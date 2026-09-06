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
| `scripts/encode.sh` | muxes `build/frames-composited/*.jpg` + audio → `build/video-raw.mp4` |
| `scripts/safe_check.js` | pre-delivery safe-zone / hook check, also drives `compose.html` |
| `scripts/fx/behind_text.js` + `fx/personmask.swift` | macOS person-cutout data feeding `compose.html` |

### How it renders

`render_frames.js`:

1. Reads `build/sound-cues.json` (`.outro`), `project.config.json` (via
   [`lib/config`](scripts/lib-config.md)), `scripts/transitions.json` (via
   [`lib/transitions`](scripts/lib-transitions.md)), optional `build/person-cutout.json`.
2. `resolvePuppeteer()` → `puppeteer` (bundled Chromium); `browser.launch(launchOptions())`;
   new page at **1080×1920**; `setCacheEnabled(false)` (Chrome would otherwise serve a
   stale `compose.html`).
3. `page.goto(fileUrl(<work>/compose.html))`, wait for the logo image.
4. `window.init({ cards, total, outro, theme, behind, transitions })` — passes
   `build/captions.json` contents in.
5. **After `init`**, wait for the theme font (weights 400/600/700/800/900). Order matters:
   a non-Cairo font `<link>` is injected *inside* `init`, so waiting before `init` waits
   for nothing.
6. For each frame `i` in `0 … round((caps.total + outro) * 30)`:
   - pick source JPEG `build/frames-source/%05d.jpg` (index `round(t*30)+1`),
     `window.setFrame(url)` → `VF.src = url; VF.decode()`
   - if `build/person-cutout.json` covers this frame: `window.setPerson(cutout.png, face)`
   - `window.draw(t)` then `window.shot(0.95)` → `canvas.toDataURL('image/jpeg')` → write
     `build/frames-composited/%05d.jpg`
7. Modes: `all` (resume — skips files `> 2000 bytes` unless `--force`), `range a b`
   (re-render a window, always overwrites), `preview t1 t2 …` (writes `build/prev/`).

Then `encode.sh` muxes `build/frames-composited/*.jpg` + `build/video-reframed.mp4` audio +
`build/sound-effects.wav` into `build/video-raw.mp4`. Full ~48 s render ≈ 12 min / ~1460 frames.

### The `window.*` contract of `compose.html`

| Function | Purpose |
|---|---|
| `init(d)` | set theme vars, inject font, apply `d.transitions` (→ `TX`, `TR`), preload B-roll; returns a Promise |
| `setFrame(url)` | set the source video frame (`VF.src`, then `decode()`) |
| `setPerson(url, face)` | set the person-cutout PNG + face box for the current frame |
| `draw(t)` | render one frame at time `t` onto the canvas |
| `shot(q)` | `canvas.toDataURL('image/jpeg', q)` |
| `vrect(t)` | the interpolated video rectangle at time `t` (used by `safe_check.js` too) |
| `preloadBroll()` | load optional B-roll frame sequences |

### How scenes are drawn

`compose.reference.html` is one `<canvas id="cv" width=1080 height=1920>` plus a script that holds:

- **Theme vars** `BG INK ACC CLAY MUT FONT HANDLE FACE_ANCH GRID BADGE_UNTIL`, overwritten
  by `init(d.theme)`; **`TX`** (transition defaults) + `TR` from `init(d.transitions)`.
