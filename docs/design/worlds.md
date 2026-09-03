# Worlds — editing families

A **world** is a family of edit: an input shape, a mode, its own layout/scene vocabulary,
and its own subset of the pipeline — all sharing the same primitives (transcribe, cut,
transitions, theme, encode, loudness).

Today there are effectively two worlds, hardcoded as "modes". This document names them and
adds a third.

## `reel-speech` — the current default

| | |
|---|---|
| Input | one talking-head video |
| Pipeline | stages 0–13 ([../pipeline.md](../pipeline.md)) |
| Selection | driven by the speech — remove silences + repeated sentences |
| Captions | yes, word-synced |
| Scenes | code-drawn motifs, one per sentence |
| Output | one 9:16 MP4 + `.srt` + `.txt` |

## `broll-montage` — the current montage mode

| | |
|---|---|
| Input | a folder of speechless clips |
| Pipeline | [`montage_mode.py`](../scripts/montage_mode.md) `scan → sheet → drop/keep → plan → build`, then `master_audio.sh` |
| Selection | driven by the shot — sharpness / motion / exposure / colour |
| Captions | none |
| Scenes | none |
| Output | one MP4 (9:16 / 4:5 / 1:1 / 16:9) |

Shares with `reel-speech`: `master_audio.sh` (loudness + background audio), the bt709 tag,
the "no colour grade" invariant, contact sheets for review.

## `long-form` — new (YouTube)

| | |
|---|---|
| Input | one or more long talking-head recordings + optional B-roll folder |
| Selection | driven by the speech — **mass jump cuts** (tighten every pause, not just silences), plus filler-word removal |
| Captions | optional, and styled differently (lower-third, not centered card) |
| Structure | **chapters** — detected from topic shifts or an outline the user provides |
| B-roll | cutaways over the speaker at marked moments (reusing the montage scorer to pick shots) |
| Output | 16:9 MP4 + chapter markers + `.srt` |

`long-form` is a **separate engine path** from the reel — the reel's motion-graphics scene
system doesn't apply. It reuses: `transcribe.py`, the silence/pause detection idea from
`plan_cuts.py` (tuned much tighter), `montage_mode.py`'s shot scorer (for B-roll
selection), `master_audio.sh`, `subtitles.py`, the transitions vocabulary.

This is roadmap item 5 — deliberately last among the engine work, because it needs the
config system, the transitions vocabulary, and ideally the motif/scene split to already
exist.

## The abstraction boundary

```
                 ┌─────────────── shared primitives ───────────────┐
                 │ transcribe · cut/pauses · reframe · transitions   │
                 │ theme/config · sound · encode · loudness · subs   │
                 └──────────────────────────────────────────────────┘
   reel-speech ──┤   + word-synced captions + motif scene system (2 engines)
 broll-montage ──┤   + shot scorer + rhythm planner
     long-form ──┤   + jump-cut/filler engine + chaptering + B-roll cutaways
```

`world` is a field in [project.config.json](project-config.md). The orchestrator
([orchestrator.md](orchestrator.md)) picks the stage list from the world.

## Open questions

- Is `long-form` one world or two (podcast-style static vs edited-talk with B-roll)?
- Chapter detection — topic-shift heuristic on the transcript, or always ask the user for
  an outline?
- Filler-word list per language — maintainable, or model-driven per run?
