# `join_takes.py`

`video-editor/scripts/join_takes.py` · python · long-form

> The `join` stage of the [long-form](../design/long-form.md) world. Joins every video at
> `rush/`'s root into `build/source-joined.mp4` so the rest of the pipeline sees one file.

## CLI

```
uv run scripts/join_takes.py <work>
```

## Inputs

| Path | Role |
|---|---|
| `rush/*` (root, sorted; `bg-audio.mp3` excluded) | the recording take(s) — resolved via [`lib/rush`](lib-rush.md)'s `find_clips` |

## Output

| File | Shape |
|---|---|
| `build/source-joined.mp4` | one take → a byte copy · many takes → ffmpeg `concat` demuxer, `-c copy` `+faststart` |

Downstream, [`lib/rush`](lib-rush.md)'s `find_source()` returns `build/source-joined.mp4`
when it exists, so `plan_cuts.py` / `reframe.py` / the audio extract use the joined file
with no change.

## External tools

`ffmpeg` (only for the multi-take path).

## Gotchas

- Multi-take `-c copy` needs the takes to **share codec / resolution / fps** — a single
  recording session split into files is fine; mixed sources need a re-encode first (the
  script says so and exits non-zero).
- Only runs in the `long-form` world (`project.config.json` `format: "long"`). `reel-speech`
  and `broll-montage` never produce `build/source-joined.mp4`.

## Place in the flow

Long-form stage 1, before `cut`. See [`scripts/pipeline/long-form.json`](../../video-editor/scripts/pipeline/long-form.json).
