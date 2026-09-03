# Roadmap

Each pass is one GitHub **milestone**, gets its own implementation plan before code, and
must keep every [invariant](../invariants.md) and stay backward compatible.

This turns `FORK.md`'s vision (config per project, style library, orchestrator agent,
long-form YouTube, web UI) into concrete work, with execution isolation, transitions and
the scene split made explicit. `FORK.md` carries the short version of this table.

| # | Pass | Milestone | Depends on | Status |
|---|---|---|---|---|
| 0 | **Documentation** (this `docs/` tree) | `Pass 0 — Documentation` | — | ✅ done |
| 1 | **Isolated execution & dependencies** | `Pass 1 — Execution & dependencies` | 0 | ✅ done (PR #37) |
| 2 | **`project.config.json` + adapter** | `Pass 2 — Config` | 0 | — |
| 3 | **Transitions vocabulary** | `Pass 3 — Transitions` | 2 (declared in config) | — |
| 4 | **Scenes as data + motif registry** | `Pass 4 — Scenes` | 2, 3 | — |
| 5 | **Orchestrator runner** (`run.py`) | `Pass 5 — Orchestrator` | 2 (4 makes it fuller) | — |
| 6 | **`long-form` world** (YouTube) | `Pass 6 — Long-form` | 2, 3, 5 | — |
| 7 | **Web interface** | `Pass 7 — Web` | 2, 5 | — |

## Pass 1 — Execution & dependencies

**Implemented.** See [execution.md](execution.md).

- `pyproject.toml` + `uv.lock` + `.python-version`; `uv` manages `video-editor/.venv/`.
- `puppeteer` (was `puppeteer-core`) — bundles a matched Chromium; `.nvmrc` pins Node.
- `setup.sh` bootstraps `uv` + `node` + `ffmpeg` (system), then `uv sync` + `npm ci`.
  **`--break-system-packages` removed.**
- `VEVO_SKILL_DIR` / `VEVO_PY` in `lib/platform.sh`; `SKILL.md` + `docs` use `uv run`.
- **Done when:** `python3 -c "import numpy"` still fails in a plain shell, and the full
  pipeline runs on a machine with no system Chrome.
- Deferred (issues): `VEVO_FFMPEG` + static-binary fallback; Remotion-template lockfile;
  optional CPU Dockerfile.

## Pass 2 — Config

- `scripts/lib/config.py` + `config.js`: `load()` (merge defaults ← creator-profile ←
  project) and `emit_legacy()` (write `theme.json` / `stage.json` / `outro.json` /
  `safe.json` / sfx cues).
- Reverse compat: synthesize a config from legacy files when `project.config.json` is absent.
- Migrate `reframe.py` and the Remotion generator to `config.load()` first (lowest risk).
- `SKILL.md` step 1 writes `project.config.json` instead of `theme.json`.
- **Done when:** an old-style project and a config-style project both render identically.

## Pass 3 — Transitions

- Shared `transitions` table (types + easings) as data.
- Light engine: parameterized scene enter/exit + `SCENES`↔`SCENES` transitions.
- Remotion: same, via `@remotion/transitions` where native.
- `montage_mode.py build`: `--transition <name>:<dur>:<param>` mapped to ffmpeg `xfade`.
- Defaults reproduce today's behavior exactly.
- **Done when:** `build --transition push:0.3:up` works and a reel scene can specify `wipe`.

## Pass 4 — Scenes

- Scene schema + `motifs/` registry (`index.json` + `canvas/` + `remotion/`).
- Light-engine interpreter (inside `safe()`); Remotion `<Scene>` dispatcher.
- Port the ~15 reference functions to motifs, one at a time, each with a 3-way visual diff.
- `studio.html` renders the scene list, drops its private drawing copy.
- **Done when:** a new video is authored as a `scenes` array with zero inline JS/JSX, and
  both engines match.

## Pass 5 — Orchestrator

- `scripts/run.py <work> [--from] [--to] [--dry]`, stage list from `world`.
- Timestamp-based skip; pause at decision points (`fixes.json`, sentence trim, `scenes`).
- Optional subagent split (transcript-fixer, scene-designer, reviewer).
- **Done when:** `run.py <work>` takes a config + source to a finished reel, pausing only
  for the genuine decisions.

## Pass 6 — Long-form

- Jump-cut / filler-word engine (tight pause removal, per-language filler list).
- Chapter detection (transcript topic shift or user outline).
- B-roll cutaways reusing `montage_mode.py`'s scorer.
- Lower-third caption style; 16:9 output; chapter markers.
- **Done when:** a 20-min recording → an edited 16:9 talk with chapters and B-roll.

## Pass 7 — Web

- Drop zone → form writes `project.config.json` → "generate" calls `run.py` → preview.
- Decision points become form steps.
- Same engine; no new pipeline.

## Also on the backlog (not passes)

Tracked as issues, not milestones — see [../project-tracking.md](../project-tracking.md):
Adobe audio cleanup (`media_enhance_speech`), Adobe-stock B-roll auto-convert, plugin
packaging, engine-drift fixes, the stale root `.skill` package, montage testing on real
varied clips.
