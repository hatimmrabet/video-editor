#!/bin/bash
# Contact sheet: gathers several shots into one image — Claude reads it in one go instead
# of ten separate reads (a big token saving).
# ./contact_sheet.sh <workdir> <sheet.jpg> <t1> <t2> ...
#   Source: SRC=<file.mp4> if given · else build/video-raw.mp4 · else the build/prev/ folder
# ⚠️ The timestamp label is drawn with Python (PIL) because many ffmpeg builds ship without
#    drawtext — and without a label the sheet becomes a riddle: you see shots and don't know
#    which moment each one is.
set -e
. "$(dirname "$0")/lib/platform.sh"
W="$(vevo_abspath "$1")"; OUT="$2"; shift 2
mkdir -p "$W/build"
TMP="$W/build/.sheet"; rm -rf "$TMP"; mkdir -p "$TMP"; i=0; IN=""
for t in "$@"; do
  i=$((i+1)); f="$TMP/$(printf %02d $i).jpg"
  V="${SRC:-$W/build/video-raw.mp4}"
  if [ -f "$V" ]; then ffmpeg -v error -ss "$t" -i "$V" -frames:v 1 -vf "scale=300:-1" -y "$f"
  else ffmpeg -v error -i "$W/build/prev/t$(printf %.2f $t).jpg" -vf "scale=300:-1" -y "$f"; fi
  IN="$IN -i $f"
done

if "${VEVO_PY[@]}" - "$OUT" "$TMP" "$@" <<'PY' 2>/dev/null
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
out, tmp = sys.argv[1], sys.argv[2]; times = sys.argv[3:]
fs = sorted(glob.glob(os.path.join(tmp, "*.jpg")))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
sheet = Image.new("RGB", (w * len(ims), h), (17, 17, 17))
dr = ImageDraw.Draw(sheet)
fnt = None
for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf"):
    if os.path.exists(p):
        fnt = ImageFont.truetype(p, 22); break
if fnt is None:
    try: fnt = ImageFont.load_default(size=22)
    except TypeError: fnt = ImageFont.load_default()
for k, im in enumerate(ims):
    sheet.paste(im, (k * w, 0))
    lbl = f"{times[k]}s" if k < len(times) else ""
    dr.rectangle([k * w + 5, 5, k * w + 22 + 12 * len(lbl), 34], fill=(0, 0, 0))
    dr.text((k * w + 12, 9), lbl, fill=(255, 255, 255), font=fnt)
sheet.save(out, quality=88)
PY
then echo "✅ $OUT  ($i shot(s) · timestamp on each one)"
else
  ffmpeg -v error $IN -filter_complex "hstack=inputs=$i" -y "$OUT"
  echo "✅ $OUT  ($i shot(s) · no label — order from the left: $*)"
fi
rm -rf "$TMP"
