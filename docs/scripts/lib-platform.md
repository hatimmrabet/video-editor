# `lib/platform.sh` + `lib/platform.js`

`video-editor/scripts/lib/` · bash + node · shared

> Cross-platform helpers. `platform.sh` is sourced by every shell script; `platform.js` is
> required by every Node script. They absorb the macOS / Windows / Linux differences so
> nothing else hard-codes a path, a Chrome location, or a `file://` URL. **They add
> Windows/Linux branches only — macOS behavior is unchanged.**

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

### Required by

`render_frames.js`, `safe_check.js`. **Not** used by `fx/behind_text.js` (macOS-only, uses
Unix command strings directly).

## Gotchas

- The Python scripts the skill invokes directly (`plan_cuts.py`, `captions.py`, …) do
  **not** go through `vevo_abspath` — they do `os.path.abspath(sys.argv[1])`. The caller
  must pass a Windows-style path, not `/c/...`. See [../windows.md](../windows.md#gotcha-1--path-translation).
- Keep `platform.sh` / `platform.js` as the single source of truth: no other file should
  hard-code a Chrome path or build a `file://` URL by string concatenation.
