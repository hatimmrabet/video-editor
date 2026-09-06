# Project tracking

Work is tracked with **GitHub Issues + Projects** on `github.com/hatimmrabet/video-editor`.

**Applied.** The labels, the milestones (Pass 0–7 after the renumber), and the seed issues
below are created. Board:
**[video-editor roadmap](https://github.com/users/hatimmrabet/projects/4)** (columns
Backlog · Design · In progress · Review · Done; all seed issues start in Backlog).
The `gh` snippets are kept as a record and for adding more.

> Renumbering (done): `Pass 1 — Execution & dependencies` (milestone #8) was inserted
> before Config; milestone objects #2…#7 were renamed to Pass 2…7 and their issues
> followed automatically.

The old `HANDOFF.md` was removed — its "what's next" list is the backlog below, and its
architecture / bug-history content is in [`docs/`](README.md).

---

## Labels

```bash
gh label create "area:docs"            -c "#0E8A16" -d "documentation"
gh label create "area:pipeline"        -c "#1D76DB" -d "stage order / data flow"
gh label create "area:engine-light"    -c "#5319E7" -d "canvas / Puppeteer engine"
gh label create "area:engine-remotion" -c "#5319E7" -d "Remotion engine"
gh label create "area:montage"         -c "#1D76DB" -d "montage mode"
gh label create "area:config"          -c "#FBCA04" -d "project.config.json / adapter"
gh label create "area:transitions"     -c "#FBCA04" -d "transition vocabulary"
gh label create "area:scenes"          -c "#FBCA04" -d "scenes-as-data / motif registry"
gh label create "area:orchestrator"    -c "#FBCA04" -d "run.py / subagents"
gh label create "area:windows"         -c "#006B75" -d "Windows support"
gh label create "type:design"          -c "#D4C5F9" -d "design doc / decision"
gh label create "type:bug"             -c "#D73A4A" -d "defect"
gh label create "type:chore"           -c "#BFDADC" -d "maintenance"
gh label create "prio:high"            -c "#B60205"
gh label create "prio:med"             -c "#D93F0B"
gh label create "prio:low"             -c "#0E8A16"
```

## Milestones

Mirror [design/roadmap.md](design/roadmap.md):

```bash
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 0 — Documentation"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 1 — Execution & dependencies"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 2 — Config"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 3 — Transitions"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 4 — Scenes"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 5 — Orchestrator"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 6 — Long-form"
gh api repos/hatimmrabet/video-editor/milestones -f title="Pass 7 — Web"
```

## Project board

```bash
gh project create --owner hatimmrabet --title "video-editor"
```

Columns: **Backlog · Design · In progress · Review · Done**. Views: by milestone, by
`area:*`. Add every issue below to the board.

---

## Seed issues

### Pass 0 — Documentation

Milestone #1 — **complete** (closed 2026-09-03).

| Title | Labels | Notes |
|---|---|---|
| ~~docs: land the `docs/` tree~~ | — | ✅ done — PR #2 |
| ~~chore: merge cross-platform branch into `main`~~ | — | ✅ done — PR #1 |
| ~~docs: verify each script page against `--help` / code~~ | `area:docs` | ✅ #3 — PR #50 |
| ~~docs: verify `docs/invariants.md` wording against the code fixes~~ | `area:docs` | ✅ #4 — PR #50 |

### Pass 1 — Execution & dependencies

Milestone #8. Implemented by **PR #37**. See [design/execution.md](design/execution.md).

| Title | Labels | Issue |
|---|---|---|
| ~~execution: `pyproject.toml` + `uv.lock` + `.python-version`~~ | `type:chore` `prio:high` | ✅ #38 |
| ~~execution: rewrite `setup.sh` (drop `--break-system-packages`)~~ | `area:windows` `type:chore` `prio:high` | ✅ #39 |
| ~~execution: `VEVO_PY` / `VEVO_SKILL_DIR`; `.sh` inline `python3` → `VEVO_PY`~~ | `type:chore` | ✅ #40 |
| ~~execution: switch to full `puppeteer` (bundled Chromium)~~ | `area:engine-light` `type:chore` `prio:high` | ✅ #41 |
| ~~execution: `.nvmrc` (Node ≥ 22.12)~~ | `type:chore` | ✅ #42 |
| ~~execution: `SKILL.md` + docs — `python3` → `uv run`~~ | `area:docs` | ✅ #43 |
| execution: `VEVO_FFMPEG` / `VEVO_FFPROBE` + static-binary fallback | `area:pipeline` `type:chore` | #44 |
| execution: commit a lockfile for the Remotion template | `area:engine-remotion` `type:chore` | #45 |
| execution: optional CPU-only `Dockerfile` | `area:pipeline` `type:chore` | #46 |

### Pass 2 — Config

**Done** (2026-09-05) — content side via PRs #54 and #57; physical file layout (#59) closes
it out. No back-compat was built (see
[design/project-config.md](design/project-config.md#migration--direct-no-bridge)) — the
originally-planned reverse-compat issue was closed as not-planned instead of implemented.

| Title | Labels | Status |
|---|---|---|
| config: define `project.config.json` schema | `area:config` `type:design` `prio:high` | ✅ #5 |
| config: `scripts/lib/config.{py,js}` — `load()` | `area:config` | ✅ #6 |
| ~~config: reverse compat — synthesize config from legacy files~~ | `area:config` | ❌ not planned — #7 |
| config: migrate `reframe.py` to `config.load()` | `area:config` | ✅ #8 |
| config: migrate the Remotion `project.json` generator | `area:config` `area:engine-remotion` | ✅ #9 |
| config: migrate `render_frames.js` to `config.load()` | `area:config` | ✅ #55 (not originally tracked) |
| config: migrate `safe_check.js` to `config.load()` | `area:config` | ✅ #56 (not originally tracked) |
| config: `SKILL.md` step 1 writes `project.config.json` | `area:config` `area:docs` | ✅ #10 |
| chore: apply the `rush`/`config`/`build` physical path migration | `area:config` `type:chore` | ✅ #59 |
| chore: remove emojis from `SKILL.md` markdown | `type:chore` `area:docs` | ✅ #58 (PR #65) |
| chore: translate Arabic logs/printf/comments to English across scripts | `type:chore` | ✅ #61 (PR #64) |
| chore: `fx/behind_text.js` uses `execSync` with string-concatenated commands | `type:chore` | #63 — open, deferred |

### Pass 3 — Transitions — **complete** (2026-09-05)

| Title | Labels | Status |
|---|---|---|
| transitions: shared `{type,duration,easing,params}` table | `area:transitions` `type:design` | ✅ #11 — `scripts/transitions.json` + `design/transitions.md` |
| transitions: light-engine scene enter/exit + rect transitions | `area:transitions` `area:engine-light` | ✅ #12 — `lib/transitions.{py,js}`, `compose.html` / `studio.html` wired |
| transitions: Remotion parity | `area:transitions` `area:engine-remotion` | ✅ #13 — `theme.ts` `TX`, `stage.ts` `videoLayers`, `Ad.tsx` / `Captions.tsx` wired (no `@remotion/transitions` dep) |
| transitions: `montage_mode.py build --transition` → ffmpeg `xfade` | `area:transitions` `area:montage` | ✅ #14 — `xfade_for()` map, `--xfade` removed, per-`plan[]` field |

### Pass 4 — Scenes

| Title | Labels | Status |
|---|---|---|
| scenes: declarative scene schema | `area:scenes` `type:design` `prio:high` | ✅ #15 — `config/scenes.json` locked in `design/scenes-as-data.md` |
| scenes: `motifs/` registry layout + `index.json` | `area:scenes` `type:design` | ✅ #16 — `scripts/motifs/` + `index.json` (11-name manifest) + `stamp` on both engines |
| scenes: light-engine interpreter (inside `safe()`) | `area:scenes` `area:engine-light` | ✅ #17 — `lib/scenes.{py,js}`, `render_frames.js` + `compose.html` `drawScenes(t)`, `safe_check.js` schedule |
| scenes: Remotion `<Scene>` dispatcher | `area:scenes` `area:engine-remotion` | ✅ #18 — `SceneList.tsx`, `project.json.scenes`, `theme.ts` `SCENES`, `Ad.tsx` picks dispatcher vs `Scenes.tsx` |
| scenes: port reference functions → motifs (one issue per motif) | `area:scenes` | 🟡 #19 — `counter`, `quote` done (+ `stamp` in #16); 8 motifs left |
| scenes: `studio.html` renders the scene list, drop its drawing copy | `area:scenes` `type:chore` | #20 |

### Pass 5 / 6 / 7

| Title | Labels | Milestone |
|---|---|---|
| orchestrator: `scripts/run.py` design | `area:orchestrator` `type:design` | Pass 5 |
| orchestrator: subagent split (transcript-fixer / scene-designer / reviewer) | `area:orchestrator` `type:design` | Pass 5 |
| long-form: world design doc → plan | `type:design` | Pass 6 |
| web: UI design doc → plan | `type:design` | Pass 7 |

### Bugs — engine drift

| Title | Labels | Source |
|---|---|---|
| bug: `R_DOWN` differs between `compose.reference.html` and `stage.ts` | `type:bug` `area:engine-light` `area:engine-remotion` | [engines.md](engines.md#drift) |
| bug: `R_STAGE` / `R_SIDE` differ between engines | `type:bug` | same |
| bug: caption max-width 730 (light) vs 918 (Remotion) | `type:bug` | same |
| bug: video object-position — `faceAnchor` (light) vs hardcoded `50% 26%` (Remotion) | `type:bug` | same |
| bug: `studio.html` rect values stale vs `compose.reference.html` | `type:bug` `area:engine-light` | [studio_html.md](scripts/studio_html.md) |

### Chores

| Title | Labels |
|---|---|
| chore: build & publish a `video-editor.skill` package as a GitHub Release | `type:chore` |

### Carried over from the previous handoff notes

| Title | Labels | Notes |
|---|---|---|
| feat: optional Adobe speech cleanup (`media_enhance_speech`) before `master_audio.sh` | `area:pipeline` | ⚠️ uploads audio to an Adobe server — against the "local only" default; needs a consent gate |
| feat: Adobe-stock B-roll — auto-convert on download (ProRes → h264) | `area:pipeline` | test clip `broll/AdobeStock_739776879.mov` |
| feat: plugin package for distribution (like `content-engine-v4.plugin`) | `type:chore` |
| test: montage mode on real varied clips | `area:montage` | today's test clips are all from one video |

---

## `gh issue create` template

```bash
gh issue create \
  --title "config: define project.config.json schema" \
  --label "area:config,type:design,prio:high" \
  --milestone "Pass 2 — Config" \
  --body "See docs/design/project-config.md. Deliverable: the finalized schema + open questions resolved."
```
