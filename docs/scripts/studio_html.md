# `studio.html`

`video-editor/scripts/studio.html` · HTML + Canvas 2D · light engine · interactive

> A standalone browser scrubber / timeline for the light engine. Copied into the work dir
> alongside `compose.html`. Serve it and open it to scrub the composition by hand:
>
> ```
> uv run python -m http.server 8791 --directory <work>   # then open /studio.html
> ```

## What it is

Same `init` / theme contract as `compose.html`, plus a UI: an `<input id="tl" type=range
max=1537>` timeline, play / step buttons, and a per-scene list. Purely interactive — **no
script calls it**, it is not part of any automated stage.

## Scenes-as-data (issue #20)

When the project has a `config/scenes.json`, `render_frames.js` stages `build/scenes.json`
(the resolved `{scenes, schedule}`) + `build/motifs/<name>.js` (the used canvas motif
sources — `studio.html` can't reach `scripts/`). The bootstrap fetches both: `SCENES` is
rebuilt from the schedule, the motif sources are `eval`'d into `MOTIFS`, `SCENELIST` is
set, the timeline chips are rebuilt from the scene list, and `draw(t)` runs the same
`drawScenes(t)` interpreter as `compose.html` instead of the hardcoded reference functions.
**So a scenes-driven project's studio matches its render.**

## The technical-debt note

For a **scenes-less** project, `studio.html` still runs its own **third hand-maintained
copy** of the reference scene functions + drawing code (the first is
`compose.reference.html`, the second is `remotion/template/src/`). Those have drifted —
e.g. its `R_STAGE` is `{190, 660, …}` while `compose.reference.html`'s is `{190, 470, …}`.
Once every project is authored as `config/scenes.json`, that copy can go — see
[../design/scenes-as-data.md](../design/scenes-as-data.md).

## Gotchas

- If you change `compose.reference.html`'s drawing code, `studio.html` will not reflect it
  until you port the change by hand.
- Transitions (issue #12): `studio.html` carries the same `EZ` / `ez()` / `TX` block and
  `vrect` / `caption` wiring, but with **no injection path** to `scripts/transitions.json` —
  `TX` stays at today's literal values, so the studio previews the default behaviour.
  Per-scene `SCENES[i].transition` overrides still work (they're read from the inline
  array). A project that overrides the global defaults in `transitions.json` won't be
  reflected here.
- Scenes (issue #20): the motif graphics show only **after a render has run**
  (`render_frames.js` writes `build/scenes.json` + `build/motifs/`). Open the studio after
  extracting/compositing frames — which you do anyway, since it reads `build/frames-source/`.
- `draw()` here isn't guarded per-function like `compose.html`'s `safe()` — a broken
  `config/logo.png` throws in `badge()`. Pre-existing; unrelated to #20.
- Treat `studio.html`'s rect values as **not authoritative** — `compose.reference.html` is.
- `OUT_D=5.2` and `NVF=1379` (line ~488) are **hardcoded literals**, not read from any
  file — edit them by hand per project. Unrelated to the layout migration below; a
  pre-existing gap (see [project-tracking.md](../project-tracking.md)'s engine-drift bugs).
- **Migrated to the `build`/`config` layout (issue #59, 2026-09-05)** — fetches
  `build/captions.json` (was `caps.json`) and derives its theme from
  `config/project.config.json`'s `.theme`/`.crop.faceAnchor` (was a direct `theme.json`
  fetch); the logo `<img>` default is `config/logo.png`; frames come from
  `build/frames-source/`.
