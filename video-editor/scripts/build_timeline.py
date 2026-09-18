# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Turns the two measurements into the montage: <work>/timeline.json (issue #144).

    uv run scripts/build_timeline.py <workdir> [--force]

Reads : build/silences.json (find_silences.py) · build/transcript-raw.json (transcribe.py)
        config/project.config.json (`cut` block)
Writes: <work>/timeline.json  — one entry per spoken sentence, in order

Replaces captions.py. It has no transcript-fixes.json to read: corrections are made
directly in timeline.json afterwards (SKILL.md step 5), one entry's `caption.text` at a
time, and `lib/timeline.sync_words()` re-spaces the words of whatever was reworded. The old
"one fix entry per Whisper segment or I exit" contract is gone with it.

REFUSES TO OVERWRITE an existing timeline.json without --force. Everything downstream --
the cuts, the scenes, the sound cues, the corrected text -- lives in that file; rebuilding
it from the measurements throws all of it away. This is the guard the old pipeline did not
have, and its absence is what let a re-run of captions.py resurrect deleted speech.

HOW A SENTENCE BECOMES AN ENTRY

  1. The kept speech is computed from the silences exactly the way plan_cuts.py did --
     complement, pad (asymmetric: more before than after), merge, drop the scraps. The set
     of seconds in the montage is therefore identical to the old cut-plan.json `keep`.
  2. Every point on the source timeline is claimed by exactly one sentence: claims meet at
     the midpoint between one sentence's last word and the next one's first. So no kept
     second is orphaned, and none is counted twice.
  3. entry.src = the kept speech inside that claim. A silence removed mid-sentence shows up
     as a hole between two spans of the same entry -- which is why an entry is one readable
     unit even when the montage cuts inside it.

`cut` config used here (defaults in brackets) -- the editorial half; `noiseDb`/`minSilence`
shaped the measurement and live in find_silences.py:
  padIn   [0.22]  lead-in kept before each speech run (s) -- air, so the cut is not abrupt
  padOut  [0.10]  tail kept after (s) -- short, no dead time between sentences
  merge   [0.20]  speech runs closer than this (s) are joined
"""
import json
import os
import sys

from lib import config as _cfg, timeline as tl

MIN_RUN = 0.30          # a kept speech run shorter than this is a scrap, not a sentence


def _read(W, name):
    p = os.path.join(W, "build", name)
    if not os.path.exists(p):
        sys.exit("[X] build/%s is missing - run the stage that writes it first" % name)
    with open(p, encoding="utf-8-sig") as f:
        return json.load(f)


def speech_runs(silences, duration, pad_in, pad_out, merge):
    """The kept speech, in absolute source seconds. Mirrors plan_cuts.py exactly, so the
    montage this produces is the same set of seconds the old pipeline produced."""
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


def sentence_bounds(segments):
    """(first word start, last word end) per Whisper segment, falling back to the segment's
    own start/end when it carries no word timings."""
    out = []
    for seg in segments:
        ws = seg.get("words") or []
        if ws:
            out.append((float(ws[0]["start"]), float(ws[-1]["end"])))
        else:
            out.append((float(seg.get("start", 0.0)), float(seg.get("end", 0.0))))
    return out


def claims(bounds, duration):
    """One half-open claim per sentence, meeting at the midpoint between neighbours, so
    every second of the source belongs to exactly one sentence."""
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
    cut = (_cfg.load(W).get("cut") or {})

    duration = float(sil["duration"])
    runs = speech_runs(sil.get("silences") or [], duration,
                       float(cut.get("padIn", 0.22)), float(cut.get("padOut", 0.10)),
                       float(cut.get("merge", 0.20)))

    segments = tr.get("segments") or []
    if not segments:
        sys.exit("[X] build/transcript-raw.json has no segments - nothing to build a montage from")
    bounds = sentence_bounds(segments)

    t = tl.blank({"file": sil.get("source"), "duration": round(duration, 3),
                  "language": tr.get("language"), "model": tr.get("model")})

    silent = 0
    for i, (seg, claim) in enumerate(zip(segments, claims(bounds, duration))):
        src = intersect(runs, claim)
        entry = {"id": "e%03d" % (i + 1), "src": src}
        if not src:
            entry["on"] = False
            entry["why"] = "no speech kept here"
            silent += 1

        words = []
        for w in seg.get("words") or []:
            words.append({"t": str(w.get("word", "")).strip(),
                          "src": [round(float(w["start"]), 3), round(float(w["end"]), 3)]})
        words = [w for w in words if w["t"]]
        if words:
            entry["caption"] = {"text": " ".join(w["t"] for w in words), "words": words}
        else:
            entry["caption"] = {"text": str(seg.get("text", "")).strip(), "words": []}
            tl.sync_words(entry)

        t["timeline"].append(entry)

    kept = sum(b - a for a, b in runs)
    problems = tl.validate(t)
    tl.save(W, t)

    print("source %.2fs -> %.2fs kept (%.0f%% removed)"
          % (duration, kept, (duration - kept) / duration * 100 if duration else 0))
    print("%d entries, %d source pieces, %.3fs of speech"
          % (len(t["timeline"]), len(tl.program(t)), tl.duration(t)))
    if silent:
        print("%d sentence(s) had no kept audio and start switched off" % silent)
    print("-> %s" % tl.path(W))
    for p in problems:
        print("  ! " + p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
