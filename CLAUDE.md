# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is **not an application** — it is a Claude Code **skill**. `video-editor/SKILL.md` is
the entry point: it instructs the model to run a pipeline of small scripts
(`video-editor/scripts/`) that edit a talking-to-camera video into a captioned vertical
9:16 reel, entirely locally. There is no server and no build step. The only automated
tests are the headless JS suite in `video-editor/test/` (CI); pipeline changes are
verified by a real run.

### Installing the skill for development — the folder must be *linked*, not copied

The skill loads from `~/.claude/skills/video-editor/` (skill `name: video-editor`). During
development that path must resolve to `<repo>/video-editor/` so every edit is live with no
re-copy.

- **Windows** — use a **directory junction** (no admin rights, no Developer Mode, fully
  transparent):
  ```powershell
  $t = "<repo>\video-editor"; $l = "$env:USERPROFILE\.claude\skills\video-editor"
  Remove-Item $l,"$l.lnk" -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Junction -Path $l -Target $t
  ```
  **Do not** use `ln -s` from Git-Bash (it silently *copies* the folder and exits 0 — the
  skill then freezes at that copy and drifts, issue #125) and **do not** use a `.lnk`
  shortcut (Claude Code does not follow `.lnk` files). Verify with
  `(Get-Item $l).LinkType` → `Junction`.
- **Linux** — `ln -s "$(pwd)/video-editor" ~/.claude/skills/video-editor`.

A junction/symlink means the installed skill always reflects the **currently checked-out
branch**. Check `git branch --show-current` before a real run.

## The code is the only source of truth

**There is no `docs/` tree, and no separate documentation file may be created.** It existed,
it drifted from the code, and it was deleted. Three places, and only these three:

| Need | Read |
|---|---|
| What the pipeline does, in order, and how to talk to the user | `video-editor/SKILL.md` |
| What one script does, its CLI, its inputs/outputs | that script's own docstring, at the top of the file |
| The canonical stage list (`needs` / `makes` / checkpoints) | `video-editor/scripts/pipeline/talking-video.json` |

Consequences, and they are not optional:

- **A new script carries its own docstring** — purpose, CLI, exit codes, what it reads and
  writes. That docstring *is* its documentation. Do not create a `.md` beside it.
- **A changed JSON shape is documented where it is produced** — in the script that writes
  it, and in the `_doc` field of the JSON file itself where one exists.
- **Never write a design document, a plan file, or a status/progress file into the repo.**
  Design decisions and progress live in **GitHub Issues**, not in tracked Markdown.

## When you find a problem, open a GitHub issue

**A problem detected is an issue created — immediately, in the same session, before moving
on.** A bug, a regression, a broken invariant, drift between a motif and its registry entry, something
that used to work and no longer does: `gh issue create` with what you observed, how to
reproduce it, and the file involved. Never record it in a Markdown file, a TODO comment,
or only in the conversation — those get lost. If you fix it in the same change, say so in
the issue and close it.

The operational spec (`video-editor/SKILL.md`) is in English, **and so are its trigger
phrases** — the description lists English and French phrasings, no Arabic. What stays in
the speaker's language is output content only: the on-screen caption text, the end-card
copy, and the transcript/filler examples that illustrate them. There is no separate
end-user guide (the Arabic `GUIDE.pdf`/`GUIDE.html` were deleted — stale, upstream, and
3 MB in every release package); the skill walks the user through each step itself.

## Running the pipeline

There's a headless suite for the moving JavaScript (`video-editor/test/`, run by CI — the
web UI, the ffmpeg resolver, the motif registry), but **no test for
the pipeline output**: "testing" a pipeline change means running the relevant stage on a
real video. Every script takes a **work directory** `<work>` as its first argument and
reads/writes its files there.

**Python scripts run via `uv run` from the skill dir** (`cd video-editor`); `uv` syncs the
`.venv/` on demand. Node scripts via `node`, shell steps via `bash`. Dependencies are
isolated.

```bash
cd video-editor

# tools: installs ffmpeg / node / uv (system), then `uv sync` + `npm ci` (isolated)
bash scripts/setup.sh              # report only
bash scripts/setup.sh --install    # install + sync

# reel pipeline (SKILL.md has the full order + the manual steps)
uv run scripts/plan_cuts.py <work>                 # silences -> build/cut-plan.json
uv run scripts/settle_check.py <work>              # nudge each cut-in onto a clean frame
uv run scripts/transcribe.py <work> --language ar-MA   # -> build/transcript-raw.json (model auto-picks)
# Claude then rewrites build/transcript-fixes.json whole (SKILL.md step 5), not line-by-line
uv run scripts/captions.py <work>                  # -> build/captions.json
# Claude finds the repeats itself and writes build/retake-cuts.json (SKILL.md step 6) — no detection script
uv run scripts/retakes.py <work> apply             # applies build/retake-cuts.json — the only fiddly, error-prone part
uv run scripts/edit_script.py <work> show          # drop whole sentences (BEFORE scene design)
uv run scripts/tighten.py <work>                   # propose word-level cuts; `apply` commits them
uv run scripts/reframe.py <work>                   # applies the cut plan -> build/video-reframed.mp4
bash  scripts/master_audio.sh <work> <work>/build/video-raw.mp4 <work>/video-final.mp4

# rendering — Remotion, the only engine. Every command installs the toolchain on first use
# (~500 MB), so `setup` is never a step you can forget.
bash scripts/remotion/remotion.sh <work> render     # -> build/video-raw.mp4
bash scripts/remotion/remotion.sh <work> studio     # the live timeline, to edit scenes visually
bash scripts/remotion/remotion.sh <work> still 4.6 12.3   # stills for review -> build/prev/
bash scripts/remotion/remotion.sh <work> check      # tsc --noEmit over the scene + motif code
```

