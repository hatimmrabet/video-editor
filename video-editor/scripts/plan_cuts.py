# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Cut plan: measures the silences in the audio and produces the speech segments.

    python3 plan_cuts.py <workdir>

Reads : the rush source (via lib/rush) · <work>/config/project.config.json (optional `cut` block)
Writes: <work>/build/cut-plan.json  = {"keep":[[a,b],...], "total":s, "src_dur":s}

`cut` config (all optional, defaults in brackets):
  noiseDb     [-32]   silencedetect threshold in dB — lower keeps more quiet tails, higher cuts harder
  minSilence  [0.35]  a gap must be at least this long (s) to be removed
  merge       [0.20]  speech segments closer than this (s) are joined
  padIn       [0.22]  lead-in kept before each segment (s) — a bit of air so the cut is not abrupt
  padOut      [0.10]  tail kept after each segment (s) — short, no dead time between sentences

The pad is deliberately asymmetric (more before, less after). The cut-in point still lands
wherever the speech starts, blur and all — settle_check.py nudges it to a clean frame next.
"""
import subprocess, re, json, sys, os
from lib import rush, platform as _plat, config as _cfg
W = os.path.abspath(sys.argv[1]); SRC = rush.find_source(W)
os.makedirs(os.path.join(W, "build"), exist_ok=True)

_c = _cfg.load(W).get("cut", {}) or {}
NOISE = f"{float(_c.get('noiseDb', -32))}dB"
MIND = float(_c.get("minSilence", 0.35))
MERGE = float(_c.get("merge", 0.20))
PAD_IN = float(_c.get("padIn", 0.22))
PAD_OUT = float(_c.get("padOut", 0.10))

dur = float(subprocess.run([_plat.FFPROBE,"-v","error","-show_entries","format=duration",
    "-of","csv=p=0", SRC], capture_output=True, text=True).stdout.strip())
out = subprocess.run([_plat.FFMPEG,"-hide_banner","-nostats","-i",SRC,"-af",
    f"silencedetect=noise={NOISE}:d={MIND}","-f","null","-"], capture_output=True, text=True).stderr

sil=[]; s=None
for mm in re.finditer(r"silence_(start|end): ([0-9.]+)", out):
    k,v = mm.group(1), float(mm.group(2))
    if k=="start": s=v
    else:
        sil.append(((0.0 if s is None else s), v)); s=None
if s is not None: sil.append((s,dur))

keep=[]; cur=0.0
for a,b in sil:
    if a-cur>0.01: keep.append([cur,a])
    cur=b
if dur-cur>0.01: keep.append([cur,dur])
keep=[[max(0,a-PAD_IN),min(dur,b+PAD_OUT)] for a,b in keep]
m=[]
for seg in keep:
    if m and seg[0]-m[-1][1]<MERGE: m[-1][1]=seg[1]
    else: m.append(seg)
m=[x for x in m if x[1]-x[0]>=0.30]
tot=sum(b-a for a,b in m)
json.dump({"keep":m,"total":tot,"src_dur":dur}, open(os.path.join(W,"build","cut-plan.json"),"w"), indent=1)
print(f"noise={NOISE} minSilence={MIND}s padIn={PAD_IN}s padOut={PAD_OUT}s")
print(f"segments={len(m)}  kept={tot:.2f}s  removed={dur-tot:.2f}s ({(dur-tot)/dur*100:.0f}%)")
for a,b in m: print(f"  {a:7.2f} -> {b:7.2f}  ({b-a:5.2f}s)")
