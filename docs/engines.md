# The two rendering engines

Speech-ad mode has two engines that produce the same visual style. The skill starts with
the **light engine** silently and only opens **Remotion** if the user asks to edit
visually. This document explains how each draws and — importantly — where they have
**drifted apart**.

---

## Light engine (Puppeteer + Canvas 2D)

### Files

| File | Role |
|---|---|
| `scripts/render_frames.js` | the driver — loads `compose.html` in headless Chrome, calls it per frame, writes JPEGs |
| `scripts/compose.reference.html` | the drawing surface — one `<canvas>` + all drawing code. Copied to `<work>/compose.html` per project |
| `scripts/studio.html` | standalone scrubber — a **third copy** of the same drawing code + a timeline UI |
| `scripts/encode.sh` | muxes `out/*.jpg` + audio → `ad-final.mp4` |
| `scripts/safe_check.js` | pre-delivery safe-zone / hook check, also drives `compose.html` |
| `scripts/fx/behind_text.js` + `fx/personmask.swift` | macOS person-cutout data feeding `compose.html` |

### How it renders

`render_frames.js`:

1. Reads `sfx.json` (`.outro`), `theme.json`, optional `behind.json`.
2. `resolvePuppeteer()` → `puppeteer` (bundled Chromium); `browser.launch(launchOptions())`;
   new page at **1080×1920**; `setCacheEnabled(false)` (Chrome would otherwise serve a
   stale `compose.html`).
3. `page.goto(fileUrl(<work>/compose.html))`, wait for the logo image.
4. `window.init({ cards, total, outro, theme, behind })` — passes `caps.json` contents in.
5. **After `init`**, wait for the theme font (weights 400/600/700/800/900). Order matters:
   a non-Cairo font `<link>` is injected *inside* `init`, so waiting before `init` waits
   for nothing.
6. For each frame `i` in `0 … round((caps.total + outro) * 30)`:
   - pick source JPEG `vfr/%05d.jpg` (index `round(t*30)+1`), `window.setFrame(url)` →
     `VF.src = url; VF.decode()`
   - if `behind.json` covers this frame: `window.setPerson(cutout.png, face)`
   - `window.draw(t)` then `window.shot(0.95)` → `canvas.toDataURL('image/jpeg')` → write
     `out/%05d.jpg`
7. Modes: `all` (resume — skips files `> 2000 bytes` unless `--force`), `range a b`
   (re-render a window, always overwrites), `preview t1 t2 …` (writes `prev/`).

Then `encode.sh` muxes `out/*.jpg` + `cutz.mp4` audio + `sfx.wav` into the final MP4.
Full 48 s render ≈ 12 min / 1461 frames.

### The `window.*` contract of `compose.html`

| Function | Purpose |
|---|---|
| `init(d)` | set theme vars, inject font, preload B-roll; returns a Promise |
| `setFrame(url)` | set the source video frame (`VF.src`, then `decode()`) |
| `setPerson(url, face)` | set the person-cutout PNG + face box for the current frame |
| `draw(t)` | render one frame at time `t` onto the canvas |
| `shot(q)` | `canvas.toDataURL('image/jpeg', q)` |
| `vrect(t)` | the interpolated video rectangle at time `t` (used by `safe_check.js` too) |
| `preloadBroll()` | load optional B-roll frame sequences |

### How scenes are drawn

`compose.reference.html` is one `<canvas id="cv" width=1080 height=1920>` plus a script that holds:

- **Theme vars** `BG INK ACC CLAY MUT FONT HANDLE FACE_ANCH GRID BADGE_UNTIL`, overwritten by `init(d.theme)`.
- **Video staging rectangles** (module consts):
  `R_FULL {0,0,1080,1920,r:0}` · `R_STAGE {190,470,700,620,44}` (legacy) ·
  `R_SIDE {120,480,840,560,44}` (legacy) · `R_LOWER {350,1370,380,520,32}` ·
  `R_DOWN {214,760,652,1160,40}`.
- **`const SCENES = [ {s:0.00,e:3.32,m:R_FULL}, {s:3.32,e:8.00,m:R_DOWN}, … ]`** — a
  hardcoded inline array of `{start, end, rect}`. `resolveScenes()` replaces each `R_DOWN`
  entry with a flexible `rDown(gb, lines)` rect computed from the graphic bottom + caption
  line count. `vrect(t)` interpolates between consecutive rects over `TR = 0.42 s` with
  cubic-in-out easing.
- `drawVideo(t)` — cover-scale the source JPEG into `vrect(t)`, clip to the rounded rect,
  optional shadow + stroke.
