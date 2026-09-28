# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Turns the two measurements into the montage: <work>/timeline.json.

    uv run scripts/build_timeline.py <workdir> [--force]

Reads : build/silences.json (find_silences.py) · build/transcript-raw.json (transcribe.py)
        config/project.config.json (`cut` block)
Writes: <work>/timeline.json  — one segment per spoken sentence, in order

Corrections are made directly in timeline.json afterwards (SKILL.md step 5), one segment's
`text` at a time — reword it and `words()` (lib/timeline.py) realigns automatically, computed
fresh every time it is read, never stored.

REFUSES TO OVERWRITE an existing timeline.json without --force. Everything downstream --
the cuts, the scenes, the sound cues, the corrected text -- lives in that file; rebuilding
it from the measurements throws all of it away.

HOW A SENTENCE BECOMES A SEGMENT

  1. The kept speech is computed from the silences: complement, pad (asymmetric: more
     before than after), merge, drop the scraps.
  2. Whisper's words (all segments, in order) are split into SENTENCE-SIZED groups: first at
     sentence-ending punctuation (`.`/`?`/`!`/`؟`); a group that is still longer than
     `cut.maxSegment` (default 8.0s) is split further at the measured silences inside it,
     greedily choosing the latest one that keeps each piece under the cap (a stretch of
     speech with no pause long enough is left as one segment — there is nowhere to cut it
     that would not land mid-word). A raw Whisper segment boundary is not itself a sentence
     boundary: the darija fine-tune returns long, paragraph-sized chunks.
  3. Every point on the source timeline is claimed by exactly one group: claims meet at the
     midpoint between one group's last word and the next one's first. So no kept second is
     orphaned, and none is counted twice.
  4. segment.source = the kept speech inside that claim, formatted as a readable range (or a
     list of them, when a silence removed mid-group leaves a hole — the segment stays one
     readable unit even though the montage cuts inside it).
