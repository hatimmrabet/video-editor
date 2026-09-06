# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""The long-form jump-cut + filler pass.

    uv run scripts/tighten.py <work>          # propose — prints the summary, writes build/tighten-plan.json
    uv run scripts/tighten.py <work> apply    # commit — folds into build/cut-plan.json + build/captions.json

Two kinds of word-level cut, both from build/captions.json's per-word timings:

  1. inter-word gaps longer than `longform.pauseMs` (config, default 250 ms) are trimmed
     to `longform.keepMs` (default 90 ms) — a hard jump cut.
  2. filler words / short runs matching scripts/fillers.json for the project language are
     dropped.

`apply` is the same terminal mutation as edit_script.py: it does NOT re-run captions.py
afterward — rebuild the video with reframe.py. Undo restores the .bak files.

Runs after captions.py, before reframe.py. Only meaningful in the long-form world
(scripts/pipeline/long-form.json). See docs/design/long-form.md.
"""
import json
import os
import re
import shutil

_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import config as _config   # noqa: E402
from lib import timeline            # noqa: E402

W = os.path.abspath(_sys.argv[1]) if len(_sys.argv) > 1 else _sys.exit("usage: tighten.py <work> [apply]")
APPLY = len(_sys.argv) > 2 and _sys.argv[2] == "apply"
B = lambda n: os.path.join(W, "build", n)
MIN_SEG = 0.20


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
    return re.sub(r"[^\w؀-ۿ]", "", s.lower())


def filler_tokens():
    cfg = _config.load(W)
    lang = str(cfg.get("language", "en")).lower().split("-")[0]
    if not cfg.get("longform", {}).get("fillers", True):
        return lang, []
    data = load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fillers.json"))
    return lang, [f.split() for f in data.get(lang, []) if isinstance(f, str)]


def build_plan():
    cfg = _config.load(W)
    lf = cfg.get("longform", {})
    pause_ms = float(lf.get("pauseMs", 250))
    keep_ms = float(lf.get("keepMs", 90))
    caps = load(B("captions.json"))
    cards = caps["cards"]
    lang, ftoks = filler_tokens()

    flat = [(ci, wi, w["s"], w["e"], w["t"])
            for ci, c in enumerate(cards) for wi, w in enumerate(c["w"])]
    if not flat:
        _sys.exit("captions.json has no words")

    # 1) gap cuts
    gaps = []
    for k in range(len(flat) - 1):
        g = flat[k + 1][2] - flat[k][3]
        if g * 1000.0 > pause_ms:
            cs = flat[k][3] + keep_ms / 1000.0
            ce = flat[k + 1][2]
            if ce - cs > 0.02:
                gaps.append({"s": round(cs, 3), "e": round(ce, 3), "gap": round(g, 3)})

    # 2) filler cuts (single words + consecutive runs; longest match wins)
    fillers, i = [], 0
    while i < len(flat):
        best = 0
        for toks in ftoks:
            n = len(toks)
            if i + n <= len(flat) and all(_norm(flat[i + j][4]) == _norm(toks[j]) for j in range(n)):
                best = max(best, n)
        if best:
            s0 = flat[i][2]
            e0 = flat[i + best - 1][3]
            prev_e = flat[i - 1][3] if i > 0 else 0.0
            next_s = flat[i + best][2] if i + best < len(flat) else caps["total"]
            fillers.append({
                "text": " ".join(flat[i + j][4] for j in range(best)),
                "s": round(max(s0 - 0.03, prev_e), 3),
                "e": round(min(e0 + 0.03, next_s), 3),
                "ctx": " ".join(flat[j][4] for j in range(max(0, i - 3), min(len(flat), i + best + 3))),
            })
            i += best
        else:
            i += 1

    cuts = timeline.merge([[g["s"], g["e"]] for g in gaps] + [[f["s"], f["e"]] for f in fillers])
    saved = round(sum(b - a for a, b in cuts), 3)
    return {
        "before": round(caps["total"], 3),
        "after": round(caps["total"] - saved, 3),
        "saved": saved,
        "language": lang,
        "pauseMs": pause_ms, "keepMs": keep_ms,
        "gaps": gaps,
        "fillers": fillers,
        "cuts": cuts,
    }


def print_plan(p):
    print(f"tighten: {len(p['gaps'])} gap cut(s), {len(p['fillers'])} filler(s)  ·  "
          f"{p['before']:.1f}s -> {p['after']:.1f}s  (-{p['saved']:.1f}s)")
    if p["fillers"]:
        print("\nfillers (review before apply):")
        for f in p["fillers"]:
            print(f"  {f['s']:7.2f}  \"{f['text']}\"   … {f['ctx']} …")
    long_gaps = sorted(p["gaps"], key=lambda g: -g["gap"])[:8]
    if long_gaps:
        print("\nlongest gaps trimmed:")
        for g in long_gaps:
            print(f"  {g['s']:7.2f}  {g['gap']:.2f}s pause")
    print(f"\nwrote {B('tighten-plan.json')}")
    print("apply:  uv run scripts/tighten.py <work> apply")


def apply_plan(p):
    cuts = [[a, b] for a, b in p["cuts"]]
    if not cuts:
        _sys.exit("nothing to tighten — no cuts in the plan")
    shift, _ = timeline.make_shift(cuts)
    fspans = [(f["s"], f["e"]) for f in p["fillers"]]

    caps = load(B("captions.json"))

    cut = load(B("cut-plan.json"))
    cut["keep"], cut["total"] = timeline.remap_keep(cut["keep"], cuts, MIN_SEG)
    save(B("cut-plan.json"), cut)

    def is_filler(w):
        return any(fs - 1e-6 <= w["s"] and w["e"] <= fe + 1e-6 for fs, fe in fspans)

    new_cards = []
    for c in caps["cards"]:
        ws = [w for w in c["w"] if not is_filler(w)]
        ws = [{**w, "s": round(shift(w["s"]), 3), "e": round(shift(w["e"]), 3)} for w in ws]
        if ws:
            new_cards.append({"s": ws[0]["s"], "e": ws[-1]["e"], "w": ws})
    for k in range(len(new_cards) - 1):
        if new_cards[k]["e"] > new_cards[k + 1]["s"]:
            new_cards[k]["e"] = round(new_cards[k + 1]["s"] - 0.02, 3)
    new_total = round(min(caps["total"] - p["saved"], cut["total"]), 3)
    save(B("captions.json"), {"total": new_total, "cards": new_cards})

    sfxp = B("sound-cues.json")
    if os.path.exists(sfxp):
        sfx = load(sfxp)
        for k, v in list(sfx.items()):
            if isinstance(v, list):
                sfx[k] = [round(shift(t), 3) for t in v
                          if not any(a - 1e-6 <= t <= b + 1e-6 for a, b in cuts)]
        save(sfxp, sfx)

    print(f"tightened: {p['before']:.1f}s -> {new_total:.1f}s  (-{p['saved']:.1f}s, "
          f"{len(p['fillers'])} fillers, {len(p['gaps'])} gaps)")
    print(f"""
next: rebuild the video
   uv run scripts/reframe.py {W}
undo: restore build/*.bak (cut-plan.json, captions.json)""")


def main():
    if APPLY:
        pp = B("tighten-plan.json")
        p = load(pp) if os.path.exists(pp) else build_plan()
        apply_plan(p)
    else:
        p = build_plan()
        with open(B("tighten-plan.json"), "w", encoding="utf-8") as f:
            json.dump(p, f, ensure_ascii=False, indent=1)
        print_plan(p)


if __name__ == "__main__":
    main()
