# Orchestrator — the config-driven runner

**Sketch only.** This depends on [project-config.md](project-config.md) existing first.

## Problem

Today the pipeline is a sequence of manual commands the model/agent types one by one, with
manual steps interleaved (extract audio, extract frames, author `fixes.json`, author
`sfx.json`, design scenes). `SKILL.md` *is* the orchestrator, executed by a human-in-the-loop.

That's fine for a skill, but it means: no way to re-run "from stage 6", no single command
for a repeat job, no path to a web UI.

## Proposal — `scripts/run.py`

```
python3 scripts/run.py <work> [--from <stage>] [--to <stage>] [--dry]
```

- Reads `<work>/project.config.json`, picks the stage list from `world`
  ([worlds.md](worlds.md)).
- Runs each stage in order, calling the **same scripts** that exist today (it is a
  conductor, not a reimplementation).
- Skips a stage whose outputs are newer than its inputs (like `make`).
- `--from` / `--to` run a slice; `--dry` prints the plan.

### Stages that are still human/agent decisions

Some stages can't be fully automated — they need judgment:

| Stage | Decision | How the orchestrator handles it |
|---|---|---|
| transcript correction (`fixes.json`) | fix Whisper errors | **pause** — the agent fills `fixes.json`, then `run.py --from captions` |
| sentence trimming (`edit_script.py`) | which sentences to drop | pause — agent proposes, user confirms |
| scene design (`scenes` in config) | the visual metaphors | pause — agent authors the `scenes` array |
| sound cues | where the whooshes land | can be derived from scene transitions (see [transitions.md](transitions.md)) or paused |

So `run.py` is really "run everything that's mechanical, stop at the next decision point,
report what it needs". The agent (or a web form) fills the gap and resumes.

## Skill / subagent structure

```
skill: video-editor  (the entry point — unchanged trigger phrases)
  │
  ├─ mandatory config phase (see below) — reads/creates project.config.json with the user
  ├─ subagent: transcript-fixer   (reads a.json, proposes fixes.json)
  ├─ subagent: scene-designer     (reads caps.json, proposes the scenes array)
  ├─ subagent: reviewer           (runs safe_check.js + contact sheet, reports)
  └─ calls run.py between decision points
```

Each subagent has a narrow job and a narrow tool set. The main skill stays the
conversation and the judgment; `run.py` is the muscle.

### The config phase — never skipped, never silent

Decided in the 2026-09-05 design session: reading or building `project.config.json` is
always the first thing that happens, and it always ends in an explicit confirmation before
any pipeline stage runs — never an implicit "I picked X, moving on."

- **`config/project.config.json` already exists** → read it, print a short human-readable
  recap (number of input videos, language, theme colors, `world`, whether B-roll is
  present), and ask "still good, or does something change?" before doing anything else.
- **It doesn't exist yet** → build it progressively, one question at a time (per
  `SKILL.md`'s existing "ask for one thing at a time" style rule), then — **before writing
  the file** — give one final complete recap and get an explicit confirmation. Only then
  is `project.config.json` saved. There is no per-creator memory file to fall back on
  (`creator-profile` is dropped, see [project-config.md](project-config.md)); starting a
  new project from a previous one's config is a manual copy-then-adjust, not automatic.

## Toward a web UI (roadmap Pass 7)

Once `run.py` + `project.config.json` exist, a web UI is: a drop zone for the video, a form
that writes `project.config.json`, a "generate" button that calls `run.py`, and a preview.
The decision points become form steps (show the transcript for correction, show the
sentence list for trimming, show scene suggestions). Same engine, no new pipeline.

## Open questions

- Language: `run.py` (Python, matches most of the pipeline) vs a Node CLI (matches the
  engines). Python is the safer default.
- State/resume — a `<work>/.run-state.json` recording which stages completed, or pure
  file-timestamp comparison?
- How much does the orchestrator know about `world`-specific stage lists vs reading them
  from a `worlds/*.json` manifest?
