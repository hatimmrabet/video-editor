# Running on Windows

The pipeline runs on Windows, but there are sharp edges. This page collects them.

## Prerequisites

- **Git-Bash or WSL.** Every `.sh` script (`setup.sh`, `encode.sh`, `master_audio.sh`,
  `contact_sheet.sh`, `remotion/remotion.sh`) requires a real bash. They will **not** run
  in `cmd.exe` or PowerShell. The `.py` and `.js` scripts run under native `python3` /
  `node` and are the Windows-friendly core.
- **Python 3** on `PATH` as `python3` (or aliased). numpy required (`sound_fx.py`,
  `montage_mode.py` metrics).
- **Node** + `puppeteer-core` (installed by `setup.sh --install`).
- **Chrome** — see discovery below.
- **ffmpeg** — `setup.sh --install` uses `winget install --id Gyan.FFmpeg`.
- **Whisper** — `faster-whisper` (preferred) or `openai-whisper`.

`setup.sh` detects the OS via `lib/platform.sh` and uses `winget` for system packages.
Baked-in winget IDs: `Gyan.FFmpeg`, `OpenJS.NodeJS.LTS`.

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

## Gotcha 3 — Chrome discovery

`lib/platform.sh` / `lib/platform.js` look for Chrome in this order:

1. `$CHROME_PATH` (if set and executable)
2. `%PROGRAMFILES%\Google\Chrome\Application\chrome.exe`
3. `%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe`
4. `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
5. (Node only) fall back to Puppeteer `channel: 'chrome'`

If Chrome is installed somewhere else, set `CHROME_PATH`.

## Gotcha 4 — CUDA on Windows

For GPU transcription, `transcribe.py`'s `enable_cuda_libs()` walks the pip packages
`nvidia-cublas-cu12` / `nvidia-cudnn-cu12`, calls `os.add_dll_directory()` on their
`bin`/`lib` folders and prepends them to `PATH` — CTranslate2 on Windows won't find them
otherwise. Install:

```
pip install faster-whisper nvidia-cublas-cu12 nvidia-cudnn-cu12
```

`setup.sh` detects an NVIDIA GPU (`nvidia-smi`) and prints this hint if the CUDA libs are missing.

## Gotcha 5 — fonts for burned-in labels

`contact_sheet.sh` and `montage_mode.py` draw timestamp labels with PIL. Their font search
includes `C:\Windows\Fonts\arialbd.ttf` and `segoeuib.ttf`. If PIL is unavailable,
`contact_sheet.sh` falls back to an unlabeled `hstack`.

## Gotcha 6 — bash-only constructs

`master_audio.sh` uses process substitution (`read -r … < <(…)`) and `${IN%.mp4}` — it
needs a real bash, not a minimal shell. Same for the heredoc Python blocks in
`contact_sheet.sh` and `remotion/remotion.sh`.

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

## What the fork changed for Windows (reference)

See `FORK.md` "passe 1". In short: `lib/platform.sh` + `lib/platform.js` created;
`render_frames.js` / `safe_check.js` switched to `lib/platform.js`; `encode.sh` /
`master_audio.sh` / `contact_sheet.sh` / `remotion.sh` source `lib/platform.sh`;
`transcribe.py` added (replaces `python -m whisper`, adds Windows CUDA support);
`reframe.py` accepts landscape sources; `contact_sheet.sh` adds Windows fonts.
