# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Nudge every cut-in point onto a clean frame — sharp and settled, not mid-motion.

    python3 settle_check.py <workdir> [--force] [--dry]

Reads : the rush source (via lib/rush) · <work>/build/cut-plan.json · config `cut` block
Writes: <work>/build/cut-plan.json  (in place — `keep` starts shifted forward, `total`
        recomputed, `"settled": true` added) + a <work>/build/.settled pipeline marker.
        With `"settled": true` already set it just refreshes the marker (a re-run is a
        no-op) unless --force. Terminal timeline edits (retakes.py, edit_script.py) leave
        the flag on so they are not undone by a second settle pass.

Why: plan_cuts.py places segment boundaries from audio silence only. The audio can't tell
that at the cut-in the speaker is still shifting position (blurry) or the camera hasn't
settled. For each segment start `a`, this looks at the first `cut.settleMaxMs` (default
400) of frames via ffmpeg `blurdetect` + `signalstats.YDIF` — the same no-dependency
metric pass montage_mode.py uses — and moves `a` to the first frame that is both sharp and
low-motion. The nudge never crosses into speech: it is capped at `cut.padIn` (the lead-in
plan_cuts.py added), so worst case it trims the whole lead-in, never a spoken word.

Eyes-open / gaze is out of scope (needs a face-detection dependency — issue #128).

Exit 0 always (a segment with no clean frame in range is left as-is and reported).
"""
import json, os, re, subprocess, sys
from lib import rush, platform as _plat, config as _cfg

W = os.path.abspath(sys.argv[1])
FORCE = "--force" in sys.argv
DRY = "--dry" in sys.argv
CP = os.path.join(W, "build", "cut-plan.json")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def frame_metrics(src, a, span):
    """[{t, blur, mot}, ...] for the window [a, a+span] of the source (t is absolute)."""
    mf = os.path.join(W, "build", ".settle-meta.txt")
    if os.path.exists(mf):
        os.remove(mf)
    vf = ("blurdetect=low=0.05:high=0.15,signalstats,"
          f"metadata=print:file={mf}")
    run([_plat.FFMPEG, "-v", "error", "-ss", f"{a:.4f}", "-t", f"{span:.4f}",
         "-i", src, "-an", "-vf", vf, "-f", "null", "-"])
    if not os.path.exists(mf):
        return []
    rows, cur = [], None
    for ln in open(mf, encoding="utf-8", errors="replace"):
        ln = ln.strip()
        m = re.match(r"frame:\d+\s+pts:\S+\s+pts_time:([0-9.]+)", ln)
        if m:
            cur = {"t": a + float(m.group(1))}
            rows.append(cur)
            continue
        if cur is None:
            continue
        m = re.match(r"lavfi\.(blur|signalstats\.YDIF)=([0-9.eE+-]+)", ln)
        if m:
            try:
                cur["blur" if m.group(1) == "blur" else "mot"] = float(m.group(2))
            except ValueError:
                pass
    return [r for r in rows if "blur" in r and "mot" in r]


def pct(vals, p):
    if not vals:
        return 0.0
    s = sorted(vals)
    return s[min(len(s) - 1, int(p / 100.0 * len(s)))]


def first_clean(rows):
    """Earliest frame that is both sharp and low-motion for this window. None if the
    whole window is junk (then the caller keeps the original start)."""
    if len(rows) < 3:
        return None
    blur_ok = pct([r["blur"] for r in rows], 45) * 1.15 + 1e-6
    mot_ok = pct([r["mot"] for r in rows], 55) * 1.30 + 1e-6
    ok = lambda r: r["blur"] <= blur_ok and r["mot"] <= mot_ok
    if ok(rows[0]):
        return None                          # the cut already lands on a fine frame
    for r in rows[1:]:
        if ok(r):
            return r["t"]
    return None                              # whole window is junk — keep the original start


def main():
    if not os.path.exists(CP):
        sys.exit("no build/cut-plan.json — run plan_cuts.py first")
    mk = os.path.join(W, "build", ".settled")
    plan = json.load(open(CP, encoding="utf-8-sig"))
    if plan.get("settled") and not FORCE:
        # already nudged (or a later stage — retakes.py / edit_script.py — shifted the
        # plan and left the flag on): just refresh the pipeline marker, do NOT rewrite
        # cut-plan.json (that would re-trigger captions.py and clobber its edits).
        if not DRY:
            open(mk, "w").close()
        print("cut-plan already settled (use --force to redo)")
        return
    keep = [list(x) for x in plan["keep"]]
    if not keep:
        sys.exit("cut-plan has no segments")

    c = (_cfg.load(W).get("cut", {}) or {})
    if not c.get("settle", True):
        print("cut.settle is off — nothing to do")
        return
    limit = min(float(c.get("settleMaxMs", 400)) / 1000.0, float(c.get("padIn", 0.22)))
    src = rush.find_source(W)

    moved = 0
    for i, (a, b) in enumerate(keep):
        span = min(limit, max(0.0, b - a - 0.30))
        if span < 0.06:
            continue
        rows = frame_metrics(src, a, span + 1e-3)
        t = first_clean(rows)
        if t is None or t <= a + 1e-3:
            continue
        keep[i][0] = round(min(t, a + limit), 4)
        moved += 1
        print(f"  seg {i+1}: {a:7.2f} -> {keep[i][0]:7.2f}  (+{keep[i][0]-a:.2f}s to a clean frame)")

    total = round(sum(y - x for x, y in keep), 3)
    print(f"settle: {moved}/{len(keep)} cut-in point(s) nudged  ·  kept {total:.2f}s")
    mf = os.path.join(W, "build", ".settle-meta.txt")
    if os.path.exists(mf):
        os.remove(mf)
    if DRY:
        print("(dry run — cut-plan.json not written)")
        return
    plan["keep"] = keep
    plan["total"] = total
    plan["settled"] = True
    json.dump(plan, open(CP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # pipeline marker: run.py re-runs settle when cut-plan.json is newer than this
    open(os.path.join(W, "build", ".settled"), "w").close()


if __name__ == "__main__":
    main()
