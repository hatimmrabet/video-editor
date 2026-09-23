# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Resolve the rush/ recording(s) into the canonical source the rest of the pipeline reads.

    uv run scripts/prepare_source.py <work>

The `source` stage of the talking-video world (scripts/pipeline/talking-video.json), and it
runs for every talking video, not just a long one. Reads every video at rush/'s root
(sorted; bg-audio.mp3 excluded — same rule as lib/rush) and writes build/source-joined.mp4,
**stream copy, never a re-encode**:

- one take   -> remuxed as-is
- many takes -> ffmpeg concat demuxer; the takes must share codec / resolution / fps (a
  single recording session split into files — the normal case). If they don't, ffmpeg
  errors and the recordings need a re-encode first.

Either way the video is re-tagged bt709 — in the bitstream itself through the
`h264_metadata` / `hevc_metadata` bitstream filter, and in the container. An iPhone HDR
recording arrives tagged bt2020/HLG, and a browser that honors that tag renders it orange;
Remotion reads this file directly at render time, so the tag has to be right here. A codec
with no such bitstream filter keeps its bitstream as-is and only gets the container tag.

Only the first video stream and the first audio stream are kept — a phone's timecode and
metadata tracks have no place in an mp4 and can make the copy fail.

Everything downstream resolves the source through lib/rush.find_source(), which prefers
build/source-joined.mp4 when it exists — find_silences.py, the audio extract and the
Remotion render (remotion.sh) all read this one file.

Exit codes: 0 done · 1 no video in rush/, or ffmpeg refused the copy.
"""
import os
import subprocess

_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import rush as _rush  # noqa: E402
from lib import platform as _plat  # noqa: E402

# colour_primaries / transfer_characteristics / matrix_coefficients = 1 is bt709
_BT709 = "colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1"
RETAG = {"h264": "h264_metadata=" + _BT709, "hevc": "hevc_metadata=" + _BT709}


def video_codec(path):
    return subprocess.run(
        [_plat.FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=codec_name", "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip()


def main():
    if len(_sys.argv) < 2:
        raise SystemExit("usage: prepare_source.py <work>")
    work = os.path.abspath(_sys.argv[1])
    os.makedirs(os.path.join(work, "build"), exist_ok=True)
    clips = _rush.find_clips(work)
    if not clips:
        raise SystemExit("rush/ has no video to prepare")
    out = os.path.join(work, "build", "source-joined.mp4")

    if len(clips) == 1:
        inputs = ["-i", clips[0]]
    else:
        lst = os.path.join(work, "build", ".join-list.txt")
        with open(lst, "w", encoding="utf-8") as f:
            for c in clips:
                f.write("file '%s'\n" % c.replace("'", "'\\''"))
        inputs = ["-f", "concat", "-safe", "0", "-i", lst]

    codec = video_codec(clips[0])
    retag = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
    if codec in RETAG:
        retag = ["-bsf:v", RETAG[codec]] + retag
    else:
        print(f"  ! {codec or 'unknown'} video: no bitstream re-tag for it, container tag only")
    if codec == "hevc":
        retag += ["-tag:v", "hvc1"]   # the mp4 sample entry browsers expect for HEVC

    r = subprocess.run(
        [_plat.FFMPEG, "-v", "error"] + inputs
        + ["-map", "0:v:0", "-map", "0:a:0?", "-c", "copy"] + retag
        + ["-movflags", "+faststart", "-y", out])
    if r.returncode != 0:
        raise SystemExit(
            "ffmpeg stream copy failed — with several takes they probably differ in codec / "
            "resolution / fps. Re-encode them to a common format first.")
    print(f"{len(clips)} take(s) -> {out}  ({codec}, stream copy, tagged bt709)")


if __name__ == "__main__":
    main()