- **Video staging rectangles** (module consts):
  `R_FULL {0,0,1080,1920,r:0}` · `R_LOWER {350,1370,380,520,32}` ·
  `R_DOWN {0,770,1080,1150,r:0}` (a full-width fallback — `resolveScenes()` replaces each
  `R_DOWN` entry with `rDown(gb, caption-lines)`, which is what actually renders).
  (`R_STAGE` / `R_SIDE` were removed — issue #26.)
- **`const SCENES = [ {s:0.00,e:3.32,m:R_FULL}, {s:3.32,e:8.00,m:R_DOWN}, … ]`** — a
  hardcoded inline array of `{start, end, rect}`. `resolveScenes()` replaces each `R_DOWN`
  entry with a flexible `rDown(gb, lines)` rect computed from the graphic bottom + caption
  line count. `vrect(t)` interpolates between consecutive rects over `TR` (=
  `TX.sceneToScene.duration`, 0.42 s) with `TX.sceneToScene.easing` — a `SCENES[i].transition`
  overrides that boundary (`rect-morph` / `cut` / `dissolve`). See
  [transitions.md](design/transitions.md).
- `drawVideo(t)` — via `paintVideo(R, alpha)`: cover-scale the source JPEG into `vrect(t)`,
  clip to the rounded rect, optional shadow + stroke (two calls, cross-fading, mid-`dissolve`).
- **`caption(t)`** — finds the active card in `CAPS`, `layout()` wraps words to lines
  (`MAXW = 730`), draws a `rgba(bg, 0.96)` rounded card with per-word highlighting
  (spoken word → `ACC`; `hot` word → animated accent pill). Enter/exit are the `rise` type
  (`TX.sceneEnter` / `TX.sceneExit`). Position depends on `vtarget(t)`: full-screen → y
  1460; lowered video → rides the video edge; cutout/headout → above the head.
- Persistent chrome: `grid()`, `badge(t)` (off by default), `bar(t)` (progress bar).
- **`safe(fn, t, name)`** — wraps every scene call in `X.save() / try / catch / finally
  X.restore()`, logs a skipped-scene warning once. This is the fix for invariants #1/#2.
- **`draw(t)`** first resets all canvas state (`setTransform`, `globalAlpha`, `filter`,
  shadow, composite-op) every frame — a hard guarantee that each frame starts clean.

The bottom of the file (`/* ===== SCENE GRAPHICS ===== */`) has ~15 named functions
**hardcoded for one specific reference video** (`stamp`, `chips`, `fileToCloud`,
`transcript`, `cardStack`, `suspense`, `syncViz`, `price`, `glitch`, `rtlBug`, `rtlFix`,
`solved`, `oneFile`, `commentBox`, `outro`), each `function name(t){ if(t<X||t>Y) return; … }`
with baked-in timestamps. `draw(t)` calls them all through `safe(...)` — **unless a
`config/scenes.json` is present** (Pass 4, issue #17): then `render_frames.js` injects the
resolved scene list + `schedule` + the used `motifs/canvas/*.js` sources, `SCENES` is
rebuilt from the schedule, and `draw(t)` runs `drawScenes(t)` — dispatching to the motifs
inside `safe()` — instead of the hardcoded list. See
[design/scenes-as-data.md](design/scenes-as-data.md).

**"Invent scenes per video" means:** per video the model copies
`compose.reference.html` → `<work>/compose.html`, rewrites the `SCENES` array, **deletes
the reference scene functions and writes new ones** (one per sentence, keyed to word
timings via `wordsOf(i)` from `build/captions.json`), and updates the `draw(t)` dispatch
list and the outro copy. There is **no scene data file** for the light engine — the scene
code is inline JavaScript in `compose.html`.

`fx/behind_text.js` (macOS): `plan` lists suitable short sentences; `build 1 9` /
`build 2:6-8` compiles `personmask.swift` (Vision), cuts the person out of the relevant
`build/frames-source/` frames → `build/person-cutout/person/%05d.png`, writes
`build/person-cutout.json`. `cutout`/`headout` take a time range instead. The compositing (kashida-stretched Arabic word passing behind the
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
  Chrome.tsx Captions.tsx Outro.tsx Guides.tsx SceneList.tsx`, plus `src/motifs/*.tsx`
  (copied from `scripts/motifs/remotion/`)
- **`Scenes.tsx` copied once only** (`[ -f … ] || cp …`) — a project's hand-written scene
  components survive a re-sync (used only when there's no `config/scenes.json`)
- `cp <work>/build/captions.json → src/caps.json` (the internal name stays `caps.json`)
- inline Python **generates `src/project.json`** from `build/captions.json` +
  `project.config.json` (via `lib/config`) + `scripts/transitions.json` (via
  `lib/transitions`) + `config/scenes.json` (via `lib/scenes` — adds `scenes` + a derived
  `stage`) + `build/sound-cues.json` + `config/stage.json` + `config/outro.json` +
  `config/safe.json`
- copies assets: `build/video-reframed.mp4 → public/video.mp4`,
  `build/sound-effects.wav → public/sfx.wav`, `<logo> → public/logo.png`

### `src/*` files

| File | Role |
|---|---|
| `index.ts` | `registerRoot(RemotionRoot)`, imports `./font` |
| `Root.tsx` | `<Composition id="Ad" component={Ad} durationInFrames={DUR_F} fps={30} width={1080} height={1920} />` |
| `theme.ts` | imports `project.json`; exports `T` (colors/font/handle/badgeUntil), `FACE_ANCHOR` (`crop.faceAnchor`, default 0.30), `FPS=30`, `VEND=P.total`, `OUTRO=P.outro`, `DUR_F`, `HAS_SFX`, `OUTRO_COPY`, `STAGE`, `GUIDES`, `TX` (transition defaults) |
| `util.tsx` | Remotion `interpolate`/`Easing` wrappers: `p, linear, ease, eio, back, ez, sec, lerp, hx, rgba, lum, onACC` — same math as `compose.html`'s helpers; `ez(name)` = easing by name |
| `stage.ts` | `R_FULL/R_LOWER/R_DOWN` presets + `vrect(t)` interpolating per `project.json.stage`; `TR` / easing from `TX.sceneToScene`; a `stage[i].transition` overrides one boundary; `videoLayers(t)` returns one rect (or two cross-fading, mid-`dissolve`). `resolveScenes()` replaces each `DOWN` span with `rDown(gb, caption-lines)` — the same flex as `compose.html` (issue #25), using canvas `measureText` for the wrap |
| `Ad.tsx` | `<AbsoluteFill background={T.bg}>`; if `t < VEND`, `videoLayers(t).map(...)` → absolutely-positioned `div`(s) with `<OffthreadVideo src={staticFile('video.mp4')} objectFit:cover objectPosition:\`50% ${FACE_ANCHOR*100}%\`>` (+ `<VideoOverlay t>` on the top layer); then `<Audio>`, `<Badge>`, `<Bar>`, `<Scenes>`, `<Captions>`, `<Outro>`, `<Guides>` |
| `Captions.tsx` | active card from `caps.cards`, RTL flex-centered card at `bottom: 1920-1460`, per-word `<span>` with `color: hot ? '#FFF' : active ? T.acc : T.ink` and an animated `scaleX` accent pill behind hot words; enter/exit = the `rise` type (`TX.sceneEnter` / `TX.sceneExit`) |
| `Chrome.tsx` | `Badge` (handle + logo pill at `top:190`, hidden when `badgeUntil==0`), `Bar` (progress bar at `top:1492`), generic `Card` |
| `Outro.tsx` | wipe-up reveal; logo, `C.line`, `RECAP` 2-col grid with SVG check, `C.cta_top` + `C.cta_word` accent chip, `C.tail`, handle+logo footer. **All copy from `project.json` — nothing hardcoded** |
| `Guides.tsx` | 4 red Instagram-zone overlays, shown only when `project.json` `guides:true` |
| `Scenes.tsx` | the operator's hand-written scenes — used **only when there is no `config/scenes.json`**. `W(i)` = words of caption `i`; `CARD` style; `Stamp` / `Chips` examples (commented out); `VideoOverlay` + `Scenes` exports |
| `SceneList.tsx` | the scenes-as-data **dispatcher** (issue #18) — mirror of `compose.html`'s `drawScenes(t)`; renders `motifs/<Motif>` per active `project.json.scenes` entry with the `rise` container applied. `Ad.tsx` renders it xor `Scenes.tsx` |
| `motifs/*.tsx` | shared per-engine motif components, copied from `scripts/motifs/remotion/` |
| `font.ts` | `delayRender`/`continueRender` around a Google Fonts `<link>` for `T.font` |
| `remotion.config.ts` | `setVideoImageFormat('jpeg')`, `setChromiumOpenGlRenderer('angle')` |
| `tsconfig.json` | ES2020, `react-jsx`, `resolveJsonModule`, `strict:false` |
| `package.json` | `@remotion/cli`, `remotion`, `react`, `react-dom` |

---

## Keeping both engines — and making Remotion's setup cheap

Reaffirmed in the 2026-09-05 design session (see
[design/file-layout.md](design/file-layout.md#engine-decision-reaffirmed)): both engines
stay. Dropping Remotion would remove the only interactive-editing surface in the codebase;
dropping the light engine would force every automated render to pay Remotion's setup cost
and licensing exposure for no benefit. `remotion.sh render` is already fully headless (no
human needed), so Remotion is not "the interactive one" by necessity — it's just the only
one *capable* of interactivity. The plan is to make its `node_modules` a shared, skill-level
install (mirroring how Puppeteer's Chromium is installed once, not per project) instead of
today's per-project `<work>/remotion/node_modules` — see the linked doc for the one real
trap that needs handling (`Scenes.tsx` must stay per-project, not shared).

## Drift

The two engines were hand-ported from each other and diverged. **Fixing this is the point
of [design/scenes-as-data.md](design/scenes-as-data.md).**

**Resolved (issues #25–#29):** `R_STAGE` / `R_SIDE` deleted from all three surfaces (out of
the data path — see [scenes-as-data.md](design/scenes-as-data.md)); `R_DOWN` now flexes
identically (`rDown(gb, caption-lines)`) in `compose.html`, `stage.ts` and `studio.html`;
caption card max width is `730` everywhere; the video object-position reads
`crop.faceAnchor` in every engine (`remotion.sh` writes it into `project.json` →
`theme.ts` `FACE_ANCHOR` → `Ad.tsx`; `studio.html` reads `d.theme.faceAnchor` in `init`).
Verified: `compose.html` render byte-identical; `studio.html` `vrect` matches `compose`'s
across a sweep; `stage.ts`'s flex verified equal to `compose`'s by a plain-JS parity port
(a real Remotion render still owed — the sandbox has no Remotion install).

**Remaining:**

| Thing | `compose.reference.html` (light) | Remotion / `studio.html` |
|---|---|---|
| caption position | rides the video edge (`vtarget`), lower-third / above-head cases | `studio.html` uses a fixed `by=1580-bh`; `Captions.tsx` a fixed `bottom` |
| `badge` / `bar` y | `badge` y 190, `bar` y 1600 | `studio.html` `badge` y 74, `bar` y 1878 |
| scene graphics (scenes-less) | inline `compose.html` functions | `Scenes.tsx` / `studio.html` inline copies — go once every project uses `config/scenes.json` |

Also:

- **`config/stage.json` and `config/outro.json` are consumed only by Remotion.** The light
  engine hardcodes its `SCENES` array and `RECAP`/outro copy inline in `compose.html`. So
  the "config-driven staging" that exists today is Remotion-only.
- Scene graphics: a project with `config/scenes.json` (Pass 4) is drawn from **one** motif
  library (`scripts/motifs/`) by all three surfaces. A scenes-less project still runs three
  hand-maintained copies — `compose.html`, `Scenes.tsx`, `studio.html` — which have drifted;
  those go once every real project uses `config/scenes.json`.
- No `.skill` distribution package is published yet — the old one (a stale snapshot from
  before the script rename) was removed. See [project-tracking.md](project-tracking.md).

## Transitions

The vocabulary is data — [`scripts/transitions.json`](../video-editor/scripts/transitions.json),
read via [`lib/transitions`](scripts/lib-transitions.md), explained in
[design/transitions.md](design/transitions.md). **Both engines are wired to it**:

- **light** (#12): `render_frames.js` injects `load().defaults` into `window.init`;
  `compose.html` / `studio.html` read `TX.sceneToScene` in `vrect` and
  `TX.sceneEnter` / `TX.sceneExit` (the `rise` type) in `caption`.
- **Remotion** (#13): `remotion.sh` writes `load()["defaults"]` into `project.json`;
  `theme.ts` exposes `TX`, `stage.ts` `vrect` / `videoLayers` use `sceneToScene`,
  `Captions.tsx` uses the `rise` defaults. Easings resolve by name through `util.tsx`'s
  `ez()`.
- **montage** (#14): `montage_mode.py build --transition <spec>` and an optional
  `transition` per `plan[]` entry, each mapped to an ffmpeg `xfade` name via
  `lib/transitions`. Default `cut` = plain `concat`, unchanged.

The defaults equal the values below exactly, so nothing changed. **Pass 3 is complete.**

- **Video-rectangle transition:** `vrect(t)` lerps x/y/w/h/r between consecutive `SCENES`
  rects over `TR = 0.42 s` (`sceneToScene.duration`) with cubic-in-out easing — the
  `rect-morph` type, and the default. A `SCENES[i].transition` object overrides
  type/duration/easing for that one boundary; on the reel video `rect-morph` / `cut` /
  `dissolve` are the meaningful set (it's one continuous take, so `wipe`/`push` — which
  read as two different shots — belong to montage and the graphic layer).
- **Caption in/out:** enter over 0.2 s (ease alpha + translateY 28→0 + back scale), exit
  over 0.13 s (linear fade + translateY 0→−10) — the `rise` element animation. Identical
  math in both engines.
- **Per-scene:** each scene function rolls its own with `pr(t,a,b)` progress + `ease`/`eio`/`back`.
- **`glitch(t)`:** RGB-split slice displacement + accent flash (light engine, timestamp-hardcoded).
- **`outro(t)`:** wipe-up reveal over 0.45 s, then staggered element fade-ins. Both engines.
- **Montage:** `--transition <spec>` / per-`plan[]` `transition` → the eight-name
  vocabulary mapped to ffmpeg `xfade` names, chained across clips. Default `cut` = plain
  `concat`. See [montage_mode.md](scripts/montage_mode.md).
- **Sound side:** `build/sound-cues.json` cue arrays (`whoosh_up/down`, `thud`, `tap`, `outro`).
