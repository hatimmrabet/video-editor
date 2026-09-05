# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""SRT subtitle file + full caption text.  python3 subtitles.py <workdir>
Produces: video-final.srt (YouTube reads it, Instagram accepts it on upload) and
post-caption.txt (text ready for the post caption).
Reads build/captions.json — the same timings that were rendered onto the video, so sync is guaranteed."""
import json, sys, os

W = os.path.abspath(sys.argv[1])
caps = json.load(open(os.path.join(W, "build", "captions.json")))
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
