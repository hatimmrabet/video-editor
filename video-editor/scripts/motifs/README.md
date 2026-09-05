# Motif registry — `scripts/motifs/`

A **motif** is a parameterized scene type, implemented once per engine and selected by name
from `config/scenes.json` (`"motif": "stamp"`). This replaces the ~15 hand-written scene
functions in `compose.reference.html` / `Scenes.tsx`. Design: [`docs/design/scenes-as-data.md`](../../../docs/design/scenes-as-data.md).

```
motifs/
  index.json            name → { status, kind, bottom, from, params }
  canvas/<motif>.js      module.exports = (ctx) => { ... }          ← light engine
  remotion/<Motif>.tsx   export default ({ ...props }) => <.../>    ← Remotion
```

## `index.json`

| Field | Meaning |
|---|---|
| `status` | `implemented` \| `planned` — the interpreter only accepts `implemented` names |
| `kind` | `scene` = drawn over everything · `overlay` = drawn on the video card (e.g. `glitch`) |
| `bottom` | nominal graphic-bottom `y` (1920 space) — feeds the `DOWN` flex rect; a scene's `layout.gb` overrides |
| `from` | which reference scene function(s) it generalizes — for the #19 port |
| `params` | shape hint per key: `number` \| `string` \| `number[]` \| `string[]` \| `boolean`. Not JSON Schema — the values are hand-authored, this is for docs + a soft check |

## The `ctx` contract (canvas)

**Draft — refined in #17 (light interpreter) / #18 (Remotion dispatcher).** The interpreter
resolves each active scene, then for a canvas motif does, inside `safe()`:

```
X.save();
// apply the container `rise`: globalAlpha *= ease(enter) * (1 - ease(exit));
//                             translateY by timing.in `y`
motif(ctx);
X.restore();
```

`ctx` fields the interpreter guarantees:

| Field | Type | Meaning |
|---|---|---|
| `X` | `CanvasRenderingContext2D` | the frame's 2D context |
| `t` | number | absolute seconds |
| `enter` | number 0..1 | **raw** linear progress over `timing.in` (motif eases it however it wants) |
| `exit` | number 0..1 | raw linear progress over `timing.out` (1 = fully exited) |
| `hold` | number 0..1 | raw linear progress over the hold window (`1` when `hold:"full"` and past `in`) |
| `words` | `{t,s,e,hot}[]` | the ref sentence's words with timings (`[]` for a `range` ref) |
| `wordIndex` | number | current word index for `hold:"words"`, else `-1` |
| `rect` | `{x,y,w,h,r}` | the resolved video rect at this frame |
| `theme` | `{bg,ink,acc,clay,mut,font,handle}` | raw theme values |
| `params` | object | the scene's `params`, with this motif's `index.json` keys as defaults |
| `fx` | object | helpers: `rr, sh, nsh, T, rgba, lum, onACC, pr, ease, eio, back, lerp, cl, ez` |

A Remotion motif is a React component taking `{ enter, exit, hold, words, wordIndex, rect,
theme, params }` as props (no `X`, no `fx` — it uses JSX + `util.tsx`).

## Rules (same as the reference functions)

- **`safe()` still wraps every call** — a motif that throws skips its frame, it doesn't
  blacken the video (invariant #1/#2).
- **Colours from `ctx.theme` / `T.*` only** — no hardcoded hex (invariant #3).
- A motif that can't render (missing param, empty `words`) returns without drawing.
- Motifs version with the skill, not per project — see the design doc.
