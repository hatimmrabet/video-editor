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
- **macOS / Linux** — `ln -s "$(pwd)/video-editor" ~/.claude/skills/video-editor`.

A junction/symlink means the installed skill always reflects the **currently checked-out
branch**. Check `git branch --show-current` before a real run.

## The code is the only source of truth

**There is no `docs/` tree, and no separate documentation file may be created.** It existed,
it drifted from the code, and it was deleted. Three places, and only these three:

| Need | Read |
|---|---|
| What the pipeline does, in order, and how to talk to the user | `video-editor/SKILL.md` |
| What one script does, its CLI, its inputs/outputs | that script's own docstring, at the top of the file |
| The canonical stage list per world (`needs` / `makes` / checkpoints) | `video-editor/scripts/pipeline/<world>.json` |

Consequences, and they are not optional:

- **A new script carries its own docstring** — purpose, CLI, exit codes, what it reads and
  writes. That docstring *is* its documentation. Do not create a `.md` beside it.
- **A changed JSON shape is documented where it is produced** — in the script that writes
  it, and in the `_doc` field of the JSON file itself where one exists.
- **Never write a design document, a plan file, or a status/progress file into the repo.**
  Design decisions and progress live in **GitHub Issues**, not in tracked Markdown.

## When you find a problem, open a GitHub issue

**A problem detected is an issue created — immediately, in the same session, before moving
on.** A bug, a regression, a broken invariant, drift between the two engines, something
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
web UI, `lint_compose`, `behind_text`, the ffmpeg resolver, the motifs), but **no test for
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

# speech-ad pipeline (SKILL.md has the full order + the manual steps)
uv run scripts/plan_cuts.py <work>                 # src.mov -> cut.json
uv run scripts/transcribe.py <work> --language ar --model large-v3
uv run scripts/captions.py <work>                  # -> caps.json
uv run scripts/edit_script.py <work> show          # drop sentences (BEFORE scene design)
uv run scripts/reframe.py <work>                   # -> cutz.mp4
node  scripts/render_frames.js <work> all          # -> out/*.jpg  (resume; --force re-renders)
node  scripts/render_frames.js <work> range 12 18  # re-render one window after editing a scene
node  scripts/render_frames.js <work> preview 4.6 12.3   # stills for review
bash  scripts/encode.sh <work>                     # -> ad-final.mp4
node  scripts/safe_check.js <work> --shot          # MANDATORY: safe zone + hook, exit 3 on violation
bash  scripts/master_audio.sh <work> <work>/ad-final.mp4 <work>/ad-master.mp4

# Remotion engine (opt-in, replaces render_frames.js + encode.sh)
bash scripts/remotion/remotion.sh <work> setup      # ~500 MB, once
bash scripts/remotion/remotion.sh <work> render <work>/ad-final.mp4

# montage mode (independent — folder of speechless clips)
uv run scripts/montage_mode.py <work> scan <clipdir> --shot 1.5
uv run scripts/montage_mode.py <work> sheet --cols 6
uv run scripts/montage_mode.py <work> plan --dur 30
uv run scripts/montage_mode.py <work> build <work>/montage.mp4
```

Token economy matters here: a 1080-wide image ≈ 150k chars of context. Always review via
one `contact_sheet.sh` image at `scale=300:-1`, not separate stills; prefer
`safe_check.js`'s one-line verdict over screenshots; `grep -n` into `compose.html` rather
than reading it whole.

## Architecture essentials

- **Two modes, chosen from the input, never asked:** a single file with speech → speech
  ad (steps 1–11); a folder of clips → `montage_mode.py` (no transcription, no captions,
  no theme).
- **Two rendering engines with identical visual style:** the *light* engine
  (`render_frames.js` drives `compose.html` in headless Chrome, frame-by-frame to JPEGs)
  is always the default; the *Remotion* engine (`remotion.sh`, a live studio) is opened
  only if the user asks to edit visually. They share `caps.json`, `theme.json`, `sfx.wav`,
  `cutz.mp4`. **They drift easily** (rect values, caption widths); a change to one almost always
  needs the mirror change to the other, and a drift found is a GitHub issue.
- **Scenes are per-video code, not data (yet):** designing scenes = copying
  `compose.reference.html` → `<work>/compose.html` and rewriting the scene functions (and
  `Scenes.tsx` for Remotion). Timestamps are hardcoded per video. `edit_script.py` shifts
  all times, so run it *before* scene design. Making scenes data-driven is the largest
  open piece of work — it is tracked in GitHub Issues.
- **Cross-platform layer:** `scripts/lib/platform.sh` (sourced by every `.sh`; provides
  `VEVO_SKILL_DIR` + the `VEVO_PY` array) and `scripts/lib/platform.js` (required by the
  Node scripts) absorb macOS/Windows/Linux differences. Nothing else may hard-code a path
  or a browser location.
- **Isolated deps:** Python via `uv` (`.venv/`), browser via `puppeteer`'s bundled
  Chromium. `setup.sh` installs only ffmpeg/node/uv at system level.
- **One hard macOS dependency:** `fx/personmask.swift` (Apple Vision) and therefore
  `fx/behind_text.js`. Everything that needs it skips itself elsewhere.

## Constraints when editing

- **Four render-engine rules that must not regress** (each one caused a real broken
  render): every scene call wrapped in `safe()` (save/restore inside try/finally — without
  it a throwing scene corrupts the canvas and the video goes black from that point on);
  `draw()` resets canvas state at the top of every frame; `img.decode()` after `img.src`
  (`onload` alone races the decode); `setCacheEnabled(false)` in `render_frames.js` and
  `safe_check.js` (headless Chrome otherwise serves a stale `compose.html`).
- **No hardcoded colors in scene code** — everything derives from `theme.json` via the
  theme helpers (`rgba`, `lum`, `onACC`).
- **No color grade / filter over the person's video** by default (`reframe.py` only
  re-tags to bt709). `grade` is opt-in.
- **Never add ffmpeg `drawtext`** to any script — it is missing from many ffmpeg builds
  and fails silently. Burn text labels with Python/PIL (`contact_sheet.sh`,
  `montage_mode.py` do this).
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
headless suite `video-editor/test/` (web UI, `lint_compose`, `behind_text`, the ffmpeg
resolver, the motifs). Add a `*.test.js` there when you touch moving JavaScript.

`main` still carries the fork's line (reset to upstream v2.4 as the base for the rename +
Passes 0–7; upstream v2.5 stays on `majed-v2.5`). Upstream references to
`majedphotos/video-ad-editor` are left as-is. Work is tracked as GitHub Issues + the
"video-editor roadmap" Project.
