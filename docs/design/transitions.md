# Transitions — a named vocabulary

## Problem

The current "bouquet" (see [../engines.md](../engines.md#transitions-today)) is:

- one eased rectangle-morph between stage rects (`vrect`, `TR = 0.42 s`, cubic-in-out)
- one caption enter (0.2 s) / exit (0.13 s)
- one outro wipe-up (0.45 s)
- one `glitch` (RGB-split, timestamp-hardcoded)
- `xfade=fade` for montage — the only inter-clip transition, and only `fade` of ffmpeg's ~50

Every one is hand-timed, none is named, and montage transitions and reel transitions have
nothing in common.

## Proposal — a transition is `{ type, duration, easing, params }`

```jsonc
{ "type": "push", "duration": 0.35, "easing": "eio", "params": { "dir": "up" } }
```

A single vocabulary, applied identically by:

- **the light engine** — between `SCENES` entries, and as scene enter/exit
- **Remotion** — same, via `@remotion/transitions` where a native one exists, hand-rolled otherwise
- **montage** (`montage_mode.py`) — mapped to ffmpeg `xfade=transition=<name>`

### Type set (starter)

| Name | Reel (canvas / Remotion) | Montage (ffmpeg `xfade`) |
|---|---|---|
| `cut` | instant | `concat` (no xfade) |
| `dissolve` | cross-fade alpha | `fade` |
| `rect-morph` | the current `vrect` lerp (reel only) | — |
| `wipe` (`dir`) | clip-rect sweep | `wipeleft` / `wiperight` / `wipeup` / `wipedown` |
| `push` (`dir`) | both layers translate | `slideleft` / `slideright` / `slideup` / `slidedown` |
| `zoom-blur` | scale + blur out/in | `zoomin` (approx) |
| `whip-pan` (`dir`) | fast translate + motion blur | `slide*` + blur (approx) |
| `glitch` | the current RGB-split effect | `pixelize` / `hlslice` (approx) |
| `iris` | radial clip | `circleopen` / `circleclose` |

Each row documents which side is **native** and which is an **approximation**.

### Easing names

`linear`, `ease` (out-cubic), `eio` (in-out-cubic), `back` — the four already in
`util.tsx` / `compose.html`. One shared table, referenced by name from config.

## Where transitions are declared

- **Scene ↔ scene:** an optional `transition` on a `layout.schedule` entry (or on a scene
  in [scenes-as-data.md](scenes-as-data.md)). Default: `rect-morph` 0.42 `eio` (today's behavior).
- **Scene enter/exit:** in the scene's `timing`, defaulting to today's caption-style fade.
- **Montage:** `build --transition push:0.3:up` (or a per-cut list in `montage.json.plan`),
  replacing the current single `--xfade` float.

## Why this is safe

- Defaults reproduce exactly what happens today — adopting the vocabulary changes nothing
  until someone picks a non-default.
- Sound stays coupled: a transition can carry a `sfx` cue name so the whoosh lands with the
  move (today the cue times are authored separately in `sfx.json`).
- The safe-zone check is unaffected — transitions move existing elements, they don't add text.

## Open questions

- Do we expose all ~50 ffmpeg `xfade` names for montage, or curate a dozen that read well?
- Motion blur on canvas is expensive per frame — is `whip-pan` worth it, or fake it with a
  short streak overlay?
- Per-cut transitions in montage need the plan to carry them — extend `montage.json.plan`
  entries with an optional `transition`.
