# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Step 1 - preflight: look at where we are, check the toolchain, prepare the ground.

    uv run scripts/preflight.py <target> [--apply] [--json]

`<target>` is whatever the user pointed at: a video file, or a folder holding the
material. Its folder becomes the project and gets a `work/` next to the footage:

    <folder>/work/{rush,config,build}                   <- created by --apply
    <folder>/work/rush/<video(s)>                       <- MOVED, never copied, names kept
    <folder>/work/config/project.config.json + logo.*   <- MOVED if found beside the footage

One folder = one project. Without `--apply` nothing is created and nothing moves - it
only looks and reports.

Exit codes (the agent branches on these, it does not parse the prose):
    0   ready - proceed to step 2 (with --apply: the structure exists, the files are in place)
    10  toolchain incomplete - ask consent, then `bash scripts/setup.sh --install`
    20  a human has to decide - ambiguous input, an occupied work/, a catch-all folder
    30  nothing usable - no readable media at all
"""
import json
import os
import shutil
import subprocess
import sys

from lib import platform as _plat

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".mts", ".m2ts",
             ".mpg", ".mpeg", ".wmv", ".flv", ".3gp"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
LOGO_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
CONFIG_NAME = "project.config.json"
BG_AUDIO = "bg-audio.mp3"

OK, TOOLS, DECIDE, EMPTY = 0, 10, 20, 30

LONG_SECONDS = 180.0        # beyond this, flag the recording as a long-form candidate
MIN_WIDTH = 1080            # below this the reframe zoom has almost no room


# --------------------------------- toolchain ------------------------------
def check_tools():
    """Delegate to setup.sh (report mode - it never installs without --install)."""
    bash = shutil.which("bash")
    if not bash:
        return {"ok": False, "code": None, "report": "",
                "problem": "no bash on PATH - Git-Bash or WSL is required on Windows"}
    r = subprocess.run([bash, os.path.join(_plat.SCRIPTS, "setup.sh")],
                       cwd=_plat.SKILL, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")   # setup.sh prints ✅/emoji
    return {"ok": r.returncode == 0, "code": r.returncode,
            "report": (r.stdout + r.stderr).strip(), "problem": None}


# --------------------------------- media probing --------------------------
def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _rate(s):
    """'30000/1001' -> 29.97"""
    if not s or "/" not in str(s):
        return _f(s) or 0.0
    n, _, d = str(s).partition("/")
    n, d = _f(n) or 0.0, _f(d) or 0.0
    return round(n / d, 3) if d else 0.0


def _rotation(v):
    for sd in v.get("side_data_list") or []:
        if "rotation" in sd:
            try:
                return int(round(float(sd["rotation"])))
            except (TypeError, ValueError):
                pass
    try:
        return int(v.get("tags", {}).get("rotate", 0))
    except (TypeError, ValueError):
        return 0


def probe(path):
    """ffprobe one file. Returns the facts plus the flags worth stopping for."""
    info = {"name": os.path.basename(path), "path": path,
            "size": os.path.getsize(path) if os.path.exists(path) else 0,
            "readable": False, "flags": []}
    r = subprocess.run([_plat.FFPROBE, "-v", "error", "-print_format", "json",
                        "-show_format", "-show_streams", path],
                       capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        info["flags"].append("unreadable")
        return info
    try:
        d = json.loads(r.stdout)
    except ValueError:
        info["flags"].append("unreadable")
        return info

    streams = d.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if not v:
        info["flags"].append("unreadable")
        return info

    info["readable"] = True
    info["duration"] = _f(d.get("format", {}).get("duration")) or _f(v.get("duration")) or 0.0
    info["width"], info["height"] = v.get("width", 0), v.get("height", 0)
    info["codec"] = v.get("codec_name", "?")
    info["fps"] = _rate(v.get("avg_frame_rate"))
    info["audio"] = bool(a)
    info["rotation"] = _rotation(v)

    if not info["audio"]:
        info["flags"].append("no-audio")
    if info["rotation"] % 360 != 0:
        info["flags"].append("rotation:%d" % info["rotation"])
    real = _rate(v.get("r_frame_rate"))
    if real and info["fps"] and abs(real - info["fps"]) > 0.5:
        info["flags"].append("variable-fps")
    if max(info["width"], info["height"]) < MIN_WIDTH:
        info["flags"].append("low-res")
    if info["duration"] > LONG_SECONDS:
        info["flags"].append("long-recording")
    return info


# --------------------------------- the folder -----------------------------
CATCH_ALL = {"desktop", "downloads", "documents", "movies", "videos", "pictures",
             "music", "bureau", "telechargements", "images", "vidéos",
             "téléchargements"}


def is_catch_all(folder):
    """A general-purpose folder we must never silently turn into a project."""
    folder = os.path.normpath(os.path.abspath(folder))
    home = os.path.normpath(os.path.expanduser("~"))
    if folder == home or folder == os.path.dirname(folder):      # home, or a drive root
        return True
    return (os.path.normpath(os.path.dirname(folder)) == home
            and os.path.basename(folder).lower() in CATCH_ALL)


def project_root(path):
    """The folder that becomes the project. Normally the folder the footage sits in - but
    if the target is already inside a prepared `work/`, the project is the folder that
    HOLDS work/, so a second run never nests work/rush/work/ (found in testing)."""
    cur = path if os.path.isdir(path) else os.path.dirname(path)
    probe_dir = cur
    while True:
        parent = os.path.dirname(probe_dir)
        if parent == probe_dir:
            return cur
        if os.path.basename(probe_dir).lower() == "work" \
                and os.path.isdir(os.path.join(probe_dir, "rush")):
            return parent
        probe_dir = parent


def relocate(target):
    """A path the user gives from memory may already have been moved into work/rush/ by
    an earlier run. Follow it there instead of failing with 'no such path'."""
    if os.path.exists(target):
        return target
    moved = os.path.join(os.path.dirname(target), "work", "rush",
                         os.path.basename(target))
    return moved if os.path.exists(moved) else target


def scan(folder):
    """Media / config / logo / bg-audio / broll sitting at the folder's root."""
    out = {"media": [], "config": None, "logo": None, "bg_audio": None, "broll": None,
           "other": []}
    for name in sorted(os.listdir(folder)):
        p = os.path.join(folder, name)
        if os.path.isdir(p):
            if name.lower() == "broll":
                out["broll"] = p
            continue
        ext = os.path.splitext(name)[1].lower()
        if name == BG_AUDIO:
            out["bg_audio"] = p
        elif name == CONFIG_NAME:
            out["config"] = p
        elif ext in VIDEO_EXT or ext in AUDIO_EXT:
            out["media"].append(p)
        elif ext in LOGO_EXT and out["logo"] is None and "logo" in name.lower():
            out["logo"] = p
        else:
            out["other"].append(p)
    return out


