# `encode.sh`

`video-editor/scripts/encode.sh` · bash · light engine

> Muxes the rendered `build/frames-composited/` JPEG sequence + `build/video-reframed.mp4`
> audio + `build/sound-effects.wav` into the final MP4, with an out-fade computed as
> `duration − 0.6 s`.

## CLI

```
bash encode.sh <work> [outfile]     # default: <work>/build/video-raw.mp4
```

## Inputs

| File | Role |
|---|---|
| `<work>/build/frames-composited/%05d.jpg` | the composited frames (framerate 30) |
| `<work>/build/video-reframed.mp4` | audio track only |
| `<work>/build/sound-effects.wav` | sound-effect bed |
| `<work>/build/captions.json` + `<work>/build/sound-cues.json` | inline `"${VEVO_PY[@]}" -c` reads `caps.total + sfx.outro` for duration |

## Outputs

| File | Encoding |
|---|---|
| `<work>/build/video-raw.mp4` | `libx264 -preset slow -crf 21 -maxrate 6M -bufsize 12M`, `profile high level 4.0`, `yuv420p`, 30 fps, `aac 160k 48kHz`, `+faststart`. Prints an `ffprobe` summary. **Not the deliverable** — `master_audio.sh` produces `video-final.mp4` next |

Audio graph: `[1:a]apad=pad_dur=8` (pad the speech), `amix` with
`build/sound-effects.wav` (`normalize=0`), `atrim` to duration, `afade out` over the last
0.6 s.

## External tools

`ffmpeg`, `ffprobe`, `"${VEVO_PY[@]}"` (inline `-c` — DUR/FADE calc).

## Cross-platform

Sources `lib/platform.sh`; `W="$(vevo_abspath "$1")"` — the `/c/...` → `C:/...` conversion
happens here. Requires Git-Bash / WSL. `set -e`.

## Place in the flow

Stage 9a, right after `render_frames.js`. Then `safe_check.js`, then `master_audio.sh`.

## Gotchas

- `amix … normalize=0` is deliberate — normalization would pump the speech level with the
  sound effects.
- If `render_frames.js` reported missing frames, the mux will have gaps — fix that first.
- **Migrated to the `build/` layout (issue #59, 2026-09-05)** — every path above changed;
  the default output name also switched from `ad-final.mp4` to `build/video-raw.mp4`
  (**`-raw` = before mastering, `-final` = the deliverable**, applied consistently now).
