# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Shared timeline surgery for edit_script.py and tighten.py.

Both remove spans from the **compressed** (post-plan_cuts) timeline and need the same two
things: map those spans back onto build/cut-plan.json's original-timeline `keep` segments,
and shift every surviving timestamp. The captions rewrite differs (whole-card drops vs
per-word filler drops) so each script keeps its own — only the gnarly parts live here.
"""


def merge(intervals, gap=0.05):
    """Sort + coalesce [[a,b], ...] intervals that touch or overlap (within `gap`)."""
    iv = sorted([a, b] for a, b in intervals if b > a)
    out = []
    for a, b in iv:
        if out and a - out[-1][1] < gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def make_shift(deleted):
    """(shift, inside) for a merged deletion list on the compressed timeline.
    shift(t) = t minus every deleted second at or before t. inside(t) = t is deleted."""
    def shift(t):
        return t - sum(min(t, b) - a for a, b in deleted if a < t)

    def inside(t):
        return any(a - 1e-6 <= t <= b + 1e-6 for a, b in deleted)

    return shift, inside


def remap_keep(keep, deleted, min_seg=0.20):
    """cut-plan.json `keep` (original timeline) minus the compressed-timeline `deleted`
    spans. Returns (new_keep, new_total). Mirrors edit_script.py's section 1 exactly."""
    keep = [list(x) for x in keep]
    off, acc = [], 0.0
    for a, b in keep:
        off.append(acc)
        acc += b - a

    src_del = []
    for ds, de in deleted:
        for i, (a, b) in enumerate(keep):
            s0, s1 = off[i], off[i] + (b - a)
            lo, hi = max(ds, s0), min(de, s1)
            if hi > lo:
                src_del.append([a + (lo - s0), a + (hi - s0)])

    new_keep = []
    for a, b in keep:
        parts = [[a, b]]
        for ds, de in src_del:
            nxt = []
            for x, y in parts:
                if de <= x or ds >= y:
                    nxt.append([x, y]); continue
                if ds > x:
                    nxt.append([x, ds])
                if de < y:
                    nxt.append([de, y])
            parts = nxt
        new_keep += [p for p in parts if p[1] - p[0] >= min_seg]

    return new_keep, round(sum(b - a for a, b in new_keep), 3)