Token economy matters here: a 1080-wide image ≈ 150k chars of context. Always review via
one `contact_sheet.sh` image at `scale=300:-1`, not separate stills; prefer
`remotion.sh <work> check`'s one-line verdict over screenshots; `grep -n` into a scene file
rather than reading it whole.

## Architecture essentials

- **One pipeline, nothing to choose.** The input is a recording of someone talking — one
  file, or several takes of the same talk, which `join_takes.py` concatenates. There is no
  format key, no aspect-ratio question and no second mode: `reframe.py` reads the source's
  own dimensions, so the output keeps the orientation it was shot in. Assembling unrelated
  clips into a montage is explicitly out of scope; the speech drives every decision here,
  so footage without it has nothing to edit.
- **One rendering engine: Remotion.** `remotion.sh` builds `<work>/remotion/` from
  `scripts/remotion/template/` plus the project's `captions.json`, `project.config.json`,
  `video-reframed.mp4` and `sound-effects.wav`, then renders with `npx remotion render`.
  There is no second engine and no `engine` config key — the canvas engine
  (`compose.html` / `render_frames.js` / `studio.html` / `safe_check.js` and the canvas
  motifs) was removed because keeping three hand-written mirrors in sync was a standing
  source of drift.
- **Scenes are per-video code, not data (yet):** designing scenes = rewriting the
  components in `<work>/remotion/src/Scenes.tsx` (never wiped by a re-sync), or authoring
  `config/scenes.json` and letting `SceneList.tsx` dispatch motifs. Timestamps are
  hardcoded per video. `edit_script.py` shifts all times, so run it *before* scene design.
  Making scenes data-driven is the largest open piece of work — tracked in GitHub Issues.
- **A motif lives in two places and both must agree:** its entry in
  `scripts/motifs/index.json` and its component in `scripts/motifs/remotion/`.
  `test/motifs.test.js` enforces that; `tsc` checks the component itself.
- **Cross-platform layer:** `scripts/lib/platform.sh` (sourced by every `.sh`; provides
  `VEVO_SKILL_DIR` + the `VEVO_PY` array) and `scripts/lib/platform.js` (required by the
  Node scripts) absorb Windows/Linux differences. Nothing else may hard-code a path or a
  browser location. macOS is no longer supported.
- **Isolated deps:** Python via `uv` (`.venv/`), the renderer via `<work>/remotion/`'s own
  `node_modules`, and `puppeteer`'s bundled Chromium for the test suite only. `setup.sh`
  installs only ffmpeg/node/uv at system level.

## Constraints when editing

- **Scene code must type-check** — `remotion.sh <work> check` (and the CI step) run
  `tsc --noEmit`. This replaced the old regex linter: it is the thing that catches an
  undefined helper, a bad prop or a duplicate style key before a render, so never merge
  scene or motif changes past a red type-check.
- **No hardcoded colors in scene code** — everything derives from `project.config.json`'s
  `theme` block through `theme.ts` (`T`) and the `util.tsx` helpers (`rgba`, `onACC`).
- **No color grade / filter over the person's video** by default (`reframe.py` only
  re-tags to bt709). `grade` is opt-in.
- **Never add ffmpeg `drawtext`** to any script — it is missing from many ffmpeg builds
  and fails silently. Burn text labels with Python/PIL (`contact_sheet.sh`,
  `contact_sheet.sh` does this).
- **Python scripts** keep `sys.stdout.reconfigure(encoding="utf-8")` at the top and write
  files with explicit `encoding="utf-8"` (Windows cp1252 otherwise breaks Arabic).
- **`.sh` scripts** need Git-Bash/WSL, source `lib/platform.sh`, and use `"${VEVO_PY[@]}"`
  for inline Python (never a bare `python3`). Python scripts the skill calls directly do
  `os.path.abspath(sys.argv[1])` — the caller must pass a Windows-style path, not `/c/...`.
- **A new script gets a docstring, not a doc page** (see "The code is the only source of
  truth"). Anything you would have written in a design or status file goes to a GitHub
  issue.

## Git / workflow

**Two long-lived branches.**

- **`develop`** — integration. Cut every `feat/` `fix/` `docs/` `chore/<topic>` branch
  from here, PR back into here (squash). Day-to-day work lands on `develop`.
- **`main`** — the release line. Only a `develop → main` PR touches it, and **every push
  to `main` publishes a release**: `.github/workflows/release.yml` builds `video-editor.skill`
  and cuts a GitHub Release named from `/VERSION`. To release, bump `VERSION` in the
  `develop → main` PR (idempotent — no bump, no release).

`.github/workflows/ci.yml` gates every PR (one job, < 2 min): the static checks
(`node --check` / `compileall` / `bash -n` / JSON parse / the Remotion lockfile) then the
headless suite `video-editor/test/` (web UI, the ffmpeg
resolver, the motifs). Add a `*.test.js` there when you touch moving JavaScript.

`main` still carries the fork's line (reset to upstream v2.4 as the base for the rename +
Passes 0–7; upstream v2.5 stays on `majed-v2.5`). Upstream references to
`majedphotos/video-ad-editor` are left as-is. Work is tracked as GitHub Issues + the
"video-editor roadmap" Project.
