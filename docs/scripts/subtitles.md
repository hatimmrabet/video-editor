# `subtitles.py`

`video-editor/scripts/subtitles.py` · python · shared

> Emits an `.srt` subtitle file and a plain `.txt` full transcript from
> `build/captions.json` — the same timings that were rendered, so sync is guaranteed.
> Word-wraps to ≤ 42 chars, ≤ 2 lines; clamps each cue so it doesn't overlap the next.
> If `config/chapters.json` exists (long-form), also emits `video-final.chapters.txt`.

## CLI

```
uv run scripts/subtitles.py <work>
```

No arguments beyond the work dir — output names are fixed (see below), not a
caller-chosen base name (issue #59 dropped the `[basename]` argument, since `.srt` and
`.txt` no longer share one base: `video-final.srt` / `post-caption.txt`).

## Inputs

| File | Shape | Required |
|---|---|---|
| `<work>/build/captions.json` | `.cards` | yes |
| `<work>/config/chapters.json` | `[{ ref, title }]` — `ref` via [`lib/scenes`](lib-scenes.md)'s `_resolve_ref` | optional (long-form) |

## Outputs

| File | Shape |
|---|---|
| `<work>/video-final.srt` | standard SRT — YouTube and LinkedIn read it, Instagram accepts it on upload |
| `<work>/post-caption.txt` | one line per caption card — the full speech text, ready for the post caption |
| `<work>/video-final.chapters.txt` | `MM:SS Title` (or `H:MM:SS` past an hour) per line, sorted, first forced to `00:00` — the YouTube description chapter list. **Only when `config/chapters.json` exists.** Warns if < 3 chapters or any pair < 10 s apart (YouTube ignores those). |

## External tools

None.

## Cross-platform

Fine on Windows. UTF-8 reconfigure + explicit `encoding="utf-8"` on writes. Called
directly by the skill — pass a Windows-style path.

## Place in the flow

Stage 13 (reel) / the `subs` stage (long-form), the last step. Delivered alongside
`video-final.mp4` (+ `video-final.chapters.txt` for long-form).

## Gotchas

- `ts()` handles the `ms == 1000` rounding edge.
- Cue end is clamped to `next card start − 0.02`; if that leaves a non-positive duration it
  falls back to `start + 0.4`.
