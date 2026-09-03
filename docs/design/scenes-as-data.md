# Scenes as data + the motif registry

**The biggest lift in the roadmap.** Everything else is tidying; this is the structural change.

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

## Proposal — a scene is a JSON object

```jsonc
{
  "ref":    { "sentence": 4 },        // or { "range": [12.0, 15.5] }
  "layout": "DOWN",                   // FULL | DOWN | LOWER  (drives the video rect for this span)
  "motif":  "counter",               // a name in the motif registry
  "params": { "to": 46, "prefix": "", "suffix": "٪" },
  "timing": { "in": 0.2, "hold": "words", "out": 0.25 }
                                     // "words" = step per spoken word of the ref sentence
}
```

- `ref` binds the scene to a sentence (so timings follow `caps.json` automatically — an
  `edit_script.py` drop no longer breaks it) or to an explicit time range.
- `layout` is the rect mode for the scene's span (feeds `stage.json` / `SCENES`).
- `motif` + `params` select and configure a reusable component.
- `timing` describes enter/hold/exit; `hold: "words"` means the motif advances one step per
  spoken word of the ref sentence, using that word's start time.

The project's `scenes` array (in [project-config.md](project-config.md)) is a list of these.

## The motif registry

A **motif** is a parameterized scene type, implemented **once per engine** and selected by
name. Generalize the ~15 reference scene functions in `compose.reference.html` into a
starter set:

| Motif | Generalized from | Params (sketch) |
|---|---|---|
| `counter` | `price` | `to`, `from`, `prefix`, `suffix`, `settle` |
| `card-stack` | `chips`, `cardStack` | `items[]`, `columns`, `checkmark` |
| `checklist` | `solved` | `items[]`, `tickPerWord` |
| `transcript-panel` | `transcript` | `lines[]` (or pull from `caps.json`) |
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
  index.json            name → { params schema, both-engines: true }
  canvas/counter.js      draw(ctx, t, params, ctxInfo)      ← light engine
  remotion/Counter.tsx   <Counter t params />               ← Remotion
```

The light engine gets a small **interpreter**: read the scene list, for each active scene
call `motifs.canvas[scene.motif].draw(...)` inside the existing `safe()` wrapper. Remotion
gets a `<Scene>` dispatcher that renders `motifs.remotion[scene.motif]`. `Scenes.tsx` and
the scene section of `compose.html` shrink to almost nothing; `studio.html` renders the
same list and stops carrying its own copy.

## Why this is safe

- `safe()` (invariant #1/#2) still wraps every motif call — a broken motif skips, it
  doesn't blacken the video.
- Motifs use `T.*` only (invariant #3).
- A motif that references a missing sentence returns nothing (invariant #2).
- The reference scene functions stay in the repo as the **source material** for the motif
  library, not as a per-project template.

## Migration path

1. Build the interpreter + dispatcher with **one** motif (`stamp`) behind a flag; a
   project can opt in with a `scenes` array while old projects keep inline code.
2. Port motifs one at a time, each with a visual diff (canvas render vs Remotion render vs
   the original reference).
3. Once the starter set is covered, make `scenes`-as-data the default and move the inline
   reference functions into `scripts/motifs/` history.

## Open questions

- How much layout logic belongs to the motif vs the scene? (`R_DOWN` flex `gb` is
  currently computed from "graphic bottom" — a motif would need to report its bottom.)
- Do we need a small expression language for `params` (e.g. `to: "$sentence.number"`), or
  is authoring them from `caps.json` in the agent enough?
- Motif versioning — if a motif's look changes, old projects re-render differently.
