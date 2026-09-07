# `lib/platform.sh` + `lib/platform.js` + `lib/platform.py`

`video-editor/scripts/lib/` · bash + node + python · shared

> Cross-platform helpers. `platform.sh` is sourced by every shell script; `platform.js` is
> required by every Node script; `platform.py` is imported by the Python scripts that shell
> out to ffmpeg. They absorb the macOS / Windows / Linux differences so nothing else
> hard-codes a path, a Chrome location, a `file://` URL, or the ffmpeg binary. **They add
> Windows/Linux branches only — macOS behavior is unchanged.**

## The `ffmpeg` / `ffprobe` contract (all three, issue #44)

`$VEVO_FFMPEG` / `$VEVO_FFPROBE` — if set, they win everywhere; otherwise the bare name
(PATH resolves it). One override points every one of the ~20 ffmpeg / ~9 ffprobe call
sites at a specific binary (a static build, a Docker image's copy, a non-standard path).

| | Reads it via |
|---|---|
| `.sh` (`encode.sh`, `master_audio.sh`, `contact_sheet.sh`, `remotion.sh`) | `"$VEVO_FFMPEG"` / `"$VEVO_FFPROBE"` — `platform.sh` sets them with `: "${VEVO_FFMPEG:=$(command -v ffmpeg …)}"` |
| `.py` (`reframe.py`, `plan_cuts.py`, `join_takes.py`, `assemble_longform.py`, `montage_mode.py`) | `from lib import platform as _plat` → `_plat.FFMPEG` / `_plat.FFPROBE` |
| `run.py` stage manifests | `{ffmpeg}` / `{ffprobe}` template vars, substituted from `lib/platform.py` |
| `fx/behind_text.js` | `require('../lib/platform').ffmpegPath()` |

No static-binary download (scope A) — `ffmpeg` is a well-behaved OS package; `setup.sh`
still installs it, and now checks `$VEVO_FFMPEG` so a custom binary doesn't trigger a
spurious install.

---

## `lib/platform.sh`

Source it at the top of a shell script:

```bash
. "$(dirname "$0")/lib/platform.sh"          # from scripts/
. "$(cd "$(dirname "$0")/.." && pwd)/lib/platform.sh"   # from scripts/remotion/
```

### What it sets

| | |
|---|---|
| `PYTHONUTF8=1`, `PYTHONIOENCODING=utf-8` | so Arabic `print()` doesn't crash under Windows cp1252 |
| `VEVO_OS` | `mac` \| `windows` \| `linux` \| `unknown` (from `uname -s`) |
| `VEVO_SKILL_DIR` | absolute path of the skill root, found via `${BASH_SOURCE[0]}` (independent of the sourcing script) |
| `VEVO_PY` | a **bash array**: `uv run --project "$VEVO_SKILL_DIR" python` if `uv` is on PATH; else the skill's `.venv` python (`bin/python` or `Scripts/python.exe`); else `python3`. Used as `"${VEVO_PY[@]}" -c "…"` |
| `VEVO_FFMPEG`, `VEVO_FFPROBE` | the ffmpeg / ffprobe binary — a pre-set value wins, else `command -v` resolves it, else the bare name. Exported (issue #44) |

`.sh` scripts run their inline Python (`encode.sh`, `master_audio.sh`, `contact_sheet.sh`,
`remotion.sh`) through `"${VEVO_PY[@]}"`, never a bare `python3`.

### Functions

| Function | Purpose |
|---|---|
| `vevo_abspath <dir>` | `cd "$dir" && { pwd -W \|\| pwd }`. The `pwd -W` is the key Windows fix: Git-Bash's `/c/...` is not understood by native Windows Python — `pwd -W` yields `C:/...` |
| `vevo_chrome_path` | `$CHROME_PATH` → per-OS candidate list → empty. **System-Chrome fallback only** — `puppeteer` normally brings its own |
| `vevo_pkg_mgr` | `brew` \| `winget` \| `apt` \| `dnf` |

### Sourced by

`setup.sh`, `encode.sh`, `master_audio.sh`, `contact_sheet.sh`, `remotion/remotion.sh`.
Every one gets `VEVO_SKILL_DIR` and the `VEVO_PY` array.

---

## `lib/platform.js`

```js
const { fileUrl, chromePath, launchOptions, resolvePuppeteer, hasFullPuppeteer } = require('./lib/platform');
```

### Exports

| Function | Purpose |
|---|---|
| `fileUrl(p)` | `pathToFileURL(path.resolve(p)).href` — a correct `file://` URL on every OS (drive letter, spaces) |
| `chromePath()` | system-Chrome fallback: `$CHROME_PATH` → per-OS candidates → `null` |
| `hasFullPuppeteer()` | is the full `puppeteer` package (bundled Chromium) resolvable? |
| `launchOptions(extra)` | ready-made options: `headless:true`, the four `--no-sandbox …` args, and a browser only if needed — `$CHROME_PATH` if set; else nothing when `hasFullPuppeteer()` (puppeteer finds its own via `.puppeteerrc.cjs`); else the system-Chrome path or `channel:'chrome'` |
| `resolvePuppeteer()` | tries `$PUPPETEER_PATH`, `puppeteer` (preferred), `puppeteer-core`, then the same names under `./node_modules` and the skill's `node_modules`; throws with a `setup.sh` hint if none found |
| `skillDir()` | the skill root — same arithmetic as `VEVO_SKILL_DIR` in `platform.sh` |
| `pythonCmd()` | JS mirror of `VEVO_PY`: `['uv','run','--project',skillDir(),'python']` if `uv` is on PATH, else the skill's `.venv` python, else `['python3']`. Returns an array — `const c = pythonCmd(); execFileSync(c[0], [...c.slice(1), script, arg])`. Used by [`lib/config.js`](lib-config.md) to shell out to `config.py` rather than reimplementing its logic |

### Required by

`render_frames.js`, `safe_check.js`, and `fx/behind_text.js` (for `ffmpegPath()` only —
the rest of that macOS-only script still uses Unix command strings directly).

---

## `lib/platform.py`

```py
from lib import platform as _plat
subprocess.run([_plat.FFMPEG, "-v", "error", "-i", src, ...])
```

The Python mirror — only the ffmpeg / ffprobe resolver so far (before #44 the Python side
had no platform lib). Module-level `FFMPEG` / `FFPROBE` are resolved once at import
(`shutil.which($VEVO_FFMPEG or "ffmpeg") or the bare name`); `ffmpeg()` / `ffprobe()`
re-resolve on call.

### Imported by

`run.py` (feeds `{ffmpeg}` / `{ffprobe}` into the stage-manifest substitution), `reframe.py`,
`plan_cuts.py`, `join_takes.py`, `assemble_longform.py`, `montage_mode.py` (via its `ff()`
helper, which swaps a leading `"ffmpeg"` / `"ffprobe"` in any `run()` argv).

## Gotchas

- The Python scripts the skill invokes directly (`plan_cuts.py`, `captions.py`, …) do
  **not** go through `vevo_abspath` — they do `os.path.abspath(sys.argv[1])`. The caller
  must pass a Windows-style path, not `/c/...`. See [../windows.md](../windows.md#gotcha-1--path-translation).
- Keep `platform.sh` / `platform.js` as the single source of truth: no other file should
  hard-code a Chrome path or build a `file://` URL by string concatenation.
