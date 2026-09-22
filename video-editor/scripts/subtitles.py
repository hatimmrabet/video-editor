# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""SRT subtitle file + full caption text + chapter list.

    uv run scripts/subtitles.py <work>

Reads : <work>/timeline.json — the same entries that were rendered onto the video, so sync
        is guaranteed by construction rather than by keeping two files in step
Writes: <work>/video-final.srt        YouTube reads it, Instagram accepts it on upload
        <work>/post-caption.txt       the spoken text, ready to paste as the post caption
        <work>/video-final.chapters.txt   when the timeline carries `chapters`

Chapters are `[{"at": "e014", "title": "..."}]` — anchored on an ENTRY ID, not a second and
not a sentence index, so cutting a sentence elsewhere can never move or drop one.
"""
import os
import sys

from lib import timeline as tl

MAXCH = 42          # a line longer than this gets cut off on mobile


def ts(t):
    t = max(0.0, float(t))
    h, m, s = int(t // 3600), int(t % 3600 // 60), int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms == 1000:
        s += 1
        ms = 0
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


def mmss(t):
    t = int(max(0.0, round(t)))
    h, m, s = t // 3600, t % 3600 // 60, t % 60
    return "%d:%02d:%02d" % (h, m, s) if h else "%02d:%02d" % (m, s)


def wrap(words):
    """At most two lines, the break chosen so neither overruns a phone's width."""
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if len(cand) > MAXCH and cur:
            lines.append(cur)
            cur = w
        else:
            cur = cand
    if cur:
        lines.append(cur)
    return lines[:2] if len(lines) <= 2 else [" ".join(lines[:-1]), lines[-1]]


def main(argv):
    work = os.path.abspath(argv[1])
    t = tl.load(work)

    cards = []
    for e in tl.entries(t):
        ws = tl.words(t, e)
        if not ws:
            continue
        cards.append({"s": ws[0]["s"], "e": ws[-1]["e"], "w": [w["t"] for w in ws]})

    if not cards:
        sys.exit("[X] the timeline has no captioned sentences - nothing to write")

    srt, txt = [], []
    for i, c in enumerate(cards, 1):
        end = c["e"]
        if i < len(cards):                      # never overlap the next subtitle
            end = min(end, cards[i]["s"] - 0.02)
        if end <= c["s"]:
            end = c["s"] + 0.4
        srt.append("%d\n%s --> %s\n%s\n" % (i, ts(c["s"]), ts(end), "\n".join(wrap(c["w"]))))
        txt.append(" ".join(c["w"]))

    sp = os.path.join(work, "video-final.srt")
    tp = os.path.join(work, "post-caption.txt")
    with open(sp, "w", encoding="utf-8") as f:
        f.write("\n".join(srt))
    with open(tp, "w", encoding="utf-8") as f:
        f.write("\n".join(txt) + "\n")
    print("[ok] %s  (%d subtitle lines)" % (sp, len(cards)))
    print("[ok] %s  (%d words - ready for the post caption)"
          % (tp, sum(len(x.split()) for x in txt)))

    chaps = []
    for c in t.get("chapters") or []:
        title = str(c.get("title") or "").strip()
        at = tl.out_start(t, c.get("at"))
        if title and at is not None:
            chaps.append((at, title))
    if not chaps:
        return 0

    chaps.sort()
    chaps[0] = (0.0, chaps[0][1])               # YouTube: the first chapter must start at 00:00
    cp = os.path.join(work, "video-final.chapters.txt")
    with open(cp, "w", encoding="utf-8") as f:
        f.write("\n".join("%s %s" % (mmss(x), title) for x, title in chaps) + "\n")
    print("[ok] %s  (%d chapters - paste into the YouTube description)" % (cp, len(chaps)))
    if len(chaps) < 3:
        print("   ! YouTube needs at least 3 chapters for the progress-bar markers to show")
    tight = [chaps[i][1] for i in range(1, len(chaps)) if chaps[i][0] - chaps[i - 1][0] < 10]
    if tight:
        print("   ! chapters under 10s apart (YouTube ignores those): %s" % ", ".join(tight))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
