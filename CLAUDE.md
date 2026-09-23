# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is **not an application** — it is a Claude Code **skill**. `video-editor/SKILL.md` is
the entry point: it instructs the model to run a pipeline of small scripts
(`video-editor/scripts/`) that edit a talking-to-camera video into a captioned vertical
9:16 reel, entirely locally. There is no server and no build step. `video-editor/test/`
carries the automated suite that already exists (CI): the headless JS suite, plus Python
`unittest` coverage of the timeline projection. **No new tests are added to this repo** —
see "Testing policy" below. Everything about a pipeline change is verified by a real run.

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
  skill then freezes at that copy and drifts) and **do not** use a `.lnk`
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
- **A comment or a doc describes what IS, never what changed.** No `issue #NNN` references,
  no "used to" / "no longer" / "was removed" / "was retired" / "replaces X" / "the old Y" —
  that is a changelog, and it belongs in the git commit message and the GitHub issue, not
  duplicated forever in something someone has to keep reading. Explain the current behavior
  or the current constraint; if a constraint is only there because of a real edge case,
  name the edge case itself, not the fix that used to be missing.
  Bad: `// Retired the hand-written fallback (issue #147) — SceneList is now the only renderer.`
  Good: `// SceneList is the only scene renderer.`
  Bad: `// used to occupy 1492-1499, removed (issue #153) — space reclaimed for the caption.`
  Good: `// stays clear of Instagram's UI at any composition height.`
  The one exception: a pointer to a still-**open** issue for a deliberate, currently-live
  limitation (e.g. "this still does two encodes, not fixed yet") — that names present-tense
  reality, not history.

## When you find a problem, open a GitHub issue

**A problem detected is an issue created — immediately, in the same session, before moving
on.** A bug, a regression, a broken invariant, drift between a motif and its registry entry, something
that used to work and no longer does: `gh issue create` with what you observed, how to
reproduce it, and the file involved. Never record it in a Markdown file, a TODO comment,
or only in the conversation — those get lost. If you fix it in the same change, say so in
the issue and close it.

**An issue closes when its fix lands on `develop` — never wait for a `main`/release PR.**
`develop` is where day-to-day work is considered done; `main` only tracks *when* that work
ships. Closing on `develop` and re-tracking "still needs releasing" separately would be a
second, redundant source of truth for the same fact `git log origin/main..origin/develop`
already answers directly.

The operational spec (`video-editor/SKILL.md`) is in English, **and so are its trigger
phrases** — the description lists English and French phrasings, no Arabic. What stays in
the speaker's language is output content only: the on-screen caption text, the end-card
copy, and the transcript/filler examples that illustrate them. There is no separate
end-user guide (the Arabic `GUIDE.pdf`/`GUIDE.html` were deleted — stale, upstream, and
3 MB in every release package); the skill walks the user through each step itself.

## Testing policy

