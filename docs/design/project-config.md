# `project.config.json` — the per-project config

**Status: shipped.** Schema finalized and confirmed by @hatimmrabet (issue #5); fully wired
in across the pipeline (Pass 2, issues #6/#8/#9/#10/#55/#56/#59). `theme.json` is retired,
no legacy bridge was built (issue #7 closed not-planned). See
[data-contracts.md](../data-contracts.md#configprojectconfigjson--the-per-project-config).

## Problem

Configuration for one video is scattered across up to six files with overlapping and
inconsistent reach: `theme.json`, `stage.json`, `outro.json`, `safe.json`, `sfx.json`'s
cue portion, and the scene code itself (`compose.html` / `Scenes.tsx` / `studio.html`).
Nothing says "this is the project," and there's no place to record language or which
engine/format to use.

## What this file is — and isn't

**It is: the small set of static facts the scripts need to run correctly, decided once,
up front — so the pipeline never has to interrupt the user again to re-ask something it
already knows.** Language, visual identity, output format. That's the whole test for
whether a field belongs here.

**It is not:**
- **A duplicate of the filesystem.** `rush/` and `rush/broll/` already say which files
  are the input — a config field that also lists them is a second source of truth that
  can drift out of sync with the first. Scripts scan `rush/` directly; nothing here names
  a file. (This reverses the first draft, which had `source.file` / `source.clips` /
  `broll.clips` snapshots — removed.)
- **A container for pipeline-generated state.** The silence-cut plan, the transcript, the
  captions, the sound cues, the scene layout, the end-card copy — none of that is known
  up front, all of it is *built* by running scripts, one stage at a time, and each stage
  already gets its own file under `build/` (see [file-layout.md](file-layout.md)'s rename
  table: `cut-plan.json`, `captions.json`, `sound-cues.json`, …). Merging them into
  `project.config.json` would mean asking the user to configure things that don't exist
  yet. (This reverses the first draft's `layout`, `scenes`, `audio`, `outro`, `safe`
  sections — removed. `safe` doubly so: the safe zone is a fixed, shared value now, not a
  per-project setting at all — see [file-layout.md](file-layout.md).) The one nuance: the
  *hand-authored* design that shapes those outputs — `config/stage.json`, `config/outro.json`,
  and `config/scenes.json` (Pass 4, [scenes-as-data.md](scenes-as-data.md)) — lives in
  `config/` as its own files, not here and not in `build/`; only what a script *generates*
  is `build/`.
- **A place for rarely-used cosmetic toggles that already have an off-by-default answer.**
  `badge` (the account handle overlay) is off by default and only ever turned on as a
  one-off exception for a specific video — that's a scene-design-time decision, not
  something every project should carry in its base config. Removed.

## The mode (`reel-speech` / `broll-montage`) is not a config field

**Same principle, one more consequence:** whether a project is a speech ad or a montage is
already fully determined by what's sitting in `rush/` (one file with speech vs. many
clips) — storing it again as a config value would be the same duplication as the file-list
problem above. `worlds.md`'s three families still describe real, different pipelines; they
just get *inferred* at the start of each run rather than *declared*.

`format` (below) is the one adjacent thing that genuinely can't be inferred from the
footage — the same recording could become either a short reel or a long-form edit — so it
stays an explicit field.

## The schema

```jsonc
{
  "format": "short",          // short | long — see worlds.md; the one thing footage shape alone can't tell us
  "engine": "light",          // light | remotion — literal, whichever is actually in use. Never "auto".
  "language": "ar",           // ar | ar-MA | ar-DZ | darija | fr | en | … — absent for broll-montage (no speech).
                               // Hard-dialect handling is derived from this value where transcribe.py consumes
                               // it, not stored as a separate flag.
  "grade": false,             // invariant #4 — off unless the user explicitly asks. reframe.py needs this
                               // before it runs, so it's the one processing flag that does belong up front.

  "crop": {                   // reel-speech only — reframe.py's landscape-crop anchors. Sensible defaults;
    "xAnchor": 0.5,            // revisited only if a preview shows the speaker off-center, never asked up front.
    "yAnchor": 0.30,
    "faceAnchor": 0.30
  },

  "theme": {
    "bg": "#101828", "ink": "#F5F7FA", "acc": "#F2B33D",
    "clay": "#C98B18", "mut": "#98A2B3",
    "font": "Tajawal", "logo": "config/logo.png", "handle": "@his_handle",
    "grid": true               // background grid — a static visual preference, same bucket as colors
  }
}
```

That's the whole file. **`logo` is a path relative to the work-dir root** — `"config/logo.png"`
since the `rush`/`config`/`build` physical migration ([file-layout.md](file-layout.md),
issue #59), now that `config/` physically holds it. `compose.html` and `remotion.sh`
resolve it from that root.

## Migration — direct, no bridge

**No back-compat adapter, no legacy-emitting step.** There is one user and no installed
base of old-style projects to protect — building a shim so "existing scripts keep working
untouched" would be maintaining two paths for a problem that doesn't exist. Scripts that
read `theme.json`/`stage.json`/`outro.json`/`safe.json`/`sfx.json` today are migrated
**directly** to `config.load()`, one at a time, and their old file-reading code is deleted
in the same change — not kept alongside as a fallback.

`scripts/lib/config.py` / `scripts/lib/config.js` expose exactly one function:

- `load(work)` → the merged config (`defaults.config.json` ←
  `<work>/config/project.config.json`). No `project.config.json` yet? Just the skill
  defaults — that's a project where the config phase hasn't run, not a case to paper over.

Done in this order, lowest-risk first: `reframe.py` (#8), `render_frames.js` (#55),
`safe_check.js` (#56), the Remotion generator (#9), `SKILL.md` step 1 (#10), then the
physical `rush`/`config`/`build` layout (#59). Each migration **removed** that script's
`theme.json`-reading code — no second path was left alongside.

## Decisions (design session with @hatimmrabet, 2026-09-05)

- **No `creator-profile` file, in any format.** With a single user today, the simpler
  equivalent convenience is copying the previous project's `project.config.json` as the
  starting point for a new one (and asking only what changed) rather than maintaining a
  second, separately-formatted memory file that could drift out of sync with the config
  schema. `SKILL.md`'s existing reference to `.auto-memory/creator-profile.md` is dropped.
- **B-roll needs no config field at all.** `rush/broll/` (see
  [file-layout.md](file-layout.md)) holds however many cutaway clips the creator supplies;
  scripts scan the folder directly, and `montage_mode.py`'s existing scorer picks the
  usable moments from among them — same principle as "the mode is not a config field."
- **Config is a mandatory first phase with an explicit confirmation, never silent.** See
  [orchestrator.md](orchestrator.md).
- **`world` → `format`, and it does not carry the reel-speech/broll-montage split.** See
  "The mode is not a config field" above.
- **Nothing in this file is closed/final until explicitly confirmed by @hatimmrabet.** The
  previous close of issue #5 happened without that confirmation — process error, corrected
  going forward for every issue, not just this one.
- **`lib/config.js` shells out to `lib/config.py` rather than reimplementing the merge
  logic.** Two independent implementations were only justified where Node has a real
  reason of its own (Chrome/Puppeteer, in `lib/platform.js`) — plain JSON merging isn't
  that, and Python is already a hard pipeline dependency. See
  [lib-config.md](../scripts/lib-config.md).
- **No back-compat, no legacy bridge, anywhere in this migration.** There's one user and no
  installed base — a shim to keep old, unmigrated scripts running untouched solves a
  problem that doesn't exist here. Old file-reading code is deleted as each script migrates
  to `config.load()`, not kept as a parallel path. (This reversed an earlier draft of
  `config.py`/`config.js` that had exactly such a bridge — removed.)
