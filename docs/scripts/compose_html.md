# `compose.reference.html` (→ `<work>/compose.html`)

`video-editor/scripts/compose.reference.html` · HTML + Canvas 2D · light engine

> The light engine's drawing surface: one `<canvas id="cv" width=1080 height=1920>` and a
> `<script>` with all the drawing code. Copied to `<work>/compose.html` per project, then
> its scene functions are rewritten. Driven by `render_frames.js` and `safe_check.js`.

## The `window.*` contract

| Function | Purpose |
|---|---|
| `init(d)` | `d = { cards, total, outro, theme, behind }`. Sets theme vars, injects a non-Cairo font `<link>`, updates the logo, calls `preloadBroll()`. Returns a Promise |
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
| `R_DOWN` | `{214, 760, 652, 1160, r:40}` | any graphic — the default. Flexed by `rDown(gb, lines)` |
| `R_LOWER` | `{350, 1370, 380, 520, r:32}` | B-roll / big panel |
| `R_STAGE` | `{190, 470, 700, 620, r:44}` | **legacy — do not use** |
| `R_SIDE` | `{120, 480, 840, 560, r:44}` | **legacy — do not use** |

`const SCENES = [ {s, e, m}, ... ]` — inline array of `{start, end, rect}`.
`resolveScenes()` swaps each `R_DOWN` for a flexible rect from the graphic bottom (`gb`,
per-scene, e.g. `{s,e,m:R_DOWN,gb:480}`) and the caption line count.
`vrect(t)` lerps between consecutive rects over `TR = 0.42 s` (cubic-in-out).
`isFull(R)` = `R.w >= 1079 && R.h >= 1919` (by area, not corner radius — bug #8 note).

## Persistent chrome

- `grid()` — 60 px grid at ~7.5 % ink (drawn before the video, so the covered part hides).
- `badge(t)` — account pill at y 190; off unless `BADGE_UNTIL > 0`.
- `bar(t)` — progress bar at y 1492, or floated above a lowered video; hidden during
  cutout/headout.
- `caption(t)` — active card from `CAPS`; `layout()` wraps at `MAXW = 730`; per-word
  highlight (`ACC` when spoken; animated accent pill for `hot`); position from
  `vtarget(t)` (full → y 1460; lowered → rides the edge; cutout → above the head `PTOP`).

## Scene functions

The bottom section (`/* ===== SCENE GRAPHICS ===== */`) holds ~15 functions hardcoded for
one reference video (`stamp`, `chips`, `fileToCloud`, `transcript`, `cardStack`,
`suspense`, `syncViz`, `price`, `glitch`, `rtlBug`, `rtlFix`, `solved`, `oneFile`,
`commentBox`, `outro`). Each: `function name(t){ if(t<X||t>Y) return; … }`. `draw(t)`
dispatches them all through `safe(fn, t, name)`.

**Per video:** copy the file, rewrite `SCENES`, delete the reference scene functions and
write new ones (one per sentence, timed to `wordsOf(i)` from `build/captions.json`),
update the `draw(t)` dispatch list and the `RECAP` array + outro copy.

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
