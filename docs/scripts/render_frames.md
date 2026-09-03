# `render_frames.js`

`video-editor/scripts/render_frames.js` · node · light engine

> The light-engine compositor. Loads `<work>/compose.html` in headless Chrome via
> Puppeteer, calls `window.init(...)` / `window.setFrame(...)` / `window.draw(t)` /
> `window.shot(q)` for every frame, and writes JPEGs. Supports resume, a time window, and
> preview stills. Overlays the person cutout if `behind.json` exists.

## CLI

```
node render_frames.js <work> all              # render all, resume (skip files > 2000 bytes)
node render_frames.js <work> all --force      # re-render everything
node render_frames.js <work> range <from> <to># re-render a time window (always overwrites)
node render_frames.js <work> preview <t1> <t2> ...  # write prev/tNN.NN.jpg stills
```

## Inputs (in `<work>`)

| File | Role | Required |
|---|---|---|
| `compose.html` | the drawing surface | yes |
| `caps.json` | caption cards, passed into `window.init` | yes |
| `sfx.json` | `.outro` → frame count | yes |
| `theme.json` | theme (font, colors) | optional |
| `behind.json` | person-cutout ranges/faces | optional |
| `vfr/*.jpg` | source frames | yes |
| `bt/person/*.png` | per-frame cutout PNGs | optional |

## Outputs

| File | Shape |
|---|---|
| `out/%05d.jpg` | composited frames, q ≈ 0.95. Count = `round((caps.total + sfx.outro) * 30)` |
| `prev/*.jpg` | preview stills (`preview` mode), q ≈ 0.9 |

## How it runs

1. `resolvePuppeteer()` + `launchOptions()` from `lib/platform.js`; page at 1080×1920;
   `setCacheEnabled(false)`.
2. `goto(fileUrl(compose.html))`, wait for the logo image.
3. `window.init({ cards, total, outro, theme, behind })`.
4. **After `init`**, wait for the theme font (weights 400/600/700/800/900) — the non-Cairo
   font `<link>` is injected inside `init`.
5. Per frame: pick `vfr/` index `round(t*30)+1`; `setFrame` (with `decode()`); if
   `behind.json` covers the frame, `setPerson`; `draw(t)`; `shot(q)` → write JPEG.
6. `all` skips frames already `> 2000 bytes` unless `--force`. After a non-`range` run it
   counts missing frames and warns before `encode.sh`.

## External tools

`node`, `puppeteer` (which bundles its own Chromium — no system Chrome needed).

## Cross-platform

Uses `lib/platform.js` (`fileUrl`, `launchOptions`, `resolvePuppeteer`), `path.sep`,
`path.resolve`. Fully Windows-capable.

## Place in the flow

Stage 9a. Followed by `encode.sh`. Re-invoked after `edit_script.py` (with `--force`) and
after `fx/behind_text.js` (with `--force` for `build`, `range` for `cutout`/`headout`).
The Remotion engine (`remotion.sh render`) replaces this stage entirely.

## Gotchas

- Full 48 s render ≈ 12 min / 1461 frames. Editing one scene? Re-render its window
  (`range a b`), don't re-render everything.
- A missing frame = a broken mux — the script's "⚠️ ناقص N فريماً" warning must be zero
  before `encode.sh`.
- Bugs #1–#4 in [../invariants.md](../invariants.md) all live at this boundary
  (draw-state, missing scene fns, image race, Chrome cache).
