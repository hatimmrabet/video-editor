# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Join the long-form recordings into one file.

    uv run scripts/join_takes.py <work>

The `join` stage of the long-form world (scripts/pipeline/long-form.json). Reads every
video at rush/'s root (sorted; bg-audio.mp3 excluded — same rule as lib/rush) and writes
build/source-joined.mp4:

- one take   -> a plain copy
- many takes -> ffmpeg concat demuxer, stream copy (`-c copy`); the takes must share codec
  / resolution / fps (a single recording session split into files — the normal case). If
  they don't, ffmpeg errors and the recordings need a re-encode first.

Everything downstream resolves the source through lib/rush.find_source(), which prefers
build/source-joined.mp4 when it exists — so plan_cuts.py / reframe.py / the audio extract
all use the joined file with no change.
"""
import os
import shutil
import subprocess

_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import rush as _rush  # noqa: E402


def main():
    if len(_sys.argv) < 2:
        raise SystemExit("usage: join_takes.py <work>")
    work = os.path.abspath(_sys.argv[1])
    os.makedirs(os.path.join(work, "build"), exist_ok=True)
    clips = _rush.find_clips(work)
    if not clips:
        raise SystemExit("rush/ has no video to join")
    out = os.path.join(work, "build", "source-joined.mp4")

    if len(clips) == 1:
        shutil.copyfile(clips[0], out)
        print(f"1 take -> {out}")
        return

    lst = os.path.join(work, "build", ".join-list.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for c in clips:
            f.write("file '%s'\n" % c.replace("'", "'\\''"))
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
         "-c", "copy", "-movflags", "+faststart", "-y", out])
    if r.returncode != 0:
        raise SystemExit(
            "ffmpeg concat failed — the takes probably differ in codec / resolution / fps. "
            "Re-encode them to a common format first.")
    print(f"{len(clips)} takes -> {out}")


if __name__ == "__main__":
    main()
