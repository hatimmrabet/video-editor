# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Cut the retakes Claude found — false starts, stammers, repeated attempts at the same idea.

    uv run scripts/retakes.py <work> apply

Reads : <work>/build/retake-cuts.json = {"cuts": [{"s":.., "e":.., "text":"...", "reason":"..."}]}
        (time spans on captions.json's own timeline)
Writes: build/cut-plan.json · build/captions.json · build/sound-cues.json — all shifted in sync

There is no detection here. Claude reads build/captions.json itself (SKILL.md step 6),
decides which passages are repeated/abandoned attempts at the same idea — keeping the LAST
attempt as the real source of what gets shown — and writes retake-cuts.json directly, no
algorithm guessing at word-run patterns. This script does the one fiddly, error-prone part
only: removing a span from the timeline without breaking sync between the video, the
captions and the sound cues. That's lib/timeline.py — the same math edit_script.py and
tighten.py already share, not reinvented here.

Prints one line per cut with its text — that line IS the recap. Nothing is shown to the
user before applying (SKILL.md step 6: Claude decides, applies, then reports).

Terminal, like edit_script.py apply / tighten.py apply: does NOT re-run captions.py.
Rebuild with reframe.py afterward. Undo restores the .bak files.
"""
import json, os, shutil

_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import timeline   # noqa: E402

if len(_sys.argv) < 3 or _sys.argv[2] != "apply":
    _sys.exit("usage: retakes.py <work> apply")
W = os.path.abspath(_sys.argv[1])
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


def apply_cuts(entries):
    spans = [[e["s"], e["e"]] for e in entries]
    if not spans:
        _sys.exit("build/retake-cuts.json has no cuts")
    cuts = timeline.merge(spans)
    saved = round(sum(b - a for a, b in cuts), 3)
    shift, _ = timeline.make_shift(cuts)

    caps = load(B("captions.json"))
    cut = load(B("cut-plan.json"))
    cut["keep"], cut["total"] = timeline.remap_keep(cut["keep"], cuts, MIN_SEG)
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

    print(f"retakes: {len(entries)} passage(s) removed  ·  -{saved:.1f}s  ·  "
          f"{caps['total']:.1f}s -> {new_total:.1f}s\n")
    for e in sorted(entries, key=lambda x: x["s"]):
        print(f"  {e['s']:7.2f}-{e['e']:7.2f}  {e.get('reason', 'repeat')}")
        if e.get("text"):
            print(f"           \"{e['text']}\"")
    print(f"""
next: rebuild the video
   uv run scripts/reframe.py {W}
undo: restore build/*.bak (cut-plan.json, captions.json, sound-cues.json)""")


def main():
    p = B("retake-cuts.json")
    if not os.path.exists(p):
        _sys.exit(f"❌ {p} not found — Claude writes it itself after reading "
                  "build/captions.json (SKILL.md step 6); nothing generates it automatically")
    apply_cuts(load(p)["cuts"])


if __name__ == "__main__":
    main()
