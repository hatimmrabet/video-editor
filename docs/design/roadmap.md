# Roadmap

Each pass is one GitHub **milestone**, gets its own implementation plan before code, and
must keep every [invariant](../invariants.md) and stay backward compatible.

This maps `FORK.md`'s five-point roadmap onto concrete work, with transitions and the
scene split made explicit.

| # | Pass | Milestone | Depends on | `FORK.md` item |
|---|---|---|---|---|
| 0 | **Documentation** (this `docs/` tree) | `Pass 0 — Documentation` | — | — |
| 1 | **`project.config.json` + adapter** | `Pass 1 — Config` | 0 | 1 |
| 2 | **Transitions vocabulary** | `Pass 2 — Transitions` | 1 (declared in config) | — (new) |
| 3 | **Scenes as data + motif registry** | `Pass 3 — Scenes` | 1, 2 | 2 |
| 4 | **Orchestrator runner** (`run.py`) | `Pass 4 — Orchestrator` | 1 (3 makes it fuller) | 3 |
| 5 | **`long-form` world** (YouTube) | `Pass 5 — Long-form` | 1, 2, 4 | 4 |
| 6 | **Web interface** | `Pass 6 — Web` | 1, 4 | 5 |

## Pass 1 — Config

- `scripts/lib/config.py` + `config.js`: `load()` (merge defaults ← creator-profile ←
  project) and `emit_legacy()` (write `theme.json` / `stage.json` / `outro.json` /
  `safe.json` / sfx cues).
- Reverse compat: synthesize a config from legacy files when `project.config.json` is absent.
- Migrate `reframe.py` and the Remotion generator to `config.load()` first (lowest risk).
- `SKILL.md` step 1 writes `project.config.json` instead of `theme.json`.
- **Done when:** an old-style project and a config-style project both render identically.

## Pass 2 — Transitions

- Shared `transitions` table (types + easings) as data.
- Light engine: parameterized scene enter/exit + `SCENES`↔`SCENES` transitions.
- Remotion: same, via `@remotion/transitions` where native.
- `montage_mode.py build`: `--transition <name>:<dur>:<param>` mapped to ffmpeg `xfade`.
- Defaults reproduce today's behavior exactly.
- **Done when:** `build --transition push:0.3:up` works and a reel scene can specify `wipe`.

## Pass 3 — Scenes

- Scene schema + `motifs/` registry (`index.json` + `canvas/` + `remotion/`).
- Light-engine interpreter (inside `safe()`); Remotion `<Scene>` dispatcher.
- Port the ~15 reference functions to motifs, one at a time, each with a 3-way visual diff.
- `studio.html` renders the scene list, drops its private drawing copy.
- **Done when:** a new video is authored as a `scenes` array with zero inline JS/JSX, and
  both engines match.

## Pass 4 — Orchestrator

- `scripts/run.py <work> [--from] [--to] [--dry]`, stage list from `world`.
- Timestamp-based skip; pause at decision points (`fixes.json`, sentence trim, `scenes`).
- Optional subagent split (transcript-fixer, scene-designer, reviewer).
- **Done when:** `run.py <work>` takes a config + source to a finished reel, pausing only
  for the genuine decisions.

## Pass 5 — Long-form

- Jump-cut / filler-word engine (tight pause removal, per-language filler list).
- Chapter detection (transcript topic shift or user outline).
- B-roll cutaways reusing `montage_mode.py`'s scorer.
- Lower-third caption style; 16:9 output; chapter markers.
- **Done when:** a 20-min recording → an edited 16:9 talk with chapters and B-roll.

## Pass 6 — Web

- Drop zone → form writes `project.config.json` → "generate" calls `run.py` → preview.
- Decision points become form steps.
- Same engine; no new pipeline.

## Also on the backlog (not passes)

Tracked as issues, not milestones — see [../project-tracking.md](../project-tracking.md):
Adobe audio cleanup (`media_enhance_speech`), Adobe-stock B-roll auto-convert, plugin
packaging, engine-drift fixes, the stale root `.skill` package, montage testing on real
varied clips.
