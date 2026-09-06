# `compose.reference.html` (→ `<work>/compose.html`)

`video-editor/scripts/compose.reference.html` · HTML + Canvas 2D · light engine

> The light engine's drawing surface: one `<canvas id="cv" width=1080 height=1920>` and a
> `<script>` with all the drawing code. Copied to `<work>/compose.html` per project, then
> its scene functions are rewritten. Driven by `render_frames.js` and `safe_check.js`.

## The `window.*` contract

| Function | Purpose |
|---|---|
| `init(d)` | `d = { cards, total, outro, theme, behind, transitions, scenes, schedule, motifs }`. Sets theme vars, injects a non-Cairo font `<link>`, updates the logo, applies `transitions` (→ `TX`, `TR`). If `d.schedule` — rebuilds `SCENES`; if `d.scenes` — sets `SCENELIST`; if `d.motifs` — evals each canvas motif source into `MOTIFS`. Calls `preloadBroll()`. Returns a Promise |
| `setFrame(url)` | `VF.src = url; VF.decode()` — set the source video frame |
| `setPerson(url, face)` | set the person-cutout PNG + face box (`{x,y,w,h}`) for this frame; `PRS_OK` gates the effect |
| `draw(t)` | render one frame at time `t`. **Resets all canvas state first** |
| `shot(q)` | `canvas.toDataURL('image/jpeg', q)` |
| `vrect(t)` | the interpolated video rectangle at `t` |
| `preloadBroll()` | load optional B-roll frame sequences declared in `BR_NEED` |

## Theme vars (overwritten by `init(d.theme)`)

`BG INK ACC CLAY MUT FONT HANDLE` · `FACE_ANCH` (default 0.30) · `GRID` (default true) ·
`BADGE_UNTIL` (default 0 — badge off). Derived helpers: `rgba(hex,a)`, `lum(hex)`,
`onACC()` (ink or white over the accent, by luminance), `DARK()`.

## Video staging rectangles

| Const | Value | Use |
|---|---|---|
| `R_FULL` | `{0, 0, 1080, 1920, r:0}` | speech, no graphic |
| `R_DOWN` | `{0, 770, 1080, 1150, r:0}` | any graphic — the default. Full-width fallback; `resolveScenes()` replaces each entry with `rDown(gb, lines)` |
| `R_LOWER` | `{350, 1370, 380, 520, r:32}` | B-roll / big panel |

`const SCENES = [ {s, e, m}, ... ]` — inline array of `{start, end, rect}`.
`resolveScenes()` swaps each `R_DOWN` for a flexible rect from the graphic bottom (`gb`,
per-scene, e.g. `{s,e,m:R_DOWN,gb:480}`) and the caption line count.
`vrect(t)` lerps between consecutive rects over `TR` (= `TX.sceneToScene.duration`, 0.42 s)
with `TX.sceneToScene.easing` (`eio`). A `SCENES[i].transition` object overrides
type/duration/easing for that boundary — `rect-morph` (lerp, default), `cut` (snap), or
`dissolve` (`drawVideo` cross-fades the two rects). Transition vocabulary + easing registry
(`EZ`, `ez()`, `TX`) come from [`scripts/transitions.json`](../../video-editor/scripts/transitions.json)
via `init`; fallback = today's literals. `isFull(R)` = `R.w >= 1079 && R.h >= 1919` (by
area, not corner radius — bug #8 note).

## Persistent chrome

- `grid()` — 60 px grid at ~7.5 % ink (drawn before the video, so the covered part hides).
- `badge(t)` — account pill at y 190; off unless `BADGE_UNTIL > 0`.
- `bar(t)` — progress bar at y 1492, or floated above a lowered video; hidden during
  cutout/headout.
- `caption(t)` — active card from `CAPS`; `layout()` wraps at `MAXW = 730`; per-word
  highlight (`ACC` when spoken; animated accent pill for `hot`); position from
  `vtarget(t)` (full → y 1460; lowered → rides the edge; cutout → above the head `PTOP`).
  Enter/exit are the `rise` type — `TX.sceneEnter` (0.2 s ease, y 28, back-scale) /
  `TX.sceneExit` (0.13 s linear, y −10).

## Scene functions

The bottom section (`/* ===== SCENE GRAPHICS ===== */`) holds ~15 functions hardcoded for
one reference video (`stamp`, `chips`, `fileToCloud`, `transcript`, `cardStack`,
`suspense`, `syncViz`, `price`, `glitch`, `rtlBug`, `rtlFix`, `solved`, `oneFile`,
`commentBox`, `outro`). Each: `function name(t){ if(t<X||t>Y) return; … }`. `draw(t)`
dispatches them all through `safe(fn, t, name)` — **but only when `SCENELIST` is null**
(no `config/scenes.json`).

**Scenes-as-data (issue #17):** when `render_frames.js` injects a resolved
`config/scenes.json`, `SCENES` is rebuilt from `d.schedule`, `SCENELIST` / `MOTIFS` are
set, and `draw(t)` calls **`drawScenes(t)`** instead of the hardcoded list. `drawScenes`
resolves each scene's `timing` (enter/exit = the `rise` type; `hold: "words"` → a
`wordIndex`), applies the container alpha + `translateY` inside `safe()`, and calls
`MOTIFS[scene.motif](ctx)` — `ctx = { X, t, enter, exit, hold, words, wordIndex, rect,
theme, params, fx }` (`fx` = the helper bag). See
[`scripts/motifs/README.md`](../../video-editor/scripts/motifs/README.md).

**Per video, the old way (no `config/scenes.json`):** copy the file, rewrite `SCENES`,
delete the reference scene functions and write new ones (one per sentence, timed to
`wordsOf(i)` from `build/captions.json`), update the `draw(t)` dispatch list and the
`RECAP` array + outro copy.

## macOS effects (compositing side)

`behindText(t)` (kashida word behind the head), `personStage(t)` (cutout — speaker in
front of the design), `headOut(t)` (video in a card, head above the edge). Data from
`build/person-cutout.json`; the cutout PNGs come from `setPerson`. All full-screen-only.

## B-roll (optional)

`BR_NEED = { name: [firstFrame, lastFrame] }` declares a sequence loaded once at `init`;
`brCard(name, dt, speed, alpha, s, e)` draws it in a card. `BRCROP` trims burned-in
subtitles from Anthropic-stock footage.

## Related

- `studio.html` — a standalone scrubber with a **third copy** of this drawing code. See
  [studio_html.md](studio_html.md).
- The Remotion equivalent is `remotion/template/src/` — see [remotion-template.md](remotion-template.md)
  and the drift table in [../engines.md](../engines.md#drift).

## Gotchas

- Bugs #1–#3 in [../invariants.md](../invariants.md) all live here — `safe()`, the
  `draw()` state reset, and `decode()` in `setFrame`/`setPerson`.
- Don't read this file whole for a small change — `grep -n` the function you need.
- Everything derives from the theme — never write a literal colour or `rgba()`.
- **Migrated to the `build`/`config` layout (issue #59, 2026-09-05)** — the hardcoded
  `<img id="LOGO" src="...">` default is now `config/logo.png`, not `logo.png`.