- **`caption(t)`** — finds the active card in `CAPS`, `layout()` wraps words to lines
  (`MAXW = 730`), draws a `rgba(bg, 0.96)` rounded card with per-word highlighting
  (spoken word → `ACC`; `hot` word → animated accent pill). Position depends on
  `vtarget(t)`: full-screen → y 1460; lowered video → rides the video edge; cutout/headout
  → above the head.
- Persistent chrome: `grid()`, `badge(t)` (off by default), `bar(t)` (progress bar).
- **`safe(fn, t, name)`** — wraps every scene call in `X.save() / try / catch / finally
  X.restore()`, logs a skipped-scene warning once. This is the fix for invariants #1/#2.
- **`draw(t)`** first resets all canvas state (`setTransform`, `globalAlpha`, `filter`,
  shadow, composite-op) every frame — a hard guarantee that each frame starts clean.

The bottom of the file (`/* ===== SCENE GRAPHICS ===== */`) has ~15 named functions
**hardcoded for one specific reference video** (`stamp`, `chips`, `fileToCloud`,
`transcript`, `cardStack`, `suspense`, `syncViz`, `price`, `glitch`, `rtlBug`, `rtlFix`,
`solved`, `oneFile`, `commentBox`, `outro`), each `function name(t){ if(t<X||t>Y) return; … }`
with baked-in timestamps. `draw(t)` calls them all through `safe(...)`.

**"Invent scenes per video" means:** per video the model copies
`compose.reference.html` → `<work>/compose.html`, rewrites the `SCENES` array, **deletes
the reference scene functions and writes new ones** (one per sentence, keyed to word
timings via `wordsOf(i)` from `caps.json`), and updates the `draw(t)` dispatch list and
the outro copy. There is **no scene data file** for the light engine — the scene code is
inline JavaScript in `compose.html`.

`fx/behind_text.js` (macOS): `plan` lists suitable short sentences; `build 1 9` /
`build 2:6-8` compiles `personmask.swift` (Vision), cuts the person out of the relevant
`vfr/` frames → `bt/person/%05d.png`, writes `behind.json`. `cutout`/`headout` take a
time range instead. The compositing (kashida-stretched Arabic word passing behind the
head; person redrawn on top; `personStage`; `headOut`) lives in `compose.reference.html`.

---

## Remotion engine

### Driver — `scripts/remotion/remotion.sh`

| Command | Effect |
|---|---|
| `setup` | `sync_all` + `npm install` in `<work>/remotion` (~500 MB, once) |
| `sync` | refresh data/assets only |
| `studio [port]` | `npx remotion studio` (default port 3000) |
| `render [out.mp4]` | `npx remotion render Ad <out> --codec h264 --crf 21 --jpeg-quality 95` |

`sync_all`:

- `mkdir -p <work>/remotion/src <work>/remotion/public`
- Always overwrites structural files: `package.json tsconfig.json remotion.config.ts
  .gitignore README.md` and `index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts util.tsx
  Chrome.tsx Captions.tsx Outro.tsx Guides.tsx`
- **`Scenes.tsx` copied once only** (`[ -f … ] || cp …`) — the user's scene work survives
  a re-sync
- `cp <work>/caps.json → src/caps.json`
- inline Python **generates `src/project.json`** from `caps.json` + `theme.json` +
  `sfx.json` + `stage.json` + `outro.json` + `safe.json`
- copies assets: `cutz.mp4 → public/video.mp4`, `sfx.wav → public/sfx.wav`,
  `<logo> → public/logo.png`

### `src/*` files

