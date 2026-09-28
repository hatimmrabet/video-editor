# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""<work>/timeline.json — the montage, and the only state the pipeline keeps.

Read top to bottom, it IS the script of the finished video: an ORDERED LIST OF SEGMENTS, one
per spoken sentence (~180 for a 10-minute recording). Open a segment and you know everything
on screen and everything audible for that stretch: no id to look up, no second file to
cross-reference.

    { "segments": [
      { "source": "0:00.6-0:06.0", "text": "..." },
      { "source": "0:06.0-0:10.5", "text": "the *third* word is highlighted",
        "layout": "SPLIT", "scene": { "type": "CHECKLIST", "items": ["a", "b"] } }
    ] }

THE RULE ABOUT TIME:

  `source`   measured off the recording -> ABSOLUTE SOURCE TIME, never moves. A readable
             range ("M:SS.s-M:SS.s") or a list of them when the segment has a hole inside it
             (a silence already removed). Kept in memory as [[a, b], ...] float pairs.
  output time  NEVER STORED — it is the running sum of the active segments' own durations.

So NOTHING EVER SHIFTS ANYTHING. Cutting is one of exactly two edits:
  - drop time from a segment: edit its `source` (tighten.py, settle_cuts.py)
  - drop the whole segment:   set `on: false` (cut_entries.py) — reversible, never destructive

THERE ARE NO IDS. A tool that needs to name one segment (`cut_entries.py`) addresses it by its
LINE NUMBER — its position in the file, exactly as `cut_entries.py show` prints it. A line
number never changes because something ELSEWHERE was cut (cutting only flips `on`); it does
shift if a segment is ever split into two, which is why a splitting tool always ends by
printing the file's new numbering.

WORD TIMINGS ARE NEVER STORED, so they can never disagree with `text`. `lib.timeline.words()`
computes them fresh every time: it aligns `text`'s own tokens against the real Whisper words
that fall inside the segment's `source` ranges (build/transcript-raw.json, read once per
process and cached) — a token that survived a rewording keeps its real timing; only a token
that actually changed gets an interpolated one, spread across the real time left after its
matched neighbours. `*word*` (or `*several words*`) in `text` marks the hot span held in the
accent pill when spoken; `*word:drop*` (`drop`/`shake`/`pulse`/`type` — `_WORD_FX`) also gives
it that entrance choreography. Both survive a rewording because they are just part of the text.

SHAPE

  {"version": 2,
   "source":     {"file","width","height","duration"},
   "segments":   [SEGMENT, ...],                # in order
   "outro":      {"seconds","line","recap","cta_top","tail"},
   "checkpoints":{"transcript-fix": true, "cut-review": true, ...}}  # see mark_checkpoint.py

  SEGMENT = {"source": "0:00.6-0:06.0",          # or a list of ranges; [] = no speech kept
             "text":   "...",                    # `*word*` marks it hot; edit this to reword
             "on":     false,                     # cut, still readable; omitted means true
             "why":    "...",                     # why it was cut
             "layout": "SPLIT",                   # a keyword, or {type, ...params}
             "filter": "BLACK_AND_WHITE",          # likewise
             "transition": "WIPE",                 # the change INTO this segment
             "zoom": 1.06, "anchor": [0.5, 0.3],    # crop inside the source frame
             "scene":  {"type","params","timing"},  # timing: {in, out} enter/exit tuning only
             "sfx":    ["WHOOSH_UP"],                # cues, all at the segment's own start
             "overlay":[{"src","pos","scale"}],       # a logo/badge, as long as the segment
             "chapter":"..."}                          # this segment starts a chapter

Everything but `source` and `text` is optional. `layout`/`filter`/`transition`/`scene.type`/
`sfx[]` are UPPERCASE keywords, defined in code — this module knows none of them; see
scripts/remotion/template/src/{layouts,transitions,scenes,filters}/ and scripts/sounds/.

WHAT LIVES ELSEWHERE, AND WHY THAT IS STILL ONE SOURCE OF TRUTH

  config/project.config.json  the SETTINGS (language, model, cut thresholds, theme).
                              Inputs to the tools. Changed once per project.
  build/source-joined.mp4     \\  MEASUREMENTS, not state. Nothing ever rewrites them, so
  build/silences.json          } nothing can diverge, and the timeline can always be
  build/transcript-raw.json   /  rebuilt from them. Also where words() reads real timings.

