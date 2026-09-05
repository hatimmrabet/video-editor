# `captions.py`

`video-editor/scripts/captions.py` · python · shared

> Builds caption card timings on the **new (post-cut) timeline**. For each Whisper
> segment it maps the original word times through the kept segments to the compressed
> timeline, substitutes the human-corrected text from `build/transcript-fixes.json`, marks
> "hot" words, and produces caption cards with lead-in / lead-out padding and de-overlap.

## CLI

```
uv run scripts/captions.py <work>
```

## Inputs

| File | Shape | Required |
|---|---|---|
| `<work>/build/cut-plan.json` | `.keep` | yes |
| `<work>/build/transcript-raw.json` | Whisper segments | yes |
| `<work>/build/transcript-fixes.json` | `{ "fix": [[words per segment]], "hot": [words] }` | yes |

**Hard constraint:** `len(fix[i])` must equal the number of Whisper words in segment `i`,
or the script exits with an error — the per-word timings are taken from Whisper positionally.

## Outputs

| File | Shape |
|---|---|
| `<work>/build/captions.json` | `{ "total": float, "cards": [{s, e, w:[{t,s,e,hot}]}] }` — see [data-contracts.md](../data-contracts.md#buildcaptionsjson--caption-card-timings-the-central-contract) |

## How the timeline mapping works

- `off[]` — cumulative offset of each kept segment on the new timeline.
- `newt(t, si)` — maps an original time `t` into kept segment `si` to its new-timeline time.
- Each Whisper segment is assigned to the kept segment containing the midpoint of its
  first and last word.
- Card `s` = `first word s − 0.10` (clamped to segment start); card `e` =
  `max word e + 0.28` (clamped to segment end). Zero-length words get `e = s + 0.12`.
- A final pass clamps each card's `e` so cards never overlap.

## External tools

None — pure JSON math.

## Cross-platform

`os.path.join` throughout, fine on Windows. UTF-8 reconfigure. Called directly by the
skill — pass a Windows-style path.

## Place in the flow

Stage 5, after the human corrects the transcript and writes `build/transcript-fixes.json`.
Output consumed by `sound_fx.py`, `render_frames.js`, `safe_check.js`, `subtitles.py`,
`fx/behind_text.js` and Remotion. Mutated later by `edit_script.py`.

## Gotchas

- `build/captions.json` is the central contract — save it (and `build/cut-plan.json`);
  later edits never need re-transcription.
- The word count constraint is the most common failure — when correcting a sentence you
  must keep the same number of tokens Whisper produced (split/join to match).
