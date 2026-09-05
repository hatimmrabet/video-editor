#!/bin/bash
# ./encode.sh <workdir> [filename]   → muxes the frames + audio + sound effects
set -e
. "$(dirname "$0")/lib/platform.sh"
W="$(vevo_abspath "$1")"; OUT="${2:-$W/build/video-raw.mp4}"
mkdir -p "$(dirname "$OUT")"
DUR=$("${VEVO_PY[@]}" -c "import json;c=json.load(open('$W/build/captions.json'));s=json.load(open('$W/build/sound-cues.json'));print(round(c['total']+s['outro'],3))")
FADE=$("${VEVO_PY[@]}" -c "print(round($DUR-0.6,3))")
ffmpeg -v error -stats -framerate 30 -i "$W/build/frames-composited/%05d.jpg" -i "$W/build/video-reframed.mp4" -i "$W/build/sound-effects.wav" \
 -filter_complex "[0:v]format=yuv420p[vo];[1:a]apad=pad_dur=8[a0];[a0][2:a]amix=inputs=2:duration=first:normalize=0[am];[am]atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=out:st=$FADE:d=0.6[ao]" \
 -map "[vo]" -map "[ao]" -c:v libx264 -preset slow -crf 21 -maxrate 6M -bufsize 12M \
 -profile:v high -level 4.0 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 \
 -movflags +faststart -y "$OUT"
echo "✅ $OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT"
