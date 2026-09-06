# Orchestrator — the config-driven runner

**Status: `run.py` built (issue #21).** The stage lists are data
([`scripts/pipeline/*.json`](../../video-editor/scripts/pipeline/)); `run.py` conducts
them. The subagent split ([issue #22](#skill--subagent-structure)) is still design-only.

## Problem

The pipeline is a sequence of commands the agent types one by one, with manual steps
interleaved (extract audio, extract frames, author `build/transcript-fixes.json`, author
`build/sound-cues.json`, design scenes). `SKILL.md` *is* the orchestrator, executed by a
human-in-the-loop.

That's fine for a skill, but it means no way to re-run "from stage 6", no single command
for a repeat job, no path to a web UI.

## `scripts/run.py`

```
uv run scripts/run.py <work> [--from ID] [--to ID] [--only ID]
                             [--world NAME] [--engine NAME] [--dry] [--force] [--list]
```

- Infers the **world** from `rush/` (one file with speech → `reel-speech`; many clips →
  `broll-montage` — [worlds.md](worlds.md)); `--world` overrides.
- Loads that world's stage list from `scripts/pipeline/<world>.json`.
- Runs each stage **in order**, spawning the **same scripts** `docs/pipeline.md` documents
  (cwd = the skill dir). It is a conductor, not a reimplementation.
- **Skips a stage whose outputs are newer than its inputs** (`make`-style — no state
  file).
- **Halts at a blocking checkpoint** (a genuine human decision) until its output file
  exists; prints what's needed and exits `2`.
- `--from`/`--to` run a slice by stage id, `--only` runs one, `--dry` prints the plan +
  per-stage verdict, `--force` reruns in-range stages regardless of timestamps, `--list`
  prints the stage ids.
- Exit: `0` done / nothing to do · `1` a stage failed · `2` halted at a checkpoint · `3`
  bad usage.

### Resolved design questions

The three open questions from the earlier sketch, decided for #21:

| Question | Decision | Why |
|---|---|---|
| **Language** — Python `run.py` vs a Node CLI | **Python.** | Most stages and every `lib/` helper are Python; `run.py` imports `lib.config` / `lib.rush` directly. |
| **State/resume** — a `<work>/.run-state.json` vs file timestamps | **File timestamps only. No state file.** | The filesystem is already the single source of truth (same reasoning as "world is not a config field", [worlds.md](worlds.md)). A stage is up-to-date iff every path it `makes` exists and postdates every path it `needs`. A "pause point" isn't state — it's just "a human-authored input file doesn't exist yet". |
| **World stage lists** — hard-coded in `run.py` vs a manifest | **A manifest per world** (`scripts/pipeline/<world>.json`). | Consistent with Pass 3/4 (`transitions.json`, `motifs/index.json`) — the pipeline order becomes data. `run.py` stays a ~200-line interpreter; adding `long-form` (Pass 6) is a new JSON file, not new code. |

### The stage manifest

`scripts/pipeline/reel-speech.json` and `broll-montage.json`. Each is
`{ _doc, world, stages: [ … ] }`; a stage is:

```jsonc
{
  "id":    "cut",                                  // slice/-only/-from/-to key; unique
  "title": "Cut plan - measure the silences",
  "run":   ["uv","run","scripts/plan_cuts.py","{work}"],   // argv; omit for a checkpoint
  "needs": ["{source}", "config/project.config.json"],     // work-relative; {source} = the rush file
  "makes": ["build/cut-plan.json"],                        // work-relative; trailing "/" = non-empty dir
  "when":  { "engine": "light" }                           // optional — gate on a config value
}
```

- **Placeholders** in `run`: `{work}` (abs work dir), `{source}` (`lib.rush.find_source`),
  `{language}` (`config.load(work)["language"]` — a stage that needs it and has none fails
  with a pointer to `SKILL.md` step 1), `{skill}` (the skill dir).
- **`run` omitted → a checkpoint.** `"block": true` → `run.py` halts if `makes` is absent.
  A checkpoint with **no `makes`** is *advisory*: its `note` prints every run (a reminder,
  not tracked state) and never blocks — used for `script-review` and `scenes`, which are
  legitimately optional.
- **`when`** filters the stage out unless every key matches (`engine` compares the
  effective engine, others `config.load()`). This is how the Remotion path swaps
  `render`+`encode` for one `render-remotion` stage.
- A runnable stage with **no `makes`** always runs (can't be proven done — e.g. montage
  `plan`, which rewrites `plan[]` inside `montage-plan.json` in place).

The manifest is the canonical stage order — `docs/pipeline.md`'s table and `SKILL.md`'s
steps are the prose mirror.

### `reel-speech` stages

`cut → audio → transcribe → ⟨transcript-fix⟩ → captions → ⟨script-review⟩ → reframe →
frames → ⟨scenes⟩ → ⟨sound-cues⟩ → sound → render → encode → safe → master → subs`

`⟨…⟩` = checkpoint. **Blocking:** `transcript-fix` (`build/transcript-fixes.json` — rule
#5, always correct the transcript) and `sound-cues` (`build/sound-cues.json` — needs at
least `outro`). **Advisory:** `script-review` (drop sentences *before* scene design, so
times don't shift under the scenes) and `scenes` (author `config/scenes.json` or edit
`compose.html`; a captions-only render is a valid choice).

### `broll-montage` stages

`scan → sheet → ⟨pick⟩ → plan → build → master`

`pick` is advisory (drop unwanted shots). `plan` has no `makes` (it rewrites
`montage-plan.json` in place) so it always re-runs — cheap and deterministic.

### What `run.py` does **not** do

It doesn't drive the conversation. The config phase, showing the transcript for
correction, proposing which sentences to drop, designing the scene metaphors, placing the
sound cues, showing the contact sheet — all of that stays in `SKILL.md`, done by the agent
with the user. `run.py` runs the mechanical spans *between* those decisions and reports the
next one it needs.

## Skill / subagent structure

*(Design only — issue #22.)*

```
skill: video-editor  (the entry point — unchanged trigger phrases)
  │
  ├─ mandatory config phase — reads/creates project.config.json with the user
  ├─ subagent: transcript-fixer   (build/transcript-raw.json → proposes build/transcript-fixes.json)
  ├─ subagent: scene-designer     (build/captions.json → proposes config/scenes.json)
  ├─ subagent: reviewer           (runs safe_check.js + a contact sheet, reports)
  └─ calls run.py between decision points
```

Each subagent has a narrow job and a narrow tool set. The main skill stays the
conversation and the judgment; `run.py` is the muscle.

### The config phase — never skipped, never silent

Reading or building `project.config.json` is always the first thing that happens, and it
always ends in an explicit confirmation before any pipeline stage runs — never an implicit
"I picked X, moving on." (`SKILL.md` step 1 is the concrete version.)

- **`config/project.config.json` exists** → read it, print a short recap (language, theme
  colors, handle, engine), ask "still good, or does something change?" before anything.
- **It doesn't exist** → build it one question at a time, then a final complete recap and
  an explicit confirmation *before* the file is written. No per-creator memory file
  (`creator-profile` is dropped — [project-config.md](project-config.md)); starting from a
  previous project's config is a manual copy-then-adjust.

## Toward a web UI (roadmap Pass 7)

With `run.py` + `project.config.json` in place, a web UI is: a drop zone for the video, a
form that writes `project.config.json`, a "generate" button that calls `run.py`, and a
preview. The checkpoints become form steps (show the transcript to correct, the sentence
list to trim, the scene suggestions). Same engine, no new pipeline.
