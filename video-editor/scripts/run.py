# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
USAGE = __doc__ = """run.py - the config-driven pipeline conductor.

    uv run scripts/run.py <work> [options]

Reads the stage list for the work-dir's world (inferred from rush/ - one file
with speech = reel-speech, many clips = broll-montage), runs each mechanical
stage whose outputs are stale, and halts at the genuine human decision points
(transcript correction, sound cues). It spawns the same scripts documented in
docs/pipeline.md - a conductor, not a reimplementation.

A stage is skipped when every path it `makes` exists and is newer than every
path it `needs`; otherwise it runs (`make`-style). A stage with no `run` is a
checkpoint: `block:true` halts until its `makes` file exists (a real decision
the agent/user must make); a checkpoint with no `makes` is advisory - printed,
never blocking.

Options:
    --from ID      start at stage ID
    --to ID        stop after stage ID
    --only ID      run just stage ID
    --world NAME   force the world instead of inferring it from rush/
    --engine NAME  override config.engine for `when` gating (light | remotion)
    --dry          print the plan + per-stage verdict, run nothing
    --force        run every in-range stage regardless of timestamps
    --list         print the world's stage ids and exit

Exit: 0 done / nothing to do . 1 a stage failed . 2 halted at a checkpoint
. 3 bad usage.
"""
import json
import os
import subprocess

SCRIPTS = os.path.dirname(os.path.abspath(__file__))   # .../video-editor/scripts
SKILL = os.path.dirname(SCRIPTS)                        # .../video-editor  (cwd for every stage)
if SCRIPTS not in _sys.path:
    _sys.path.insert(0, SCRIPTS)
from lib import config as _config  # noqa: E402
from lib import rush as _rush      # noqa: E402


def die(msg, code=3):
    print("run.py: " + msg)
    raise SystemExit(code)


