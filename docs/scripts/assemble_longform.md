# `assemble_longform.py`

`video-editor/scripts/assemble_longform.py` · python · long-form

> The `assemble` stage of the [long-form](../design/long-form.md) world.
> `build/video-reframed.mp4` is already the cut + tightened + 16:9 video; this step
> overlays the B-roll cutaways (or just remuxes) → `build/video-raw.mp4`. No frame render.

## CLI

```
uv run scripts/assemble_longform.py <work>
```

## Behaviour

| `config/broll.json` | what happens |
|---|---|
| absent / empty | `build/video-reframed.mp4` → `build/video-raw.mp4`, **stream copy** |
| present | one ffmpeg filter graph: each entry's clip is trimmed, shifted to its span, cover-scaled to the video's resolution, and `overlay`-ed over the speaker for that span with an alpha cross-fade in/out. **Audio is always the speaker's**, untouched (`-c:a copy`). |

## `config/broll.json`

```jsonc
[
  {
    "ref":        { "range": [72.0, 78.5] },   // OR {sentence:N} / {sentence:N,words:[a,b]} — build/captions.json timeline
    "clip":       "screen-recording.mp4",      // a filename in rush/broll/
    "at":         0.4,                          // seconds into the clip to start (default 0.4 — skips the hand-on-device moment)
    "transition": "dissolve:0.25",              // a Pass-3 spec; only its duration is used for the alpha fade (default)
    "crop":       "cover"                       // "cover" (default, fill + centre-crop); "fit" reserved
  }
]
```

- `ref` is resolved by [`lib/scenes`](lib-scenes.md)'s `_resolve_ref` against
  `build/captions.json` — which is on the same tightened timeline as `video-reframed.mp4`.
- A clip shorter than its span → the B-roll is shortened (the speaker shows through early,
  `eof_action=pass`), with a note.
- The graph spills to ffmpeg's `/`-prefix file form above ~90 kB.

## Inputs / Output

| Path | Role |
|---|---|
| `build/video-reframed.mp4` | the cut + 16:9 base video (from `reframe.py`) — required |
| `config/broll.json` | the cutaway list — optional |
| `build/captions.json` | for `{sentence}` refs |
| `rush/broll/*` | the cutaway clips (via [`lib/rush`](lib-rush.md)'s `find_broll`) |
| → `build/video-raw.mp4` | `libx264 -crf 18` (overlay path) or stream copy (no B-roll); `-c:a copy`; `+faststart` |

## External tools

`ffprobe` (resolution + clip durations) · `ffmpeg` (`overlay` + `fade` alpha).

## Place in the flow

Long-form stage 11 (`assemble`), after `reframe` and the `⟨broll⟩` checkpoint, before
`master_audio.sh`. The long-form equivalent of the reel's `encode.sh` (there are no
composited frames to mux — long-form has no compositor).
