# Target architecture

Where the project is going — **not** where it is. These documents are design, not
implementation plans; each numbered pass in [roadmap.md](roadmap.md) gets its own plan and
its own GitHub milestone before any code is written. The exception is
[execution.md](execution.md) (Pass 1), which is already built.

## North star

> A local, agent-driven video editor. You drop a video (or a config file), an orchestrator
> runs the pipeline end to end, and the output is a finished reel — with per-project
> configuration, multiple languages, a reusable style/motif library, a real transitions
> vocabulary, and support for more than one editing "world" (short talking-head reel,
> B-roll montage, long-form YouTube). Eventually a web UI on the same engine.

This is `FORK.md`'s roadmap, made concrete.

## Principles

1. **Data over code for anything that varies per video.** Colours, layout schedule, outro
   copy, safe zones, sound cues, and — the big one — the scene list should be *data* a
   human or an agent edits, not JavaScript hand-ported between three files.
2. **One description, both engines.** The light engine and Remotion must render the *same*
   scene list. No more drift (see [../engines.md](../engines.md#drift)).
3. **Backward compatible.** The existing per-file JSON contracts keep working. A new
   `project.config.json` is a *superset*; an adapter emits the legacy files so scripts
   migrate one at a time.
4. **The pipeline stays scriptable.** The orchestrator is a thin layer over the same
   scripts, not a rewrite. Any stage can still be run by hand.
5. **Invariants hold.** Everything in [../invariants.md](../invariants.md) survives every
   pass — especially "no colour over the person", "Western digits", "no publishing",
   "scenes are metaphors, not decoration".

## What changes / what stays

| Stays | Changes |
|---|---|
| ffmpeg does the cutting/muxing/loudness | scene definitions become data, not inline JS/JSX |
| Whisper transcription, per-word timing | `theme.json` + `stage.json` + `outro.json` + `safe.json` + sfx cues merge into `project.config.json` |
| The work-dir model | a `scripts/run.py` orchestrator reads the config and runs stages |
| Two engines (light default, Remotion opt-in) | both engines interpret one scene list via a shared motif registry |
| `montage_mode.py` as an independent mode | montage becomes one "world" alongside `reel-speech` and a new `long-form` |
| Everything in `SKILL.md`'s style rules | transitions get a named, parameterized vocabulary |

## The documents

| Doc | What it specifies |
|---|---|
| [execution.md](execution.md) | **built** — how dependencies are isolated (uv, bundled Chromium, the `VEVO_*` contract) |
| [project-config.md](project-config.md) | the `project.config.json` schema + the legacy-emitting adapter |
| [file-layout.md](file-layout.md) | `rush`/`config`/`build` directory split, the full file rename, the engine and safe-zone decisions (2026-09-05 session) |
| [scenes-as-data.md](scenes-as-data.md) | declarative scene schema + the shared motif registry (the biggest lift) |
| [transitions.md](transitions.md) | a named/parameterized transition set for both engines + montage |
| [worlds.md](worlds.md) | editing families — `reel-speech`, `broll-montage`, `long-form` |
| [orchestrator.md](orchestrator.md) | the config-driven runner + skill/subagent structure (sketch) |
| [roadmap.md](roadmap.md) | the sequence of implementable passes = GitHub milestones |
