# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Cuts the silences + reframes to the output aspect + a different zoom per segment +
optional color grade.
python3 reframe.py <workdir>

Output aspect follows project.config.json `format`:
- "short" (default) → vertical 9:16 (1080x1920). A landscape source is centre-cropped to 9:16.
- "long"            → horizontal 16:9 (1920x1080), the long-form / YouTube world. A landscape
                       source passes through; a vertical source is centre-cropped to 16:9.
In both cases the source resolves through lib/rush (long-form: build/source-joined.mp4).
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
LONG=_cfg_data.get("format")=="long"          # long-form / YouTube → 16:9 instead of 9:16
OW,OH = (1920,1080) if LONG else (1080,1920)
_crop=_cfg_data.get("crop",{})
XANCH=float(_crop.get("xAnchor",0.5)); YANCH=float(_crop.get("yAnchor",0.30))
Z=[1.00,1.08,1.00,1.06,1.00,1.12,1.04,1.14,1.00,1.08,1.00,1.05,1.10,1.00]
p=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
   "stream=width,height","-of","csv=p=0:s=x",SRC],capture_output=True,text=True).stdout.strip()
SW,SH=[int(x) for x in p.split("x")[:2]]
TARGET=OW/OH
# Base frame (z=1): the largest TARGET-ratio rectangle that fits inside the source
if SW/SH > TARGET + 1e-3:          # source wider than target → crop the sides
    BW,BH = int(SH*TARGET)//2*2, SH
    print(f"source {SW}x{SH} → {BW}x{BH} crop (anchor x={XANCH})")
elif SW/SH < TARGET - 1e-3:        # source taller than target → crop top/bottom
    BW,BH = SW, int(SW/TARGET)//2*2
    print(f"source {SW}x{SH} → {BW}x{BH} crop (anchor y={YANCH})")
else:                              # already the target aspect → pass through
    BW,BH = SW, SH
print(f"output: {OW}x{OH} ({'16:9 long-form' if LONG else '9:16'})")
fc=[];v=[];a=[]
for i,(s,e) in enumerate(k):
    z=Z[i%len(Z)]; cw=int(BW/z)//2*2; ch=int(BH/z)//2*2
    x=max(0,min(SW-cw,int((SW-cw)*XANCH))); y=max(0,min(SH-ch,int((SH-ch)*YANCH)))
    fc.append(f"[0:v]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS,crop={cw}:{ch}:{x}:{y},"
              f"scale={OW}:{OH}:flags=lanczos,setsar=1[v{i}]")
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
print(f"{len(k)} segment(s) → {os.path.join(W,'build','video-reframed.mp4')}")
graph=";".join(fc)
cmd=["ffmpeg","-v","error","-stats","-i",SRC,"-filter_complex",graph,
     "-map","[vo]","-map","[ao]","-c:v","libx264","-preset","medium","-crf","16",
     "-c:a","aac","-b:a","192k","-movflags","+faststart","-y",os.path.join(W,"build","video-reframed.mp4")]
# A long-form video tightened to many jump-cut segments makes a big filter graph; if it
# ever overruns the OS argument limit, ffmpeg's `/`-prefix reads the graph from a file.
if len(graph) > 90000:
    _fcs=os.path.join(W,"build",".reframe-filters.txt")
    open(_fcs,"w",encoding="utf-8").write(graph)
    cmd[cmd.index(graph)]="/"+_fcs
sys.exit(subprocess.call(cmd))
