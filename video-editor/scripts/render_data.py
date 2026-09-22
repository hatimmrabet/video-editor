# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Flattens <work>/timeline.json into the one file the Remotion project renders from.

    uv run scripts/render_data.py <work> <remotion-dir>

Reads : <work>/timeline.json · config/project.config.json · scripts/motifs/index.json
        scripts/transitions.json · the rendered video's dimensions
Writes: <remotion-dir>/src/timeline.json

This is a BUILD ARTIFACT, not state: remotion.sh regenerates it on every sync and nothing
reads it back. It replaces the old pair src/project.json + src/caps.json, which came from
two different places and could disagree.

Everything in it is derived from the timeline, with output times already resolved, so the
TSX never has to know that source time exists:

  cards    one per active entry, with per-word output timings  (Captions.tsx, stage.ts)
  scenes   one per entry that authored a `scene`               (SceneList.tsx)
  overlays one per entry's `overlay[]` item, output-resolved   (VideoOverlays.tsx)
  stage    the video-rect schedule, derived from each entry's `video.layout`
  total    the speech duration; `outro` is added on top by theme.ts

`scenes` and `overlays` are always present, even empty — there is no more hand-written
fallback for either (`Scenes.tsx` was retired, issue #147), so there is nothing left for an
empty list to silently disable.

WHY THE SCHEDULE CARRIES `gb`. stage.ts sizes a DOWN rect from `gb` — how tall the graphic
sitting above the captions is. The old resolver (lib/scenes.py) copied only an explicit
`layout.gb` and never the motif's own declared `bottom`, so a tall motif got a rect sized
for a 500px one (issue #147). Here `bottom` from the registry is the fallback.
"""
import json
import os
import subprocess
import sys

from lib import config as cfg, platform as plat, timeline as tl, transitions as trans

LAYOUT_DEFAULT = "FULL"


def _read(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    return default


def motif_registry(skill_dir):
    """name -> {kind, bottom}, for motifs the renderer actually implements."""
    raw = _read(os.path.join(skill_dir, "scripts", "motifs", "index.json"), {})
    items = raw.get("motifs", raw) if isinstance(raw, dict) else raw
    out = {}
    if isinstance(items, dict):
        items = [dict(v, name=k) for k, v in items.items()]
    for m in items or []:
        if not isinstance(m, dict) or m.get("status") != "implemented":
            continue
        out[m.get("name")] = {"kind": m.get("kind", "scene"), "bottom": m.get("bottom")}
    return out


def video_size(work, fallback=(1080, 1920)):
    """The composition's own size, read off the cut video rather than assumed, so a
    horizontal recording gets a horizontal canvas (issue #136)."""
    path = os.path.join(work, "build", "video-reframed.mp4")
    if not os.path.exists(path):
        return fallback
    dims = subprocess.run([plat.ffprobe(), "-v", "error", "-select_streams", "v:0",
                           "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path],
                          capture_output=True, text=True).stdout.strip()
    try:
        w, h = (int(x) for x in dims.split("x")[:2])
        return w, h
    except Exception:
        return fallback


def build(work, remotion_dir, skill_dir):
    t = tl.load(work)
    conf = cfg.load(work)
    registry = motif_registry(skill_dir)
    defaults = (t.get("defaults") or {}).get("video") or {}
    width, height = video_size(work)

    cards, scenes, overlays, stage = [], [], [], []
    for e in tl.entries(t):
        words = tl.words(t, e)
        start = tl.out_start(t, e)
        end = start + tl.entry_duration(e)
        if words:
            cards.append({"s": round(words[0]["s"], 3), "e": round(words[-1]["e"], 3),
                          "w": [{"t": w["t"], "s": round(w["s"], 3), "e": round(w["e"], 3),
                                 "hot": w["hot"]} for w in words]})

        vid = {**defaults, **(e.get("video") or {})}
        mode = vid.get("layout") or LAYOUT_DEFAULT
        if mode not in tl.LAYOUTS:
            mode = LAYOUT_DEFAULT

        sc = e.get("scene") or {}
        name = sc.get("motif")
        meta = registry.get(name)
        if name and not meta:
            # a bad reference never stops the render; it just does not draw
            print("  ! %s: motif %r is not implemented - skipped" % (e["id"], name))
            name = None

        gb = vid.get("gb")
        if gb is None and meta:
            gb = meta.get("bottom")

        entry_stage = {"s": round(start, 3), "e": round(end, 3), "m": mode}
        trans_in = vid.get("in")
        if trans_in:
            entry_stage["transition"] = trans_in
        if gb is not None:
            entry_stage["gb"] = gb
        stage.append(entry_stage)

        if name:
            at = float(sc.get("at", 0.0))
            dur = sc.get("dur")
            s0 = tl.project_rel(t, e, at)
            s1 = tl.project_rel(t, e, at + float(dur)) if dur is not None else end
            scenes.append({"s": round(s0, 3), "e": round(s1, 3), "mode": mode,
                           "transition": trans_in, "gb": gb, "motif": name,
                           "kind": meta.get("kind", "scene"),
                           "params": sc.get("params") or {},
                           "timing": sc.get("timing") or {},
                           "words": [{"t": w["t"], "s": round(w["s"], 3),
                                      "e": round(w["e"], 3), "hot": w["hot"]} for w in words],
                           "bottom": meta.get("bottom")})

        for ov in (e.get("overlay") or []):
            ov_at = float(ov.get("at", 0.0))
            ov_dur = ov.get("dur")
            o0 = tl.project_rel(t, e, ov_at)
            o1 = tl.project_rel(t, e, ov_at + float(ov_dur)) if ov_dur is not None else end
            overlays.append({"s": round(o0, 3), "e": round(o1, 3),
                              "kind": ov.get("kind", "image"), "src": ov.get("src"),
                              "pos": ov.get("pos") or [0.5, 0.5], "scale": ov.get("scale", 0.2)})

    stage = merge_stage(stage, round(tl.duration(t), 3))
    theme = conf.get("theme", {})

    payload = {
        "width": width, "height": height,
        # the whole theme block, verbatim. A whitelist silently dropped keys it did not know
        # and falsy-but-valid values (0, false); theme.ts carries a default per key.
        "theme": theme,
        # a project with no logo must still render - Chrome.tsx / Outro.tsx guard every <Img>
        "logo": os.path.exists(os.path.join(remotion_dir, "public", "logo.png")),
        "faceAnchor": conf.get("crop", {}).get("faceAnchor", 0.30),
        "total": round(tl.duration(t), 3),
        "outro": float((t.get("outro") or {}).get("seconds", 5.0)),
        "sfx": os.path.exists(os.path.join(work, "build", "sound-effects.wav")),
        "fps": 30,
        "cards": cards,
        "scenes": scenes,
        "overlays": overlays,
        "stage": stage,
        "outro_copy": {k: (t.get("outro") or {}).get(k, v) for k, v in
                       (("line", ""), ("recap", []), ("cta_top", ""), ("cta_word", ""), ("tail", ""))},
        "guides": bool(conf.get("guides", False)),
        "transitions": trans.load()["defaults"],
    }
    return payload


def merge_stage(stage, total):
    """Collapse neighbouring entries that render identically, and run the last one to the
    end. Without this a 180-sentence video produces 180 rect changes that are all the same
    rect, and stage.ts cross-fades between a rect and itself at every sentence."""
    out = []
    for s in stage:
        prev = out[-1] if out else None
        same = (prev and prev["m"] == s["m"] and prev.get("gb") == s.get("gb")
                and not s.get("transition"))
        if same:
            prev["e"] = s["e"]
        else:
            out.append(dict(s))
    if out:
        out[-1]["e"] = max(out[-1]["e"], total)
    else:
        out = [{"s": 0, "e": max(total, 9999), "m": LAYOUT_DEFAULT}]
    return out


def main(argv):
    work, remotion_dir = os.path.abspath(argv[1]), os.path.abspath(argv[2])
    skill_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    payload = build(work, remotion_dir, skill_dir)
    dest = os.path.join(remotion_dir, "src", "timeline.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print("timeline.json -> %.3fs + %.1fs outro  ·  %d card(s), %d scene(s), %d overlay(s), %d stage span(s)  ·  sfx: %s"
          % (payload["total"], payload["outro"], len(payload["cards"]), len(payload["scenes"]),
             len(payload["overlays"]), len(payload["stage"]), "yes" if payload["sfx"] else "no"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
