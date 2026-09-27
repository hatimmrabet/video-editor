# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""The jump-cut + filler pass, on <work>/timeline.json.

    uv run scripts/tighten.py <work>          # propose - prints what it would cut
    uv run scripts/tighten.py <work> apply    # commit

Two kinds of word-level cut, both read off each segment's own word timings (`tl.words()`,
computed fresh from `text` — see lib/timeline.py):

  1. a silence longer than `tighten.pauseMs` (config, default 250 ms) is trimmed back to
     `tighten.keepMs` (default 90 ms) - a hard jump cut. Silences considered: between two
     words of a sentence, and the air at either end of one.
  2. filler words and short filler runs matching scripts/fillers.json for the project
     language are dropped, word and audio together — removed straight from `text`.

SAFE TO RE-RUN. `apply` measures and cuts in one pass, always against the CURRENT
timeline — there is no cached plan that could go stale. Running it twice finds no gap over
the threshold the second time, so it is a no-op rather than a second cut.

Each cut edits one segment's `source` and, for a filler, drops that word from its `text`.
Nothing outside the segment is touched, because nothing outside it stores an output time.
"""
import json
import os
import re
import sys

from lib import config as _config, timeline as tl

MIN_PIECE = 0.05          # a scrap of video shorter than this is not worth keeping


def norm(s):
    return re.sub(r"[^\w؀-ۿ]", "", s.lower())


def filler_tokens(work):
    """The filler list for the project language, from scripts/fillers.json."""
    cfg = _config.load(work)
    lang = str(cfg.get("language", "en")).lower().split("-")[0]
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fillers.json")
    try:
        with open(path, encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception:
        return lang, []
    raw = data.get(lang) or data.get(lang.split("_")[0]) or []
    return lang, [[norm(x) for x in str(p).split()] for p in raw if str(p).strip()]


def plan_segment(seg, words, fillers, pause, keep):
    """What to cut from one segment: (spans to remove, filler words found, gaps found).
    `words` is `tl.words(t, seg)`, computed ONCE by the caller and reused — recomputing it
    after `tl.subtract()` has already shrunk `source` would realign against the wrong
    (already-cut) spans and silently stop finding the very fillers just detected.

    Silences are measured between the segment's own word timings, so a sentence that
    already reads tight yields nothing — which is what makes a second run a no-op."""
    spans, found, gaps = [], [], []
    src = tl.span_list(seg)
    if not src:
        return spans, found, gaps

    # --- filler words and runs, longest match first
    flat = [(w, norm(w["t"])) for w in words]
    i = 0
    while i < len(flat):
        best = 0
        for phrase in fillers:
            n = len(phrase)
            if n and i + n <= len(flat) and [flat[i + j][1] for j in range(n)] == phrase:
                best = max(best, n)
        if best:
            a = flat[i][0]["src"][0]
            b = flat[i + best - 1][0]["src"][1]
            found.append({"text": " ".join(flat[i + j][0]["t"] for j in range(best)),
                          "src": [a, b],
                          "ctx": " ".join(flat[j][0]["t"]
                                          for j in range(max(0, i - 3), min(len(flat), i + best + 3)))})
            spans.append([a, b])
            i += best
        else:
            i += 1

    # --- silences: the air before the first word, between words, and after the last
    lo, hi = src[0][0], src[-1][1]
    points = [(lo, lo)] + [(w["src"][0], w["src"][1]) for w in words] + [(hi, hi)]
    for (_, prev_end), (next_start, _) in zip(points, points[1:]):
        # Measured in OUTPUT seconds, not source seconds: what matters is the pause the
        # viewer hears. A pause trimmed by an earlier run reads as the ~90 ms that was
        # kept, so it is not cut again — this is what makes `apply` safe to re-run.
        gap = tl.elapsed(seg, next_start) - tl.elapsed(seg, prev_end)
        if gap > pause:
            start = tl.unproject_rel(seg, tl.elapsed(seg, prev_end) + keep)
            cut = [round(start, 3), round(next_start, 3)]
            if cut[1] - cut[0] > 0.01:
                spans.append(cut)
                gaps.append({"src": cut, "gap": round(gap, 3)})

    return spans, found, gaps


def drop_fillers(seg, words, found):
    """Rebuild `text` without the tokens `found` flagged (from the SAME `words` snapshot
    `plan_segment` found them in), keeping every surviving `*hot*` marker exactly where it
    was."""
    gone = {tuple(f["src"]) for f in found}
    kept = [w for w in words if tuple(w["src"]) not in gone]
    seg["text"] = " ".join(("*%s*" % w["t"]) if w["hot"] else w["t"] for w in kept)


def main(argv):
    work = os.path.abspath(argv[1])
    apply = len(argv) > 2 and argv[2] == "apply"

    t = tl.load(work)
    cfg = (_config.load(work).get("tighten") or {})
    pause = float(cfg.get("pauseMs", 250)) / 1000.0
    keep = float(cfg.get("keepMs", 90)) / 1000.0
    lang, fillers = filler_tokens(work)

    before = tl.duration(t)
    all_fillers, all_gaps, saved = [], [], 0.0

    for seg in tl.segments(t):
        line = tl.line_of(t, seg)
        words = tl.words(t, seg)
        spans, found, gaps = plan_segment(seg, words, fillers, pause, keep)
        if not spans:
            continue
        all_fillers += [dict(f, line=line) for f in found]
        all_gaps += [dict(g, line=line) for g in gaps]
        if apply:
            if found:
                drop_fillers(seg, words, found)
            saved += tl.subtract(seg, spans, MIN_PIECE)
        else:
            saved += sum(b - a for a, b in spans)

    print("tighten (%s): %d gap cut(s), %d filler(s)  -  %.1fs -> %.1fs  (-%.1fs)"
          % (lang, len(all_gaps), len(all_fillers), before, before - saved, saved))

    if all_fillers:
        print("\nfillers:")
        for f in all_fillers[:40]:
            print("  line %d  \"%s\"   ... %s ..." % (f["line"], f["text"], f["ctx"]))
        if len(all_fillers) > 40:
            print("  ... and %d more" % (len(all_fillers) - 40))
    if all_gaps:
        print("\nlongest pauses trimmed:")
        for g in sorted(all_gaps, key=lambda x: -x["gap"])[:8]:
            print("  line %d  %.2fs pause" % (g["line"], g["gap"]))

    if not apply:
        if all_gaps or all_fillers:
            print("\napply:  uv run scripts/tighten.py <work> apply")
        return 0

    if not (all_gaps or all_fillers):
        print("nothing to tighten - the timeline is already tight")
        return 0

    problems = tl.validate(t)
    tl.save(work, t)
    print("\n%.1fs -> %.1fs. Rebuild:  bash scripts/remotion/remotion.sh %s render"
          % (before, tl.duration(t), work))
    for p in problems:
        print("  ! " + p)
    return 1 if problems else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: tighten.py <work> [apply]")
    sys.exit(main(sys.argv))
