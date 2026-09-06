# Roadmap

Each pass is one GitHub **milestone**, gets its own implementation plan before code, and
must keep every [invariant](../invariants.md). **"Stay backward compatible" no longer
applies as a blanket rule** — decided during Pass 2 (2026-09-05): there is one user and no
installed base of old-style projects, so a legacy-emitting adapter or reverse-compat shim
solves a problem that doesn't exist here. When a pass replaces a file format or a script's
inputs, migrate every consumer directly and delete the old reading code in the same
change — see [project-config.md](project-config.md#migration--direct-no-bridge) for the
concrete example.

This turns `FORK.md`'s vision (config per project, style library, orchestrator agent,
long-form YouTube, web UI) into concrete work, with execution isolation, transitions and
the scene split made explicit. `FORK.md` carries the short version of this table.

| # | Pass | Milestone | Depends on | Status |
|---|---|---|---|---|
| 0 | **Documentation** (this `docs/` tree) | `Pass 0 — Documentation` | — | ✅ done |
| 1 | **Isolated execution & dependencies** | `Pass 1 — Execution & dependencies` | 0 | ✅ done (PR #37) |
| 2 | **`project.config.json` + adapter** | `Pass 2 — Config` | 0 | ✅ done (PRs #54, #57, issues #10, #59) |
| 3 | **Transitions vocabulary** | `Pass 3 — Transitions` | 2 (declared in config) | ✅ done (#11 schema · #12 light · #13 Remotion · #14 montage) |
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

**Scope grew in a 2026-09-05 design session** — see
[design/file-layout.md](file-layout.md) for the `rush`/`config`/`build` directory split +
full rename, the reaffirmed two-engine decision, and the safe-zone research; see
[project-config.md](project-config.md#decisions-design-session-with-hatimmrabet-2026-09-05)
for the resolved open questions (no `creator-profile` file; B-roll is a folder).

**No back-compat, decided the same session:** single user, no installed base of old-style
projects — there is no adapter and no reverse-compat synthesis. Each script migrates to
`config.load()` directly and deletes its old file-reading code in the same change (see
[project-config.md#migration--direct-no-bridge](project-config.md#migration--direct-no-bridge)).

- ✅ `scripts/lib/config.py` + `config.js`: `load()` (merge `defaults.config.json` ←
  `project.config.json`). One function, nothing else.
- ✅ Migrate `reframe.py` to `config.load()` — delete its `theme.json` reads (issue #8).
  Leaves `grade`/`xAnchor`/`yAnchor` orphaned in `theme.json` (still written by `SKILL.md`
  step 1, read by nothing) until issue #10 migrates the writing side too — see
  [data-contracts.md](../data-contracts.md).
- ✅ Migrate the Remotion `project.json` generator (`remotion.sh`'s `sync_all`) to
  `config.load()` — delete its `theme.json` read (issue #9).
- ✅ Migrate `render_frames.js` to `config.load()` — delete its `theme.json` read. **Not
  originally in this list** — split out as issue #55 during implementation, since #9 only
  ever covered the Remotion generator.
- ✅ Migrate `safe_check.js` to `config.load()` — same pattern, found while doing #9/#55.
  **Also not originally in this list** — split out as issue #56.
- ✅ `SKILL.md` step 1 writes `project.config.json` instead of `theme.json` (issue #10) —
  the mandatory config-confirmation phase from `orchestrator.md`, made concrete. No
  `creator-profile` step, no `badge` field (a scene-design-time exception now), `format`/
  `engine` always literal (`"short"`/`"light"`), never asked as an open question.
- **Done when:** nothing in the pipeline reads `theme.json` anymore — every consumer reads
  `project.config.json` via `config.load()`. **Done** (2026-09-05) — `theme.json` is
  retired (see [data-contracts.md](../data-contracts.md)).

- ✅ **Physical `rush`/`config`/`build` layout** (issue #59, 2026-09-05) — the full rename
  table in [file-layout.md](file-layout.md) applied across every script in one atomic
  change (`plan_cuts.py`, `transcribe.py`, `captions.py`, `edit_script.py`, `reframe.py`,
  `sound_fx.py`, `subtitles.py`, `montage_mode.py`, `render_frames.js`, `safe_check.js`,
  `encode.sh`, `master_audio.sh`, `contact_sheet.sh`, `remotion.sh`, `fx/behind_text.js`,
  `compose.reference.html`, `studio.html`). New `lib/rush.py` resolves the source file(s)
  in `rush/` without assuming a fixed name (`rush/` never renames the creator's file).
  `montage_mode.py scan` defaults to `rush/` when no folder is given. `safe-zone-check.jpg`
  now written only on a violation, per file-layout.md's decision.
  **Done when:** nothing reads/writes the old flat paths anymore — verified end-to-end
  (a real synthetic video through `plan_cuts.py → reframe.py → captions.py →
  edit_script.py → sound_fx.py → render_frames.js → encode.sh → safe_check.js →
  subtitles.py`, and separately `montage_mode.py scan → sheet → plan → build`; a real
  flag-parsing bug in `montage_mode.py scan --shot` was caught and fixed by this testing,
  not just read through). `master_audio.sh`/`contact_sheet.sh`/`remotion.sh` were reviewed
  and their non-path-invoking logic spot-checked, but couldn't be run end-to-end through
  their `bash` wrapper in the sandbox this was built in (a `bash`/toolchain mismatch
  unrelated to the change — see the PR for detail).

*(Also tracked, not blocking anything: issue #58, removing the emoji markers from
`SKILL.md`'s markdown; issue #61, translating the scripts/ tree's Arabic logs and comments
to English — both cosmetic cleanup, pick up whenever.)*

## Pass 3 — Transitions

- ✅ **Shared `transitions` table (types + easings) as data** (issue #11) —
  [`scripts/transitions.json`](../../video-editor/scripts/transitions.json), explained in
  [transitions.md](transitions.md). Eight curated types (`cut` `dissolve` `rect-morph`
  `wipe` `push` `zoom-blur` `iris` `glitch`), four named easings, a `rise` element
  enter/exit, and defaults that each equal today's hand-tuned value. Shorthand
  `type:dur:param` ↔ object. `whip-pan` dropped; raw ffmpeg xfade names reachable only via
  a montage-only escape hatch.
- ✅ **Light engine** (#12) — `lib/transitions.py` resolver (`.js` shells out to it),
  `render_frames.js` injects `load().defaults`, `compose.html` / `studio.html` read it in
  `vrect` (`sceneToScene`) and `caption` (`rise`), with today's literals as the fallback so
  nothing changed. `SCENES[i].transition` overrides one boundary; `rect-morph` / `cut` /
  `dissolve` render on the reel video (`wipe`/`push` are montage + graphic-layer — see
  [transitions.md](transitions.md)). Byte-identical default render verified. Scene-graphic
  enter/exit still hand-rolled per scene until Pass 4.
- ✅ **Remotion** (#13) — same scope as #12. `remotion.sh` writes `load()["defaults"]` into
  `project.json`; `theme.ts` exposes `TX`; `stage.ts` gains `vtrans` + `videoLayers(t)`;
  `Ad.tsx` maps over the layers (cross-fade mid-`dissolve`); `Captions.tsx` + `util.tsx`
  wired. Not `@remotion/transitions` — that's sequence-to-sequence, i.e. the Pass 4 graphic
  layer. Transition math verified equal to the old `stage.ts` for the default vocabulary.
- ✅ **`montage_mode.py build`** (#14) — `--transition <name>:<dur>:<param>` (replaces
  `--xfade`, removed) + an optional `transition` per `plan[]` entry; `xfade_for()` maps the
  vocabulary to ffmpeg `xfade` names. All-`cut` → plain `concat` (unchanged); any
  transition → one `xfade` chain. Verified end-to-end with real ffmpeg. `montage-plan.json`
  now read `utf-8-sig`.
- Defaults reproduce today's behavior exactly. **Pass 3 complete.**

## Pass 4 — Scenes

- ✅ **Declarative scene schema** (#15) — `config/scenes.json`, a hand-authored array of
  `{ ref, layout, motif, params, timing }`. `ref` binds to a caption sentence (survives an
  `edit_script.py` drop). `layout` carries the rect mode + optional Pass 3 `transition`.
  **Subsumes `config/stage.json`** when present. No params expression language; motifs
  version with the skill. Locked in [scenes-as-data.md](scenes-as-data.md).
- ✅ **`motifs/` registry** (#16) — `scripts/motifs/` with `index.json` (the 11-name
  manifest: `{status, kind, bottom, from, params}`), `README.md` (the `ctx` contract),
  `canvas/` + `remotion/`. `stamp` implemented on both engines as the reference; the other
  ten are `status: "planned"` until #19.
- ✅ **Light-engine interpreter** (#17) — `lib/scenes.{py,js}` resolves `config/scenes.json`
  against `build/captions.json`; `render_frames.js` injects `{scenes, schedule}` + the used
  canvas motif sources; `compose.html` rebuilds `SCENES` from `schedule` and `drawScenes(t)`
  dispatches to motifs inside `safe()`. `safe_check.js` takes the `schedule` too. Gated on
  the file — byte-identical raw-canvas render without it.
- ✅ **Remotion `<Scene>` dispatcher** (#18) — `remotion.sh` folds `scenes` + the derived
  `schedule` into `project.json` and copies `motifs/remotion/*.tsx`; `theme.ts` exports
  `SCENES`; new `SceneList.tsx` (mirror of `drawScenes`) is rendered by `Ad.tsx` when
  `SCENES` is set, else the hand-written `Scenes.tsx`. Timing math verified == the light
  engine's. `Scenes.tsx` examples now commented out by default.
- ✅ **All 11 reference functions ported to motifs** (#19) — canvas + Remotion. Canvas
  verified via `drawScenes` on a headless canvas; the Remotion visual diff still wants a
  real render pass. `lib/scenes` now carries `kind` so `overlay` motifs (`glitch`,
  `suspense`) skip the container `rise`.
- `studio.html` renders the scene list, drops its private drawing copy (#20).
- **Done when:** a new video is authored as a `config/scenes.json` with zero inline JS/JSX,
  and both engines match.

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
