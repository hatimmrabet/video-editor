# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Applies the montage: trims and concatenates the kept pieces, with a zoom per sentence
and an optional color grade.

    uv run scripts/reframe.py <work>

**The output keeps the source's orientation and size.** A vertical recording gives a
vertical video, a horizontal one gives a horizontal video — there is no `format` setting
and nothing is ever centre-cropped to a different aspect. The dimensions are read off the
source (rounded to even numbers, which h264 requires); the per-segment zoom crops inside
that frame, anchored by crop.xAnchor / crop.yAnchor.

The source resolves through lib/rush — build/source-joined.mp4, written by join_takes.py.
The pieces to keep come from <work>/timeline.json via lib/timeline.program() (issue #144).

ZOOM IS PER ENTRY, not per cut. An entry may state its own `video.zoom` and `video.anchor`;
whatever it does not state falls back to the Z cycle below, indexed by the entry's position
— so a project that has authored nothing still gets the same restless framing it always
did, and one that has authored a zoom gets exactly that.

project.config.json (optional): crop.xAnchor (0-1, horizontal · default 0.5) ·
crop.yAnchor (0-1, vertical · default 0.30) · grade (bool · default false)
"""
import json, subprocess, sys, os
from lib import config as _cfg, rush as _rush, platform as _plat, timeline as _tl
W=os.path.abspath(sys.argv[1]); SRC=_rush.find_source(W)
os.makedirs(os.path.join(W,"build"),exist_ok=True)
_T=_tl.load(W)
_PROG=_tl.program(_T)
if not _PROG: sys.exit("[X] the timeline has nothing to render - every entry is cut or empty")
_ORDER={e["id"]:i for i,e in enumerate(_tl.entries(_T))}
_DEF=(_T.get("defaults") or {}).get("video") or {}
_cfg_data=_cfg.load(W)
GRADE=_cfg_data.get("grade",False)
_crop=_cfg_data.get("crop",{})
XANCH=float(_crop.get("xAnchor",0.5)); YANCH=float(_crop.get("yAnchor",0.30))
Z=[1.00,1.08,1.00,1.06,1.00,1.12,1.04,1.14,1.00,1.08,1.00,1.05,1.10,1.00]
p=subprocess.run([_plat.FFPROBE,"-v","error","-select_streams","v:0","-show_entries",
   "stream=width,height","-of","csv=p=0:s=x",SRC],capture_output=True,text=True).stdout.strip()
SW,SH=[int(x) for x in p.split("x")[:2]]
# The output IS the source frame — only rounded down to even numbers for h264. No aspect
# conversion: the orientation the creator shot in is the orientation they get.
OW,OH = SW//2*2, SH//2*2
BW,BH = OW,OH
_ratio = "9:16" if OH > OW else ("16:9" if OW > OH else "1:1")
print(f"output: {OW}x{OH} ({_ratio}, from the source — no reframing)")
fc=[];v=[];a=[]
for i,piece in enumerate(_PROG):
    s,e=piece["src"]
    _e=_tl.by_id(_T,piece["entry"]) or {}
    _vid={**_DEF, **((_e.get("video") or {}))}
    z=float(_vid.get("zoom") or Z[_ORDER.get(piece["entry"],i)%len(Z)])
    _anc=_vid.get("anchor") or [XANCH,YANCH]
    xa,ya=float(_anc[0]),float(_anc[1])
    cw=int(BW/z)//2*2; ch=int(BH/z)//2*2
    x=max(0,min(SW-cw,int((SW-cw)*xa))); y=max(0,min(SH-ch,int((SH-ch)*ya)))
    fc.append(f"[0:v]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS,crop={cw}:{ch}:{x}:{y},"
              f"scale={OW}:{OH}:flags=lanczos,setsar=1[v{i}]")
    fc.append(f"[0:a]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS[a{i}]")
    v.append(f"[v{i}]"); a.append(f"[a{i}]")
fc.append("".join(v)+f"concat=n={len(_PROG)}:v=1:a=0[vc]")
fc.append("".join(a)+f"concat=n={len(_PROG)}:v=0:a=1[ac]")
# The color grade is entirely optional — off by default (the video keeps its original colors)
_g = ("eq=brightness=0.015:saturation=0.96:contrast=1.05,"
      "colorbalance=rs=0.02:gs=0.005:bs=-0.02,") if GRADE else ""
# iPhone HDR source arrives tagged bt2020/HLG — any browser that honors the tag renders it orange.
# setparams re-tags it to bt709 so the colors come out natural everywhere.
fc.append("[vc]fps=30," + _g +
          "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p[vo]")
print("color grade:", "on" if GRADE else "off (original colors)")
fc.append("[ac]afade=t=in:st=0:d=0.06,dynaudnorm=f=200:g=5:p=0.9[ao]")
print(f"{len(_PROG)} piece(s) from {len(_tl.entries(_T))} sentence(s) → {os.path.join(W,'build','video-reframed.mp4')}  ({_tl.duration(_T):.2f}s)")
graph=";".join(fc)
cmd=[_plat.FFMPEG,"-v","error","-stats","-i",SRC,"-filter_complex",graph,
     "-map","[vo]","-map","[ao]","-c:v","libx264","-preset","medium","-crf","16",
     "-c:a","aac","-b:a","192k","-movflags","+faststart","-y",os.path.join(W,"build","video-reframed.mp4")]
# A long recording tightened to many jump-cut segments makes a big filter graph; if it
# ever overruns the OS argument limit, ffmpeg's `/`-prefix reads the graph from a file.
if len(graph) > 90000:
    _fcs=os.path.join(W,"build",".reframe-filters.txt")
    open(_fcs,"w",encoding="utf-8").write(graph)
    cmd[cmd.index(graph)]="/"+_fcs
sys.exit(subprocess.call(cmd))