"""
import json
import os
import re
import sys

from lib import config as _cfg, timeline as tl

MIN_RUN = 0.30          # a kept speech run shorter than this is a scrap, not a sentence
DEFAULT_CAP = 8.0        # a sentence-sized group longer than this gets split at a silence
SENTENCE_END = re.compile(r"[.?!؟]\s*$")


def _read(W, name):
    p = os.path.join(W, "build", name)
    if not os.path.exists(p):
        sys.exit("[X] build/%s is missing - run the stage that writes it first" % name)
    with open(p, encoding="utf-8-sig") as f:
        return json.load(f)


def speech_runs(silences, duration, pad_in, pad_out, merge):
    """The kept speech, in absolute source seconds: complement the silences, pad, merge
    runs closer than `merge` seconds apart, drop anything shorter than MIN_RUN."""
    runs, cur = [], 0.0
    for a, b in silences:
        if a - cur > 0.01:
            runs.append([cur, a])
        cur = b
    if duration - cur > 0.01:
        runs.append([cur, duration])

    runs = [[max(0.0, a - pad_in), min(duration, b + pad_out)] for a, b in runs]
    out = []
    for r in runs:
        if out and r[0] - out[-1][1] < merge:
            out[-1][1] = r[1]
        else:
            out.append(r)
    return [r for r in out if r[1] - r[0] >= MIN_RUN]


def _words(segments):
    """Every Whisper word, across every raw segment, in order — {word, start, end}."""
    out = []
    for seg in segments:
        out += seg.get("words") or []
    return out


def sentence_groups(all_words):
    """Every word split into sentence-sized groups, first at sentence-ending punctuation —
    a raw Whisper segment boundary is not itself a sentence boundary."""
    groups, cur = [], []
    for w in all_words:
        cur.append(w)
        if SENTENCE_END.search(str(w.get("word", ""))):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    return [g for g in groups if g]


def _choose_cuts(start, end, candidates, cap):
    """Which of the (ascending) candidate times to cut at, greedily preferring the latest
    one that still keeps every piece under `cap` — the same idea as a text-wrap algorithm.
    A gap with no candidate close enough is left over-cap: there is nothing to cut on."""
    cuts, piece_start, last_fit = [], start, None
    for c in candidates:
        if c - piece_start > cap:
            if last_fit is not None:
                cuts.append(last_fit)
                piece_start, last_fit = last_fit, None
                if c - piece_start > cap:
                    cuts.append(c)
                    piece_start = c
                else:
                    last_fit = c
            else:
                cuts.append(c)
                piece_start = c
        else:
            last_fit = c
    # the tail past the last cut: a still-pending candidate that was never "closed out" by a
    # later over-cap one (the group simply ended) is otherwise silently lost, even when using
    # it would have kept the last piece under cap.
    if last_fit is not None and end - piece_start > cap:
        cuts.append(last_fit)
    return cuts


def split_long_groups(groups, silences, cap):
    """A group longer than `cap` seconds is split at the measured silences fully inside it.
    See the module docstring for the algorithm."""
    out = []
    for g in groups:
        start, end = float(g[0]["start"]), float(g[-1]["end"])
        if end - start <= cap:
            out.append(g)
            continue
        candidates = sorted((a + b) / 2 for a, b in silences if start < a and b < end)
        cuts = _choose_cuts(start, end, candidates, cap)
        if not cuts:
            out.append(g)
            continue
        piece, ci = [], 0
        for w in g:
            if ci < len(cuts) and float(w["start"]) >= cuts[ci]:
                out.append(piece)
                piece = []
                ci += 1
            piece.append(w)
        out.append(piece)
    return [p for p in out if p]


def claims(bounds, duration):
    """One half-open claim per group, meeting at the midpoint between neighbours, so every
    second of the source belongs to exactly one group."""
    out = []
    for i, (lo, hi) in enumerate(bounds):
        a = 0.0 if i == 0 else (bounds[i - 1][1] + lo) / 2.0
        b = duration if i == len(bounds) - 1 else (hi + bounds[i + 1][0]) / 2.0
        out.append([a, max(a, b)])
    return out


def intersect(runs, claim):
    lo, hi = claim
    out = []
    for a, b in runs:
        x, y = max(a, lo), min(b, hi)
        if y - x > 0.001:
            out.append([round(x, 3), round(y, 3)])
    return out


def main(argv):
    W = os.path.abspath(argv[1])
    force = "--force" in argv[2:]

    if os.path.exists(tl.path(W)) and not force:
        sys.exit("[X] %s already exists. Rebuilding it discards every cut, correction, scene\n"
                 "    and sound cue in it. Pass --force only if that is what you want."
                 % tl.NAME)

    sil = _read(W, "silences.json")
    tr = _read(W, "transcript-raw.json")
    cfg = _cfg.load(W)
    cut = cfg.get("cut") or {}
    cap = float(cut.get("maxSegment", DEFAULT_CAP))

    duration = float(sil["duration"])
    runs = speech_runs(sil.get("silences") or [], duration,
                       float(cut.get("padIn", 0.22)), float(cut.get("padOut", 0.10)),
                       float(cut.get("merge", 0.20)))

    all_words = _words(tr.get("segments") or [])
    if not all_words:
        sys.exit("[X] build/transcript-raw.json has no words - nothing to build a montage from")
    groups = split_long_groups(sentence_groups(all_words), sil.get("silences") or [], cap)
    bounds = [(float(g[0]["start"]), float(g[-1]["end"])) for g in groups]

    t = tl.blank({"file": sil.get("source"), "duration": round(duration, 3),
                  "language": tr.get("language"), "model": tr.get("model")})

    silent = 0
    for group, claim in zip(groups, claims(bounds, duration)):
        source = intersect(runs, claim)
        text = " ".join(str(w.get("word", "")).strip() for w in group).strip()
        seg = {"source": source, "text": text}
        if not source:
            seg["on"] = False
            seg["why"] = "no speech kept here"
            silent += 1
        t["segments"].append(seg)

    kept = sum(b - a for a, b in runs)
    problems = tl.validate(t)
    tl.save(W, t)

    over = sum(1 for g in groups if float(g[-1]["end"]) - float(g[0]["start"]) > cap)
    print("source %.2fs -> %.2fs kept (%.0f%% removed)"
          % (duration, kept, (duration - kept) / duration * 100 if duration else 0))
    print("%d segment(s), %d source piece(s), %.3fs of speech  (longest %.1fs, %d over the %.1fs cap)"
          % (len(t["segments"]), len(tl.program(t)), tl.duration(t),
             max((b - a for a, b in bounds), default=0.0), over, cap))
    if silent:
        print("%d segment(s) had no kept audio and start switched off" % silent)
    print("-> %s" % tl.path(W))
    for p in problems:
        print("  ! " + p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
