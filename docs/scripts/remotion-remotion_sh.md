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
| `caps.json` | copied verbatim to `remotion/src/caps.json` |
| `theme.json` | theme subset → `project.json.theme` |
| `sfx.json` | `.outro` → `project.json.outro`; existence of `sfx.wav` → `project.json.sfx` |
| `sfx.wav` | → `remotion/public/sfx.wav` |
| `cutz.mp4` | → `remotion/public/video.mp4` |
| `stage.json` | → `project.json.stage` (default one `FULL` span) |
| `outro.json` | → `project.json.outro_copy` |
| `safe.json` | `.guides` → `project.json.guides` |
| `<logo>` (from `theme.json.logo`, default `logo.png`) | → `remotion/public/logo.png` |

## Outputs

| File | Shape |
|---|---|
| `<work>/remotion/` | scaffolded Remotion project (see [remotion-template.md](remotion-template.md)) |
| `<work>/remotion/src/project.json` | generated — see [data-contracts.md](../data-contracts.md#projectjson--generated-remotion-config) |
| `<work>/ad-final.mp4` (or given path) | on `render` |

## `sync_all`

- `mkdir -p <work>/remotion/src <work>/remotion/public`
- Always overwrites: `package.json tsconfig.json remotion.config.ts .gitignore README.md`
  and `index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts util.tsx Chrome.tsx Captions.tsx
  Outro.tsx Guides.tsx`
- **`src/Scenes.tsx` copied once only** — the operator's scene work is never wiped
- inline Python generates `project.json`
- copies the assets listed above

## External tools

`npm`, `npx remotion`, `python3` (inline), `ffprobe`, `grep`.

## Cross-platform

Sources `../lib/platform.sh`; `W="$(vevo_abspath "$1")"`. `TPL` and `R` resolved via
`cd … && pwd`. Bash + npm required; `render`/`studio` shell out to `npx` (Windows-fine),
but the wrapper itself needs Git-Bash / WSL. `set -e`.

## Place in the flow

Only when the user explicitly asks to edit visually (`SKILL.md` — "أبي أعدّل بنفسي").
Replaces stage 9a (`render_frames.js` + `encode.sh`). Never redo the earlier stages — cut,
transcribe, caption, effects are all shared.

## Gotchas

- On `render` it greps `project.json` for `"guides": true` and warns — the red safe-zone
  overlays would be burned into the video. Remove `guides` from `safe.json` before delivery.
- Remotion needs a paid license for companies with 4+ employees — tell the user if they're
  a company.
- `public/video.mp4` must be bt709-tagged (it is — `reframe.py` does that).
