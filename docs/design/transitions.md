# Transitions — a named vocabulary

Status: **schema locked (#11); light engine wired (#12).** The canonical table is
[`video-editor/scripts/transitions.json`](../../video-editor/scripts/transitions.json),
read via [`lib/transitions`](../scripts/lib-transitions.md); this page explains it.
Remaining: #13 (Remotion), #14 (montage).

## Problem

The current "bouquet" (see [../engines.md](../engines.md#transitions-today)) is:

- one eased rectangle-morph between stage rects (`vrect`, `TR = 0.42 s`, cubic-in-out)
- one caption enter (0.2 s) / exit (0.13 s)
- one outro wipe-up (0.45 s)
- one `glitch` (RGB-split, timestamp-hardcoded)
- `xfade=fade` for montage — the only inter-clip transition, and only `fade` of ffmpeg's ~50

Every one is hand-timed, none is named, and montage transitions and reel transitions have
nothing in common.

## A transition is `{ type, duration, easing, params }`

```jsonc
{ "type": "push", "duration": 0.35, "easing": "eio", "params": { "dir": "up" } }
```

**Shorthand** (CLI, `montage-plan.json`, quick edits) — `type` or `type:duration` or
`type:duration:param`:

```
push            push:0.3            push:0.3:up
```

The shorthand expands against the type's defaults: `push` → `{type:"push", duration:0.35,
easing:"eio", params:{dir:"up"}}`. The object form is canonical; the shorthand is sugar and
always round-trips to it.

`duration` is **seconds**. `0` (or a negative value) renders as `cut` — an instant swap
with no interpolation, whatever the `type`. There is no upper clamp; a duration longer than
the shorter of the two shots it joins is the author's problem to notice.

One vocabulary, applied by all three renderers:

- **the light engine** — between `SCENES` entries (rect transition) and as scene enter/exit
- **Remotion** — the same, via `@remotion/transitions` where a native one exists, hand-rolled otherwise
- **montage** (`montage_mode.py`) — mapped to ffmpeg `xfade=transition=<name>`

## Type set

The vocabulary is **eight** types — curated, not "every ffmpeg xfade". Each row names what
each side actually does and flags where the montage side is only an approximation.

| `type` | Light / Remotion | Montage (ffmpeg `xfade`) | Params |
|---|---|---|---|
| `cut` | instant | plain `concat`, no xfade | — |
| `dissolve` | cross-fade alpha | `fade` | — |
| `rect-morph` | the current `vrect` lerp — **reel only** | — (no equivalent) | — |
| `wipe` | clip-rect sweep | `wipeup` / `wipedown` / `wipeleft` / `wiperight` | `dir` |
| `push` | both layers translate | `slideup` / `slidedown` / `slideleft` / `slideright` | `dir` |
| `zoom-blur` | scale + blur out/in | `zoomin` *(approx)* | — |
| `iris` | radial clip | `circleopen` / `circleclose` | `dir` = `open`\|`close` |
| `glitch` | the current RGB-split slice effect | `pixelize` *(approx)* | — |

`whip-pan` from the earlier draft is **dropped** for now — real per-frame motion blur on
canvas is too expensive and a faked streak looked cheap. Add it later if a real need shows up.

**On the reel video rect** (`SCENES[i].transition`), only `rect-morph` / `cut` / `dissolve`
are wired — the reel is one continuous take, so `wipe`/`push`/`iris`/etc. between two crops
of the *same* frame read as a gimmick, not a shot change. Those types are for montage
(#14) and, later, the scene graphic layer (Pass 4). An unsupported type on a `SCENES`
entry falls back to `rect-morph` timing.

**Escape hatch (montage only):** `params.xfade` passes a raw ffmpeg xfade name straight
through (`{"type":"dissolve","params":{"xfade":"hlslice"}}`). Not part of the vocabulary,
not portable to the reel engines — for one-off montage experiments only.

### Element enter/exit — `rise`

Separate from shot transitions: how a caption card or a graphic scene appears/disappears.
One type, `rise` = fade + `translateY(y → 0)` + optional out-back scale.

- **Caption enter today** is exactly `rise` `{y:28, scale:true}` over 0.20 s, `ease`.
- **Caption exit today** is `rise` `{y:-10, scale:false}` over 0.13 s, `linear`.

These become the `sceneEnter` / `sceneExit` defaults so a scene author gets the house feel
for free. The ~15 reference scenes still hand-roll their own entrances; they move onto
`rise` (or a per-scene override) one at a time in Pass 4.

## Easing names

`linear`, `ease` (out-cubic), `eio` (in-out-cubic), `back` (out-back, overshoot 1.9) — the
four already in `util.tsx` / `compose.html`, now with a shared name in `transitions.json`.
`linear` / `ease` / `eio` carry a cubic-bezier; `back` carries an `overshoot` constant
(it maps to Remotion's `Easing.back(overshoot)` and canvas's existing out-back formula —
a single cubic-bezier can't match that curve exactly). Same name → same curve on both sides.

## Where a transition is declared

| Situation | Where | Default (= today's behaviour) |
|---|---|---|
| Scene ↔ scene (the video rect moves) | optional `transition` on a schedule entry — the inline `SCENES` array (light) / `config/stage.json` (Remotion) / a `scenes[]` entry once [scenes-as-data](scenes-as-data.md) lands | `rect-morph` 0.42 `eio` |
| A scene's own entrance / exit | optional `enter` / `exit` in the scene's `timing` | `rise` 0.20 `ease` / `rise` 0.13 `linear` |
| The outro reveal | fixed for now (not yet configurable) | `wipe` 0.45 `ease` `up` |
| Montage, all cuts | `build --transition push:0.3:up` | `cut` |
| Montage, one cut | `transition` on that `plan[]` entry in `build/montage-plan.json` (overrides the global) | inherits the global |

A schedule entry with no `transition` key renders exactly as it does today — **adopting the
vocabulary changes nothing until someone sets a non-default value.**

## Sound stays coupled

A transition may carry an optional `sfx` naming a cue synth
(`whoosh_up` \| `whoosh_down` \| `thud` \| `tap`):

```jsonc
{ "type": "push", "duration": 0.3, "params": { "dir": "up" }, "sfx": "whoosh_up" }
```

When set, the whoosh is emitted at the transition's start time — the move and the sound
land together instead of the cue time being authored separately in
`build/sound-cues.json`. Unset = no sound (unchanged). How the emitted cue reaches
`sound_fx.py` (a generated cue list vs. a merge at build time) is an implementation detail
for #12/#14.

## Montage plan — the per-cut field

`build/montage-plan.json`'s `plan[]` entries gain an optional `transition` (shorthand
string or object). `montage_mode.py build` reads, in priority order: the entry's
`transition` → `--transition` on the command line → `cut`. The old `--xfade <float>` flag
is **removed** — `--transition dissolve:<float>` replaces it exactly, and there is no
installed base of scripts calling the old flag to keep an alias for (same reasoning as the
Pass 2 no-back-compat rule).

```jsonc
"plan": [
  { "i": 1, "file": "...", "in": 2.10, "dur": 1.50, "transition": "cut" },
  { "i": 2, "file": "...", "in": 0.40, "dur": 1.50, "transition": "push:0.3:left" }
]
```

The `transition` on entry *k* describes the cut **into** entry *k* (so entry 0's is
ignored). `xfade` overlaps eat `duration` seconds from the outgoing clip — the plan's
total shortens by `Σ duration`, same arithmetic as the current `--xfade` path.

## Why this is safe

- Every default is exactly today's hand-tuned value — a project that sets nothing looks
  identical.
- The safe-zone check is unaffected: transitions move elements that already exist, they
  never add text.
- `rect-morph` stays reel-only and is the scene↔scene default, so `vrect` behaviour is
  untouched.

## Resolved (were open questions)

- **Expose all ~50 ffmpeg xfade names?** No. Curate the eight above; a raw name is reachable
  only through the montage-only `params.xfade` escape hatch.
- **`whip-pan` motion blur on canvas?** Dropped from the starter set.
- **Per-cut montage transitions?** Yes — the optional `transition` on `plan[]` entries above.

## Follow-ups for the implementation issues

- **#12 (light): done.** `lib/transitions.py` resolver + `lib/transitions.js` shelling out
  to it. `render_frames.js` injects `load().defaults`; `compose.html` / `studio.html` read
  it in `vrect` (`sceneToScene`) and `caption` (`sceneEnter` / `sceneExit` = the `rise`
  type), with today's literals as the fallback. `SCENES[i].transition` (object form)
  overrides one boundary; `rect-morph` / `cut` / `dissolve` render on the reel video.
  Not done here: scene-graphic enter/exit still hand-rolled per scene (moves to `rise` in
  Pass 4); `wipe`/`push` on the reel (see the Type set note).
- **#13 (Remotion):** `@remotion/transitions` for `dissolve` / `wipe` / `push` / `iris`;
  hand-roll `zoom-blur` / `glitch`; `rect-morph` stays the existing `stage.ts` lerp. While
  in `remotion/template/src/`, finish the #59 path-migration leftovers there (some comments
  still say `theme.json` / old numbered script names).
- **#14 (montage):** the `--transition` flag, the `plan[]` field, drop `--xfade`, and the
  eight-name → xfade-name map from `transitions.json`.
