# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Builds caption timings on the new (post-cut) timeline.  python3 captions.py <workdir>
Reads: build/cut-plan.json · build/transcript-raw.json (Whisper) · build/transcript-fixes.json
  ← {"fix":[[words of sentence 0],...], "hot":[highlighted words]}
The word count of each sentence in fix must equal Whisper's word count for that sentence
(so the timings stay accurate)."""
import json, sys, os
W=os.path.abspath(sys.argv[1])
os.makedirs(os.path.join(W,"build"),exist_ok=True)
keep=json.load(open(os.path.join(W,"build","cut-plan.json")))["keep"]
tr=json.load(open(os.path.join(W,"build","transcript-raw.json")))
fx=json.load(open(os.path.join(W,"build","transcript-fixes.json")))
FIX, HOT = fx["fix"], set(fx.get("hot",[]))

def seg_of(t):
    best,bd=0,1e9
    for i,(a,b) in enumerate(keep):
        if a<=t<=b: return i
        d=min(abs(t-a),abs(t-b))
        if d<bd: bd,best=d,i
    return best
off=[];acc=0.0
for a,b in keep: off.append(acc); acc+=b-a
def newt(t,si):
    a,b=keep[si]; return off[si]+(max(a,min(b,t))-a)

cards=[]
for i,seg in enumerate(tr["segments"]):
    ws=seg.get("words",[]); f=FIX[i]
    if len(ws)!=len(f):
        sys.exit(f"❌ sentence {i}: Whisper has {len(ws)} words, transcript-fixes.json has {len(f)} — they must match")
    si=seg_of((ws[0]["start"]+ws[-1]["end"])/2)
    o=[]
    for w,txt in zip(ws,f):
        s,e=newt(w["start"],si),newt(w["end"],si)
        if e<=s: e=s+0.12
        o.append({"t":txt,"s":round(s,3),"e":round(e,3),"hot":txt in HOT})
    a,b=keep[si]
    cs=max(o[0]["s"]-0.10, off[si])
    ce=min(max(x["e"] for x in o)+0.28, off[si]+(b-a))
    cards.append({"s":round(cs,3),"e":round(ce,3),"w":o})
for i in range(len(cards)-1):
    if cards[i]["e"]>cards[i+1]["s"]: cards[i]["e"]=round(cards[i+1]["s"]-0.02,3)
json.dump({"total":round(acc,3),"cards":cards},open(os.path.join(W,"build","captions.json"),"w"),ensure_ascii=False,indent=1)
print("cards:",len(cards)," duration:",round(acc,2))
for c in cards: print(f"{c['s']:6.2f}-{c['e']:6.2f}  "+" ".join(x['t'] for x in c['w']))