| File | Role |
|---|---|
| `index.ts` | `registerRoot(RemotionRoot)`, imports `./font` |
| `Root.tsx` | `<Composition id="Ad" component={Ad} durationInFrames={DUR_F} fps={30} width={1080} height={1920} />` |
| `theme.ts` | imports `project.json`; exports `T` (colors/font/handle/badgeUntil), `FPS=30`, `VEND=P.total`, `OUTRO=P.outro`, `DUR_F`, `HAS_SFX`, `OUTRO_COPY`, `STAGE`, `GUIDES` |
| `util.tsx` | Remotion `interpolate`/`Easing` wrappers: `p, ease, eio, back, sec, lerp, hx, rgba, lum, onACC` — same math as `compose.html`'s helpers |
| `stage.ts` | rect presets + `vrect(t)` interpolating per `project.json.stage`. `TR = 0.42` |
| `Ad.tsx` | `<AbsoluteFill background={T.bg}>`; if `t < VEND` an absolutely-positioned `div` at `vrect(t)` with `<OffthreadVideo src={staticFile('video.mp4')} objectFit:cover objectPosition:'50% 26%'>` + `<VideoOverlay t>`; then `<Audio>`, `<Badge>`, `<Bar>`, `<Scenes>`, `<Captions>`, `<Outro>`, `<Guides>` |
| `Captions.tsx` | active card from `caps.cards`, RTL flex-centered card at `bottom: 1920-1460`, per-word `<span>` with `color: hot ? '#FFF' : active ? T.acc : T.ink` and an animated `scaleX` accent pill behind hot words |
| `Chrome.tsx` | `Badge` (handle + logo pill at `top:190`, hidden when `badgeUntil==0`), `Bar` (progress bar at `top:1492`), generic `Card` |
| `Outro.tsx` | wipe-up reveal; logo, `C.line`, `RECAP` 2-col grid with SVG check, `C.cta_top` + `C.cta_word` accent chip, `C.tail`, handle+logo footer. **All copy from `project.json` — nothing hardcoded** |
| `Guides.tsx` | 4 red Instagram-zone overlays, shown only when `project.json` `guides:true` |
| `Scenes.tsx` | **the file the operator rewrites per video.** Exports `W(i)` = words of caption `i`, a `CARD` style const, two example components (`Stamp`, `Chips`). `VideoOverlay` = drawn over the video itself; `Scenes` = drawn over everything |
| `font.ts` | `delayRender`/`continueRender` around a Google Fonts `<link>` for `T.font` |
| `remotion.config.ts` | `setVideoImageFormat('jpeg')`, `setChromiumOpenGlRenderer('angle')` |
| `tsconfig.json` | ES2020, `react-jsx`, `resolveJsonModule`, `strict:false` |
| `package.json` | `@remotion/cli`, `remotion`, `react`, `react-dom` |

---

## Drift

The two engines were hand-ported from each other and have diverged. **Fixing this is the
point of [design/scenes-as-data.md](design/scenes-as-data.md).** Known differences today:

| Thing | `compose.reference.html` (light) | `stage.ts` / `Captions.tsx` (Remotion) |
|---|---|---|
| `R_DOWN` | `{x:214, y:760, w:652, h:1160, r:40}` | `{x:0, y:770, w:1080, h:1150, r:0}` |
| `R_STAGE` | `{x:190, y:470, w:700, h:620, r:44}` | `{x:190, y:660, w:700, h:700, r:44}` |
| `R_SIDE` | `{x:120, y:480, w:840, h:560, r:44}` | `{x:120, y:700, w:840, h:620, r:44}` |
| Caption card max width | `MAXW = 730` (word wrap), card `bw` from measured lines | `maxWidth: 918` |
| Video object-position | `FACE_ANCH` (theme, default 0.30) | hardcoded `'50% 26%'` |
| `studio.html` rects | its own stale inline copy (`R_STAGE {190,660,…}`) | — |

Also:

- **`stage.json` and `outro.json` are consumed only by Remotion.** The light engine
  hardcodes its `SCENES` array and `RECAP`/outro copy inline in `compose.html`. So the
  "config-driven staging" that exists today is Remotion-only.
- Scene graphics are maintained **three times**: `compose.html` (imperative Canvas 2D),
  `Scenes.tsx` (declarative JSX), `studio.html` (a third imperative copy).
- No `.skill` distribution package is published yet — the old one (a stale snapshot from
  before the script rename) was removed. See [project-tracking.md](project-tracking.md).

## Transitions today

The "bouquet" is thin — see [design/transitions.md](design/transitions.md) for the plan.

- **Video-rectangle transition:** `vrect(t)` lerps x/y/w/h/r between consecutive `SCENES`
  rects over `TR = 0.42 s` with cubic-in-out easing. This is the only "shot transition"
  (the underlying video is one continuous `cutz.mp4`).
- **Caption in/out:** enter over 0.2 s (ease alpha + translateY 28→0 + back scale), exit
  over 0.13 s (linear fade + translateY 0→−10). Identical math in both engines.
- **Per-scene:** each scene function rolls its own with `pr(t,a,b)` progress + `ease`/`eio`/`back`.
- **`glitch(t)`:** RGB-split slice displacement + accent flash (light engine, timestamp-hardcoded).
- **`outro(t)`:** wipe-up reveal over 0.45 s, then staggered element fade-ins. Both engines.
- **Montage:** `--xfade` → ffmpeg `xfade=transition=fade` chained across clips; only
  `fade` is wired up (ffmpeg's `xfade` has ~50). Default is a hard cut.
- **Sound side:** `sfx.json` cue arrays (`whoosh_up/down`, `thud`, `tap`, `outro`).
