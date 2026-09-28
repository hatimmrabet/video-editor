# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Flattens <work>/timeline.json into the one file the Remotion project renders from.

    uv run scripts/render_data.py <work> <remotion-dir>

Reads : <work>/timeline.json · <work>/build/transcript-raw.json (via lib.timeline.words)
        config/project.config.json · build/source-joined.mp4's dimensions
Writes: <remotion-dir>/src/plan.json

THE PLAN IS A BUILD ARTIFACT, not state: remotion.sh regenerates it on every sync and
nothing reads it back. It is the single source of theme + duration + layout schedule +
scenes + overlays + end-card copy that the Remotion project renders from — the compiled
form of timeline.json, with output times, word timings and every keyword already resolved,
so the TSX never has to know that source time exists or that a `text` field was ever a
string with `*hot*` markers in it.

  pieces   the render program: one per kept source span              (Footage.tsx)
  cards    one per active segment, with per-word output timings      (Captions.tsx, stage.ts)
  scenes   one per segment that authored a `scene`                   (scenes/SceneList.tsx)
           - itemReveal: for a scene with an `items` param, the absolute second each item
             first appeared (see item_reveal_times) — None for a scene with no `items`
           - continues / continuesNext: whether this scene picked up an already-running
             `items` list from the one before it / hands it on to the one after
  overlays one per segment's `overlay[]` item, output-resolved       (VideoOverlays.tsx)
  stage    the layout schedule: each span's layout, scene and transition, as authored
  total    the speech duration; `outro` is added on top by theme.ts
  grade    whether project.config.json asks for the light colour grade

`scenes` and `overlays` are always present, even empty: `scenes/SceneList.tsx` and
`VideoOverlays.tsx` are the only renderers for either, so there is no fallback for an empty
list to disable.

THIS SCRIPT KNOWS NO OPTION. A layout, a transition, a scene or a filter is an UPPERCASE
keyword (with parameters) that passes through exactly as written; the folders layouts/,
transitions/, scenes/ and filters/ of the Remotion template are the only place that knows
what they mean, and `options/check.ts` audits the plan against them (remotion.sh runs it
right after this script).

A SCENE NOW LIVES AS LONG AS ITS SEGMENT — there is no more per-scene `at`/`dur`: cutting a
sentence to a different length reshapes its scene automatically, and putting a scene on only
part of a sentence means splitting the sentence (`cut_entries.py split`), not offsetting the
scene inside it. `scene.timing` still tunes the enter/exit rise only.

