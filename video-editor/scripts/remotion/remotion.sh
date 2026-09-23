#!/bin/bash
# ═══ The second engine: Remotion (a live timeline instead of rendered frames) ═══
#   remotion/remotion.sh <work> setup            → sets up the project in the work dir (downloads ~500 MB the first time)
#   remotion/remotion.sh <work> sync             → updates data/assets only (no download)
#   remotion/remotion.sh <work> studio [port]    → opens the live studio
#   remotion/remotion.sh <work> render [out.mp4] → produces an MP4 directly (no frames)
#   remotion/remotion.sh <work> still 4.6 12.3   → review stills → <work>/build/prev/t<sec>.jpg
#   remotion/remotion.sh <work> check            → type-checks the project (tsc --noEmit)
# Scenes are authored as data — an entry's `scene`/`overlay` in <work>/timeline.json,
# dispatched by SceneList.tsx/VideoOverlays.tsx. No per-project TSX to preserve across a sync.
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
  for f in index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts capPages.ts util.tsx Chrome.tsx Captions.tsx Background.tsx VideoOverlays.tsx Outro.tsx Guides.tsx Grid.tsx SceneList.tsx Footage.tsx; do
    cp "$TPL/src/$f" "$R/src/$f"; done
  # Motifs: the shared per-engine components — always refreshed
  mkdir -p "$R/src/motifs"
  for f in "$(cd "$(dirname "$0")/../motifs/remotion" && pwd)"/*.tsx; do
    [ -f "$f" ] && cp "$f" "$R/src/motifs/"; done

  LOGO="$("${VEVO_PY[@]}" -c "import os,sys
sys.path.insert(0, os.path.join(os.environ['VEVO_SKILL_DIR'],'scripts'))
from lib import config as cfg
print(cfg.load('$W').get('theme',{}).get('logo','config/logo.png'))")"
  [ -f "$W/$LOGO" ] && cp "$W/$LOGO" "$R/public/logo.png"
  # config/images/*: whatever the image-card motif (scene.params.src) or an entry's
  # `overlay[]` (VideoOverlays.tsx) references — resolved into that folder by the
  # media-use skill, one file per image.
  if [ -d "$W/config/images" ]; then
    mkdir -p "$R/public/images"
    cp "$W/config/images/"* "$R/public/images/" 2>/dev/null || true
  fi
  "${VEVO_PY[@]}" "$VEVO_SKILL_DIR/scripts/render_data.py" "$W" "$R" || return 1
  # The source itself, uncut — Footage.tsx plays each kept span straight out of it. A hard
  # link, not a copy: a long recording is gigabytes, and every sync would duplicate it.
  SRC="$W/build/source-joined.mp4"
  [ -f "$SRC" ] || { echo "❌ no $SRC — run prepare_source.py first"; return 1; }
  if ! [ "$SRC" -ef "$R/public/video.mp4" ]; then
    rm -f "$R/public/video.mp4"
    ln "$SRC" "$R/public/video.mp4" 2>/dev/null || cp "$SRC" "$R/public/video.mp4"
  fi
  [ -f "$W/build/sound-effects.wav" ]  && cp "$W/build/sound-effects.wav"  "$R/public/sfx.wav"
  [ -f "$R/public/logo.png" ] || echo "⚠️  no logo found at $W — put config/logo.png (the video still renders, without the mark)"
  echo "✅ data and assets updated at $R"
}

# Every command that runs the toolchain needs node_modules. render / studio / still / check
# all install it on demand the first time — nothing depends on `setup` having run first.
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
    grep -q '"guides": true' "$R/src/timeline.json" && \
      echo "⚠️  Safe-zone guides are on — they'll be burned into the video. Set guides:false in config/project.config.json before delivery."
    ( cd "$R" && npx remotion render Ad "$OUT" --codec h264 --crf 21 --jpeg-quality 95 )
    echo "✅ $OUT"
    "$VEVO_FFPROBE" -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT" ;;
  still)
    # review stills at arbitrary times, without rendering the whole video.
    sync_all; ensure_deps
    shift 2 || true
    [ $# -gt 0 ] || { echo "usage: remotion.sh <work> still <seconds> [<seconds>...]"; exit 2; }
    FPS="$("${VEVO_PY[@]}" -c "import json,os;print(json.load(open(os.path.join('$R','src','timeline.json')))['fps'])" 2>/dev/null || echo 30)"
    mkdir -p "$W/build/prev"
    for T in "$@"; do
      F="$("${VEVO_PY[@]}" -c "print(int(round(float('$T')*$FPS)))")"
      ( cd "$R" && npx remotion still Ad "$W/build/prev/t$("${VEVO_PY[@]}" -c "print('%.2f' % float('$T'))").jpg"           --frame="$F" --image-format=jpeg --jpeg-quality=95 ) || exit 13
    done
    echo "✅ $# still(s) → $W/build/prev/" ;;
  check)
    # the type-checker IS the scene linter: it catches an undefined helper, a bad prop, or
    # a duplicate style key before a render.
    sync_all; ensure_deps
    ( cd "$R" && npm run --silent check ) && echo "✅ scenes type-check clean" ;;
  *) echo "Commands: setup | sync | studio | render | still | check"; exit 2 ;;
esac
