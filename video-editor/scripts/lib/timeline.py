# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""<work>/timeline.json — the montage, and the only state the pipeline keeps (issue #144).

An ORDERED LIST OF SELF-CONTAINED ENTRIES. One entry = one spoken sentence (~180 for a
10-minute recording). Open an entry and you know everything on screen and everything
audible for that stretch: no other array to cross-reference, no other file to consult.

THE RULE ABOUT TIME — the whole design rests on it:

  measured off the recording (`src`, the words)  -> ABSOLUTE SOURCE TIME
      it never moves; a word's identity is its place in the take
  decided by hand (scene, sfx, overlay)          -> RELATIVE TO THE ENTRY
      "0.30 s in" stays true even when the sentence gets shorter
  output time                                    -> NEVER STORED
      it is the running sum of the active entries; storing it is how it diverges

So NOTHING EVER SHIFTS ANYTHING. Cutting is one of exactly two edits:
  - drop time from an entry: edit its `src` list (tighten.py, settle_cuts.py)
  - drop the whole entry:    set `on: false` (cut_entries.py) — reversible, never destructive
Everything else in the file is untouched, forever. That is what replaced the old
merge/make_shift/remap_keep surgery this module used to hold.

SHAPE

  {"version": 1,
   "source":     {"file","width","height","duration"},
   "defaults":   {"video": {...}},            # what an entry does not state
   "timeline":   [ENTRY, ...],                # in order
   "spans":      [{"kind","from","to",...}],  # what outlives one entry, anchored on entry ids
   "chapters":   [{"at": "e001", "title"}],
   "outro":      {"seconds","line","recap","cta_top","tail"},
   "checkpoints":{"transcript-fix": true, "cut-review": true, ...}}  # see mark_checkpoint.py

  ENTRY = {"id":  "e014",
           "src": [[112.30, 113.94], [114.21, 115.82]],   # AUTHORITY. Hole = silence removed
           "on":  true,                                    # false = cut, still readable
           "why": null,                                    # why it was cut
           "caption": {"text": "...",
                       "words": [{"t","src":[a,b],"hot"}]},   # absolute source time
           "video":   {"zoom","anchor","layout","filter","in"},
           "scene":   {"motif","params","at","dur"},           # at/dur entry-relative
           "sfx":     [{"cue","at"}],                          # at entry-relative
           "overlay": [{"kind","src","pos","scale","at","dur"}]}

Everything but `id` and `src` is optional; `on` defaults to true.

`checkpoints` records that a human/agent decision step (transcript-fix, cut-review, tighten,
chapters, scenes, sound-cues) has been addressed for this project — set by
`mark_checkpoint.py`, never inferred. It exists because those steps edit entries in place
(a reworded `caption.text`, a `scene` added, or deliberately nothing) with no file of their
own for `run.py` to check the existence of; without an explicit marker "nothing needed
changing" and "not looked at yet" are indistinguishable from the file alone (issue #148).

WHAT LIVES ELSEWHERE, AND WHY THAT IS STILL ONE SOURCE OF TRUTH

  config/project.config.json  the SETTINGS (language, model, cut thresholds, theme).
                              Inputs to the tools. Changed once per project.
  build/source-joined.mp4     \\  MEASUREMENTS, not state. Nothing ever rewrites them, so
  build/silences.json          } nothing can diverge, and the timeline can always be
  build/transcript-raw.json   /  rebuilt from them.

"Single source of truth" is about DECISIONS. timeline.json owns every decision.
It sits at the work root, not under build/: build/ is disposable, the timeline is the project.

USING IT

    from lib import timeline as tl
    t = tl.load(work)
    for seg in tl.program(t):        # the render program, in output order
        ...                          # seg = {"entry","src":[a,b],"out":[x,y]}
    tl.duration(t)                   # total speech seconds, outro excluded
