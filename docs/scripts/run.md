# `run.py`

`video-editor/scripts/run.py` · python · shared (conductor)

> The config-driven pipeline conductor. Reads the stage list for the work-dir's world and
> spawns the same scripts `docs/pipeline.md` documents, skipping any stage whose outputs
> are already newer than its inputs and halting at the genuine human decision points.
> A conductor, not a reimplementation. Design: [`design/orchestrator.md`](../design/orchestrator.md).

## CLI

```
uv run scripts/run.py <work> [--from ID] [--to ID] [--only ID]
                             [--world NAME] [--engine NAME] [--dry] [--force] [--list]
```

| Flag | Effect |
|---|---|
| `--from ID` | start at stage `ID` |
| `--to ID` | stop after stage `ID` |
| `--only ID` | run just stage `ID` |
| `--world NAME` | force `reel-speech` / `broll-montage` instead of inferring from `rush/` |
| `--engine NAME` | override `config.engine` for `when` gating (`light` / `remotion`) |
| `--dry` | print the plan + per-stage verdict (`SKIP`/`RUN`/`CHECKPOINT`/`HALT`), run nothing |
| `--force` | rerun every in-range runnable stage regardless of timestamps |
| `--list` | print the world's stage ids and exit |

Exit codes: `0` done / nothing to do · `1` a stage failed · `2` halted at a blocking
checkpoint · `3` bad usage.

## Inputs

| File (in `<work>`) | Role | Required |
|---|---|---|
| `rush/` | world inference (1 file → `reel-speech`, many → `broll-montage`) + `{source}` | yes |
| `config/project.config.json` (via [`lib/config`](lib-config.md)) | `engine`, `language`, `when` gating | `language` required before `transcribe` |
| `scripts/pipeline/<world>.json` | the stage list (static skill file) | yes |

## Outputs

None of its own. Each stage writes what `docs/pipeline.md` says it does. `run.py` creates
`<work>/build/` if missing.

## The stage manifest

`scripts/pipeline/reel-speech.json` · `scripts/pipeline/broll-montage.json` —
`{ _doc, world, stages[] }`. Per stage: `id`, `title`, `run` (argv with `{work}`
`{source}` `{language}` `{skill}` substituted — omit for a checkpoint), `needs` / `makes`
(work-relative; `{source}` = the rush file; trailing `/` = non-empty directory),
optional `block` (halt a checkpoint until `makes` exists), `note`, `when` (gate on a
config value). Full contract: [data-contracts.md](../data-contracts.md#scriptspipelineworldjson--the-stage-manifest-static-skill-file).

**Verdict rules:** a runnable stage is `SKIP` iff every `makes` path exists and the oldest
of them postdates the newest `needs` path; else `RUN` (a runnable stage with no `makes`
always runs). A checkpoint with a missing `makes` is `HALT` (if `block`) or `CHECKPOINT`; a
checkpoint with no `makes` is always an advisory `CHECKPOINT` — the `note` reprints every
run (a reminder, not tracked state).

## External tools

None directly — it spawns `uv`, `node`, `bash`, `ffmpeg` via the stage `run` arrays (cwd =
the skill dir). Those tools' requirements are each script's own.

## Cross-platform

Pure `os.path` + `subprocess` with argv lists (no shell — spaces in `rush/` filenames are
safe). Imports `lib.config` / `lib.rush` by adding `scripts/` to `sys.path`. The `.sh`
stages (`encode`, `master`, `remotion`) still need Git-Bash/WSL, same as when invoked by
hand.

## Place in the flow

Optional. It runs the mechanical spans of `docs/pipeline.md`; `SKILL.md` still drives the
conversation and the four decision points (transcript correction, sentence trimming, scene
design, sound cues). A repeat job or a "re-run from stage 6" is `run.py <work> --from …`.

## Gotchas

- **Not a state machine.** Resume is pure file-timestamp comparison — touch an input and
  everything downstream reruns; delete an output and that stage reruns.
- Advisory checkpoints (`script-review`, `scenes`) print their note on every invocation —
  there's no marker to say "already done".
- `safe`'s exit `3` (safe-zone violation) is surfaced as `run.py` exit `1` with a pointer
  to `build/safe-zone-check.jpg`.
- The Remotion path (`--engine remotion` or `config.engine == "remotion"`) drops the
  `render` + `encode` stages and runs `render-remotion` instead.
