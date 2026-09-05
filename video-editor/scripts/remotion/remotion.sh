#!/bin/bash
# ═══ The second engine: Remotion (a live timeline instead of rendered frames) ═══
#   remotion/remotion.sh <work> setup            → sets up the project in the work dir (downloads ~500 MB the first time)
#   remotion/remotion.sh <work> sync             → updates data/assets only (no download)
#   remotion/remotion.sh <work> studio [port]    → opens the live studio
#   remotion/remotion.sh <work> render [out.mp4] → produces an MP4 directly (no frames)
# Scenes are written in <work>/remotion/src/Scenes.tsx — never wiped by a re-run.
set -e
. "$(cd "$(dirname "$0")/.." && pwd)/lib/platform.sh"
W="$(vevo_abspath "$1")"; CMD="${2:-setup}"; ARG="$3"
TPL="$(cd "$(dirname "$0")/template" && pwd)"
R="$W/remotion"

sync_all(){
  mkdir -p "$R/src" "$R/public"
  # Structural files: always updated, except what the user edits
  for f in package.json tsconfig.json remotion.config.ts .gitignore README.md; do
    [ -f "$TPL/$f" ] && cp "$TPL/$f" "$R/$f"; done
  for f in index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts util.tsx Chrome.tsx Captions.tsx Outro.tsx Guides.tsx; do
    cp "$TPL/src/$f" "$R/src/$f"; done
  # Scenes: copied once only — your work is never wiped
  [ -f "$R/src/Scenes.tsx" ] || cp "$TPL/src/Scenes.tsx" "$R/src/Scenes.tsx"

  cp "$W/build/captions.json" "$R/src/caps.json"
  "${VEVO_PY[@]}" - "$W" "$R" <<'PY'
import json, os, sys
sys.path.insert(0, os.path.join(os.environ["VEVO_SKILL_DIR"], "scripts"))
from lib import config as cfg   # project.config.json — see docs/design/project-config.md
W, R = sys.argv[1], sys.argv[2]
def rd(rel, dflt):
    p = os.path.join(W, rel)
    return json.load(open(p, encoding="utf-8-sig")) if os.path.exists(p) else dflt
caps  = json.load(open(os.path.join(W, "build", "captions.json"), encoding="utf-8-sig"))
theme = cfg.load(W).get("theme", {})   # no longer from theme.json — same migration as reframe.py (#8)
sfx   = rd(os.path.join("build", "sound-cues.json"), {})
proj = {
  "theme": {k: theme.get(k) for k in ("bg","ink","acc","clay","mut","font","handle") if theme.get(k)},
  "total": round(caps["total"], 3),
  "outro": float(sfx.get("outro", 5.0)),
  "sfx":   os.path.exists(os.path.join(W, "build", "sound-effects.wav")),
  "stage": rd(os.path.join("config", "stage.json"), [{"s":0, "e":9999, "m":"FULL"}]),
  "outro_copy": rd(os.path.join("config", "outro.json"), {"line":"", "recap":[], "cta_top":"", "cta_word":"", "tail":""}),
  "guides": bool(rd(os.path.join("config", "safe.json"), {}).get("guides", False)),   # true → live safe-zone guides in the studio
}
json.dump(proj, open(os.path.join(R, "src", "project.json"), "w"), ensure_ascii=False, indent=1)
print("project.json → duration", proj["total"], "+ outro", proj["outro"], "· sfx:", "yes" if proj["sfx"] else "no")
PY
  [ -f "$W/build/video-reframed.mp4" ] && cp "$W/build/video-reframed.mp4" "$R/public/video.mp4"
  [ -f "$W/build/sound-effects.wav" ]  && cp "$W/build/sound-effects.wav"  "$R/public/sfx.wav"
  LOGO="$("${VEVO_PY[@]}" -c "import os,sys
sys.path.insert(0, os.path.join(os.environ['VEVO_SKILL_DIR'],'scripts'))
from lib import config as cfg
print(cfg.load('$W').get('theme',{}).get('logo','config/logo.png'))")"
  [ -f "$W/$LOGO" ] && cp "$W/$LOGO" "$R/public/logo.png"
  [ -f "$R/public/logo.png" ] || echo "⚠️  no logo found at $W — put config/logo.png"
  echo "✅ data and assets updated at $R"
}

case "$CMD" in
  setup)
    sync_all
    if [ -d "$R/node_modules" ]; then echo "Libraries already installed — ready."; else
      echo "⏬ Downloading Remotion libraries (~500 MB, once)…"
      ( cd "$R" && npm install --silent ) || { echo "❌ Download failed"; exit 12; }
      echo "✅ Ready."
    fi ;;
  sync) sync_all ;;
  studio)
    sync_all; PORT="${ARG:-3000}"
    echo "🎬 Studio at http://localhost:$PORT"
    ( cd "$R" && npx remotion studio --port "$PORT" ) ;;
  render)
    sync_all; OUT="${ARG:-$W/build/video-raw.mp4}"
    mkdir -p "$(dirname "$OUT")"
    grep -q '"guides": true' "$R/src/project.json" && \
      echo "⚠️  Safe-zone guides are on — they'll be burned into the video. Remove guides from config/safe.json before delivery."
    ( cd "$R" && npx remotion render Ad "$OUT" --codec h264 --crf 21 --jpeg-quality 95 )
    echo "✅ $OUT"
    ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT" ;;
  *) echo "Commands: setup | sync | studio | render"; exit 2 ;;
esac