"""
import json
import os

VERSION = 1
NAME = "timeline.json"

_DOC = ("The montage, and the only state this pipeline keeps. An ordered list of "
        "self-contained entries, one per spoken sentence. `src` is absolute source time and "
        "is the authority; times inside an entry (scene.at, sfx.at) are relative to the "
        "entry; output time is NEVER stored - it is the running sum of the active entries. "
        "Cutting is either editing an entry's `src` or setting `on:false`. Nothing else ever "
        "moves. See scripts/lib/timeline.py and issue #144.")

LAYOUTS = ("FULL", "DOWN", "LOWER", "HIDDEN")   # HIDDEN: no face — a full-screen motion
                                                 # graphic (Background.tsx) carries the entry instead (issue #154)


def path(work):
    return os.path.join(os.path.abspath(work), NAME)


def blank(source=None):
    """An empty timeline — what build_timeline.py starts from."""
    return {"_doc": _DOC, "version": VERSION, "source": source or {},
            "defaults": {"video": {"zoom": 1.0, "anchor": [0.5, 0.30], "layout": "FULL"}},
            "timeline": [], "spans": [], "chapters": [], "outro": {}, "checkpoints": {}}


def load(work):
    # utf-8-sig: tolerate a BOM if the file was saved from a Windows editor
    with open(path(work), encoding="utf-8-sig") as f:
        return json.load(f)


def save(work, tl):
    """Write it back, `_doc` and `version` restated so the file always documents itself."""
    tl = dict(tl)
    tl["_doc"] = _DOC
    tl["version"] = VERSION
    keys = ("_doc", "version", "source", "defaults", "timeline", "spans", "chapters", "outro",
            "checkpoints")
    ordered = {k: tl[k] for k in keys if k in tl}
    ordered.update({k: v for k, v in tl.items() if k not in ordered})
    with open(path(work), "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=1)
        f.write("\n")


# --- the entries -----------------------------------------------------------------

def is_on(entry):
    """An entry counts unless it was explicitly switched off. A cut entry stays in the
    file — readable, with its `why` — so undo is a flag flip, not a restore."""
    return entry.get("on", True) is not False


def entries(tl, every=False):
    """The active entries, in order. `every=True` includes the cut ones."""
    return [e for e in tl.get("timeline", []) if every or is_on(e)]


def by_id(tl, eid):
    for e in tl.get("timeline", []):
        if e.get("id") == eid:
            return e
    return None


# --- checkpoints -------------------------------------------------------------------

def checkpoint_done(tl, name):
    """Whether `name` (a pipeline stage id) was explicitly marked addressed."""
    return bool((tl.get("checkpoints") or {}).get(name))


def mark_checkpoint(work, name):
    """Record that stage `name` was addressed. Idempotent; used by mark_checkpoint.py."""
    t = load(work)
    cps = dict(t.get("checkpoints") or {})
    cps[name] = True
    t["checkpoints"] = cps
    save(work, t)


def span_list(entry):
    """`src` normalised to a list of [a, b] pairs, dropping the empty ones."""
    out = []
    for pair in entry.get("src") or []:
        a, b = float(pair[0]), float(pair[1])
        if b > a:
            out.append([a, b])
    return out


def entry_duration(entry):
    """How long this entry lasts on screen: the sum of its source spans. The holes
    between them (removed silences) cost nothing — that is the whole point."""
    return sum(b - a for a, b in span_list(entry))


def duration(tl):
    """Total speech duration of the montage. The outro is not part of it."""
    return sum(entry_duration(e) for e in entries(tl))


def out_start(tl, entry):
    """Where this entry starts in the finished video. Accepts an entry or its id.
    Returns None for an unknown or switched-off entry — it has no place on the output."""
    eid = entry.get("id") if isinstance(entry, dict) else entry
    acc = 0.0
    for e in entries(tl):
        if e.get("id") == eid:
            return acc
        acc += entry_duration(e)
    return None


# --- projection: source or entry time -> output time ------------------------------

def project_rel(tl, entry, t_rel):
    """An entry-relative time (scene.at, sfx.at) -> output time.

    Clamped to the entry: a cue authored past the end of a sentence that later got
    shortened fires at its end rather than bleeding into the next one."""
    e = entry if isinstance(entry, dict) else by_id(tl, entry)
    if e is None:
        return None
    start = out_start(tl, e)
    if start is None:
        return None
    return start + max(0.0, min(float(t_rel), entry_duration(e)))


def elapsed(entry, t_src):
    """How many seconds of this entry the viewer has seen by source time `t_src`.

    Entry-local, so it answers the question that matters when deciding whether a pause is
    too long: the gap the VIEWER hears between two words, not the gap in the recording. A
    pause already trimmed shows up here as the ~90 ms that was kept, which is why the
    tighten pass is a no-op the second time it runs.

    A time landing in a hole — a silence already removed — reports the near edge, so a word
    never counts material that is gone."""
    t_src = float(t_src)
    acc = 0.0
    for a, b in span_list(entry if isinstance(entry, dict) else {}):
        if t_src < a:           # before this span: in a hole, or before the entry
            return acc
        if t_src <= b:
            return acc + (t_src - a)
        acc += b - a
    return acc                  # past the last span


def project_src(tl, entry, t_src):
    """An absolute source time (a word's `src`) -> output time."""
    e = entry if isinstance(entry, dict) else by_id(tl, entry)
    if e is None:
        return None
    start = out_start(tl, e)
    return None if start is None else start + elapsed(e, t_src)


def unproject_rel(entry, t_rel):
    """The inverse: entry-relative output seconds -> absolute source time.

    Needed whenever something is authored against what the viewer sees and has to be
    written back as source time — sync_words() below is the reason it exists.

    At a seam (where a removed silence was) two source times map to the same output
    instant, so this has to pick one: it returns the END of the earlier span, never a time
    inside the hole. project_src(unproject_rel(x)) == x holds everywhere regardless."""
    spans = span_list(entry if isinstance(entry, dict) else {})
    if not spans:
        return None
    t_rel = max(0.0, float(t_rel))
    acc = 0.0
    for a, b in spans:
        if t_rel <= acc + (b - a):
            return a + (t_rel - acc)
        acc += b - a
    return spans[-1][1]


def program(tl):
    """THE RENDER PROGRAM: every surviving piece of source, in output order.

    This is what a renderer consumes — one <Sequence> per item, or one ffmpeg trim+concat
    pair. Output times are computed here and nowhere else.

        [{"entry": "e014", "src": [112.30, 113.94], "out": [41.20, 42.84]}, ...]
    """
    out, acc = [], 0.0
    for e in entries(tl):
        for a, b in span_list(e):
            out.append({"entry": e.get("id"), "src": [a, b], "out": [acc, acc + (b - a)]})
            acc += b - a
    return out


def words(tl, entry):
    """This entry's words with their output times resolved — what a caption renderer
    needs. `hot` rides along untouched."""
    e = entry if isinstance(entry, dict) else by_id(tl, entry)
    out = []
    for w in ((e or {}).get("caption") or {}).get("words") or []:
        src = w.get("src") or []
        if len(src) < 2:
            continue
        out.append({"t": w.get("t", ""), "hot": bool(w.get("hot")),
                    "s": project_src(tl, e, src[0]), "e": project_src(tl, e, src[1])})
    return out


def subtract(entry, spans, min_piece=0.05):
    """Remove source spans from an entry, rewriting its `src`. Returns the seconds dropped.

    The one destructive-looking operation in the model, and it is still local: it changes
    this entry's `src` and nothing else. No other entry moves, because no other entry
    stores an output time. A piece left shorter than `min_piece` is dropped rather than
    kept as an unwatchable sliver.
    """
    cuts = sorted([[float(a), float(b)] for a, b in spans if float(b) > float(a)])
    if not cuts:
        return 0.0
    before = entry_duration(entry)
    out = []
    for a, b in span_list(entry):
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
    entry["src"] = out
    return round(before - entry_duration(entry), 3)


def sync_words(entry):
    """Rebuild `caption.words` when `caption.text` no longer matches them.

    This is what makes correcting a transcript cheap: edit `caption.text`, run this, and
    the per-word timings follow. Tokens are spread across the entry's own OUTPUT duration
    (so a removed silence inside the sentence does not bunch words against its edge),
    weighted by token length, then written back as source time. `hot` is preserved for
    tokens that survive the rewording.

    Whisper's per-word timing is kept untouched whenever the text still matches it — this
    only fires on the sentences that were actually reworded. Returns True if it changed
    anything.
    """
    cap = entry.get("caption") or {}
    tokens = (cap.get("text") or "").split()
    have = [w.get("t", "") for w in cap.get("words") or []]
    if tokens == have:
        return False

    dur = entry_duration(entry)
    if not tokens or dur <= 0:
        cap["words"] = []
        entry["caption"] = cap
        return True

    hot = {w.get("t") for w in cap.get("words") or [] if w.get("hot")}
    weights = [max(1, len(x)) for x in tokens]
    total = sum(weights)
    gap = min(0.04, dur / len(tokens) / 4)
    span = dur - gap * (len(tokens) - 1)

    out, cursor = [], 0.0
    for tok, wgt in zip(tokens, weights):
        d = span * wgt / total
        a = unproject_rel(entry, cursor)
        b = unproject_rel(entry, cursor + d)
        w = {"t": tok, "src": [round(a, 3), round(b, 3)]}
        if tok in hot:
            w["hot"] = True
        out.append(w)
        cursor += d + gap

    cap["words"] = out
    entry["caption"] = cap
    return True


def span_window(tl, span):
    """A `spans` entry (music bed, permanent logo, intro badge) -> its output window.
    Anchored on entry ids, so nothing about it moves when another entry is cut."""
    a = out_start(tl, span.get("from"))
    to = by_id(tl, span.get("to"))
    b = None if to is None else project_rel(tl, to, entry_duration(to))
    return [0.0 if a is None else a, duration(tl) if b is None else b]


# --- validation -------------------------------------------------------------------

def validate(tl):
    """Every structural problem, as a list of human-readable strings. Empty = sound.

    Checks what nothing downstream can catch: a duplicate id silently makes out_start()
    return the first match, and overlapping `src` spans double-count seconds into the
    duration, so the video and the captions drift apart with no error anywhere.
    """
    problems = []
    seen = set()
    src_dur = float((tl.get("source") or {}).get("duration") or 0) or None

    for i, e in enumerate(tl.get("timeline", [])):
        where = "entry %d (%s)" % (i, e.get("id") or "no id")
        eid = e.get("id")
        if not eid:
            problems.append("%s: missing id" % where)
        elif eid in seen:
            problems.append("%s: duplicate id" % where)
        else:
            seen.add(eid)

        spans = span_list(e)
        if not spans and is_on(e):
            problems.append("%s: active but has no usable src span" % where)
        last = None
        for a, b in spans:
            if src_dur and b > src_dur + 0.001:
                problems.append("%s: src [%g, %g] runs past the source (%gs)"
                                % (where, a, b, src_dur))
            if last is not None and a < last - 0.001:
                problems.append("%s: src spans overlap or are out of order at %g" % (where, a))
            last = b

        lay = (e.get("video") or {}).get("layout")
        if lay is not None and lay not in LAYOUTS:
            problems.append("%s: unknown layout %r (expected one of %s)"
                            % (where, lay, ", ".join(LAYOUTS)))

        if spans:
            lo, hi = spans[0][0], spans[-1][1]
            for w in ((e.get("caption") or {}).get("words") or []):
                src = w.get("src") or []
                if len(src) < 2:
                    problems.append("%s: word %r has no src" % (where, w.get("t")))
                elif src[0] < lo - 0.001 or src[0] > hi + 0.001:
                    problems.append("%s: word %r at %gs falls outside the entry (%g-%g)"
                                    % (where, w.get("t"), src[0], lo, hi))

    for s in tl.get("spans") or []:
        for end in ("from", "to"):
            if s.get(end) and by_id(tl, s[end]) is None:
                problems.append("span %r: %s points at unknown entry %r"
                                % (s.get("kind"), end, s[end]))

    for c in tl.get("chapters") or []:
        if by_id(tl, c.get("at")) is None:
            problems.append("chapter %r points at unknown entry %r" % (c.get("title"), c.get("at")))

    return problems


if __name__ == "__main__":
    import sys
    _t = load(sys.argv[1])
    _bad = validate(_t)
    print("%s: %d entries (%d active), %d source pieces, %.3fs"
          % (NAME, len(_t.get("timeline", [])), len(entries(_t)), len(program(_t)), duration(_t)))
    for _p in _bad:
        print("  ! " + _p)
    sys.exit(1 if _bad else 0)