def flag(argv, name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default


def infer_world(work):
    rush = os.path.join(work, "rush")
    if not os.path.isdir(rush):
        die("no rush/ in " + work + " - put the source file(s) there first")
    files = [f for f in os.listdir(rush)
             if os.path.isfile(os.path.join(rush, f)) and f != "bg-audio.mp3"]
    if not files:
        die("rush/ is empty")
    return "reel-speech" if len(files) == 1 else "broll-montage"


def load_manifest(world):
    p = os.path.join(SCRIPTS, "pipeline", world + ".json")
    if not os.path.exists(p):
        die("no pipeline manifest: " + p)
    with open(p, encoding="utf-8-sig") as f:
        return json.load(f)


def _mtime(work, spec, source):
    """Newest mtime behind a needs/makes spec, or None if it doesn't exist yet.
    A trailing '/' means 'the newest file anywhere under this directory'."""
    if spec == "{source}":
        return os.path.getmtime(source) if source and os.path.exists(source) else None
    p = os.path.join(work, spec)
    if spec.endswith("/"):
        d = p.rstrip("/\\")
        if not os.path.isdir(d):
            return None
        times = [os.path.getmtime(os.path.join(dp, f))
                 for dp, _, fs in os.walk(d) for f in fs]
        return max(times) if times else None
    return os.path.getmtime(p) if os.path.exists(p) else None


def _exists(work, spec, source):
    return _mtime(work, spec, source) is not None


def verdict(stage, work, source):
    """SKIP | RUN for a runnable stage; CHECKPOINT | HALT for a checkpoint."""
    makes = stage.get("makes", [])
    if "run" not in stage:
        if makes and not all(_exists(work, m, source) for m in makes):
            return "HALT" if stage.get("block") else "CHECKPOINT"
        return "CHECKPOINT" if not makes else "SKIP"
    if not makes:
        return "RUN"  # can't prove it's done (e.g. montage `plan`)
    made = [_mtime(work, m, source) for m in makes]
    if any(t is None for t in made):
        return "RUN"
    needed = [_mtime(work, n, source) for n in stage.get("needs", [])]
    needed = [t for t in needed if t is not None]
    return "RUN" if needed and min(made) < max(needed) else "SKIP"


def subst(argv, ctx):
    out = []
    for a in argv:
        for k, v in ctx.items():
            if "{" + k + "}" in a:
                if v is None:
                    die("stage needs {%s} but it is not set - run SKILL.md step 1 "
                        "(config/project.config.json)" % k)
                a = a.replace("{" + k + "}", v)
        out.append(a)
    return out


def main():
    argv = _sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        raise SystemExit(0 if argv else 3)
    work = os.path.abspath(argv[0])
    opt = argv[1:]
    dry = "--dry" in opt
    force = "--force" in opt
    if not os.path.isdir(os.path.join(work, "rush")):
        die("no rush/ in " + work + " - put the source file(s) there first")
    os.makedirs(os.path.join(work, "build"), exist_ok=True)
    cfg = _config.load(work)
    # long-form can't be inferred from rush/ (a folder of takes looks like broll-montage) —
    # it's the config.format switch, checked first. See docs/design/long-form.md.
    world = flag(opt, "--world") or ("long-form" if cfg.get("format") == "long"
                                     else infer_world(work))
    engine = flag(opt, "--engine") or cfg.get("engine", "light")
    source = None
    if world in ("reel-speech", "long-form"):
        try:
            source = _rush.find_source(work)   # long-form: build/source-joined.mp4 once `join` ran
        except SystemExit:
            source = None  # a later stage will report it precisely

    def when_ok(s):
        for k, v in s.get("when", {}).items():
            eff = engine if k == "engine" else cfg.get(k)
            if eff != v:
                return False
        return True

    manifest = load_manifest(world)
    stages = [s for s in manifest["stages"] if when_ok(s)]
    ids = [s["id"] for s in stages]

    if "--list" in opt:
        print(world + ": " + " -> ".join(ids))
        raise SystemExit(0)

    only = flag(opt, "--only")
    frm = flag(opt, "--from")
    to = flag(opt, "--to")
    for name, val in (("--only", only), ("--from", frm), ("--to", to)):
        if val and val not in ids:
            die("%s %s: not a stage of %s (%s)" % (name, val, world, ", ".join(ids)))
    lo = ids.index(frm) if frm else 0
    hi = ids.index(to) if to else len(ids) - 1
    sel = [only] if only else ids[lo:hi + 1]

    ctx = {"work": work, "skill": SKILL, "source": source,
           "language": cfg.get("language")}

    print("world: %s | engine: %s | %d stage(s)%s"
          % (world, engine, len(sel), "  [dry run]" if dry else ""))
    print("-" * 60)
    for s in stages:
        if s["id"] not in sel:
            continue
        v = verdict(s, work, source)
        if force and "run" in s and v == "SKIP":
            v = "RUN"
        line = "  %-9s %-16s %s" % (v, s["id"], s["title"])
        if v == "SKIP":
            print(line + "  (up to date)")
            continue
        if v == "CHECKPOINT":
            print(line)
            if s.get("note"):
                print("            -> " + s["note"])
            continue
        if v == "HALT":
            print(line)
            if s.get("note"):
                print("            -> " + s["note"])
            if dry:
                continue
            print("-" * 60)
            print("halted: create %s, then re-run `run.py %s`"
                  % (", ".join(s["makes"]), argv[0]))
            raise SystemExit(2)
        cmd = subst(s["run"], ctx)
        print(line)
        print("            $ " + " ".join(cmd))
        if dry:
            continue
        r = subprocess.run(cmd, cwd=SKILL)
        if r.returncode != 0:
            if s["id"] == "safe" and r.returncode == 3:
                die("safe-zone / hook violation - see %s/build/safe-zone-check.jpg"
                    % argv[0], 1)
            die("stage '%s' failed (exit %d)" % (s["id"], r.returncode), 1)
    print("-" * 60)
    print("done" if not dry else "dry run complete")


if __name__ == "__main__":
    main()