def infer_world(probes):
    """One talking file -> reel-speech. Several files -> broll-montage. `format:"long"`
    in the config overrides this later - it is the one thing footage cannot tell us."""
    usable = [p for p in probes if p["readable"]]
    if not usable:
        return None
    if len(usable) == 1:
        return "reel-speech" if usable[0].get("audio") else "broll-montage"
    return "broll-montage"


# --------------------------------- apply ----------------------------------
def apply(folder, work, picked, found):
    """Create work/{rush,config,build} and MOVE the material in. Anything we did not
    recognise stays exactly where the user left it."""
    moved = []
    for sub in ("rush", "config", "build"):
        os.makedirs(os.path.join(work, sub), exist_ok=True)

    def move(src, dst_dir):
        if not src or not os.path.exists(src):
            return
        os.makedirs(dst_dir, exist_ok=True)
        dst = os.path.join(dst_dir, os.path.basename(src))
        if os.path.abspath(src) == os.path.abspath(dst) or os.path.exists(dst):
            return
        shutil.move(src, dst)
        moved.append((os.path.relpath(src, folder), os.path.relpath(dst, folder)))

    for m in picked:
        move(m, os.path.join(work, "rush"))
    move(found["bg_audio"], os.path.join(work, "rush"))
    move(found["broll"], os.path.join(work, "rush"))
    move(found["config"], os.path.join(work, "config"))
    move(found["logo"], os.path.join(work, "config"))

    # the per-project drawing surface (scene design rewrites it; the reference is the start)
    for src, dst in ((os.path.join(_plat.SCRIPTS, "compose.reference.html"),
                      os.path.join(work, "compose.html")),
                     (os.path.join(_plat.SCRIPTS, "studio.html"),
                      os.path.join(work, "studio.html"))):
        if os.path.exists(src) and not os.path.exists(dst):
            shutil.copy2(src, dst)
    return moved


# --------------------------------- report ---------------------------------
def human(res):
    L = []
    t = res["tools"]
    L.append("tools: " + ("ok" if t["ok"] else "INCOMPLETE"))
    for line in (t["report"] or t["problem"] or "").splitlines():
        L.append("   " + line)
    L.append("folder: " + res["folder"])
    L.append("work:   " + res["work"] + ("  [exists]" if res["work_exists"] else ""))
    if res["world"]:
        L.append("world:  " + res["world"])
    L.append("config: " + (res["found"]["config"] or
                           "none beside the footage - step 1 asks for it"))
    for key, label in (("logo", "logo:  "), ("bg_audio", "bg:    "), ("broll", "broll: ")):
        if res["found"].get(key):
            L.append(label + " " + res["found"][key])
    L.append("media (%d):" % len(res["probes"]))
    for p in res["probes"]:
        if not p["readable"]:
            L.append("   %-34s UNREADABLE" % p["name"])
            continue
        warn = [f for f in p["flags"] if f != "no-audio"]
        L.append("   %-34s %6.1fs  %dx%d  %sfps  %-6s %-8s %s"
                 % (p["name"], p["duration"], p["width"], p["height"], p["fps"],
                    p["codec"], "audio" if p["audio"] else "NO AUDIO",
                    ("! " + " ".join(warn)) if warn else ""))
    for q in res["questions"]:
        L.append("ASK: " + q)
    if res["moved"]:
        L.append("moved:")
        for a, b in res["moved"]:
            L.append("   %s -> %s" % (a, b))
    L.append("verdict: %s (exit %d)" % (res["verdict"], res["exit"]))
    return "\n".join(L)


