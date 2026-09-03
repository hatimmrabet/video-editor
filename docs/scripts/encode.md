# `encode.sh`

`video-editor/scripts/encode.sh` · bash · light engine

> Muxes the rendered `out/` JPEG sequence + `cutz.mp4` audio + `sfx.wav` into the final
> MP4, with an out-fade computed as `duration − 0.6 s`.

## CLI

```
bash encode.sh <work> [outfile]     # default: <work>/ad-final.mp4
```

## Inputs

| File | Role |
|---|---|
| `<work>/out/%05d.jpg` | the composited frames (framerate 30) |
| `<work>/cutz.mp4` | audio track only |
| `<work>/sfx.wav` | sound-effect bed |
| `<work>/caps.json` + `<work>/sfx.json` | inline `"${VEVO_PY[@]}" -c` reads `caps.total + sfx.outro` for duration |

## Outputs

| File | Encoding |
|---|---|
| `<work>/ad-final.mp4` | `libx264 -preset slow -crf 21 -maxrate 6M -bufsize 12M`, `profile high level 4.0`, `yuv420p`, 30 fps, `aac 160k 48kHz`, `+faststart`. Prints an `ffprobe` summary |

Audio graph: `[1:a]apad=pad_dur=8` (pad the speech), `amix` with `sfx.wav`
(`normalize=0`), `atrim` to duration, `afade out` over the last 0.6 s.

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
