# Execution & dependency management

**Status: implemented** (this is the one `docs/design/` document that is built, not just
designed — Pass 1). It describes how the skill's dependencies are isolated so that running
it does not install anything into the user's system Python or require a separately-installed
Chrome.

## Problem it solved

`setup.sh` used to run:

```sh
pip_install(){ pip3 install --quiet "$@" || pip3 install --quiet --break-system-packages "$@"; }
```

— installing `numpy`, `faster-whisper` etc. into whatever `pip3` pointed at, with a
`--break-system-packages` fallback that can damage the OS Python (PEP 668). No version
pins, no reproducibility. And `puppeteer-core` needs an externally-installed Google Chrome
that `setup.sh` could only print a note about.

## The dependency surface (why this is small)

| Ecosystem | Third-party deps | Notes |
|---|---|---|
| Python | `numpy`, `pillow`, `faster-whisper` (+ optional `openai-whisper` fallback, optional `nvidia-*-cu12` for GPU) | everything else is stdlib + `subprocess` to ffmpeg |
| Node | `puppeteer` | drives headless Chrome, which renders every caption/scene |
| System binaries | `ffmpeg` / `ffprobe`, `node`, `uv`, (macOS) `swiftc` | genuinely OS-level |

## The model

```
video-editor/                 ← the skill dir (== ~/.claude/skills/video-editor/)
  pyproject.toml              numpy · pillow · faster-whisper   [gpu] · [whisper-fallback]
  uv.lock                     committed — reproducible
  .python-version             uv provisions this Python
  .nvmrc                      Node floor (puppeteer needs ≥ 22.12)
  .venv/                      gitignored — uv-managed
  package.json / -lock.json   puppeteer (bundles a matched Chromium)
  node_modules/.cache/puppeteer/   gitignored — the browser lives here
```

- **Python → `uv`.** `uv run scripts/X.py <work>` discovers `./pyproject.toml` from the
  skill dir and **auto-syncs `.venv/` on demand** — no activation, no separate install
  step for the happy path. `setup.sh` still calls `uv sync` up front to warm it (and to
  add `--extra gpu` when an NVIDIA GPU is present).
- **Node → `npm ci`** in the skill dir. `puppeteer` (not `puppeteer-core`) downloads a
  version-matched Chromium into `node_modules/.cache/puppeteer/` on install. No system
  Chrome, and no "puppeteer vs system-Chrome version mismatch" class of bugs.
- **System binaries** are installed by `setup.sh` through the OS package manager
  (`brew` / `winget` / `apt` / `dnf`): `ffmpeg`, `node`, `uv`. `swiftc` (Xcode CLT, macOS
  only) for the person-cutout effect.

A plain `python3 -c "import numpy"` still fails after setup — the proof that the system
Python is untouched.

## The `VEVO_*` contract (`scripts/lib/platform.sh`)

`platform.sh` locates itself via `${BASH_SOURCE[0]}` (independent of which script sourced
it) and exports:

| Var | Meaning |
|---|---|
| `VEVO_SKILL_DIR` | absolute path of the skill root (`.../video-editor`) |
| `VEVO_PY` | a bash array: `uv run --project "$VEVO_SKILL_DIR" python` if `uv` is on PATH; else `$VEVO_SKILL_DIR/.venv/bin/python` (or `Scripts/python.exe` on Windows); else `python3` |
| `PUPPETEER_CACHE_DIR` | `$VEVO_SKILL_DIR/node_modules/.cache/puppeteer` — keeps the browser with the skill |

Shell scripts use `"${VEVO_PY[@]}" -c "…"` for their inline Python instead of a bare
`python3`. The standalone Python scripts are invoked as `uv run scripts/X.py <work>` in
`SKILL.md` / `docs/`.

`scripts/lib/platform.js` `launchOptions(pptr)` takes the resolved puppeteer module and
prefers, in order: `$CHROME_PATH` → puppeteer's bundled `executablePath()` → a
system-Chrome path → `channel: 'chrome'`.

## Deferred (tracked as issues in Pass 1)

- **`VEVO_FFMPEG` / `VEVO_FFPROBE` + a static-binary fallback** — thread a resolver through
  the ~20 ffmpeg / ~9 ffprobe call sites and download a static build when the OS package
  is missing. Not done because ffmpeg is a well-behaved OS package and the change is broad.
- **A committed lockfile for the Remotion template** (`scripts/remotion/template/` — its
  `remotion.sh setup` does an unpinned `npm install`).
- **An optional CPU-only `Dockerfile`** for "don't touch my machine at all" / CI. Not the
  default: GPU passthrough on Windows/macOS is painful and the skill writes files the user
  wants locally.
