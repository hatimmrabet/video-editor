# `tighten.py`

`video-editor/scripts/tighten.py` · python · long-form

> The long-form jump-cut + filler pass. Word-level cuts from `build/captions.json`'s
> per-word timings — the fine pass on top of `plan_cuts.py`'s coarse silence cut.
> Design: [`design/long-form.md`](../design/long-form.md#the-tighten-pass-tightenpy--the-heart-of-it).

## CLI

```
uv run scripts/tighten.py <work>          # propose — prints the summary, writes build/tighten-plan.json
uv run scripts/tighten.py <work> apply    # commit — folds into build/cut-plan.json + build/captions.json
```

## What it cuts

| Kind | Rule |
|---|---|
| **inter-word gap** | a gap between consecutive words longer than `longform.pauseMs` (config, default 250 ms) is trimmed to `longform.keepMs` (default 90 ms) |
| **filler** | a word or consecutive run matching `scripts/fillers.json` for the project language (`config.language`, `ar-*` → `ar`); longest match wins. Skipped entirely if `longform.fillers` is `false` |

## Inputs

| Path | Role |
|---|---|
| `build/captions.json` | per-word timings (the source of truth for the cuts) |
| `config/project.config.json` (via [`lib/config`](lib-config.md)) | `language`, `longform.{pauseMs,keepMs,fillers}` |
| `scripts/fillers.json` | `{ lang: [word\|phrase, …] }` — curated, static skill file |

## Outputs

| File | Shape |
|---|---|
| `build/tighten-plan.json` | `{ before, after, saved, language, pauseMs, keepMs, gaps:[{s,e,gap}], fillers:[{text,s,e,ctx}], cuts:[[a,b]] }` — `cuts` is the merged deletion list `apply` uses |

`apply` also rewrites, each with a `.bak` (and one-time `.orig`):

| File | Change |
|---|---|
| `build/cut-plan.json` | `cuts` mapped back onto the original timeline, subtracted from `keep` (via [`lib/timeline`](lib-timeline.md)) |
| `build/captions.json` | filler words dropped, every surviving timestamp shifted, empty cards removed |
| `build/sound-cues.json` | cue times shifted; a cue inside a cut is dropped (only if the file exists) |

## Gotchas

- **Terminal mutation** — like `edit_script.py apply`, do **not** re-run `captions.py`
  after it. Rebuild with `reframe.py`. Undo = restore the `.bak` files.
- Order: **after `captions.py`, before `reframe.py`** — it shifts every downstream timestamp.
- Keep `scripts/fillers.json` conservative. `tighten.py` (no apply) prints every proposed
  filler cut in context so the agent + user review before `apply`; hand-drop anything the
  list misses per project rather than adding an ambiguous word.
- Long-form world only. The `tighten` stage of
  [`scripts/pipeline/long-form.json`](../../video-editor/scripts/pipeline/long-form.json)
  is a blocking checkpoint — `run.py` halts there until `build/tighten-plan.json` exists.

## Place in the flow

Long-form stage 7 (`⟨tighten⟩`), between `captions` and `reframe`.
