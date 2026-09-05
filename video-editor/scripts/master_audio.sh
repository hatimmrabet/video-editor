#!/bin/bash
# ═══ Loudness calibration to the platform standard + optional background audio, auto-ducked ═══
#   ./master_audio.sh <work> <in.mp4> [out.mp4]
# • Calibration: -14 LUFS (the same loudness as the other videos in the feed — without it your audio comes out quieter)
# • Background audio: only kicks in if <work>/rush/bg-audio.mp3|m4a|wav exists (or BG=path),
#   and lowers automatically whenever you speak (sidechain) so it doesn't compete with your voice.
#   ⛔ We don't use music — the intent is a background audio file (human voices, ambience, room tone).
# • The video stream is copied as-is — no re-encode, no quality loss.
# Variables: BG · BG_GAIN (0.28) · LUFS (-14) · NO_LOUDNORM=1
set -e
. "$(dirname "$0")/lib/platform.sh"
W="$(vevo_abspath "$1")"; IN="$2"; OUT="${3:-${IN%.mp4}-master.mp4}"
[ -f "$IN" ] || { echo "❌ couldn't find $IN"; exit 2; }
G="${BG_GAIN:-${MUSIC_GAIN:-0.28}}"; I="${LUFS:--14}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FO=$("${VEVO_PY[@]}" -c "print(max(0,round($DUR-1.4,3)))")

MUS="${BG:-$MUSIC}"
if [ -z "$MUS" ]; then for n in bg-audio bg sound music; do for e in mp3 m4a wav aac; do
  [ -f "$W/rush/$n.$e" ] && MUS="$W/rush/$n.$e" && break 2; done; done; fi

mkdir -p "$W/build"
MIX="$W/build/.master-mix.wav"; NRM="$W/build/.master-norm.wav"
if [ -n "$MUS" ]; then
  echo "🔊 background audio: $(basename "$MUS")  (level $G · lowers while you speak)"
  ffmpeg -v error -stats -i "$IN" -stream_loop -1 -i "$MUS" -filter_complex \
   "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=2[v0][sc];\
    [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=$G,atrim=0:$DUR,asetpts=N/SR/TB,\
    afade=t=in:st=0:d=1.0,afade=t=out:st=$FO:d=1.4[m];\
    [m][sc]sidechaincompress=threshold=0.035:ratio=9:attack=8:release=320[md];\
    [v0][md]amix=inputs=2:duration=first:normalize=0[a]" \
   -map "[a]" -ac 2 -ar 48000 -y "$MIX"
else
  echo "🔊 no background audio (put rush/bg-audio.mp3 if you want one)"
  ffmpeg -v error -i "$IN" -vn -ac 2 -ar 48000 -y "$MIX"
fi

if [ "$NO_LOUDNORM" = "1" ]; then cp "$MIX" "$NRM"; echo "⏭  Calibration skipped";
else
  echo "📏 Measuring loudness…"
  M=$(ffmpeg -hide_banner -nostats -v info -i "$MIX" -af "loudnorm=I=$I:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | \
      "${VEVO_PY[@]}" -c "import sys,json,re;s=sys.stdin.read();m=re.findall(r'\{[^{}]*input_i[^{}]*\}',s,re.S);print(json.dumps(json.loads(m[-1])) if m else '')")
  if [ -z "$M" ]; then echo "⚠️  Couldn't measure — calibrating in a single pass";
    ffmpeg -v error -stats -i "$MIX" -af "loudnorm=I=$I:TP=-1.5:LRA=11" -ar 48000 -y "$NRM"
  else
    read -r II TP LRA TH < <("${VEVO_PY[@]}" -c "
import json,sys;d=json.loads('''$M''');print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'])")
    # A silent track (a montage with no background audio) measures -inf, and loudnorm rejects it and halts the whole pipeline.
    if "${VEVO_PY[@]}" -c "import sys;v=float('$II');sys.exit(0 if v!=v or v<-70 else 1)" 2>/dev/null; then
      echo "🔇 Audio track is silent — calibration skipped (put rush/bg-audio.mp3 if you want sound)."
      cp "$MIX" "$NRM"
    else
      echo "   before: $II LUFS → after: $I LUFS"
      ffmpeg -v error -stats -i "$MIX" -af \
       "loudnorm=I=$I:TP=-1.5:LRA=11:measured_I=$II:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:linear=true" \
       -ar 48000 -y "$NRM"
    fi
  fi
fi

ffmpeg -v error -stats -i "$IN" -i "$NRM" -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -y "$OUT"
rm -f "$MIX" "$NRM"
echo "✅ $OUT"
ffmpeg -hide_banner -nostats -v info -i "$OUT" -af "loudnorm=I=$I:TP=-1.5:print_format=summary" -f null - 2>&1 | grep -E "Input Integrated|Input True Peak" || true
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
