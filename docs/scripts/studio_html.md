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

## The technical-debt note

`studio.html` contains a **third hand-maintained copy** of the light engine's drawing code
(the first is `compose.reference.html`, the second is `remotion/template/src/`). It has
already drifted — e.g. its `R_STAGE` is `{190, 660, …}` while
`compose.reference.html`'s is `{190, 470, …}`.

Eliminating the triple maintenance is the point of
[../design/scenes-as-data.md](../design/scenes-as-data.md): if scenes are data and both
engines interpret the same list, the scrubber renders that list too instead of carrying
its own copy of the drawing code.

## Gotchas

- If you change `compose.reference.html`'s drawing code, `studio.html` will not reflect it
  until you port the change by hand.
- Treat `studio.html`'s rect values as **not authoritative** — `compose.reference.html` is.
- `OUT_D=5.2` and `NVF=1379` (line ~488) are **hardcoded literals**, not read from any
  file — edit them by hand per project. Unrelated to the layout migration below; a
  pre-existing gap (see [project-tracking.md](../project-tracking.md)'s engine-drift bugs).
- **Migrated to the `build`/`config` layout (issue #59, 2026-09-05)** — fetches
  `build/captions.json` (was `caps.json`) and derives its theme from
  `config/project.config.json`'s `.theme`/`.crop.faceAnchor` (was a direct `theme.json`
  fetch); the logo `<img>` default is `config/logo.png`; frames come from
  `build/frames-source/`.