"Single source of truth" is about DECISIONS. timeline.json owns every decision.
It sits at the work root, not under build/: build/ is disposable, the timeline is the project.

USING IT

    from lib import timeline as tl
    t = tl.load(work)
    for seg in tl.segments(t):
        ...
    for piece in tl.program(t):        # the render program, in output order
        ...                            # piece = {"line","src":[a,b],"out":[x,y]}
    tl.duration(t)                     # total speech seconds, outro excluded
"""
import difflib
import json
import os
import re

VERSION = 2
NAME = "timeline.json"

_DOC = ("The montage, and the only state this pipeline keeps. An ordered list of segments, "
        "read top to bottom, one per spoken sentence. `source` is absolute recording time and "
        "is the authority; output time is NEVER stored - it is the running sum of the active "
        "segments. Cutting is either editing a segment's `source` or setting `on:false`. "
        "Nothing else ever moves. Word timings are computed from `text` + build/"
        "transcript-raw.json, never stored. See scripts/lib/timeline.py.")

_TIME = re.compile(r"^\s*(\d+):(\d+(?:\.\d+)?)\s*$")
_HOT = re.compile(r"\*(.+?)\*")
# Captions.tsx's per-word choreography — must match the keys that file's wordFX() answers to.
_WORD_FX = frozenset(("drop", "shake", "pulse", "type"))

SEGMENT_KEYS = ("source", "text", "on", "why", "layout", "filter", "transition",
                "zoom", "anchor", "scene", "sfx", "overlay", "chapter")
TOP_KEYS = ("_doc", "version", "source", "segments", "outro", "checkpoints")


# --- readable time <-> seconds -----------------------------------------------------

def _parse_time(s):
    m = _TIME.match(s)
    if not m:
        raise ValueError("bad time %r - expected M:SS or M:SS.sss" % s)
    return int(m.group(1)) * 60 + float(m.group(2))


def _parse_range(s):
    a, b = s.split("-")
    return [round(_parse_time(a), 3), round(_parse_time(b), 3)]


def fmt_time(t):
    """Seconds -> `M:SS.s`, trimmed to the precision actually needed (never fewer than 1
    decimal, so it always reads as seconds, not an integer count)."""
    t = max(0.0, round(float(t), 3))
    m, s = divmod(t, 60)
    frac = ("%06.3f" % s).rstrip("0").rstrip(".")
    if "." not in frac:
        frac += ".0"
    return "%d:%s" % (int(m), frac)


def _fmt_range(a, b):
    return "%s-%s" % (fmt_time(a), fmt_time(b))


def _parse_source(raw):
    """A segment's `source` as written (a bare range, or a list of them) -> [[a, b], ...]
    float pairs, always a list, possibly empty."""
    if raw is None:
        return []
    items = [raw] if isinstance(raw, str) else raw
    return [_parse_range(x) for x in items]


def _fmt_source(spans):
    """The inverse of `_parse_source`: one range writes as a bare string (the common case);
    zero or several write as a list, so a reader is never in doubt about the shape."""
    if len(spans) == 1:
        return _fmt_range(*spans[0])
    return [_fmt_range(a, b) for a, b in spans]


def _strip_hot(text):
    """`text` with `*word*` / `*several words*` markers -> (plain tokens, the set of token
    indices that were marked hot, {index: effect name} for the ones that also named one of
    `_WORD_FX`). `*word:drop*` marks a span hot AND gives it that choreography in
    Captions.tsx; a trailing `:something` that is not one of `_WORD_FX`'s names is left as
    literal text instead, so an ordinary colon inside a marked span (`*الشروط: أولا*`, say)
    is never misread as an effect tag. The markers are never stored anywhere else."""
    tokens, hot, fx, pos = [], set(), {}, 0
    for m in _HOT.finditer(text or ""):
        tokens += text[pos:m.start()].split()
        inner, effect = m.group(1), None
        if ":" in inner:
            head, _, tail = inner.rpartition(":")
            if head and tail in _WORD_FX:
                inner, effect = head, tail
        span = inner.split()
        idxs = range(len(tokens), len(tokens) + len(span))
        hot |= set(idxs)
        if effect:
            fx.update({i: effect for i in idxs})
        tokens += span
        pos = m.end()
    tokens += (text or "")[pos:].split()
    return tokens, hot, fx


def path(work):
    return os.path.join(os.path.abspath(work), NAME)


def blank(source=None):
    """An empty timeline — what build_timeline.py starts from."""
    return {"_doc": _DOC, "version": VERSION, "source": source or {},
            "segments": [], "outro": {}, "checkpoints": {}}


def load(work):
    # utf-8-sig: tolerate a BOM if the file was saved from a Windows editor
    with open(path(work), encoding="utf-8-sig") as f:
        raw = json.load(f)
    t = dict(raw)
    t["segments"] = [dict(s, source=_parse_source(s.get("source"))) for s in raw.get("segments", [])]
    t["_work"] = os.path.abspath(work)   # for words()'s lazy read of the raw transcript
    return t


def _fmt_segment(seg):
    body = {k: v for k, v in seg.items() if v is not None and k != "source"}
    if body.get("on") is True:
        del body["on"]
    body["source"] = _fmt_source(seg.get("source") or [])
    ordered = {k: body[k] for k in SEGMENT_KEYS if k in body}
    ordered.update({k: v for k, v in body.items() if k not in ordered})
    return ordered


def save(work, t):
    """Write it back, `_doc` and `version` restated so the file always documents itself."""
    body = {k: v for k, v in t.items() if k not in ("_work", "_raw")}
    body["_doc"] = _DOC
    body["version"] = VERSION
    body["segments"] = [_fmt_segment(s) for s in body.get("segments") or []]
    ordered = {k: body[k] for k in TOP_KEYS if k in body}
    ordered.update({k: v for k, v in body.items() if k not in ordered})
    with open(path(work), "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=1)
        f.write("\n")


# --- the segments ------------------------------------------------------------------

def is_on(seg):
    """A segment counts unless it was explicitly switched off. A cut segment stays in the
    file — readable, with its `why` — so undo is a flag flip, not a restore."""
    return seg.get("on", True) is not False


def segments(t, every=False):
    """The active segments, in order. `every=True` includes the cut ones."""
    return [s for s in t.get("segments", []) if every or is_on(s)]


def by_line(t, n):
    """The segment at 1-based line `n` — its position in the file, exactly as `show` prints
    it — or None if out of range. Every segment counts, on or off: a cut segment keeps its
    line number, since cutting only flips `on` and never removes or reorders anything."""
    segs = t.get("segments") or []
    return segs[n - 1] if isinstance(n, int) and 1 <= n <= len(segs) else None


def line_of(t, seg):
    """The 1-based line of `seg` — the inverse of `by_line`, comparing by identity since
    there are no ids. None if `seg` is not (any longer) part of this timeline."""
    for i, s in enumerate(t.get("segments") or [], 1):
        if s is seg:
            return i
    return None


# --- checkpoints -------------------------------------------------------------------

def checkpoint_done(t, name):
    """Whether `name` (a pipeline stage id) was explicitly marked addressed."""
    return bool((t.get("checkpoints") or {}).get(name))


def mark_checkpoint(work, name):
    """Record that stage `name` was addressed. Idempotent; used by mark_checkpoint.py."""
    t = load(work)
    cps = dict(t.get("checkpoints") or {})
    cps[name] = True
    t["checkpoints"] = cps
    save(work, t)


def span_list(seg):
    """`source` as kept ranges, dropping the empty ones."""
    return [[a, b] for a, b in (seg.get("source") or []) if b > a]


def entry_duration(seg):
    """How long this segment lasts on screen: the sum of its source spans. The holes
    between them (removed silences) cost nothing — that is the whole point."""
    return sum(b - a for a, b in span_list(seg))


def duration(t):
    """Total speech duration of the montage. The outro is not part of it."""
    return sum(entry_duration(s) for s in segments(t))


def out_start(t, seg):
    """Where this segment starts in the finished video, or None if it is switched off or
    not part of `t`."""
    if not is_on(seg):
        return None
    acc = 0.0
    for s in segments(t):
        if s is seg:
            return acc
        acc += entry_duration(s)
    return None


# --- projection: source or entry time -> output time ------------------------------

def elapsed(seg, t_src):
    """How many seconds of this segment the viewer has seen by source time `t_src`.

    Segment-local, so it answers the question that matters when deciding whether a pause is
    too long: the gap the VIEWER hears between two words, not the gap in the recording. A
    pause already trimmed shows up here as the ~90 ms that was kept, which is why the
    tighten pass is a no-op the second time it runs.

    A time landing in a hole — a silence already removed — reports the near edge, so a word
    never counts material that is gone."""
    t_src = float(t_src)
    acc = 0.0
    for a, b in span_list(seg):
        if t_src < a:           # before this span: in a hole, or before the segment
            return acc
        if t_src <= b:
            return acc + (t_src - a)
        acc += b - a
    return acc                  # past the last span


def project_src(t, seg, t_src):
    """An absolute source time (a raw word's own timing) -> output time."""
    start = out_start(t, seg)
    return None if start is None else start + elapsed(seg, t_src)


def unproject_rel(seg, t_rel):
    """The inverse: segment-relative output seconds -> absolute source time.

    Needed whenever something is authored against what the viewer sees and has to be
    written back as source time — filling an interpolated word's time in `words()` is the
    reason it exists.

    At a seam (where a removed silence was) two source times map to the same output
    instant, so this has to pick one: it returns the END of the earlier span, never a time
    inside the hole. project_src(t, seg, unproject_rel(seg, x)) == out_start(t, seg) + x."""
    spans = span_list(seg)
    if not spans:
        return None
    t_rel = max(0.0, float(t_rel))
    acc = 0.0
    for a, b in spans:
        if t_rel <= acc + (b - a):
            return a + (t_rel - acc)
        acc += b - a
    return spans[-1][1]


def program(t):
    """THE RENDER PROGRAM: every surviving piece of source, in output order.

    This is what a renderer consumes — one <Sequence> per item. Output times are computed
    here and nowhere else.

        [{"line": 4, "src": [112.30, 113.94], "out": [41.20, 42.84]}, ...]
    """
    out, acc = [], 0.0
    for i, seg in enumerate(t.get("segments") or [], 1):
        if not is_on(seg):
            continue
        for a, b in span_list(seg):
            out.append({"line": i, "src": [a, b], "out": [acc, acc + (b - a)]})
            acc += b - a
    return out


# --- words: computed fresh from text + the raw transcript, never stored -----------

def _raw(t):
    """Every real Whisper word (absolute source time), flattened and sorted — read from
    build/transcript-raw.json and cached on first use. Never persisted: `save()` only ever
    writes the keys in TOP_KEYS/SEGMENT_KEYS."""
    cache = t.get("_raw")
    if cache is not None:
        return cache
    work = t.get("_work")
    out = []
    p = os.path.join(work, "build", "transcript-raw.json") if work else None
    if p and os.path.exists(p):
        with open(p, encoding="utf-8-sig") as f:
            raw = json.load(f)
        for seg in raw.get("segments") or []:
            for w in seg.get("words") or []:
                tok = str(w.get("word", "")).strip()
                if tok:
                    out.append({"t": tok, "s": round(float(w["start"]), 3), "e": round(float(w["end"]), 3)})
        out.sort(key=lambda w: w["s"])
    t["_raw"] = out
    return out


def words(t, seg):
    """This segment's words, with BOTH their output time (`s`/`e` — what a caption renderer
    or a subtitle writer draws against) and their source time (`src` — what `tighten.py` and
    `settle_cuts.py` cut against) resolved.

    Computed fresh every call: `text`'s tokens are aligned (difflib) against the real Whisper
    words whose own timing falls inside this segment's `source` ranges. A token that matches
    keeps its REAL timing; a run of tokens that changed (a rewording) is spread, weighted by
    length, across the real output time left between its nearest matched neighbours — the
    same idea as the old sync_words(), just never written to disk and so never stale.
    `*word*` in `text` marks a token (or a run of them) hot; `*word:drop*` (`_WORD_FX`'s
    names) additionally gives it that entrance choreography in Captions.tsx."""
    tokens, hot_idx, fx_idx = _strip_hot(seg.get("text") or "")
    if not tokens:
        return []
    dur = entry_duration(seg)
    if dur <= 0:
        return []

    spans = span_list(seg)
    raw = [w for w in _raw(t) if any(a <= w["s"] < b for a, b in spans)]
    sm = difflib.SequenceMatcher(None, [w["t"] for w in raw], tokens, autojunk=False)
    anchor = [None] * len(tokens)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                anchor[j1 + k] = (raw[i1 + k]["s"], raw[i1 + k]["e"])

    gap = min(0.04, dur / len(tokens) / 4)
    span_src = [None] * len(tokens)
    i = 0
    while i < len(tokens):
        if anchor[i] is not None:
            span_src[i] = anchor[i]
            i += 1
            continue
        j = i
        while j < len(tokens) and anchor[j] is None:
            j += 1
        left = elapsed(seg, anchor[i - 1][1]) if i > 0 else 0.0
        right = elapsed(seg, anchor[j][0]) if j < len(tokens) else dur
        run = tokens[i:j]
        weights = [max(1, len(x)) for x in run]
        total = sum(weights)
        room = max(0.0, right - left - gap * (len(run) - 1))
        cursor = left
        for k in range(len(run)):
            d = room * weights[k] / total if total else 0.0
            span_src[i + k] = (unproject_rel(seg, cursor), unproject_rel(seg, cursor + d))
            cursor += d + gap
        i = j

    out = []
    for idx, tok in enumerate(tokens):
        a, b = span_src[idx]
        s, e = project_src(t, seg, a), project_src(t, seg, b)
        if s is None or e is None:
            continue
        w = {"t": tok, "s": round(s, 3), "e": round(e, 3),
             "src": [round(a, 3), round(b, 3)], "hot": idx in hot_idx}
        if idx in fx_idx:
            w["fx"] = fx_idx[idx]
        out.append(w)
    return out


def subtract(seg, spans, min_piece=0.05):
    """Remove source spans from a segment, rewriting its `source`. Returns the seconds
    dropped.

    The one destructive-looking operation in the model, and it is still local: it changes
    this segment's `source` and nothing else. No other segment moves, because no other
    segment stores an output time. A piece left shorter than `min_piece` is dropped rather
    than kept as an unwatchable sliver.
    """
    cuts = sorted([[float(a), float(b)] for a, b in spans if float(b) > float(a)])
    if not cuts:
        return 0.0
    before = entry_duration(seg)
    out = []
    for a, b in span_list(seg):
        pieces = [[a, b]]
        for ca, cb in cuts:
            nxt = []
            for x, y in pieces:
                if cb <= x or ca >= y:
                    nxt.append([x, y])
                    continue
                if ca > x:
                    nxt.append([x, ca])
                if cb < y:
                    nxt.append([cb, y])
            pieces = nxt
        out += [[round(x, 3), round(y, 3)] for x, y in pieces if y - x >= min_piece]
    seg["source"] = out
    return round(before - entry_duration(seg), 3)


# --- validation -------------------------------------------------------------------

def validate(t):
    """Every structural problem, as a list of human-readable strings. Empty = sound.

    Checks what nothing downstream can catch: overlapping `source` spans double-count
    seconds into the duration, so the video and the captions drift apart with no error
    anywhere. Whether a `layout`/`filter`/`scene.type`/`sfx` keyword actually exists is not
    this module's business — options/check.ts (Remotion side) and sound_fx.py (its cues)
    judge those, each against its own domain.
    """
    problems = []
    src_dur = float((t.get("source") or {}).get("duration") or 0) or None

    for i, seg in enumerate(t.get("segments") or [], 1):
        where = "line %d" % i
        spans = span_list(seg)
        if not spans and is_on(seg):
            problems.append("%s: active but has no usable source span" % where)
        last = None
        for a, b in spans:
            if src_dur and b > src_dur + 0.001:
                problems.append("%s: source [%g, %g] runs past the recording (%gs)"
                                % (where, a, b, src_dur))
            if last is not None and a < last - 0.001:
                problems.append("%s: source ranges overlap or are out of order at %g" % (where, a))
            last = b

    return problems


if __name__ == "__main__":
    import sys
    _t = load(sys.argv[1])
    _bad = validate(_t)
    print("%s: %d segment(s) (%d active), %d source piece(s), %.3fs"
          % (NAME, len(_t.get("segments", [])), len(segments(_t)), len(program(_t)), duration(_t)))
    for _p in _bad:
        print("  ! " + _p)
    sys.exit(1 if _bad else 0)
