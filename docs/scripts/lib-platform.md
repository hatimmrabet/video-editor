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

### Functions

| Function | Purpose |
|---|---|
| `vevo_abspath <dir>` | `cd "$dir" && { pwd -W \|\| pwd }`. The `pwd -W` is the key Windows fix: Git-Bash's `/c/...` is not understood by native Windows Python — `pwd -W` yields `C:/...` |
| `vevo_chrome_path` | `$CHROME_PATH` → per-OS candidate list → empty. Windows candidates: `%PROGRAMFILES%`, `%PROGRAMFILES(X86)%`, `%LOCALAPPDATA%` + `\Google\Chrome\Application\chrome.exe` |
| `vevo_pkg_mgr` | `brew` \| `winget` \| `apt` \| `dnf` |

### Sourced by

`setup.sh`, `encode.sh`, `master_audio.sh`, `contact_sheet.sh`, `remotion/remotion.sh`.

---

## `lib/platform.js`

```js
const { fileUrl, chromePath, launchOptions, resolvePuppeteer } = require('./lib/platform');
```

### Exports

| Function | Purpose |
|---|---|
| `fileUrl(p)` | `pathToFileURL(path.resolve(p)).href` — a correct `file://` URL on every OS (drive letter, spaces) |
| `chromePath()` | `$CHROME_PATH` → per-OS candidates → `null` (caller then passes `{ channel: 'chrome' }` to Puppeteer) |
| `launchOptions(extra)` | ready-made Puppeteer options: `headless:'new'`, args `--no-sandbox --allow-file-access-from-files --font-render-hinting=none --force-color-profile=srgb`; sets `executablePath` if Chrome found, else `channel:'chrome'` |
| `resolvePuppeteer()` | tries `$PUPPETEER_PATH`, `puppeteer-core`, `puppeteer`, `./node_modules/...`, `../../node_modules/puppeteer-core`; throws with an install hint if none found |

### Required by

`render_frames.js`, `safe_check.js`. **Not** used by `fx/behind_text.js` (macOS-only, uses
Unix command strings directly).

## Gotchas

- The Python scripts the skill invokes directly (`plan_cuts.py`, `captions.py`, …) do
  **not** go through `vevo_abspath` — they do `os.path.abspath(sys.argv[1])`. The caller
  must pass a Windows-style path, not `/c/...`. See [../windows.md](../windows.md#gotcha-1--path-translation).
- Keep `platform.sh` / `platform.js` as the single source of truth: no other file should
  hard-code a Chrome path or build a `file://` URL by string concatenation.
