# Architecture

## The core idea: the whole edit is code

There is no editing application and no timeline UI in the critical path. The edit is
produced by a chain of small scripts:

- **ffmpeg** does every cut, crop, concat, mux and loudness pass.
- **Whisper** (faster-whisper on GPU when available, else CPU, else openai-whisper)
  transcribes the speech with per-word start/end times.
- A **drawing engine** composites captions and motion graphics on top of the video,
  frame by frame.

The output is a single MP4. Nothing is uploaded to any server — every tool runs locally.

## Two modes

The skill decides the mode from the input; it never asks the user.

| | **Speech ad** (default) | **Montage** |
|---|---|---|
| Input | one video of a person talking | a folder of many speechless clips |
| Selection driven by | the speech (remove silences + repeated sentences) | the shot itself (sharpness · motion · lighting · color) |
| Captions | yes, word-synced | none — no transcription at all |
| Theme / colors / logo | required | not used (there is no text) |
| Script | [`scripts/`](scripts/) stages 0–13 | [`montage_mode.py`](scripts/montage_mode.md) only |

Detection rule: **a folder / multiple clips ⇒ montage; a single file with speech ⇒
speech ad.** If a folder turns out to have meaningful speech and the user wants captions,
treat the main clip as a speech ad.

## Two rendering engines (speech-ad mode only)

The scene *style* is identical between them; only the technology that draws the scenes
differs. The skill always starts with the **light engine, silently**, and only opens the
Remotion engine if the user explicitly asks to edit visually.

| | **Light engine** | **Remotion engine** |
|---|---|---|
| Tech | headless Chrome renders a `<canvas>` frame-by-frame to JPEGs | React + Remotion renders an MP4 directly |
| Driver | [`render_frames.js`](scripts/render_frames.md) + [`encode.sh`](scripts/encode.md) | [`remotion/remotion.sh`](scripts/remotion-remotion_sh.md) |
| Scene code | inline JS in `<work>/compose.html` | inline JSX in `<work>/remotion/src/Scenes.tsx` |
| Extra download | none | ~500 MB once (`npm install`) |
| Licensing | free | paid for companies with 4+ employees |
| Full 48 s render | ≈ 12 min (1461 frames) | comparable, no intermediate frames |

Both consume the same inputs (`caps.json`, `theme.json`, `sfx.json`/`sfx.wav`,
`cutz.mp4`, `logo.png`). See [engines.md](engines.md) for how they draw and where they
have diverged.

## The "work dir" model

Every run operates on one **work directory** (`<work>`), passed as the first argument to
every script. Each script reads its inputs from `<work>` and writes its outputs back
there. There is no database and no global state — the work dir *is* the state.

A speech-ad work dir accumulates roughly this:

```
<work>/
  src.mov            the source video (copied in)
  theme.json         colors, font, logo, handle, crop anchors     ← hand-authored
  logo.png           the creator's logo
  compose.html       copy of compose.reference.html, scenes rewritten  ← hand-authored
  studio.html        copy of scripts/studio.html
  cut.json           silence-cut plan               ← plan_cuts.py
  a.wav / a.json     extracted audio / transcript   ← ffmpeg / transcribe.py
  fixes.json         corrected transcript + hot words   ← hand-authored
  caps.json          caption card timings           ← captions.py
  script.txt         numbered transcript for editing   ← edit_script.py
  cutz.mp4           cut + reframed video           ← reframe.py
  vfr/*.jpg          source frames (fps=30)         ← ffmpeg
  sfx.json / sfx.wav sound-effect cues / rendered bed   ← hand-authored / sound_fx.py
  behind.json + bt/  person-cutout data (macOS)     ← fx/behind_text.js
  stage.json         video-rectangle schedule (Remotion only)   ← hand-authored, optional
  outro.json         end-card copy (Remotion only)  ← hand-authored, optional
  safe.json          safe-zone overrides            ← hand-authored, optional
  out/*.jpg          composited frames              ← render_frames.js
  ad-final.mp4       muxed video                    ← encode.sh / remotion.sh
  ad-master.mp4      loudness-normalized            ← master_audio.sh
  ad-master.srt/.txt subtitles + caption text       ← subtitles.py
  safe.jpg           worst safe-zone frame          ← safe_check.js
  remotion/          scaffolded Remotion project (if used)   ← remotion.sh
```

A montage work dir is much smaller: `montage.json` (state), `montage-sheet.jpg`,
`montage.mp4`, optional `bg-audio.mp3`.

## Data contracts

Scripts communicate only through JSON files in the work dir. The important ones:

| File | Written by | Read by |
|---|---|---|
| `cut.json` | `plan_cuts.py` (mutated by `edit_script.py`) | `captions.py`, `reframe.py` |
| `a.json` | `transcribe.py` | `captions.py` |
| `fixes.json` | hand-authored | `captions.py` |
| `caps.json` | `captions.py` (mutated by `edit_script.py`) | `sound_fx.py`, `render_frames.js`, `safe_check.js`, `subtitles.py`, `fx/behind_text.js`, Remotion |
| `theme.json` | hand-authored | `reframe.py`, `render_frames.js`, `safe_check.js`, `compose.html`, `remotion.sh` |
| `sfx.json` | hand-authored (mutated by `edit_script.py`) | `sound_fx.py`, `render_frames.js`, `encode.sh`, `safe_check.js` |
| `behind.json` | `fx/behind_text.js` | `render_frames.js` |
| `safe.json` | hand-authored (optional) | `safe_check.js`, `remotion.sh` |
| `stage.json`, `outro.json` | hand-authored (optional) | `remotion.sh` → `project.json` |
| `project.json` | generated by `remotion.sh` | Remotion `theme.ts` |
| `montage.json` | `montage_mode.py` | `montage_mode.py` |

Full field-by-field schemas: [data-contracts.md](data-contracts.md).

## Cross-platform model

The pipeline runs on macOS, Windows (Git-Bash/WSL) and Linux. Two helper modules absorb
the differences:

- [`lib/platform.sh`](scripts/lib-platform.md) — sourced by every `.sh` script. OS
  detection, `vevo_abspath` (`/c/...` → `C:/...` for native Python), `VEVO_SKILL_DIR` /
  `VEVO_PY`, package-manager selection, forces UTF-8 for Python.
- [`lib/platform.js`](scripts/lib-platform.md) — required by the Node scripts. `fileUrl`
  (correct `file://` on Windows), puppeteer resolution, launch options.

## Dependency isolation

`setup.sh` installs only **ffmpeg**, **Node** and **uv** at the system level. Python
packages live in a `uv`-managed `video-editor/.venv/` (`uv run scripts/X.py …`); the
browser that renders scenes is a `puppeteer`-bundled Chromium under
`node_modules/`. Nothing touches the system Python or needs a separate Chrome install.
See [design/execution.md](design/execution.md).

The one hard macOS dependency is the person-cutout effect
([`fx/personmask.swift`](scripts/fx-personmask.md), Apple Vision). Everything that needs
it skips itself on other platforms; the rest of the pipeline is unaffected. See
[windows.md](windows.md).

## What is NOT in the architecture (deliberately)

- **No publishing, no scheduling.** The pipeline delivers a file; posting is the user's job.
- **No color grade on the person's image** by default — captions and cards carry color,
  the video keeps its original colors (`reframe.py` only re-tags to bt709).
- **No per-project config file yet.** `theme.json` is the closest thing; `stage.json` and
  `outro.json` exist but only the Remotion engine reads them. Unifying this is the first
  item in [design/](design/).
