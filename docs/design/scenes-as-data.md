# Scenes as data + the motif registry

**The biggest lift in the roadmap.** Everything else is tidying; this is the structural change.

Status: **schema locked (#15).** This page is the spec for `config/scenes.json` and the
motif registry. Implementation: #16 (registry layout), #17 (light interpreter), #18
(Remotion dispatcher), #19 (port the reference functions), #20 (`studio.html`).

## Problem

A scene today is imperative code with baked-in timestamps, maintained in **three** places:

| Place | Form | Example |
|---|---|---|
| `<work>/compose.html` | Canvas 2D JS | `function price(t){ if(t<25.9\|\|t>28.35) return; … pr(t,27.27,27.52) … }` |
| `<work>/remotion/src/Scenes.tsx` | React JSX | `<Stamp t={t} at={[2.45,3.30]} .../>` |
| `scripts/studio.html` | Canvas 2D JS (copy) | its own inline `SCENES` / `SCLIST` |

Consequences: the engines have drifted (see [../engines.md](../engines.md#drift)); every
new video is hand-written JS; a timestamp shift from `edit_script.py` silently breaks
hardcoded scenes; the scrubber shows something different from the render.

## A scene is a JSON object

`config/scenes.json` is a hand-authored array of these — the per-video design work, in the
same family as `config/stage.json` / `config/outro.json` (not in `project.config.json`,
which holds only up-front static facts — see
[project-config.md](project-config.md#what-this-file-is--and-isnt)).

```jsonc
{
  "ref":    { "sentence": 4 },        // OR { "sentence": 4, "words": [2, 6] }  OR  { "range": [12.0, 15.5] }
  "layout": "DOWN",                   // "FULL" | "DOWN" | "LOWER"  — or { "mode", "transition"?, "gb"? }
  "motif":  "counter",               // a name in scripts/motifs/index.json  (null / omitted = layout-only, no graphic)
  "params": { "to": 46, "suffix": "٪" },   // plain JSON literals — no expression language
  "timing": { "in": 0.2, "hold": "words", "out": 0.25 }   // optional — see defaults below
}
```

### `ref` — required — binds the scene's time span

| Form | Span |
|---|---|
| `{ "sentence": N }` | caption card `N`'s `[s, e]` from `build/captions.json` — **survives an `edit_script.py` drop** |
| `{ "sentence": N, "words": [a, b] }` | word `a`'s start → word `b`'s end (0-indexed, inclusive) within sentence `N` |
| `{ "range": [t0, t1] }` | explicit seconds — the escape hatch for a scene not tied to speech |

### `layout` — required — the video-rect mode for the span

A string `"FULL" | "DOWN" | "LOWER"` (`STAGE` / `SIDE` are dropped — legacy), or an object:

```jsonc
{ "mode": "DOWN", "transition": "dissolve:0.3", "gb": 480 }
```

- `transition` — the scene↔scene video-rect transition **into** this scene (the Pass 3
  vocabulary, shorthand or object; `rect-morph` / `cut` / `dissolve` on the reel). Default
  `rect-morph` 0.42 `eio`.
- `gb` — the "graphic bottom" `y` for the `DOWN` flex rect, overriding the motif's declared
  `bottom`. Only meaningful with `mode: "DOWN"`.

### `motif` + `params`

`motif` is a name in `scripts/motifs/index.json`. `params` is plain JSON, motif-specific —
**no expression language** (`"to": "$sentence.number"` and the like). The scene author (the
agent) reads `build/captions.json` and writes concrete values; a params reference to a
missing sentence would just be another thing to keep in sync.

### `timing` — optional

| Field | Default | Meaning |
|---|---|---|
| `in` | `rise` `sceneEnter` (0.20 s `ease`) | element entrance. A number overrides the duration; an object `{type, duration, easing}` overrides fully |
| `out` | `rise` `sceneExit` (0.13 s `linear`) | element exit, same override rules |
| `hold` | `"full"` | `"full"` = shown for the whole span · `"words"` = the motif advances one step per spoken word of the ref sentence (uses each word's start time) · a number = seconds after `in` |

`in` / `out` reuse the `rise` type and the `transitions.json` defaults from Pass 3 — a
scene author gets the house feel for free.

## How the engine resolves the list

1. Read `config/scenes.json`. For each scene, resolve `ref` → `[s, e]` against
   `build/captions.json` (a scene whose `ref.sentence` doesn't exist is skipped — invariant #2).
2. Build the rect schedule: `[{ s, e, m: layout.mode, transition: layout.transition }]`,
   merging adjacent same-mode spans and filling gaps with `FULL`. **This replaces
   `config/stage.json`** when `scenes.json` is present (`stage.json` stays for scenes-less
   projects and manual rect control).
3. Per frame: for each active scene, call `motifs.canvas[scene.motif].draw(...)` (light) /
   render `motifs.remotion[scene.motif]` (Remotion) inside the existing `safe()` wrapper.

**No `config/scenes.json`** → behaviour is exactly today: the light engine's inline
`SCENES` array, Remotion's `config/stage.json` (or one `FULL` span).

## The motif registry

A **motif** is a parameterized scene type, implemented **once per engine** and selected by
name. Generalize the ~15 reference scene functions in `compose.reference.html` into a
starter set:

| Motif | Generalized from | Params (sketch) |
|---|---|---|
| `counter` | `price` | `to`, `from`, `prefix`, `suffix`, `settle` |
| `card-stack` | `chips`, `cardStack` | `items[]`, `columns`, `checkmark` |
| `checklist` | `solved` | `items[]`, `tickPerWord` |
| `transcript-panel` | `transcript` | `lines[]` (or pull from `build/captions.json`) |
| `file-merge` | `fileToCloud`, `oneFile` | `sources[]`, `targetLabel` |
| `glitch` | `glitch` | `intensity`, `slices` — a `VideoOverlay` motif (drawn on the video) |
| `stamp` | `stamp` | `text`, `rotation` |
| `quote` / `title-chip` | `titleChip` | `text` |
| `comment-box` | `commentBox` | `word`, `avatar` |
| `sync-viz` | `syncViz` | — |
| `suspense` | `suspense` | — |

Registry shape:

```
scripts/motifs/
  index.json              name → { kind, bottom, params }
  canvas/<motif>.js        module.exports = (X, t, params, ctx) => { ... }   ← light engine
  remotion/<Motif>.tsx     export default ({ t, params }) => <.../>          ← Remotion
```

`index.json` entry:

```jsonc
"counter": {
  "kind":   "scene",              // "scene" = drawn over everything · "overlay" = drawn on the video card (e.g. glitch)
  "bottom": 520,                  // nominal graphic-bottom y (1920 space) — feeds the DOWN flex; a scene's layout.gb overrides
  "params": { "to": "number", "from": "number", "prefix": "string", "suffix": "string", "settle": "number" }
}
```

`params` is a shallow shape hint (`"number" | "string" | "string[]" | "boolean"`) for
validation and docs — not a full JSON Schema (minimalism; the values are hand-authored, not
machine-generated).

The light engine gets a small **interpreter**: read the scene list, for each active scene
call `motifs.canvas[scene.motif](X, t, params, ctx)` inside the existing `safe()` wrapper
(`ctx` carries `theme`, the resolved rect, the ref sentence's words). Remotion gets a
`<Scene>` dispatcher that renders `motifs.remotion[scene.motif]`. `Scenes.tsx` and the
scene section of `compose.html` shrink to almost nothing; `studio.html` renders the same
list and stops carrying its own copy.

**Motif versioning:** motifs are versioned with the skill, not per project — a re-render
uses whatever the motif looks like now. No per-project pinning (that would be the
back-compat thinking Pass 2 ruled out; one user, re-rendering is cheap). A motif whose look
must change incompatibly gets a new name.

## Why this is safe

- `safe()` (invariant #1/#2) still wraps every motif call — a broken motif skips, it
  doesn't blacken the video.
- Motifs use `T.*` only (invariant #3).
- A motif that references a missing sentence returns nothing (invariant #2).
- The reference scene functions stay in the repo as the **source material** for the motif
  library, not as a per-project template.

## Migration path

1. #16 builds `scripts/motifs/` (`index.json` + the two engine folders) with **one** motif
   (`stamp`).
2. #17 / #18 build the light interpreter and the Remotion `<Scene>` dispatcher — both gated
   on `config/scenes.json` existing, so a project opts in by adding the file while every
   other project keeps its inline code unchanged.
3. #19 ports the reference scene functions to motifs one at a time, each with a 3-way visual
   diff (canvas render vs Remotion render vs the original reference).
4. #20 points `studio.html` at the interpreter and drops its private drawing copy.
5. Once the starter set is covered, `config/scenes.json` becomes the documented default and
   the inline reference functions move to `scripts/motifs/` history.

## Resolved (were open questions)

- **Layout logic — motif vs scene?** The motif declares a nominal `bottom` in `index.json`;
  the scene's `layout.gb` overrides per-instance. The flex-`R_DOWN` computation stays in the
  engine (it already knows the caption line count), fed by `bottom` / `gb`.
- **Expression language for `params`?** No — concrete JSON literals only, authored from
  `build/captions.json`. An indirection like `"$sentence.number"` is a second source of
  truth to keep in sync, against the Pass 2 philosophy.
- **Motif versioning?** With the skill, not per project (see the registry section).
- **Where does the scene list live?** `config/scenes.json`, not `project.config.json` — it
  is hand-authored per-video design, same as `config/stage.json` / `config/outro.json`.
- **What about `config/stage.json`?** Subsumed: when `config/scenes.json` is present the
  engine derives the rect schedule from the scenes' `layout`. `stage.json` stays supported
  for scenes-less projects; #19/#20 decide whether to retire it once scenes-as-data is the
  default.

## Still open (for the implementation issues)

- Sound cues on a scene — `timing.sfx` naming Pass 3 cue synths, vs keeping
  `build/sound-cues.json` separate. Decide in #17/#18 alongside the transition `sfx` coupling.
- Whether `hold: "words"` needs a per-word `params` hook (e.g. a `checklist` ticking a
  different item per word) or the motif just reads `ctx.words` itself. Lean: the motif reads
  `ctx.words`.
