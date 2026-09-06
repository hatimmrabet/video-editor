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
| 2 | **`project.config.json`** (direct migration, no adapter) | `Pass 2 — Config` | 0 | ✅ done (PRs #54, #57, issues #10, #59) |
| 3 | **Transitions vocabulary** | `Pass 3 — Transitions` | 2 (declared in config) | ✅ done (#11 schema · #12 light · #13 Remotion · #14 montage) |
| 4 | **Scenes as data + motif registry** | `Pass 4 — Scenes` | 2, 3 | ✅ done (#15 schema · #16 registry · #17 light · #18 Remotion · #19 11 motifs · #20 studio) |
| 5 | **Orchestrator runner** (`run.py`) | `Pass 5 — Orchestrator` | 2 (4 makes it fuller) | ✅ done (#21 `run.py` + stage manifests · #22 subagent design) |
| 6 | **`long-form` world** (YouTube) | `Pass 6 — Long-form` | 2, 3, 5 | 🚧 design done (#23 — [long-form.md](long-form.md)) |
| 7 | **Web interface** | `Pass 7 — Web` | 2, 5 | 🚧 design done (#24 — [web.md](web.md)) |

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
- ✅ **`studio.html` reads the scene list** (#20) — `render_frames.js` stages
  `build/scenes.json` + `build/motifs/<name>.js` (studio can't reach `scripts/`); the studio
  runs the same `drawScenes(t)` and rebuilds its timeline chips from the scenes, so it
  matches the render. Its own copy still serves scenes-less projects.
- **Done** — a video can be authored as `config/scenes.json` with zero inline JS/JSX and
  both engines + the studio interpret it. **Remaining (unnumbered):** delete all three
  inline scene-code copies once a real project has shipped through the new path.

## Pass 5 — Orchestrator

- ✅ **`scripts/run.py`** (#21) — `run.py <work> [--from ID] [--to ID] [--only ID]
  [--world] [--engine] [--dry] [--force] [--list]`. World inferred from `rush/`; stage
  list from [`scripts/pipeline/<world>.json`](../../video-editor/scripts/pipeline/).
  Timestamp-based skip (no state file), blocking checkpoints for the real decisions
  (`transcript-fixes.json`, `sound-cues.json`) and advisory ones for the optional steps
  (sentence trim, scenes), `when` gate for the Remotion path. Decisions locked in
  [orchestrator.md](orchestrator.md); tested through `cut`+`audio` on a real clip and the
  full plan via `--dry`.
- ✅ **Subagent split** (#22, design) — spec in [orchestrator.md](orchestrator.md). The
  honest conclusion: only **reviewer** is a clean win (mechanical pre-delivery checks, no
  user input, keeps images/ffmpeg dumps off the main thread); **scene-designer** is worth
  it as a *draft* generator that the main agent then refines with the user;
  **transcript-fixer stays inline** (correcting colloquial Arabic is a conversation, so a
  subagent saves little). Turning the two into `video-editor/agents/*.md` templates is a
  follow-up implementation ticket if wanted — not built.
- **Done when:** `run.py <work>` takes a config + source to a finished reel, pausing only
  for the genuine decisions. The conductor + both stage manifests are complete and every
  branch (`--dry`, resume-past-halt, `--force`, `--engine remotion`, error paths) is
  verified, plus a real `cut`+`audio` run; a full sandbox reel run needs Whisper + a real
  scene-design pass, not done here.

## Pass 6 — Long-form

- ✅ **World design + implementation plan** (#23) — [long-form.md](long-form.md). One
  world (`format:"long"` switch, not inferred); its own 11-stage manifest; `tighten.py`
  for the jump-cut + filler pass (curated `scripts/fillers.json`, not per-run model
  choice); hand-authored `config/chapters.json` (agent proposes, no topic-shift
  heuristic); B-roll via `config/broll.json` + the montage scorer; `assemble_longform.py`
  (ffmpeg filter graph, no frame render); soft `.srt` captions (burned lower-third
  reserved). No motif/scene/`safe_check`/`sound_fx` involvement. Six implementation
  tickets listed in the doc.
- 🚧 **World switch** (#84) — `run.py` checks `config.format=="long"`;
  `scripts/pipeline/long-form.json` (13 stages); `join_takes.py`; `longform` config block.
- 🚧 **Jump-cut + filler engine** (#85) — `tighten.py` + `scripts/fillers.json`; the
  `keep`-remap extracted to `lib/timeline.py` (shared with `edit_script.py`).
- 🚧 **16:9 `reframe.py`** (#86) — `format:"long"` → 1920×1080; crop logic generalized.
- 🚧 **`assemble_longform.py`** (#87) — B-roll `overlay` graph / remux → `video-raw.mp4`.
- 🚧 **Chapters** (#88) — `config/chapters.json` → `subtitles.py` → `video-final.chapters.txt`.
- **The long-form pipeline runs end to end.** Remaining: `SKILL.md` section (#89).
- **Done when:** a ≥ 20-min recording → an edited 16:9 talk with chapters and B-roll.

## Pass 7 — Web

- ✅ **UI design + implementation plan** (#24) — [web.md](web.md). Local-only
  (`127.0.0.1`, no auth, no cloud, no publish); `scripts/web.py` = a ~250-line stdlib
  `http.server` that shells out to `run.py` and serves a no-build SPA. The config form
  writes `config/project.config.json`; each `run.py` checkpoint (`transcript-fix`,
  `script-review`, `scenes`, `sound-cues`) is a screen; `GET /state` = parsed
  `run.py --dry --json`. Nothing re-implements pipeline logic. Eight implementation
  tickets listed in the doc.
- Drop zone → form writes `project.config.json` → "generate" calls `run.py` → preview.
- Decision points become form steps.
- Same engine; no new pipeline.
- **Done when:** drop a real video in the browser → download a finished reel without
  touching a terminal.

## Also on the backlog (not passes)

Tracked as issues, not milestones — see [../project-tracking.md](../project-tracking.md):
Adobe audio cleanup (`media_enhance_speech`), Adobe-stock B-roll auto-convert, plugin
packaging, engine-drift fixes, the stale root `.skill` package, montage testing on real
varied clips.
