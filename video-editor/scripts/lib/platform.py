# -*- coding: utf-8 -*-
"""Cross-platform helpers shared by the Python scripts — the mirror of
`lib/platform.sh` (`VEVO_*`) and `lib/platform.js` for the Python side.

- `FFMPEG` / `FFPROBE` (issue #44): the ~16 Python call sites used the bare string
  `"ffmpeg"` / `"ffprobe"`. These honour `$VEVO_FFMPEG` / `$VEVO_FFPROBE` (same names
  `platform.sh` exports), then fall back to the name on PATH.
- `python_argv()`: how to spawn one of the skill's own Python scripts — `uv run` if `uv`
  is on PATH, else the skill's `.venv`, else `python3`. Mirror of `platform.js`'s
  `pythonCmd()` and `platform.sh`'s `VEVO_PY`. Used by `web.py` so it runs without `uv`.

    from lib import platform as _plat
    subprocess.run([_plat.FFMPEG, "-v", "error", "-i", src, ...])
    subprocess.run([*_plat.python_argv(), "scripts/run.py", work, "--json"], cwd=_plat.SKILL)
"""
import os
import shutil

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .../video-editor/scripts
SKILL = os.path.dirname(SCRIPTS)                                        # .../video-editor


def _tool(name, env):
    """Absolute path to `name`, honouring $<env>; the bare name if PATH can't resolve it
    yet (it may be installed by the time the subprocess runs)."""
    want = os.environ.get(env) or name
    return shutil.which(want) or want


def ffmpeg():
    return _tool("ffmpeg", "VEVO_FFMPEG")


def ffprobe():
    return _tool("ffprobe", "VEVO_FFPROBE")


def python_argv():
    """Prefix for spawning a skill Python script (cwd = SKILL). `uv run` if available,
    else the skill's venv python, else `python3`."""
    if shutil.which("uv"):
        return ["uv", "run", "--project", SKILL, "python"]
    venv = os.path.join(SKILL, ".venv", "Scripts", "python.exe") if os.name == "nt" \
        else os.path.join(SKILL, ".venv", "bin", "python")
    return [venv] if os.path.exists(venv) else ["python3"]


FFMPEG = ffmpeg()
FFPROBE = ffprobe()
