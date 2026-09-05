# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Cuts the silences + reframes to vertical 9:16 + a different zoom per segment +
optional color grade.
python3 reframe.py <workdir>

Works with any source:
- Vertical source (selfie ~9:16)  → passes through as-is (original behavior, unchanged)
- Landscape source (16:9 / camera) → a vertical 9:16 frame is cropped from the center before the zoom
project.config.json (optional): crop.xAnchor (0-1, horizontal · default 0.5) ·
crop.yAnchor (0-1, vertical · default 0.30) · grade (bool · default false)
"""
import json, subprocess, sys, os
from lib import config as _cfg, rush as _rush
W=os.path.abspath(sys.argv[1]); SRC=_rush.find_source(W)
os.makedirs(os.path.join(W,"build"),exist_ok=True)
k=json.load(open(os.path.join(W,"build","cut-plan.json")))["keep"]
_cfg_data=_cfg.load(W)
GRADE=_cfg_data.get("grade",False)
_crop=_cfg_data.get("crop",{})
XANCH=float(_crop.get("xAnchor",0.5)); YANCH=float(_crop.get("yAnchor",0.30))
Z=[1.00,1.08,1.00,1.06,1.00,1.12,1.04,1.14,1.00,1.08,1.00,1.05,1.10,1.00]
p=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
   "stream=width,height","-of","csv=p=0:s=x",SRC],capture_output=True,text=True).stdout.strip()
SW,SH=[int(x) for x in p.split("x")[:2]]
TARGET=9/16
# Base frame (z=1): the largest 9:16 rectangle that fits inside the source
if SW/SH > TARGET + 1e-3:          # landscape source → crop vertically
    BW,BH = int(SH*TARGET)//2*2, SH
    print(f"landscape source {SW}x{SH} → vertical frame {BW}x{BH} (anchor x={XANCH})")
elif SW/SH < TARGET - 1e-3:        # source narrower than 9:16? rare — crop horizontally
    BW,BH = SW, int(SW/TARGET)//2*2
    print(f"narrow source {SW}x{SH} → frame {BW}x{BH}")
else:                              # vertical ~9:16 → as-is (original behavior)
    BW,BH = SW, SH
fc=[];v=[];a=[]
for i,(s,e) in enumerate(k):
    z=Z[i%len(Z)]; cw=int(BW/z)//2*2; ch=int(BH/z)//2*2
    x=max(0,min(SW-cw,int((SW-cw)*XANCH))); y=max(0,min(SH-ch,int((SH-ch)*YANCH)))
    fc.append(f"[0:v]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS,crop={cw}:{ch}:{x}:{y},"
              f"scale=1080:1920:flags=lanczos,setsar=1[v{i}]")
    fc.append(f"[0:a]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS[a{i}]")
    v.append(f"[v{i}]"); a.append(f"[a{i}]")
fc.append("".join(v)+f"concat=n={len(k)}:v=1:a=0[vc]")
fc.append("".join(a)+f"concat=n={len(k)}:v=0:a=1[ac]")
# The color grade is entirely optional — off by default (the video keeps its original colors)
_g = ("eq=brightness=0.015:saturation=0.96:contrast=1.05,"
      "colorbalance=rs=0.02:gs=0.005:bs=-0.02,") if GRADE else ""
# iPhone HDR source arrives tagged bt2020/HLG — any browser that honors the tag renders it orange.
# setparams re-tags it to bt709 so the colors come out natural everywhere.
fc.append("[vc]fps=30," + _g +
          "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p[vo]")
print("color grade:", "on" if GRADE else "off (original colors)")
fc.append("[ac]afade=t=in:st=0:d=0.06,dynaudnorm=f=200:g=5:p=0.9[ao]")
sys.exit(subprocess.call(["ffmpeg","-v","error","-stats","-i",SRC,"-filter_complex",";".join(fc),
 "-map","[vo]","-map","[ao]","-c:v","libx264","-preset","medium","-crf","16",
 "-c:a","aac","-b:a","192k","-movflags","+faststart","-y",os.path.join(W,"build","video-reframed.mp4")]))
