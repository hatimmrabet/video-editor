# Running on Windows

The pipeline runs on Windows, but there are sharp edges. This page collects them.

## Prerequisites

- **Git-Bash or WSL.** Every `.sh` script (`setup.sh`, `encode.sh`, `master_audio.sh`,
  `contact_sheet.sh`, `remotion/remotion.sh`) requires a real bash. They will **not** run
  in `cmd.exe` or PowerShell. The `.py` scripts run via `uv run` and the `.js` scripts via
  `node`.
- **Three system tools**, installed by `setup.sh --install` via `winget`:
  `astral-sh.uv` (`uv`), `OpenJS.NodeJS.LTS` (Node ≥ 22.12), `Gyan.FFmpeg` (ffmpeg).
- **Everything else is isolated** — Python deps in `video-editor/.venv/` (uv), the browser
  in `video-editor/node_modules/.cache/puppeteer/` (npm). **No system Chrome, no system
  `pip install`.** See [design/execution.md](design/execution.md).

## Gotcha 1 — path translation

Git-Bash passes paths like `/c/Users/you/work`, which native Windows Python/Node cannot
resolve. `lib/platform.sh`'s `vevo_abspath()` runs `pwd -W` to get `C:/Users/you/work`,
and **every `.sh` wrapper applies it** before calling Python/Node.

But the Python scripts the skill invokes **directly** — `plan_cuts.py`, `captions.py`,
`reframe.py`, `sound_fx.py`, `transcribe.py`, `edit_script.py`, `montage_mode.py` — just
do `os.path.abspath(sys.argv[1])`. So **the caller must pass a Windows-style path**
(`C:/Users/you/work`) or a relative path, not `/c/Users/...`. The `SKILL.md` examples use
a bare `<work>` placeholder; substitute a real path.

## Gotcha 2 — UTF-8 / Arabic output

`platform.sh` exports `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`. Every Python script
also does `sys.stdout.reconfigure(encoding="utf-8")` at the top and writes files with
`encoding="utf-8"`. Without this, Arabic `print()` crashes under Windows cp1252. Keep
these lines in any new Python script.

## Gotcha 3 — the browser

`puppeteer` (full) downloads a version-matched Chromium into
`video-editor/node_modules/.cache/puppeteer/` on `npm ci` (via `.puppeteerrc.cjs`), and
`launchOptions()` lets puppeteer find it. **No system Chrome is used or needed.**

To force a specific browser anyway, set `CHROME_PATH` — `launchOptions()` honours it
first, and `lib/platform.js`'s `chromePath()` still checks the usual Windows locations
(`%PROGRAMFILES%` / `%PROGRAMFILES(X86)%` / `%LOCALAPPDATA%` `\Google\Chrome\Application\chrome.exe`)
as a last-resort fallback for a `puppeteer-core`-only install.

## Gotcha 4 — CUDA on Windows

For GPU transcription, `transcribe.py`'s `enable_cuda_libs()` walks the pip packages
`nvidia-cublas-cu12` / `nvidia-cudnn-cu12`, calls `os.add_dll_directory()` on their
`bin`/`lib` folders and prepends them to `PATH` — CTranslate2 on Windows won't find them
otherwise. Install:

```
cd video-editor && uv sync --extra gpu
```

`setup.sh --install` runs exactly this when it sees `nvidia-smi`. Report mode only checks
whether `ctranslate2` is importable and prints the GPU status.

## Gotcha 5 — fonts for burned-in labels

`contact_sheet.sh` and `montage_mode.py` draw timestamp labels with PIL. Their font search
includes `C:\Windows\Fonts\arialbd.ttf` and `segoeuib.ttf`. If PIL is unavailable,
`contact_sheet.sh` falls back to an unlabeled `hstack`.

## Gotcha 6 — bash-only constructs

`master_audio.sh` uses process substitution (`read -r … < <(…)`) and `${IN%.mp4}` — it
needs a real bash, not a minimal shell. Same for the heredoc Python blocks in
`contact_sheet.sh` and `remotion/remotion.sh`, and for the `VEVO_PY` **bash array** set in
`lib/platform.sh` (`"${VEVO_PY[@]}"`).

## Gotcha 7 — the macOS-only effect

`fx/personmask.swift` (Apple Vision) and therefore `fx/behind_text.js` (`build` / `cutout`
/ `headout`, SKILL.md 7.5 / 7.6) are **macOS only**. On Windows `swiftc` is absent →
`behind_text.js` prints `xcode-select --install` and exits code 4. The rest of the
pipeline is unaffected: `render_frames.js` only activates the person overlay when
`behind.json` exists.

## Minor

- `sound_fx.py` hardcodes `os.path.abspath(sys.argv[1]) + "/"` — harmless, Python on
  Windows accepts forward slashes.
- `fx/behind_text.js` builds `<work>/bt/personmask` with no `.exe` suffix — irrelevant on
  Windows (it exits early), but note it if anyone ports the effect.

## How Windows support was added (reference)

See [`../FORK.md`](../FORK.md). In short: `lib/platform.sh` + `lib/platform.js` created;
`render_frames.js` / `safe_check.js` switched to `lib/platform.js`; `encode.sh` /
`master_audio.sh` / `contact_sheet.sh` / `remotion.sh` source `lib/platform.sh`;
`transcribe.py` added (replaces `python -m whisper`, adds Windows CUDA support);
`reframe.py` accepts landscape sources; `contact_sheet.sh` adds Windows fonts.
