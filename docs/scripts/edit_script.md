# `edit_script.py`

`video-editor/scripts/edit_script.py` · python · shared

> Remove whole spoken sentences by deleting them from the transcript. The corresponding
> video + audio ranges are cut and everything after shifts left. Also detects **repeated
> sentences** (Arabic-normalized similarity): when a speaker restates a sentence, the
> first is assumed wrong and the second is the correction.

## CLI

```
uv run scripts/edit_script.py <work> show           # numbered sentences + timecodes, writes script.txt, flags dupes
uv run scripts/edit_script.py <work> dupes          # list repeated pairs only
uv run scripts/edit_script.py <work> drop 3 7 12    # remove those sentence numbers
uv run scripts/edit_script.py <work> keep 1 2 5 6   # keep only those, remove the rest
uv run scripts/edit_script.py <work> apply          # re-read the edited script.txt, drop whatever lines were deleted
uv run scripts/edit_script.py <work> undo           # restore from .bak
```

Append `--dry` to any command to preview without writing.

## Inputs

| File | Role |
|---|---|
| `<work>/caps.json` | always — the sentence list |
| `<work>/cut.json` | mutated on drop/keep/apply |
| `<work>/sfx.json` | mutated if present (cue times shifted / dropped) |
| `<work>/script.txt` | read by `apply` |

## Outputs / mutations

Rewrites `cut.json`, `caps.json`, `sfx.json` **in place**, keeping `.orig` (first run) and
`.bak` (every run) beside each. `show` writes `<work>/script.txt`.

| File | What changes |
|---|---|
| `cut.json` | deleted ranges mapped back to the original timeline and removed from `keep`; `total` recomputed. Sub-`MIN_SEG` (0.20 s) fragments dropped |
| `caps.json` | dropped cards removed; remaining card/word times shifted; de-overlapped; `total` = `min(theoretical, cut.total)` (so no extra frame) |
| `sfx.json` | every timestamp in every list-valued key shifted; cues inside a deleted range removed |

Padding: `PAD_L = 0.08`, `PAD_R = 0.12` around each deleted sentence; a deletion never eats
into the next sentence's start.

## Dupe detection

`find_dupes` compares each card with the next `win = 2` cards. Similarity `_sim` =
`max(shared non-stopword ratio, character SequenceMatcher ratio)`; threshold `0.60`.
Arabic normalization strips diacritics/tatweel, unifies alef/ya/ta-marbuta, drops a
leading `ال`. Suggests `drop <first of each pair>` — always show the user first.

## External tools

None.

## Cross-platform

Pure Python + `shutil`. Fine on Windows. Called directly by the skill — pass a
Windows-style path.

## Place in the flow

Stage 5.5 — **must run before scene design**, because it shifts every time. After it:
re-run `reframe.py`, re-extract `vfr/` frames, and re-render with `--force`. The script
prints these follow-up commands.

## Gotchas

- If you already designed scenes with hardcoded timestamps, they will be off after a drop
  — the script warns about this.
- `undo` restores the last `.bak` of `cut.json`, `caps.json`, `sfx.json` together.
