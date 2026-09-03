# `plan_cuts.py`

`video-editor/scripts/plan_cuts.py` · python · shared

> Silence-cut planner. Runs ffmpeg `silencedetect` on `src.mov`, turns the detected
> silences into speech segments, pads them, merges tiny gaps, and drops sub-0.30 s
> fragments. Output is `cut.json` — the list of `[start, end]` ranges to keep on the
> original timeline.

## CLI

```
uv run scripts/plan_cuts.py <work>
```

Single positional argument. Prints a per-segment table and how much was removed.

## Inputs

| File | Shape | Required |
|---|---|---|
| `<work>/src.mov` | the source video (hardcoded name) | yes |

## Outputs

| File | Shape |
|---|---|
| `<work>/cut.json` | `{ "keep": [[a,b],...], "total": float, "src_dur": float }` — see [data-contracts.md](../data-contracts.md#cutjson--silence-cut-plan) |

## Constants (line 10)

| Name | Value | Meaning |
|---|---|---|
| `NOISE` | `-32dB` | silence threshold |
| `MIND` | `0.35` | minimum silence duration to detect |
| `PAD` | `0.13` | seconds added to each side of a kept segment |
| `MERGE` | `0.20` | gaps smaller than this between kept segments are merged |

Segments shorter than `0.30 s` after all of the above are dropped.

## External tools

`ffprobe` (source duration) · `ffmpeg` (`silencedetect=noise=-32dB:d=0.35`, parsed from stderr).

## Cross-platform

`W = os.path.abspath(sys.argv[1])`. Pure ffmpeg otherwise. UTF-8 reconfigure at the top.
**Called directly by the skill**, not via a `.sh` wrapper — the caller must pass a
Windows-style path (see [../windows.md](../windows.md#gotcha-1--path-translation)).

## Place in the flow

Stage 1. Runs right after the work dir is set up (`src.mov` copied in). Its `cut.json` is
consumed by `captions.py` (stage 5) and `reframe.py` (stage 6), and mutated by
`edit_script.py` (stage 5.5).

## Gotchas

- If the source has music or constant background noise, `silencedetect` finds no silences
  and the whole video is one "keep" segment — that's fine, just no time is removed.
- `edit_script.py` later rewrites `cut.json` in place (keeping `.orig` / `.bak`).
