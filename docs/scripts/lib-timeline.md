# `lib/timeline.py`

`video-editor/scripts/lib/` · python · shared

> Timeline surgery shared by [`edit_script.py`](edit_script.md) and
> [`tighten.py`](tighten.md). Both remove spans from the **compressed** (post-`plan_cuts`)
> timeline and need the same two hard parts: map those spans back onto
> `build/cut-plan.json`'s original-timeline `keep` segments, and shift every surviving
> timestamp. The captions rewrite differs per script (whole-card drops vs per-word filler
> drops) and stays in each.

## Functions

| Function | Returns |
|---|---|
| `merge(intervals, gap=0.05)` | sorted `[[a,b],…]` coalesced where they touch or overlap within `gap` |
| `make_shift(deleted)` | `(shift, inside)` — `shift(t)` = `t` minus every deleted second at or before `t`; `inside(t)` = `t` falls in a deleted span |
| `remap_keep(keep, deleted, min_seg=0.20)` | `(new_keep, new_total)` — `cut-plan.json`'s `keep` (original timeline) with the compressed-timeline `deleted` spans subtracted, segments shorter than `min_seg` dropped |

## Consumers

`edit_script.py` (`drop`/`keep`/`apply` — whole sentences) and `tighten.py` (`apply` —
gaps + fillers). The extraction removed a hand-duplicated copy of the `remap_keep` logic
that would otherwise have lived in both.

## No JS mirror

Both consumers are Python; nothing under `scripts/*.js` edits the cut timeline.
