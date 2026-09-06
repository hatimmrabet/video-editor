# `lib/scenes.py` + `lib/scenes.js`

`video-editor/scripts/lib/` · python (source of truth) + node (thin subprocess wrapper) · shared

> Resolves `config/scenes.json` against `build/captions.json`. Schema:
> [`design/scenes-as-data.md`](../design/scenes-as-data.md).

---

## One implementation, not two

`lib/scenes.py` holds the resolution; `lib/scenes.js` shells out to it (via
[`pythonCmd()`](lib-platform.md)) — same arrangement as [`lib/config`](lib-config.md) and
[`lib/transitions`](lib-transitions.md).

## What it does

**`load(work)`** → `{ scenes, schedule }`.

- `scenes` is `None` / `null` when `config/scenes.json` is absent — the engines then behave
  exactly as today (inline `SCENES`, `config/stage.json`).
- each resolved scene: `{ s, e, mode, transition, gb, motif, kind, params, timing, words, bottom }`
  (`kind` is `"scene"` | `"overlay"` from `motifs/index.json` — `overlay` motifs get no
  container `rise`).
  - `ref` (`{sentence:N}` / `{sentence:N,words:[a,b]}` / `{range:[t0,t1]}`) → `[s, e]` against
    `build/captions.json`. A scene whose sentence doesn't exist is **dropped** (invariant #2).
  - `motif` is nulled when it isn't `status:"implemented"` in `scripts/motifs/index.json` —
    the `layout` still applies, the graphic is skipped.
  - `words` = the ref sentence's words (for `timing.hold == "words"`); `[]` for a range ref.
  - `bottom` = the motif's `index.json` nominal graphic-bottom (feeds the `DOWN` flex).
- `schedule` = the video-rect timeline derived from the scenes' `layout` — gaps filled with
  `FULL`, adjacent same-mode spans merged, a trailing `FULL`. **Replaces `config/stage.json`**
  when `scenes.json` is present.

## Consumers

- **`render_frames.js`** — injects `scenes` + `schedule` + the used canvas motif sources
  into `window.init` (issue #17).
- **`safe_check.js`** — injects `schedule` only (it needs the right `vrect`, not the graphics).
- **Remotion** (#18) — `remotion.sh` folds `scenes` + the derived `schedule` into
  `project.json`; `SceneList.tsx` dispatches motifs.
- **`studio.html`** (#20).
