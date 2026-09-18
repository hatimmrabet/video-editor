# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Nudge every cut-in point onto a clean frame — sharp and settled, not mid-motion.

    uv run scripts/settle_cuts.py <work> [--dry]

Reads : the rush source (via lib/rush) · <work>/timeline.json · config `cut` block
Writes: <work>/timeline.json — the first `src` span of each entry starts a little later

Renamed from settle_check.py (issue #144): it never was a check, it EDITS the cut-in
points. And it no longer carries a sticky `"settled": true` flag. That flag existed to stop
a re-run from rewriting cut-plan.json and re-triggering captions.py, which would clobber
every edit — a hazard that no longer exists, because nothing here touches anything but the
in-point of each entry. Re-running is now useful rather than dangerous: after a tighten
pass there are new cut-in points, and this finds clean frames for them too. A cut-in that
already lands on a good frame is left alone, so a second pass over settled material is a
no-op anyway.

Why: find_silences.py places boundaries from audio alone. The audio cannot tell that at the
cut-in the speaker is still shifting position (blurry) or the camera has not settled. For
each entry start `a`, this looks at the first `cut.settleMaxMs` (default 400) of frames via
ffmpeg `blurdetect` + `signalstats.YDIF` — the same no-dependency metric pass — and moves
`a` to the first frame that is both sharp and low-motion. The nudge never crosses into
speech: it is capped at `cut.padIn` (the lead-in build_timeline.py added), so worst case it
trims the whole lead-in, never a spoken word.

Eyes-open / gaze is out of scope (needs a face-detection dependency — issue #128).

Exit 0 always (an entry with no clean frame in range is left as-is and reported).
"""
import json, os, re, subprocess, sys
from lib import rush, platform as _plat, config as _cfg, timeline as tl

W = os.path.abspath(sys.argv[1])
DRY = "--dry" in sys.argv


def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def frame_metrics(src, a, span):
    """[{t, blur, mot}, ...] for the window [a, a+span] of the source (t is absolute)."""
    build = os.path.join(W, "build")
    meta_name = ".settle-meta.txt"
    mf = os.path.join(build, meta_name)
    if os.path.exists(mf):
        os.remove(mf)
    # `metadata=print:file=...` lives inside ffmpeg's filtergraph mini-language, where `:`
    # separates options and `\` escapes — an absolute Windows path (C:\Users\...) breaks that
    # parser outright (issue #133). A bare relative filename with cwd=build sidesteps the
    # whole escaping problem, on every OS.
    vf = f"blurdetect=low=0.05:high=0.15,signalstats,metadata=print:file={meta_name}"
    r = run([_plat.FFMPEG, "-v", "error", "-ss", f"{a:.4f}", "-t", f"{span:.4f}",
             "-i", src, "-an", "-vf", vf, "-f", "null", "-"], cwd=build)
    if r.returncode != 0 or not os.path.exists(mf):
        # Real failure, not "no clean frame in range": say so loudly instead of quietly
        # folding it into "0/N nudged", which reads as a benign, expected outcome.
        detail = (r.stderr or "").strip().splitlines()[-1] if r.stderr else "no output produced"
        print(f"  !! settle measurement failed at {a:.2f}s (kept as-is): {detail}")
        return None
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
    if not os.path.exists(tl.path(W)):
        sys.exit("no timeline.json - run build_timeline.py first")
    t = tl.load(W)
    entries = [e for e in tl.entries(t) if tl.span_list(e)]
    if not entries:
        sys.exit("the timeline has no entries to settle")

    c = (_cfg.load(W).get("cut", {}) or {})
    if not c.get("settle", True):
        print("cut.settle is off - nothing to do")
        return
    limit = min(float(c.get("settleMaxMs", 400)) / 1000.0, float(c.get("padIn", 0.22)))
    src = rush.find_source(W)

    moved, failed = 0, 0
    for e in entries:
        spans = tl.span_list(e)
        a, b = spans[0]
        # never eat into speech: stop short of the first word if there is one
        words = (e.get("caption") or {}).get("words") or []
        ceiling = min(a + limit, (words[0].get("src") or [b])[0] if words else b)
        span = min(limit, max(0.0, min(b, ceiling) - a - 0.06))
        if span < 0.06:
            continue
        rows = frame_metrics(src, a, span + 1e-3)
        if rows is None:
            failed += 1
            continue
        clean = first_clean(rows)
        if clean is None or clean <= a + 1e-3:
            continue
        spans[0][0] = round(min(clean, ceiling), 4)
        e["src"] = spans
        moved += 1
        print("  %s: %7.2f -> %7.2f  (+%.2fs to a clean frame)" % (e["id"], a, spans[0][0], spans[0][0] - a))

    note = "  -  %d measurement failure(s), see above" % failed if failed else ""
    print("settle: %d/%d cut-in point(s) nudged  -  %.2fs kept%s"
          % (moved, len(entries), tl.duration(t), note))

    mf = os.path.join(W, "build", ".settle-meta.txt")
    if os.path.exists(mf):
        os.remove(mf)
    if DRY:
        print("(dry run - timeline.json not written)")
        return
    tl.save(W, t)
    # pipeline marker: run.py re-runs settle when the timeline is newer than this
    os.makedirs(os.path.join(W, "build"), exist_ok=True)
    open(os.path.join(W, "build", ".settled"), "w").close()


if __name__ == "__main__":
    main()
