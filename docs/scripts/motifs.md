# Motif registry — `scripts/motifs/`

`video-editor/scripts/motifs/` · JSON manifest + one JS/TSX per motif per engine · both engines

> Parameterized scene types, selected by name from `config/scenes.json`
> (`"motif": "stamp"`). Replaces the hand-written scene functions in
> `compose.reference.html` / `Scenes.tsx`. Design + schema:
> [`design/scenes-as-data.md`](../design/scenes-as-data.md).

## Layout

```
motifs/
  index.json            name → { status, kind, bottom, from, params }
  README.md             the ctx contract + rules
  canvas/<motif>.js      module.exports = (ctx) => { ... }          ← light engine
  remotion/<Motif>.tsx   export default (props) => <.../>           ← Remotion
```

## `index.json`

| Field | Meaning |
|---|---|
| `status` | `implemented` \| `planned` — the interpreter (#17/#18) accepts only `implemented` |
| `kind` | `scene` (over everything) \| `overlay` (on the video card, e.g. `glitch`) |
| `bottom` | nominal graphic-bottom `y` (1920 space) — feeds the `DOWN` flex; `layout.gb` overrides |
| `from` | reference scene function(s) it generalizes — for the #19 port |
| `params` | shape hint: `number` \| `string` \| `number[]` \| `string[]` \| `boolean` (not JSON Schema) |

Full schema — [data-contracts.md](../data-contracts.md#scriptsmotifsindexjson--the-motif-manifest).

## Status

**All 11 motifs are implemented** (canvas + Remotion) as of #19 — `stamp`, `counter`,
`quote`, `checklist`, `card-stack`, `transcript-panel`, `file-merge`, `glitch`,
`comment-box`, `sync-viz`, `suspense`. The canvas side is verified via `drawScenes` on a
headless canvas; the Remotion side wants a real render pass for the 3-way visual diff.

## The `ctx` contract

Draft in [`motifs/README.md`](../../video-editor/scripts/motifs/README.md); finalized with
the interpreters (#17 light, #18 Remotion). A canvas motif receives one `ctx` object
(`X`, `t`, `enter`/`exit`/`hold`, `words`, `rect`, `theme`, `params`, `fx` helpers) and
draws inside the interpreter's `save()`/`restore()` inside `safe()`. A Remotion motif is a
component taking the same fields (minus `X`/`fx`) as props.
