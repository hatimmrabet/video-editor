# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Cut the retakes: false starts, restarts and stammers left in after the silence pass.

    uv run scripts/retakes.py <work>          # detect — prints the list, writes build/retakes.json
    uv run scripts/retakes.py <work> apply    # commit — folds into cut-plan.json + captions.json + sound-cues.json

The creator re-says a sentence several times until it comes out right. plan_cuts.py only
removes silence (a retake pause is often shorter than its threshold), and edit_script.py
only drops whole sentences — so mid-sentence retakes survive both. This is word-span
surgery, like tighten.py's filler pass, but the target is *repeated content*, not pauses.

Detected automatically (build/retakes.json, each entry has `cut: true|false` — review it):
  1. stammer   — the same short word 3+ times in a row (or 2x for a function word / filler)
  2. restart   — a run of words immediately followed by a near-repeat of itself; the first
                 run is the mistake, it is cut
  3. stall     — a lone filler word from scripts/fillers.json for the project language

Claude adds the cases only meaning catches (SKILL.md step 5): append entries to
build/retakes.json before `apply`. Set `cut: false` on anything that is real content.

`apply` is terminal (like edit_script.py apply / tighten.py apply): it does NOT re-run
captions.py. Rebuild with reframe.py afterward. Undo restores the .bak files. It does not
re-run settle_check.py either — a retake cut-in lands where the good take starts, the
speaker already mid-speech, so a fresh clean-frame pass isn't needed (issue #128).
"""
import json, os, re, shutil, difflib

_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import config as _config   # noqa: E402
from lib import timeline            # noqa: E402

W = os.path.abspath(_sys.argv[1]) if len(_sys.argv) > 1 else _sys.exit("usage: retakes.py <work> [apply]")
APPLY = len(_sys.argv) > 2 and _sys.argv[2] == "apply"
B = lambda n: os.path.join(W, "build", n)
MIN_SEG = 0.20
MAX_GAP = 1.5   # a restart follows its mistake fast — a long pause means it's a new thought


def load(p):
    with open(p, encoding="utf-8-sig") as f:
        return json.load(f)


def save(p, d):
    if os.path.exists(p):
        if not os.path.exists(p + ".orig"):
            shutil.copy(p, p + ".orig")
        shutil.copy(p, p + ".bak")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def _norm(s):
    s = re.sub(r"[ً-ْـ]", "", s)          # Arabic diacritics + tatweel
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    s = re.sub(r"[^\w؀-ۿ]", "", s.lower())
    if len(s) > 4 and s.startswith("ال"):
        s = s[2:]
    return s


def _sim(a, b):
    a = [w for w in a if w]
    b = [w for w in b if w]
    if not a or not b:
        return 0.0
    shared = len(set(a) & set(b)) / min(len(a), len(b))
    ratio = difflib.SequenceMatcher(None, " ".join(a), " ".join(b)).ratio()
    return max(shared, ratio)


def filler_set():
    cfg = _config.load(W)
    lang = str(cfg.get("language", "en")).lower().split("-")[0]
    fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fillers.json")
    data = load(fp) if os.path.exists(fp) else {}
    singles = {_norm(f) for f in data.get(lang, []) if isinstance(f, str) and " " not in f}
    return lang, singles


def detect(cards):
    flat = [{"ci": ci, "s": w["s"], "e": w["e"], "t": w["t"], "n": _norm(w["t"])}
            for ci, c in enumerate(cards) for w in c["w"]]
    lang, fillers = filler_set()
    N = len(flat)
    cand = []   # (s, e, reason, cut_default)
    used = [False] * N

    # 1) stammer — a run of the same normalized token
    i = 0
    while i < N:
        j = i
        while j + 1 < N and flat[j + 1]["n"] and flat[j + 1]["n"] == flat[i]["n"] \
                and flat[j + 1]["s"] - flat[j]["e"] < 0.7:
            j += 1
        run = j - i + 1
        if run >= 2 and flat[i]["n"]:
            short = len(flat[i]["n"]) <= 3 or flat[i]["n"] in fillers
            if run >= 3 or (run == 2 and short):
                # keep the last occurrence, cut the rest
                cand.append((flat[i]["s"], flat[j - 1]["e"], f"stammer x{run}", True))
                for k in range(i, j):
                    used[k] = True
        i = j + 1

    # 2) restart — run A immediately followed by a near-repeat run B (A is the mistake)
    i = 0
    while i < N:
        if used[i]:
            i += 1
            continue
        best = None
        for K in range(2, 8):
            if i + 2 * K > N:
                break
            A = [flat[i + x]["n"] for x in range(K)]
            B = [flat[i + K + x]["n"] for x in range(K)]
            gap = flat[i + K]["s"] - flat[i + K - 1]["e"]
            if gap > MAX_GAP:
                continue
            sim = _sim(A, B)
            # also try A vs a slightly longer restart ("we can — we can solve it")
            B2 = [flat[i + K + x]["n"] for x in range(min(K + 2, N - i - K))]
            sim = max(sim, _sim(A, B2[:K]) if len(B2) >= K else 0.0)
            if sim >= 0.72:
                best = K
        if best:
            cand.append((flat[i]["s"], flat[i + best - 1]["e"], f"restart ({best}w)", True))
            for k in range(i, i + best):
                used[k] = True
            i += best
            continue
        i += 1

    # 3) stall — a lone filler token
    for k in range(N):
        if used[k] or not flat[k]["n"]:
            continue
        if flat[k]["n"] in fillers:
            cand.append((flat[k]["s"], flat[k]["e"], "stall (filler)", True))
            used[k] = True

    cand.sort()
    out = []
    for s, e, reason, cut in cand:
        ctx = " ".join(w["t"] for w in flat if s - 2.5 <= w["s"] <= e + 2.5)
        txt = " ".join(w["t"] for w in flat if s - 1e-6 <= w["s"] and w["e"] <= e + 1e-6)
        out.append({"s": round(s, 3), "e": round(e, 3), "cut": cut,
                    "reason": reason, "text": txt, "context": ctx})
    return lang, out


def build():
    caps = load(B("captions.json"))
    lang, cuts = detect(caps["cards"])
    plan = {"_doc": "Retake cuts for retakes.py apply. `cut:false` keeps the span. Claude "
                    "appends the cases the detector misses. See scripts/retakes.py.",
            "language": lang, "cuts": cuts}
    save(B("retakes.json"), plan)
    return plan


def print_plan(p):
    on = [c for c in p["cuts"] if c["cut"]]
    print(f"retakes: {len(p['cuts'])} candidate(s), {len(on)} marked to cut  ·  language {p['language']}")
    for c in p["cuts"]:
        mark = "CUT " if c["cut"] else "keep"
        print(f"  [{mark}] {c['s']:7.2f}-{c['e']:7.2f}  {c['reason']:16s}  \"{c['text']}\"")
        print(f"         … {c['context']} …")
    print(f"\nwrote {B('retakes.json')} — edit `cut` flags / append entries, then:")
    print("apply:  uv run scripts/retakes.py <work> apply")


def apply_plan(p):
    spans = [[c["s"], c["e"]] for c in p["cuts"] if c.get("cut")]
    if not spans:
        _sys.exit("nothing marked to cut in build/retakes.json")
    cuts = timeline.merge(spans)
    saved = round(sum(b - a for a, b in cuts), 3)
    shift, _ = timeline.make_shift(cuts)

    caps = load(B("captions.json"))
    cut = load(B("cut-plan.json"))
    cut["keep"], cut["total"] = timeline.remap_keep(cut["keep"], cuts, MIN_SEG)
    # keep `settled` as-is: a retake cut-in lands where the good take starts (speaker
    # already mid-speech, camera settled), so it does not need a fresh settle pass, and
    # re-running settle_check here would re-trigger captions.py and clobber this edit.
    save(B("cut-plan.json"), cut)

    def gone(w):
        return any(a - 1e-6 <= w["s"] and w["e"] <= b + 1e-6 for a, b in cuts)

    new_cards = []
    for c in caps["cards"]:
        ws = [{**w, "s": round(shift(w["s"]), 3), "e": round(shift(w["e"]), 3)}
              for w in c["w"] if not gone(w)]
        if ws:
            new_cards.append({"s": ws[0]["s"], "e": ws[-1]["e"], "w": ws})
    for k in range(len(new_cards) - 1):
        if new_cards[k]["e"] > new_cards[k + 1]["s"]:
            new_cards[k]["e"] = round(new_cards[k + 1]["s"] - 0.02, 3)
    new_total = round(min(caps["total"] - saved, cut["total"]), 3)
    save(B("captions.json"), {"total": new_total, "cards": new_cards})

    sfxp = B("sound-cues.json")
    if os.path.exists(sfxp):
        sfx = load(sfxp)
        for k, v in list(sfx.items()):
            if isinstance(v, list):
                sfx[k] = [round(shift(t), 3) for t in v
                          if not any(a - 1e-6 <= t <= b + 1e-6 for a, b in cuts)]
        save(sfxp, sfx)

    print(f"retakes applied: -{saved:.1f}s  ({len(cuts)} span(s))  ·  {caps['total']:.1f}s -> {new_total:.1f}s")
    print(f"""
next: rebuild the video
   uv run scripts/reframe.py {W}
undo: restore build/*.bak (cut-plan.json, captions.json, sound-cues.json)""")


def main():
    if APPLY:
        pp = B("retakes.json")
        p = load(pp) if os.path.exists(pp) else build()
        apply_plan(p)
    else:
        print_plan(build())


if __name__ == "__main__":
    main()
