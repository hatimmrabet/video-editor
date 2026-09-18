# Motif registry — `scripts/motifs/`

A **motif** is a parameterized scene type, selected by name from an entry's `scene.motif`
in `<work>/timeline.json`
(`"motif": "stamp"`) and dispatched by `SceneList.tsx`. This replaces hand-writing every
scene as its own component in `Scenes.tsx`.

```
motifs/
  index.json            name → { status, kind, bottom, from, params }
  remotion/<Motif>.tsx   export default ({ ...props }) => <.../>
```

There used to be a second implementation per motif (`canvas/<motif>.js`, for the light
rendering engine). That engine — and every canvas motif with it — was removed; Remotion is
the only renderer now.

## `index.json`

| Field | Meaning |
|---|---|
| `status` | `implemented` \| `planned` — the interpreter only accepts `implemented` names |
| `kind` | `scene` = drawn over everything · `overlay` = drawn on the video card (e.g. `glitch`) |
| `bottom` | nominal graphic-bottom `y`, designed against a 1080x1920 canvas and scaled to the composition's real size at render time (a scene's `layout.gb` overrides, scaled the same way — see "Orientation" below) |
| `from` | which reference scene function(s) it generalizes |
| `params` | shape hint per key: `number` \| `string` \| `number[]` \| `string[]` \| `boolean`. Not JSON Schema — the values are hand-authored, this is for docs + a soft check |

## The component contract

`SceneList.tsx` resolves each active scene, applies the container `rise` (enter/exit alpha
+ translateY from `timing.in`/`timing.out`) for `kind:"scene"` motifs — `kind:"overlay"`
gets none of that, it owns its whole appearance — then renders the motif with these props:

| Prop | Type | Meaning |
|---|---|---|
| `t` | number | absolute seconds |
| `prog` | number 0..1 | linear progress through the whole scene span (`(t − s) / (e − s)`) — for a motif's internal phases (a `counter` settling, a list revealing) |
| `enter` | number 0..1 | **raw** linear progress over `timing.in` (motif eases it however it wants) |
| `exit` | number 0..1 | raw linear progress over `timing.out` (1 = fully exited) |
| `hold` | number 0..1 | raw linear progress over the hold window (`1` when `hold:"full"` and past `in`) |
| `words` | `{t,s,e,hot}[]` | the ref sentence's words with timings (`[]` for a `range` ref) |
| `wordIndex` | number | current word index for `hold:"words"`, else `-1` |
| `rect` | `{x,y,w,h,r}` | the resolved video rect at this frame |
| `theme` | `{bg,ink,acc,clay,mut,font,handle}` | raw theme values |
| `params` | object | the scene's `params`, with this motif's `index.json` keys as defaults |

Not every motif uses every prop — see each file's own header comment for which it takes.
Small helpers (`lerp`, `rgba`, easings, …) are inlined per motif rather than shared, except
for `W`/`H` (the composition's own width/height, from `../theme`) where a motif needs to
place something relative to the frame — see "Orientation" below.

## Orientation (#136)

The composition is no longer always 1080×1920 — `reframe.py` keeps the source's own
orientation, so a horizontal recording renders at whatever width/height it was shot in.
Every motif was designed against the 1080×1920 canvas, so a motif with absolute pixel
positions imports `W`/`H` from `../theme` and scales:

- an **x position or width** by `W / 1080`
- a **y position or height** by `H / 1920`
- `540` (horizontal center) becomes `W / 2` — not scaled, computed directly

**Font size, border-radius, stroke-width, box-shadow blur stay literal, unscaled** — that's
about how big the type reads, not where things sit, and is out of scope here.

**A value the author placed themselves** (`params.at`, `params.x`/`.y`, a scene's own
`layout.gb`) is used verbatim, never re-scaled — it was tuned live in the studio against
the real composition, so scaling it again would double-transform it. Only the *codebase's
own default*, used when the author didn't override it, needs the `W`/`H` treatment.

## Rules

- A motif that can't render (missing param, empty `words`) returns `null` without drawing.
- **Colours from `theme.*` only** — no hardcoded hex.
- Motifs version with the skill, not per project.
