# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Assemble the long-form deliverable video.

    uv run scripts/assemble_longform.py <work>

The `assemble` stage of the long-form world. `build/video-reframed.mp4` is already the cut
+ tightened + 16:9 video (reframe.py did that). This step:

  - no config/broll.json  -> remuxes video-reframed.mp4 -> build/video-raw.mp4 (stream copy)
  - config/broll.json     -> one ffmpeg filter graph: each B-roll range is a clip from
                             rush/broll/ overlaid full-frame over the speaker for that
                             span (the speaker's audio continues), cross-fading in/out.

No frame-by-frame render. Audio is always the speaker's, untouched. See docs/design/long-form.md.

config/broll.json — [ { "ref", "clip", "at"?, "transition"?, "crop"? } ]:
  ref        {sentence:N} | {sentence:N,words:[a,b]} | {range:[t0,t1]}  (build/captions.json timeline)
  clip       a filename in rush/broll/
  at         seconds into the clip to start from (default 0.4 — skips the hand-on-device moment)
  transition a Pass-3 spec; only its duration is used for the alpha cross-fade (default "dissolve:0.25")
  crop       "cover" (default, fill + centre-crop) — reserved for future "fit"
"""
import json
import os
import subprocess

_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import rush as _rush           # noqa: E402
from lib import scenes as _scn          # noqa: E402
from lib import transitions as _trans   # noqa: E402

W = os.path.abspath(_sys.argv[1]) if len(_sys.argv) > 1 else _sys.exit("usage: assemble_longform.py <work>")
B = lambda n: os.path.join(W, "build", n)
OUT = B("video-raw.mp4")
REFRAMED = B("video-reframed.mp4")


def _probe(path, entries):
    return subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                           "-show_entries", entries, "-of", "csv=p=0:s=x", path],
                          capture_output=True, text=True).stdout.strip()


def main():
    if not os.path.exists(REFRAMED):
        _sys.exit("no build/video-reframed.mp4 — run the reframe stage first")

    raw = _scn._read_json(os.path.join(W, "config", "broll.json"))
    cards = (_scn._read_json(B("captions.json"), {}) or {}).get("cards", [])
    broll_files = {os.path.basename(p): p for p in _rush.find_broll(W)}
    table = _trans.load()

    plan = []
    for e in raw or []:
        if not isinstance(e, dict):
            continue
        span = _scn._resolve_ref(e.get("ref", {}), cards)
        clip = e.get("clip")
        if span is None or clip not in broll_files:
            print(f"skip: {e.get('ref')} / {clip} — bad ref or clip not in rush/broll/")
            continue
        a, b = span
        fade = float(_trans.resolve(e.get("transition", "dissolve:0.25"), "montage", table).get("duration", 0.25))
        plan.append({"a": round(a, 3), "b": round(b, 3), "src": broll_files[clip],
                     "at": float(e.get("at", 0.4)), "fade": max(0.05, fade)})

    if not plan:
        subprocess.check_call(["ffmpeg", "-v", "error", "-i", REFRAMED, "-c", "copy",
                               "-movflags", "+faststart", "-y", OUT])
        print(f"no B-roll — {OUT}")
        return

    dims = _probe(REFRAMED, "stream=width,height").split("x")
    OW, OH = int(dims[0]), int(dims[1])

    cmd = ["ffmpeg", "-v", "error", "-stats", "-i", REFRAMED]
    for p in plan:
        cmd += ["-i", p["src"]]

    fc, vlast = [], "[0:v]"
    for i, p in enumerate(plan, start=1):
        a, b, T = p["a"], p["b"], p["fade"]
        d = b - a
        cdur = float(_probe(p["src"], "format=duration") or subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p["src"]],
            capture_output=True, text=True).stdout.strip() or "0")
        at = p["at"]
        if at + d > cdur:                       # clip too short for the whole span
            at = max(0.0, cdur - d - 0.05)
            if d > cdur:
                d = max(0.3, cdur - 0.1)
                print(f"note: {os.path.basename(p['src'])} is {cdur:.1f}s — B-roll shortened to {d:.1f}s")
        fc.append(
            f"[{i}:v]trim=start={at:.3f}:duration={d:.3f},setpts=PTS-STARTPTS+{a:.3f}/TB,"
            f"scale={OW}:{OH}:force_original_aspect_ratio=increase,crop={OW}:{OH},setsar=1,"
            f"format=yuva420p,fade=t=in:st={a:.3f}:d={T:.3f}:alpha=1,"
            f"fade=t=out:st={a + d - T:.3f}:d={T:.3f}:alpha=1[bk{i}]")
        fc.append(f"{vlast}[bk{i}]overlay=enable='between(t,{a - T:.3f},{a + d:.3f})':eof_action=pass[ov{i}]")
        vlast = f"[ov{i}]"

    graph = ";".join(fc)
    cmd += ["-filter_complex", graph, "-map", vlast, "-map", "0:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "copy",
            "-movflags", "+faststart", "-y", OUT]
    if len(graph) > 90000:
        gp = B(".assemble-filters.txt")
        open(gp, "w", encoding="utf-8").write(graph)
        cmd[cmd.index(graph)] = "/" + gp

    print(f"{len(plan)} B-roll cutaway(s) -> {OUT}")
    _sys.exit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