def _out(res, as_json):
    print(json.dumps(res, ensure_ascii=False, indent=1) if as_json else human(res))
    return res["exit"]


# --------------------------------- main -----------------------------------
def main():
    argv = sys.argv[1:]
    as_json = "--json" in argv
    do_apply = "--apply" in argv
    targets = [a for a in argv if not a.startswith("--")]
    if not targets:
        print("usage: preflight.py <video-file|folder> [--apply] [--json]\n"
              "  exit 0 ready . 10 toolchain incomplete . 20 needs a human decision . "
              "30 nothing usable")
        return 2
    target = relocate(os.path.abspath(targets[0]))
    if not os.path.exists(target):
        print("no such path: " + target)
        return EMPTY

    res = {"target": target, "questions": [], "moved": [], "probes": [], "resume": [],
           "world": None, "verdict": "", "exit": OK, "applied": do_apply}

    # 1. the toolchain first - without ffprobe we cannot look at anything
    res["tools"] = check_tools()

    # 2. the folder that becomes the project
    designated = target if os.path.isfile(target) else None
    folder = project_root(target)
    res["folder"] = folder
    res["work"] = os.path.join(folder, "work")
    res["work_exists"] = os.path.isdir(res["work"])
    res["found"] = {"config": None, "logo": None, "bg_audio": None, "broll": None,
                    "media": [], "other": []}

    if not res["tools"]["ok"]:
        res["verdict"] = "toolchain incomplete - get consent, then setup.sh --install"
        res["exit"] = TOOLS
        return _out(res, as_json)

    found = scan(folder)
    res["found"] = found

    # 3. the guards - never decide these alone
    if found["media"] and is_catch_all(folder) and not res["work_exists"]:
        res["questions"].append(
            "%s is a catch-all folder, not a project. Ask the user to put this montage's "
            "footage in its own folder and point at that folder." % folder)

    if res["work_exists"]:
        rush = os.path.join(res["work"], "rush")
        in_rush = sorted(f for f in os.listdir(rush)
                         if os.path.isfile(os.path.join(rush, f)) and f != BG_AUDIO) \
            if os.path.isdir(rush) else []
        res["resume"] = in_rush
        same = bool(designated) and os.path.basename(designated) in in_rush
        if in_rush and not same and (designated or found["media"]):
            res["questions"].append(
                "work/ already holds another project (%s). One folder = one project - do "
                "not overwrite it. Ask the user for a fresh folder for this video."
                % ", ".join(in_rush))
        elif in_rush:
            res["verdict"] = ("resume - this project already exists; "
                              "run `uv run scripts/run.py <work> --dry` for its state")

    # 4. what are we actually editing
    picked = [designated] if designated else list(found["media"])
    if designated and len(found["media"]) > 1:
        others = [os.path.basename(m) for m in found["media"]
                  if os.path.abspath(m) != os.path.abspath(designated)]
        res["questions"].append(
            "the folder holds %d other video(s) (%s) and one file was designated. Ask "
            "whether this is one video or a montage of all of them."
            % (len(others), ", ".join(others)))
    if not picked and not res["resume"]:
        res["verdict"] = "no video found in " + folder
        res["exit"] = EMPTY
        return _out(res, as_json)

    # 5. look at every file
    res["probes"] = [probe(p) for p in picked]
    res["world"] = infer_world(res["probes"])
    if any("unreadable" in p["flags"] for p in res["probes"]):
        res["questions"].append(
            "at least one file is unreadable - confirm it is the right file.")
    if res["world"] == "reel-speech" and res["probes"] and not res["probes"][0]["audio"]:
        res["questions"].append(
            "the video has no audio track - a captioned speech ad is impossible. "
            "Confirm the mode with the user.")

    if res["questions"]:
        res["verdict"] = ("needs a human decision - %d question(s), nothing was created"
                          % len(res["questions"]))
        res["exit"] = DECIDE
        return _out(res, as_json)

    # 6. prepare the ground
    if do_apply:
        res["moved"] = apply(folder, res["work"], picked, found)
        os.makedirs(os.path.join(res["work"], "build"), exist_ok=True)
        with open(os.path.join(res["work"], "build", "preflight.json"),
                  "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
    if not res["verdict"]:
        res["verdict"] = ("ready - %s, %d file(s)%s"
                          % (res["world"], len(res["probes"]),
                             "" if do_apply else "; re-run with --apply to prepare work/"))
    return _out(res, as_json)


if __name__ == "__main__":
    sys.exit(main())