`video-editor/test/` holds what it already holds — the headless JS suite (the ffmpeg
resolver, the motif registry) and the Python `unittest` suite (`lib/timeline.py`'s
projection, `build_timeline.py`'s montage). Keep this working: if a change breaks one of
these tests, fix it. **Do not add new test files, and do not add new test cases to an
existing file.** This is a deliberate decision, not an oversight — do not "helpfully" add
coverage for a new script or a new function. Verifying a pipeline change means running the
relevant stage on a real video (see below), not writing a unit test for it.

## Running the pipeline

`python -m unittest discover test` runs the existing Python suite; CI runs both suites on
every PR. Beyond that, there's **no test for the pipeline output**: "testing" a pipeline
change means running the relevant stage on a real video. Every script takes a **work
directory** `<work>` as its first argument and reads/writes its files there.

**Python scripts run via `uv run` from the skill dir** (`cd video-editor`); `uv` syncs the
`.venv/` on demand. Node scripts via `node`, shell steps via `bash`. Dependencies are
isolated.

```bash
cd video-editor

# tools: installs ffmpeg / node / uv (system), then `uv sync` (isolated)
bash scripts/setup.sh              # report only
bash scripts/setup.sh --install    # install + sync

# reel pipeline (SKILL.md has the full order + the manual steps)
uv run scripts/prepare_source.py <work>            # rush/ take(s) -> build/source-joined.mp4 (stream copy, bt709)
uv run scripts/find_silences.py <work>             # measures silence -> build/silences.json
uv run scripts/transcribe.py <work> --language ar-MA   # -> build/transcript-raw.json (model auto-picks)
uv run scripts/build_timeline.py <work>            # the two measurements -> <work>/timeline.json
uv run scripts/settle_cuts.py <work>               # nudge each cut-in onto a clean frame
# Claude then corrects caption.text entry by entry in timeline.json (SKILL.md step 5)
uv run scripts/sync_captions.py <work>             # re-space only the sentences that were reworded
uv run scripts/mark_checkpoint.py <work> transcript-fix   # so run.py knows this was reviewed
# Claude finds the repeats itself (SKILL.md step 6) — no detection script
uv run scripts/cut_entries.py <work> drop e007     # `on: false`; `restore` puts it back
uv run scripts/mark_checkpoint.py <work> cut-review
uv run scripts/tighten.py <work>                   # propose word-level cuts; `apply` commits them
uv run scripts/mark_checkpoint.py <work> tighten
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
  file, or several takes of the same talk, which `prepare_source.py` concatenates. There is no
  format key, no aspect-ratio question and no second mode: `render_data.py` reads the source's
  own dimensions, so the output keeps the orientation it was shot in. Assembling unrelated
  clips into a montage is explicitly out of scope; the speech drives every decision here,
  so footage without it has nothing to edit.
- **One rendering engine: Remotion.** `remotion.sh` builds `<work>/remotion/` from
  `scripts/remotion/template/` plus one generated data file — `render_data.py` flattens
  `timeline.json` + `project.config.json` into `<work>/remotion/src/timeline.json`, with
  output times already resolved — alongside `build/source-joined.mp4` (hard-linked, uncut)
  and `sound-effects.wav`, then renders with `npx remotion render`. **The render is the only
  encode**: `Footage.tsx` plays each kept `src` span straight out of the source in its own
  `<Sequence>`, with the entry's zoom/anchor as CSS — there is no intermediate cut video.
  There is no second engine and no `engine` config key — each motif has exactly one
  implementation to keep correct, not several hand-written mirrors that can quietly
  disagree.
- **One file holds the montage: `<work>/timeline.json`.** An ordered list of
  self-contained entries, one per spoken sentence: what source seconds it keeps (`src`),
  its words, and whatever it was given — a scene, sound cues, a video treatment. Two rules
  make it work, and breaking either reintroduces cross-file drift:
  **(1)** anything measured off the recording is in **absolute source time** and never
  moves; anything authored by hand is **relative to its entry**; the output time is
  **never stored**, it is the running sum of the active entries.
  **(2)** cutting is either editing an entry's `src` or setting `on: false` — never
  deleting, never shifting. `lib/timeline.py` owns the schema and the projection; it is
  the most load-bearing code here and `test/test_timeline.py` guards it.
  `build/silences.json` and `build/transcript-raw.json` sit beside it as **measurements**:
  nothing ever edits them, so they cannot disagree with the montage, and it can always be
  rebuilt from them.
- **Scenes are data, not per-video code.** A `scene` block on an entry (motif + params) is
  dispatched by `SceneList.tsx`; an `overlay` block (a logo/badge riding the video itself)
  is drawn by `VideoOverlays.tsx`. There is no hand-written scene file: a one-off visual
  means writing a reusable motif in `scripts/motifs/`, never a throwaway per-video
  component.
- **A motif lives in two places and both must agree:** its entry in
  `scripts/motifs/index.json` and its component in `scripts/motifs/remotion/`.
  `test/motifs.test.js` enforces that; `tsc` checks the component itself.
- **`run.py` gates on `timeline.json`'s own content, not just file mtimes.** A human/agent
  decision step that edits entries in place (transcript-fix, cut-review, tighten, chapters,
  scenes, sound-cues) has no output file of its own to prove it ran, so it
  blocks on `timeline.json#checkpoints.<id>` instead — set once by
  `mark_checkpoint.py <work> <id>`, an explicit "considered" mark, same spirit as `on:false`,
  never inferred from what changed. A media file in a stage's `makes` (`.mp4`/`.wav`/…) is
  also verified playable via `ffprobe`, not just present — a killed encoder can leave one
  that exists but never finished.
- **Cross-platform layer:** `scripts/lib/platform.sh` (sourced by every `.sh`; provides
  `VEVO_SKILL_DIR` + the `VEVO_PY` array) and `scripts/lib/platform.js` (required by the
  Node scripts) absorb Windows/Linux differences. Nothing else may hard-code a path.
  Windows and Linux only.
- **Isolated deps:** Python via `uv` (`.venv/`), the renderer via `<work>/remotion/`'s own
  `node_modules`. `setup.sh` installs only ffmpeg/node/uv at system level — nothing at the
  skill root needs its own `npm install` (`scripts/lib/*.js` and the test suite are
  stdlib-only).

## Constraints when editing

- **Scene code must type-check** — `remotion.sh <work> check` (and the CI step) run
  `tsc --noEmit`. It catches an undefined helper, a bad prop or a duplicate style key
  before a render, so never merge scene or motif changes past a red type-check.
- **No hardcoded colors in scene code** — everything derives from `project.config.json`'s
  `theme` block through `theme.ts` (`T`) and the `util.tsx` helpers (`rgba`, `onACC`).
- **No color grade / filter over the person's video** by default (`prepare_source.py` only
  re-tags to bt709, stream copy). `grade` is opt-in.
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

**A branch is one unit of work, and it dies with its PR.** A squash merge writes `develop`
a brand-new commit — `develop` never gains the branch's own commits, only a flattened copy
of their diff. So a branch's history and "the same change, already on `develop`" are never
the same commit, even seconds after the merge: keep committing to that branch for a second,
unrelated piece of work, and the next PR's merge-base is still the point *before* the first
PR — git replays the first PR's entire diff again and collides with itself on every file
the second piece of work also touched. **So: once a PR merges, delete its branch before
starting anything else.** Before adding a commit to a branch that already exists, check
`gh pr list --state merged --head <branch>` — if it has an already-merged PR, cut a fresh
branch from `develop` instead of reusing it, even for a closely related follow-up.

`.github/workflows/ci.yml` gates every PR (one job, < 2 min): the static checks
(`node --check` / `compileall` / `bash -n` / JSON parse / the Remotion lockfile) then the
existing suite in `video-editor/test/` (the ffmpeg resolver and the motifs in JS; the
timeline projection and the montage in Python). See "Testing policy" above — keep it
green, don't grow it.

Upstream references to `majedphotos/video-ad-editor` are left as-is — see `FORK.md`. Work
is tracked as GitHub Issues + the "video-editor roadmap" Project.
