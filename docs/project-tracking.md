# Project tracking

Work is tracked with **GitHub Issues + Projects** on `github.com/hatimmrabet/video-editor`.

**Applied.** The labels, the milestones (Pass 0–7 after the renumber), and the seed issues
below are created. Board:
**[video-editor roadmap](https://github.com/users/hatimmrabet/projects/4)** (columns
Backlog · Design · In progress · Review · Done; all seed issues start in Backlog).
The `gh` snippets are kept as a record and for adding more.

> Renumbering note: `Pass 1 — Execution & dependencies` was inserted before Config; the
> milestone objects Config…Web were renamed to Pass 2…7 (issues follow the object, so
> assignments were preserved).

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

| Title | Labels | Notes |
|---|---|---|
| ~~docs: land the `docs/` tree~~ | — | ✅ done — PR #2 |
| ~~chore: merge cross-platform branch into `main`~~ | — | ✅ done — PR #1 |
| docs: verify each script page against `--help` / code | `area:docs` | #3 |
| docs: verify `docs/invariants.md` wording against the code fixes | `area:docs` | #4 |

### Pass 1 — Execution & dependencies

Most of these are implemented by the Pass 1 PR — close on merge. See
[design/execution.md](design/execution.md).

| Title | Labels |
|---|---|
| execution: `pyproject.toml` + `uv.lock` + `.python-version` | `area:pipeline` `type:chore` `prio:high` |
| execution: rewrite `setup.sh` (uv bootstrap + `uv sync` + `npm ci`; drop `--break-system-packages`) | `area:pipeline` `area:windows` `type:chore` `prio:high` |
| execution: `VEVO_PY` / `VEVO_SKILL_DIR` in `lib/platform.sh`; `.sh` inline `python3` → `VEVO_PY` | `area:pipeline` `type:chore` |
| execution: switch to full `puppeteer` (bundled Chromium) + `launchOptions()` | `area:engine-light` `type:chore` `prio:high` |
| execution: `.nvmrc` (Node ≥ 22.12) | `area:pipeline` `type:chore` |
| execution: `SKILL.md` + docs — `python3` → `uv run` | `area:pipeline` `area:docs` |
| execution: `VEVO_FFMPEG` / `VEVO_FFPROBE` + optional static-binary fallback (deferred) | `area:pipeline` `type:chore` |
| execution: commit a lockfile for the Remotion template (deferred) | `area:engine-remotion` `type:chore` |
| execution: optional CPU-only `Dockerfile` (deferred) | `area:pipeline` `type:chore` |

### Pass 2 — Config

| Title | Labels |
|---|---|
| config: define `project.config.json` schema | `area:config` `type:design` `prio:high` |
| config: `scripts/lib/config.{py,js}` — `load()` + `emit_legacy()` | `area:config` |
| config: reverse compat — synthesize config from legacy files | `area:config` |
| config: migrate `reframe.py` to `config.load()` | `area:config` |
| config: migrate the Remotion `project.json` generator | `area:config` `area:engine-remotion` |
| config: `SKILL.md` step 1 writes `project.config.json` | `area:config` `area:docs` |

### Pass 3 — Transitions

| Title | Labels |
|---|---|
| transitions: shared `{type,duration,easing,params}` table | `area:transitions` `type:design` |
| transitions: light-engine scene enter/exit + rect transitions | `area:transitions` `area:engine-light` |
| transitions: Remotion parity (`@remotion/transitions`) | `area:transitions` `area:engine-remotion` |
| transitions: `montage_mode.py build --transition` → ffmpeg `xfade` | `area:transitions` `area:montage` |

### Pass 4 — Scenes

| Title | Labels |
|---|---|
| scenes: declarative scene schema | `area:scenes` `type:design` `prio:high` |
| scenes: `motifs/` registry layout + `index.json` | `area:scenes` `type:design` |
| scenes: light-engine interpreter (inside `safe()`) | `area:scenes` `area:engine-light` |
| scenes: Remotion `<Scene>` dispatcher | `area:scenes` `area:engine-remotion` |
| scenes: port reference functions → motifs (one issue per motif) | `area:scenes` |
| scenes: `studio.html` renders the scene list, drop its drawing copy | `area:scenes` `type:chore` |

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
