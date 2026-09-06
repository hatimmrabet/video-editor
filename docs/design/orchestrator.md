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

**Status: designed (issue #22), not built.** The templates below become
`video-editor/agents/*.md` (prompt text the main agent passes to the Task tool) in a
follow-up implementation ticket, if wanted.

```
skill: video-editor  (the entry point — unchanged trigger phrases)
  │
  ├─ config phase — reads/creates project.config.json WITH THE USER   (never a subagent)
  ├─ run.py <work> --to transcribe
  ├─ transcript correction — first pass by a subagent, then WITH THE USER
  ├─ run.py <work> --from captions --to frames
  ├─ subagent: scene-designer    → a first config/scenes.json, then iterate WITH THE USER
  ├─ run.py <work> --from sound
  └─ subagent: reviewer          → safe zone + sync + loudness + one contact sheet, verdict
```

### Which steps are actually worth a subagent

A subagent can't talk to the user and starts with none of the conversation's context, so
it only pays off where the job is **self-contained, judgeable by a machine or a quick
glance, and context-heavy enough to be worth isolating**. Against that bar:

| Candidate | Verdict | Reason |
|---|---|---|
| **reviewer** | **build it** | Purely mechanical: run `safe_check.js --shot`, the sync re-transcribe, the loudness read, one `contact_sheet.sh`. No user input. Output is a short pass/fail table. Isolating it keeps a pile of image + ffmpeg output out of the main thread. |
| **scene-designer** | **build it, as a *draft* generator** | The heaviest reading job (every sentence of `build/captions.json` against the `motifs/index.json` vocabulary). A subagent can produce a complete first `config/scenes.json` + preview stills; the main agent then refines it with the user's taste feedback. Not a one-shot — a starting point. |
| **transcript-fixer** | **keep inline** | Correcting colloquial Arabic is a conversation with the user (`SKILL.md` step 5: "show them the full text to correct"). A subagent can only do an automated first pass, which the main agent must then re-review with the user anyway — the isolation saves little and adds a hand-off. Do the raw automated cleanup inline. |

### `reviewer` — the one clean win

| | |
|---|---|
| **Spawned** | after `run.py` reaches `master` / `subs` — i.e. right before delivery |
| **Input** | `<work>` (reads `build/captions.json`, `video-final.mp4`, `build/sound-cues.json`) |
| **Tools** | `Bash` (for `node`, `uv run`, `bash`, `ffmpeg`), `Read`, `Glob` — no `Edit`/`Write` |
| **Does** | `safe_check.js <work> --shot` · re-transcribe the output and diff sentence starts vs `build/captions.json` (< 0.1 s) · read the printed LUFS/dBTP · one `contact_sheet.sh` at 6 timestamps, looked at once · file size < 30 MB |
| **Returns** | a table: each check → PASS / FAIL + the number, and the `safe-zone-check.jpg` path if it failed. Nothing else — no screenshots back to the main thread. |
| **Main agent then** | on any FAIL, fixes the cause (re-render a window, adjust a rect, re-master) and re-spawns; on all-PASS, delivers. |

This is the "Verification before delivery (mandatory)" block of `SKILL.md`, moved into an
agent so its images and ffmpeg dumps never enter the main conversation.

### `scene-designer` — a draft, not an oracle

| | |
|---|---|
| **Spawned** | at the `scenes` checkpoint, if the user wants scene graphics |
| **Input** | `<work>` + a one-line brief of the video's angle |
| **Tools** | `Read` (`build/captions.json`, `scripts/motifs/index.json`, `scripts/motifs/README.md`), `Write` (`config/scenes.json` only), `Bash` (`render_frames.js <work> preview …`) |
| **Does** | for each sentence, pick a motif (or none) that is a **visual metaphor for what's said** (rule #10 + `SKILL.md` step 7's table), bind `params` to concrete values from `build/captions.json`, set `layout` per the layout rule, write `config/scenes.json`, render 4–6 preview stills |
| **Returns** | the `config/scenes.json` it wrote + the preview paths + a one-line rationale per scene |
| **Main agent then** | shows the user the previews, takes "more energy here / drop that one / wrong metaphor there" feedback, and edits `config/scenes.json` directly — it does **not** re-spawn the designer for small changes |

### The config phase — never a subagent, never skipped, never silent

Reading or building `project.config.json` is always the first thing that happens, and it
always ends in an explicit confirmation before any pipeline stage runs — never an implicit
"I picked X, moving on." It is a conversation with the user by definition, so it stays in
the main thread (`SKILL.md` step 1 is the concrete version).

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
