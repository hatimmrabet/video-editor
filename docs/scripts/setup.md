# `setup.sh`

`video-editor/scripts/setup.sh` · bash · shared

> Environment probe and installer. Detects the OS via `lib/platform.sh`, checks for
> ffmpeg, node, Python `numpy`, a Whisper engine, Chrome and `puppeteer-core`, and
> optionally installs what's missing using the platform package manager. Also detects an
> NVIDIA GPU + CUDA libs and reports whether the Remotion engine is available.

## CLI

```
bash setup.sh            # probe only — prints "الجاهز / الناقص"
bash setup.sh --install  # install what's missing
```

| Exit code | Meaning |
|---|---|
| 0 | everything present |
| 10 | something missing, `--install` not passed |
| 11 | `--install` ran but something still failed |

## Inputs

None. It only queries `command -v`, `python3 -c "import ..."`, and the filesystem for Chrome.

## Outputs

None.

## External tools

`command -v`, `python3`, `node`, `npm`, `nvidia-smi`. Installers by OS:
`brew` (macOS) · `winget` — `Gyan.FFmpeg`, `OpenJS.NodeJS.LTS` (Windows) · `apt-get` /
`dnf` (Linux). Python packages via `pip3 install` (with a `--break-system-packages` fallback).

## Checks performed

| Item | How | Install target |
|---|---|---|
| ffmpeg | `command -v ffmpeg` | system pkg mgr |
| node | `command -v node` | system pkg mgr |
| numpy | `python3 -c "import numpy"` | `pip3 install numpy` |
| transcriber | `faster_whisper` (preferred) or `whisper` | `pip3 install faster-whisper` |
| chrome | `vevo_chrome_path` | manual (prints a hint) |
| puppeteer-core | `node -e "require.resolve('puppeteer-core')"` | `npm i puppeteer-core` |
| GPU (optional) | `nvidia-smi` + `nvidia.cudnn` / `nvidia.cublas` | prints a `pip install` hint |
| Remotion (optional) | `command -v npm` | not installed here — `remotion.sh setup` does it |

## Cross-platform

Sources `lib/platform.sh` (line 5). Uses `vevo_chrome_path` and `vevo_pkg_mgr`. On Windows
the `winget` branch uses `--disable-interactivity`. Requires Git-Bash / WSL to run at all.

## Place in the flow

Stage 0 of the speech-ad pipeline (`SKILL.md` step 0). Run silently; if it reports missing
tools, tell the user in one sentence what will be installed and why, get consent, then
`bash setup.sh --install`.

## Gotchas

- Chrome is never auto-installed — the user must install it or set `CHROME_PATH`.
- `pip3 install` may need `--break-system-packages` on externally-managed Python (the
  script retries automatically).