THE PIECES ARE THE CUT. Remotion reads build/source-joined.mp4 directly and plays each
piece's source span in its own <Sequence> — one encode, no intermediate video. A piece is
{s, e} (source seconds), o (its output start), filter (the segment's own filter choice, or
null), and its framing:

  z / a     a segment's own hand-authored `zoom` / `anchor` — present only when actually
            authored; used verbatim, overriding everything below.
  measured  the face measurement for this span (build/framing.json, find_face.py), as
            {cx, cy, h} source-frame fractions — the median of every sample inside the span,
            or the nearest one when the span is shorter than the sampling interval. null when
            nothing was measured there (find_face.py never ran, or found no face at all).
  filter    a segment's own `filter`; null leaves the person's image alone (unless the
            project's `grade` is on, which the renderer applies as the fallback look).

Turning a measurement into an actual crop is Footage.tsx's job, not this script's: it already
knows the active layout's own face TARGET (where and how big the face should render), which
is exactly the kind of option-domain knowledge this script never has.

Neighbouring pieces that continue the same take with the same treatment are merged: there
is no cut between them, so there is nothing to seek to and no seam to fade.

WHY A STAGE SPAN CARRIES ITS SCENE. The SPLIT layout leaves the video as much room as
the scene above it needs, and how far down a scene reaches is the scene's own business. The
span therefore carries the scene as authored, and the renderer asks the scene. Two
neighbouring spans merge only when their layout, scene and transition are all identical.

Every plan item carries the 1-based `line` of the segment it came from (there are no ids),
so a problem found later — by options/check.ts, or by a person reading the render log — can
say where it is.
"""
import json
import os
import statistics
import subprocess
import sys

from lib import config as cfg, platform as plat, timeline as tl


SOURCE = os.path.join("build", "source-joined.mp4")
FRAMING = os.path.join("build", "framing.json")


def video_size(work, fallback=(1080, 1920)):
    """The composition's own size, read off the source rather than assumed, so a
    horizontal recording gets a horizontal canvas. Rounded down to even numbers, which
    h264 requires."""
    path = os.path.join(work, SOURCE)
    if not os.path.exists(path):
        return fallback
    dims = subprocess.run([plat.ffprobe(), "-v", "error", "-select_streams", "v:0",
                           "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path],
                          capture_output=True, text=True).stdout.strip()
    try:
        w, h = (int(x) for x in dims.split("x")[:2])
        return w // 2 * 2, h // 2 * 2
    except Exception:
        return fallback


def load_framing(work):
    """[(t, cx, cy, h), ...], sorted — build/framing.json's samples, or [] when find_face.py
    has not run (or found nothing). A missing measurement is not an error: the render falls
    back to a centred crop, exactly as before this measurement existed."""
    p = os.path.join(work, FRAMING)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8-sig") as f:
        data = json.load(f)
    return [(s["t"], s["cx"], s["cy"], s["h"]) for s in data.get("samples") or []]


def measured_face(samples, s, e):
    """The representative face measurement for source span [s, e): the median of every
    sample that falls inside it, so one stray misdetection cannot swing the crop. A span
    shorter than the sampling interval falls back to the single nearest sample. None when
    there is nothing measured at all."""
    if not samples:
        return None
    inside = [x for x in samples if s <= x[0] < e] or [min(samples, key=lambda x: min(abs(x[0] - s), abs(x[0] - e)))]
    return {"cx": round(statistics.median(x[1] for x in inside), 4),
            "cy": round(statistics.median(x[2] for x in inside), 4),
            "h": round(statistics.median(x[3] for x in inside), 4)}


def _merge_key(item):
    """Whether two neighbouring pieces render identically enough to become one <Sequence>.
    The measured face is rounded coarser here than it is written to the piece itself (4
    decimals): natural micro-movement between two adjacent slices of the same continuous
    shot almost never lands on the exact same median once a face is actually being tracked,
    which would otherwise defeat the merge every time and reintroduce a seek at a boundary
    that was never a real cut."""
    a = item.get("a")
    m = item.get("measured")
    return (item.get("z"), tuple(a) if a else None,
            (round(m["cx"], 2), round(m["cy"], 2), round(m["h"], 2)) if m else None, item.get("filter"))


def pieces(t, framing):
    """The render program with each piece's framing resolved — see the module docstring."""
    out = []
    for piece in tl.program(t):
        seg = tl.by_line(t, piece["line"])
        s, en = piece["src"]
        item = {"s": round(s, 3), "e": round(en, 3), "o": round(piece["out"][0], 3),
                "filter": seg.get("filter"), "measured": measured_face(framing, s, en),
                "line": piece["line"]}
        if seg.get("zoom") is not None:
            item["z"] = float(seg["zoom"])
        if seg.get("anchor"):
            item["a"] = [float(x) for x in seg["anchor"][:2]]

        prev = out[-1] if out else None
        if prev and abs(prev["e"] - s) < 0.001 and _merge_key(prev) == _merge_key(item):
            prev["e"] = round(en, 3)
            continue
        out.append(item)
    return out


def _continues(prev, sc):
    """Whether sc's own `items` picks up exactly where prev's left off — the same things
    named again, with one or more new ones appended — rather than an unrelated fresh list
    that merely happens to share the same scene type."""
    if not prev or prev.get("type") != sc.get("type"):
        return False
    prev_items = (prev.get("params") or {}).get("items")
    items = (sc.get("params") or {}).get("items")
    if not isinstance(prev_items, list) or not isinstance(items, list):
        return False
    return len(items) > len(prev_items) and items[:len(prev_items)] == prev_items


def item_reveal_times(scenes):
    """For every scene with an `items` param: `(itemReveal, continues)`, where `itemReveal`
    is the absolute second each item first appeared, parallel to that scene's own `items`
    list, and `continues` is whether this scene picked up an already-running list rather than
    starting a fresh one. A scene with no `items` gets `(None, False)`.

    The first time a list of items shows up its reveal times spread across that scene's own
    span (the pop-in pacing a component already tunes for); a segment that continues the same
    list (one more item than the last time this exact scene type ran) inherits every earlier
    item's original time and gives only the new one(s) this segment's own start. A component
    then animates each item off `t - itsRevealTime`, so a segment mounting mid-list draws every
    earlier item already settled — never replaying an entrance that happened several segments
    ago. SceneList.tsx also reads `continues` to skip the enter/exit rise it wraps every other
    scene in: a continuing scene is not a new thing arriving, so it must not fade in over what
    is already on screen, and neither may whichever segment continues FROM it fade out from
    under a list that is still growing."""
    out = []
    prev, prev_reveal = None, []
    for sc in scenes:
        items = (sc.get("params") or {}).get("items")
        if not isinstance(items, list):
            out.append((None, False))
            prev, prev_reveal = sc, []
            continue
        continues = _continues(prev, sc)
        if continues:
            reveal = list(prev_reveal) + [sc["s"]] * (len(items) - len(prev_reveal))
        else:
            n = len(items)
            span = sc["e"] - sc["s"]
            reveal = [round(sc["s"] + (0.05 + (i / n) * 0.4) * span, 3) for i in range(n)]
        out.append((reveal, continues))
        prev, prev_reveal = sc, reveal
    return out


def build(work, remotion_dir):
    t = tl.load(work)
    conf = cfg.load(work)
    width, height = video_size(work)

    cards, scenes, overlays, stage = [], [], [], []
    for i, seg in enumerate(tl.segments(t), 1):
        ws = tl.words(t, seg)
        start = tl.out_start(t, seg)
        end = start + tl.entry_duration(seg)
        if ws:
            cards.append({"s": round(ws[0]["s"], 3), "e": round(ws[-1]["e"], 3),
                          "w": [{"t": w["t"], "s": round(w["s"], 3), "e": round(w["e"], 3),
                                 "hot": w["hot"]} for w in ws]})

        sc = seg.get("scene")
        span = {"s": round(start, 3), "e": round(end, 3), "layout": seg.get("layout"),
                "scene": {"type": sc.get("type"), "params": sc.get("params") or {}} if sc else None,
                "line": i}
        if seg.get("transition"):
            span["transition"] = seg["transition"]
        stage.append(span)

        if sc:
            scenes.append({"s": round(start, 3), "e": round(end, 3), "type": sc.get("type"),
                           "params": sc.get("params") or {}, "timing": sc.get("timing") or {},
                           "words": [{"t": w["t"], "s": round(w["s"], 3),
                                      "e": round(w["e"], 3), "hot": w["hot"]} for w in ws],
                           "line": i})

        for ov in (seg.get("overlay") or []):
            overlays.append({"s": round(start, 3), "e": round(end, 3), "kind": "image",
                              "src": ov.get("src"), "pos": ov.get("pos") or [0.5, 0.5],
                              "scale": ov.get("scale", 0.2)})

    stage = merge_stage(stage, round(tl.duration(t), 3))
    reveals = item_reveal_times(scenes)
    for i, (sc, (reveal, continues)) in enumerate(zip(scenes, reveals)):
        sc["itemReveal"] = reveal
        sc["continues"] = continues
        # whether the NEXT scene continues this one — so this scene's own container knows not
        # to fade out from under a list its successor is about to keep growing.
        sc["continuesNext"] = i + 1 < len(reveals) and reveals[i + 1][1]
    theme = conf.get("theme", {})

    payload = {
        "width": width, "height": height,
        # the whole theme block, verbatim. A whitelist silently dropped keys it did not know
        # and falsy-but-valid values (0, false); theme.ts carries a default per key.
        "theme": theme,
        # a project with no logo must still render - Chrome.tsx / Outro.tsx guard every <Img>
        "logo": os.path.exists(os.path.join(remotion_dir, "public", "logo.png")),
        "total": round(tl.duration(t), 3),
        "outro": float((t.get("outro") or {}).get("seconds", 5.0)),
        "sfx": os.path.exists(os.path.join(work, "build", "sound-effects.wav")),
        "grade": bool(conf.get("grade", False)),
        "fps": 30,
        "pieces": pieces(t, load_framing(work)),
        "cards": cards,
        "scenes": scenes,
        "overlays": overlays,
        "stage": stage,
        "outro_copy": {k: (t.get("outro") or {}).get(k, v) for k, v in
                       (("line", ""), ("recap", []), ("cta_top", ""), ("cta_word", ""), ("tail", ""))},
        "guides": bool(conf.get("guides", False)),
    }
    return payload


def merge_stage(stage, total):
    """Collapse neighbouring segments that render identically, and run the last one to the
    end. Without this a 180-sentence video produces 180 spans that are all the same layout,
    and the renderer would run a transition between a layout and itself at every sentence."""
    out = []
    for s in stage:
        prev = out[-1] if out else None
        same = (prev and prev["layout"] == s["layout"] and prev["scene"] == s["scene"]
                and not s.get("transition"))
        if same:
            prev["e"] = s["e"]
        else:
            out.append(dict(s))
    if out:
        out[-1]["e"] = max(out[-1]["e"], total)
    else:
        out = [{"s": 0, "e": max(total, 9999), "layout": None, "scene": None}]
    return out


def main(argv):
    work, remotion_dir = os.path.abspath(argv[1]), os.path.abspath(argv[2])
    payload = build(work, remotion_dir)
    dest = os.path.join(remotion_dir, "src", "plan.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print("plan.json -> %.3fs + %.1fs outro  ·  %d piece(s), %d card(s), %d scene(s), %d overlay(s), %d stage span(s)  ·  sfx: %s"
          % (payload["total"], payload["outro"], len(payload["pieces"]), len(payload["cards"]), len(payload["scenes"]),
             len(payload["overlays"]), len(payload["stage"]), "yes" if payload["sfx"] else "no"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
