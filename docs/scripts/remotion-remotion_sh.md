# `remotion/remotion.sh`

`video-editor/scripts/remotion/remotion.sh` · bash · Remotion engine

> Driver for the optional Remotion engine (a live timeline instead of pre-rendered
> frames). Scaffolds a Remotion project inside the work dir, syncs data/assets into it,
> and either opens the studio or renders an MP4 directly.

## CLI

```
remotion.sh <work> setup            # sync + npm install in <work>/remotion (~500 MB, once)
remotion.sh <work> sync             # refresh data/assets only
remotion.sh <work> studio [port]    # npx remotion studio (default port 3000)
remotion.sh <work> render [out.mp4] # npx remotion render Ad <out> --codec h264 --crf 21 --jpeg-quality 95
```

## Inputs (in `<work>`)

| File | Role |
|---|---|
| `build/captions.json` | copied verbatim to `remotion/src/caps.json` |
| `config/project.config.json` (via [`lib/config.py`](lib-config.md)'s `load()`) | `.theme` subset → `project.json.theme`; `.theme.logo` (default `config/logo.png`) → `remotion/public/logo.png` |
| `build/sound-cues.json` | `.outro` → `project.json.outro`; existence of `build/sound-effects.wav` → `project.json.sfx` |
| `build/sound-effects.wav` | → `remotion/public/sfx.wav` |
| `build/video-reframed.mp4` | → `remotion/public/video.mp4` |
| `config/stage.json` | → `project.json.stage` (default one `FULL` span) |
| `config/outro.json` | → `project.json.outro_copy` |
| `config/safe.json` | `.guides` → `project.json.guides` |
| `scripts/transitions.json` (via [`lib/transitions.py`](lib-transitions.md)'s `load()`) | `["defaults"]` → `project.json.transitions` (issue #13) |
| `config/scenes.json` (via [`lib/scenes.py`](lib-scenes.md)'s `load()`) | when present: `scenes` → `project.json.scenes`, and the derived `schedule` **replaces** `project.json.stage` (issue #18) |
| `scripts/motifs/remotion/*.tsx` | copied to `<work>/remotion/src/motifs/` — always refreshed |

**Migrated to `config.load()` (issue #9, 2026-09-05)** — the inline Python in `sync_all`
no longer reads `theme.json` directly for the theme subset or the logo filename; both come
from `project.config.json` now. **Migrated to the `rush`/`config`/`build` layout (issue
#59, 2026-09-05)** — every path above moved; `stage.json`/`outro.json`/`safe.json` are
still separate hand-authored files (not part of `project.config.json`, deferred to Pass 4,
see [project-config.md](../design/project-config.md)) but now live in `config/`.

## Outputs

| File | Shape |
|---|---|
| `<work>/remotion/` | scaffolded Remotion project (see [remotion-template.md](remotion-template.md)) |
| `<work>/remotion/src/project.json` | generated — see [data-contracts.md](../data-contracts.md#projectjson--generated-remotion-config) |
| `<work>/build/video-raw.mp4` (or given path) | on `render` — pre-mastering, not the deliverable |

## `sync_all`

- `mkdir -p <work>/remotion/src <work>/remotion/public`
- Always overwrites: `package.json tsconfig.json remotion.config.ts .gitignore README.md`
  and `index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts util.tsx Chrome.tsx Captions.tsx
  Outro.tsx Guides.tsx SceneList.tsx`, plus `src/motifs/*.tsx` (issue #18)
- **`src/Scenes.tsx` copied once only** — a project's hand-written scene components are
  never wiped. With `config/scenes.json` the scenes are data and `SceneList.tsx` dispatches
  motifs instead (`Ad.tsx` renders one or the other)
- inline Python generates `project.json` (now including `scenes` when `config/scenes.json` exists)
- copies the assets listed above

## External tools

`npm`, `npx remotion`, `"${VEVO_PY[@]}"` (inline — generates `project.json`), `ffprobe`, `grep`.

## Cross-platform

Sources `../lib/platform.sh`; `W="$(vevo_abspath "$1")"`. `TPL` and `R` resolved via
`cd … && pwd`. Bash + npm required; `render`/`studio` shell out to `npx` (Windows-fine),
but the wrapper itself needs Git-Bash / WSL. `set -e`.

## Place in the flow

Only when the user explicitly asks to edit visually (`SKILL.md` — "I want to edit it myself").
Replaces stage 9a (`render_frames.js` + `encode.sh`). Never redo the earlier stages — cut,
transcribe, caption, effects are all shared.

## Gotchas

- On `render` it greps `project.json` for `"guides": true` and warns — the red safe-zone
  overlays would be burned into the video. Remove `guides` from `config/safe.json` before
  delivery.
- Remotion needs a paid license for companies with 4+ employees — tell the user if they're
  a company.
- `public/video.mp4` must be bt709-tagged (it is — `reframe.py` does that).
- This script's `bash` wrapper could not be run end-to-end in the sandbox issue #59 was
  built in (a `bash`/toolchain mismatch — see the issue for detail); the theme/logo
  migration's inline Python was verified directly (issue #9), and the path renames here
  were reviewed but not separately re-executed.
