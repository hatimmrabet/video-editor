# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""SRT subtitle file + full caption text.  python3 subtitles.py <workdir>
Produces: video-final.srt (YouTube reads it, Instagram accepts it on upload) and
post-caption.txt (text ready for the post caption). If config/chapters.json exists
(long-form world), also video-final.chapters.txt — the `MM:SS Title` list for the
YouTube description.
Reads build/captions.json — the same timings that were rendered onto the video, so sync is guaranteed."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import scenes as _scn   # _resolve_ref / _read_json, shared with the scene + B-roll code

W = os.path.abspath(sys.argv[1])
caps = json.load(open(os.path.join(W, "build", "captions.json"), encoding="utf-8-sig"))
cards = caps["cards"]

def ts(t):
    t = max(0.0, float(t))
    h = int(t // 3600); m = int(t % 3600 // 60); s = int(t % 60); ms = int(round((t - int(t)) * 1000))
    if ms == 1000: s += 1; ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

MAXCH = 42          # a line longer than this gets cut off on mobile
def wrap(words):
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if len(cand) > MAXCH and cur:
            lines.append(cur); cur = w
        else:
            cur = cand
    if cur: lines.append(cur)
    return lines[:2] if len(lines) <= 2 else [" ".join(lines[:-1]), lines[-1]]

srt, txt = [], []
for i, c in enumerate(cards, 1):
    words = [w["t"] for w in c["w"]]
    end = c["e"]
    if i < len(cards):                       # don't overlap the next card
        end = min(end, cards[i]["s"] - 0.02)
    if end <= c["s"]: end = c["s"] + 0.4
    srt.append(f"{i}\n{ts(c['s'])} --> {ts(end)}\n" + "\n".join(wrap(words)) + "\n")
    txt.append(" ".join(words))

sp = os.path.join(W, "video-final.srt"); tp = os.path.join(W, "post-caption.txt")
open(sp, "w", encoding="utf-8").write("\n".join(srt))
open(tp, "w", encoding="utf-8").write("\n".join(txt) + "\n")
print(f"✅ {sp}  ({len(cards)} subtitle lines)")
print(f"✅ {tp}  ({sum(len(t.split()) for t in txt)} words — ready for the post caption)")

# ── chapters (long-form) — config/chapters.json → video-final.chapters.txt ──
_chraw = _scn._read_json(os.path.join(W, "config", "chapters.json"))
if isinstance(_chraw, list) and _chraw:
    def _mmss(t):
        t = int(max(0.0, round(t)))
        h, m, s = t // 3600, t % 3600 // 60, t % 60
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
    chaps = []
    for e in _chraw:
        if not isinstance(e, dict) or not e.get("title"):
            continue
        span = _scn._resolve_ref(e.get("ref", {}), cards)
        if span is not None:
            chaps.append((span[0], str(e["title"])))
    chaps.sort()
    if chaps:
        chaps[0] = (0.0, chaps[0][1])                  # YouTube: the first chapter must start at 00:00
        lines = [f"{_mmss(t)} {title}" for t, title in chaps]
        cp = os.path.join(W, "video-final.chapters.txt")
        open(cp, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print(f"✅ {cp}  ({len(lines)} chapters — paste into the YouTube description)")
        if len(lines) < 3:
            print("   ⚠️ YouTube needs at least 3 chapters for the progress-bar markers to show")
        tight = [chaps[i][1] for i in range(1, len(chaps)) if chaps[i][0] - chaps[i - 1][0] < 10]
        if tight:
            print(f"   ⚠️ chapters under 10s apart (YouTube ignores those): {', '.join(tight)}")
