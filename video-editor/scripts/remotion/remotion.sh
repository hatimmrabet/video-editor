#!/bin/bash
# ═══ The second engine: Remotion (a live timeline instead of rendered frames) ═══
#   remotion/remotion.sh <work> setup            → sets up the project in the work dir (downloads ~500 MB the first time)
#   remotion/remotion.sh <work> sync             → updates data/assets only (no download)
#   remotion/remotion.sh <work> studio [port]    → opens the live studio
#   remotion/remotion.sh <work> render [out.mp4] → produces an MP4 directly (no frames)
#   remotion/remotion.sh <work> still 4.6 12.3   → review stills → <work>/build/prev/t<sec>.jpg
#   remotion/remotion.sh <work> check            → type-checks the project (tsc --noEmit)
# Scenes are written in <work>/remotion/src/Scenes.tsx — never wiped by a re-run.
set -e
. "$(cd "$(dirname "$0")/.." && pwd)/lib/platform.sh"
W="$(vevo_abspath "$1")"; CMD="${2:-setup}"; ARG="$3"
TPL="$(cd "$(dirname "$0")/template" && pwd)"
R="$W/remotion"

sync_all(){
  mkdir -p "$R/src" "$R/public"
  # Structural files: always updated, except what the user edits
  for f in package.json package-lock.json tsconfig.json remotion.config.ts .gitignore README.md; do
    [ -f "$TPL/$f" ] && cp "$TPL/$f" "$R/$f"; done
  for f in index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts util.tsx Chrome.tsx Captions.tsx Outro.tsx Guides.tsx Grid.tsx SceneList.tsx; do
    cp "$TPL/src/$f" "$R/src/$f"; done
  # Scenes.tsx: copied once only — a project's hand-written scene components are never wiped
  # (with config/scenes.json the scenes are data and SceneList.tsx dispatches them instead)
  [ -f "$R/src/Scenes.tsx" ] || cp "$TPL/src/Scenes.tsx" "$R/src/Scenes.tsx"
  # Motifs: the shared per-engine components — always refreshed (issue #18)
  mkdir -p "$R/src/motifs"
  for f in "$(cd "$(dirname "$0")/../motifs/remotion" && pwd)"/*.tsx; do
    [ -f "$f" ] && cp "$f" "$R/src/motifs/"; done

  LOGO="$("${VEVO_PY[@]}" -c "import os,sys
sys.path.insert(0, os.path.join(os.environ['VEVO_SKILL_DIR'],'scripts'))
from lib import config as cfg
print(cfg.load('$W').get('theme',{}).get('logo','config/logo.png'))")"
  [ -f "$W/$LOGO" ] && cp "$W/$LOGO" "$R/public/logo.png"
  cp "$W/build/captions.json" "$R/src/caps.json"
  "${VEVO_PY[@]}" - "$W" "$R" <<'PY'
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.environ["VEVO_SKILL_DIR"], "scripts"))
from lib import config as cfg          # project.config.json
from lib import transitions as trans   # scripts/transitions.json
from lib import scenes as scn          # config/scenes.json
from lib import platform as plat       # $VEVO_FFPROBE resolver (issue #44)
W, R = sys.argv[1], sys.argv[2]
def rd(rel, dflt):
    p = os.path.join(W, rel)
    return json.load(open(p, encoding="utf-8-sig")) if os.path.exists(p) else dflt
caps  = json.load(open(os.path.join(W, "build", "captions.json"), encoding="utf-8-sig"))
_cfg  = cfg.load(W)                     # no longer from theme.json — same migration as reframe.py (#8)
theme = _cfg.get("theme", {})
sfx   = rd(os.path.join("build", "sound-cues.json"), {})
# The composition's own size, read off the cut video rather than assumed — the scene layer
# (Root.tsx, stage.ts, every motif) follows whatever orientation reframe.py produced (#136).
_dims = subprocess.run([plat.ffprobe(), "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x",
                        os.path.join(W, "build", "video-reframed.mp4")],
                       capture_output=True, text=True).stdout.strip()
_ow, _oh = (int(x) for x in _dims.split("x")) if "x" in _dims else (1080, 1920)
proj = {
  "width": _ow, "height": _oh,
  # the whole theme block, verbatim. A whitelist here silently dropped every key it did not
  # know (Chrome.tsx reads theme.badgeUntil, which was never written, so the account badge
  # could not work) and `if theme.get(k)` dropped falsy values too — 0 and false are valid
  # settings. theme.ts already carries a default per key.
  "theme": theme,
  # a project with no logo must still render — Chrome.tsx / Outro.tsx guard every <Img>
  # on this. Before it existed, a missing logo.png aborted the render outright.
  "logo": os.path.exists(os.path.join(R, "public", "logo.png")),
  "faceAnchor": _cfg.get("crop", {}).get("faceAnchor", 0.30),   # → theme.ts FACE_ANCHOR / Ad.tsx objectPosition (issue #28)
  "total": round(caps["total"], 3),
  "outro": float(sfx.get("outro", 5.0)),
  "sfx":   os.path.exists(os.path.join(W, "build", "sound-effects.wav")),
  "stage": rd(os.path.join("config", "stage.json"), [{"s":0, "e":9999, "m":"FULL"}]),
  "outro_copy": rd(os.path.join("config", "outro.json"), {"line":"", "recap":[], "cta_top":"", "cta_word":"", "tail":""}),
  "guides": bool(rd(os.path.join("config", "safe.json"), {}).get("guides", False)),   # true → live safe-zone guides in the studio
  "transitions": trans.load()["defaults"],   # resolved transition defaults — the engine falls back to today's values without this
}
_scn = scn.load(W)   # config/scenes.json (issue #18) — None when the file is absent
if _scn["scenes"] is not None:
    proj["scenes"] = _scn["scenes"]
    proj["stage"] = _scn["schedule"]   # the rect schedule is derived from the scenes' layout
json.dump(proj, open(os.path.join(R, "src", "project.json"), "w"), ensure_ascii=False, indent=1)
print("project.json → duration", proj["total"], "+ outro", proj["outro"], "· sfx:", "yes" if proj["sfx"] else "no",
      "· scenes:", len(proj["scenes"]) if "scenes" in proj else "inline")
PY
  [ -f "$W/build/video-reframed.mp4" ] && cp "$W/build/video-reframed.mp4" "$R/public/video.mp4"
  [ -f "$W/build/sound-effects.wav" ]  && cp "$W/build/sound-effects.wav"  "$R/public/sfx.wav"
  [ -f "$R/public/logo.png" ] || echo "⚠️  no logo found at $W — put config/logo.png (the video still renders, without the mark)"
  echo "✅ data and assets updated at $R"
}

# Every command that runs the toolchain needs node_modules. `setup` is no longer a step the
# caller can forget: render / studio / still / check install on demand the first time.
ensure_deps(){
  [ -d "$R/node_modules" ] && return 0
  echo "⏬ Downloading Remotion libraries (~500 MB, once)…"
  # npm ci — installs the exact tree in template/package-lock.json (just copied in by sync_all)
  ( cd "$R" && npm ci --silent ) || { echo "❌ Download failed"; exit 12; }
  echo "✅ Ready."
}

case "$CMD" in
  setup)
    sync_all
    if [ -d "$R/node_modules" ]; then echo "Libraries already installed — ready."; else ensure_deps; fi ;;
  sync) sync_all ;;
  studio)
    sync_all; ensure_deps; PORT="${ARG:-3000}"
    echo "🎬 Studio at http://localhost:$PORT"
    ( cd "$R" && npx remotion studio --port "$PORT" ) ;;
  render)
    sync_all; ensure_deps; OUT="${ARG:-$W/build/video-raw.mp4}"
    mkdir -p "$(dirname "$OUT")"
    grep -q '"guides": true' "$R/src/project.json" && \
      echo "⚠️  Safe-zone guides are on — they'll be burned into the video. Remove guides from config/safe.json before delivery."
    ( cd "$R" && npx remotion render Ad "$OUT" --codec h264 --crf 21 --jpeg-quality 95 )
    echo "✅ $OUT"
    "$VEVO_FFPROBE" -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT" ;;
  still)
    # review stills at arbitrary times — the replacement for render_frames.js preview.
    sync_all; ensure_deps
    shift 2 || true
    [ $# -gt 0 ] || { echo "usage: remotion.sh <work> still <seconds> [<seconds>...]"; exit 2; }
    FPS="$("${VEVO_PY[@]}" -c "import json,os;print(json.load(open(os.path.join('$R','src','project.json')))['fps'])" 2>/dev/null || echo 30)"
    mkdir -p "$W/build/prev"
    for T in "$@"; do
      F="$("${VEVO_PY[@]}" -c "print(int(round(float('$T')*$FPS)))")"
      ( cd "$R" && npx remotion still Ad "$W/build/prev/t$("${VEVO_PY[@]}" -c "print('%.2f' % float('$T'))").jpg"           --frame="$F" --image-format=jpeg --jpeg-quality=95 ) || exit 13
    done
    echo "✅ $# still(s) → $W/build/prev/" ;;
  check)
    # the type-checker IS the scene linter: it catches undefined helpers, bad props and
    # out-of-range refs that the old lint_compose.js approximated with regexes.
    sync_all; ensure_deps
    ( cd "$R" && npm run --silent check ) && echo "✅ scenes type-check clean" ;;
  *) echo "Commands: setup | sync | studio | render | still | check"; exit 2 ;;
esac
