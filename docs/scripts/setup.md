# `setup.sh`

`video-editor/scripts/setup.sh` · bash · shared

> Prepares the toolchain. It installs **only three things at the system level** —
> `ffmpeg`, `Node`, and `uv` — via the OS package manager. Everything else is isolated:
> Python packages go into a `uv`-managed `.venv/`, and the browser that renders the scenes
> is downloaded by `npm` into `node_modules/`. See
> [../design/execution.md](../design/execution.md).

## CLI

```
bash setup.sh            # report only — no installs, no downloads
bash setup.sh --install  # install missing system tools, then `uv sync` + `npm ci`
```

| Exit code | Meaning |
|---|---|
| 0 | `✅ ready.` — everything present |
| 10 | something missing, `--install` not passed |
| 11 | `--install` ran but something still failed |

**Report mode is strictly read-only** — it never runs `uv sync` or `npm ci`, so it returns
instantly even on a GPU machine (where the CUDA libs are large).

## Inputs / Outputs

Reads nothing (only `command -v`, `"${VEVO_PY[@]}" -c "import …"`, `node -e "require.resolve(…)"`).
Writes nothing directly; `--install` creates `../.venv/` and `../node_modules/`.

## What it installs

| Item | Check | Install (`--install`) |
|---|---|---|
| `uv` | `command -v uv` | `brew install uv` / `winget install --id astral-sh.uv` / the standalone `curl \| sh` installer |
| `ffmpeg` | `command -v ffmpeg` | `brew` / `winget install --id Gyan.FFmpeg` / `apt` / `dnf` |
| `node` | `command -v node` | `brew` / `winget install --id OpenJS.NodeJS.LTS` / `apt` (need ≥ 22.12) |
| Python deps | `import numpy, PIL` via `VEVO_PY` | `cd .. && uv sync` (`--extra gpu` when `nvidia-smi` is present) |
| Node deps + Chromium | `node -e "require.resolve('puppeteer')"` | `cd .. && npm ci` (puppeteer downloads a matched Chromium) |

GPU: if `nvidia-smi` is present, report mode prints whether `ctranslate2` is importable;
`--install` adds `uv sync --extra gpu` (the `nvidia-*-cu12` wheels — large, one-time).

## Cross-platform

Sources `lib/platform.sh` (gets `VEVO_SKILL_DIR`, `VEVO_PY`, `vevo_pkg_mgr`). Requires
Git-Bash / WSL. The `winget` branch uses `--disable-interactivity`. After bootstrapping a
fresh `uv` it re-sources `platform.sh` so `VEVO_PY` picks it up.

## Place in the flow

Stage 0 (`SKILL.md` step 0). Run silently; on `✅ ready.` say nothing. If it reports
missing tools, tell the user in one sentence what will be installed and why, get consent,
then `bash setup.sh --install`.

## Gotchas

- **No system Chrome needed** — `puppeteer` bundles its own. `$CHROME_PATH` still overrides.
- **No system Python packages** — `--break-system-packages` is gone. If `uv` somehow can't
  be installed, `VEVO_PY` falls back to `python3` and the user's system Python must have
  numpy / pillow / faster-whisper (the script says so).
- The Remotion engine's ~500 MB is still installed on demand by `remotion.sh setup`, not here.
