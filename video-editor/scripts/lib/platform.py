# -*- coding: utf-8 -*-
"""Cross-platform helpers shared by the Python scripts — the mirror of
`lib/platform.sh` (`VEVO_*`) and `lib/platform.js` for the Python side.

Only the ffmpeg / ffprobe resolver for now (issue #44): the ~16 Python call sites used
the bare string `"ffmpeg"` / `"ffprobe"`, so there was no single place to point them at a
specific binary. `FFMPEG` / `FFPROBE` honour `$VEVO_FFMPEG` / `$VEVO_FFPROBE` (same names
`platform.sh` exports), then fall back to the name on PATH.

    from lib import platform as _plat
    subprocess.run([_plat.FFMPEG, "-v", "error", "-i", src, ...])
"""
import os
import shutil


def _tool(name, env):
    """Absolute path to `name`, honouring $<env>; the bare name if PATH can't resolve it
    yet (it may be installed by the time the subprocess runs)."""
    want = os.environ.get(env) or name
    return shutil.which(want) or want


def ffmpeg():
    return _tool("ffmpeg", "VEVO_FFMPEG")


def ffprobe():
    return _tool("ffprobe", "VEVO_FFPROBE")


FFMPEG = ffmpeg()
FFPROBE = ffprobe()
