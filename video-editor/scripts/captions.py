# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Builds caption timings on the new (post-cut) timeline.  python3 captions.py <workdir>
Reads: build/cut-plan.json · build/transcript-raw.json (Whisper) · build/transcript-fixes.json
  ← {"fix":[[words of sentence 0],...], "hot":[highlighted words]}

`fix` has ONE entry per Whisper segment (that structure must match). The word count within
a sentence does NOT have to match Whisper's: when Claude reformulates a garbled sentence
(SKILL.md step 5) the wording changes. If the counts match, each word keeps Whisper's own
timing; if they differ, the corrected words are spread across the sentence's span
(weighted by length) — Whisper's per-sentence start/end stays reliable even in darija, so
the drift is contained to that sentence.
"""
import json, sys, os
W=os.path.abspath(sys.argv[1])
os.makedirs(os.path.join(W,"build"),exist_ok=True)
keep=json.load(open(os.path.join(W,"build","cut-plan.json")))["keep"]
tr=json.load(open(os.path.join(W,"build","transcript-raw.json")))
fx=json.load(open(os.path.join(W,"build","transcript-fixes.json")))
FIX, HOT = fx["fix"], set(fx.get("hot",[]))

SEGS=tr["segments"]
if len(FIX)!=len(SEGS):
    sys.exit(f"❌ transcript-fixes.json has {len(FIX)} sentence(s), Whisper has {len(SEGS)} — "
             f"one `fix` entry per Whisper segment (reword inside a sentence, don't merge or split entries)")

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

def spread(f, t0, t1):
    """Distribute the tokens of `f` across [t0,t1], weighted by token length, tiny gap between."""
    t1=max(t1, t0+0.12*len(f))
    wgt=[max(1,len(str(x))) for x in f]; tot=sum(wgt)
    gap=min(0.04, (t1-t0)/max(1,len(f))/4)
    span=(t1-t0)-gap*max(0,len(f)-1)
    out=[]; c=t0
    for x,g in zip(f,wgt):
        d=span*g/tot
        out.append((x, c, c+d)); c+=d+gap
    return out

cards=[]
for i,seg in enumerate(SEGS):
    ws=seg.get("words",[]); f=FIX[i]
    if not f: continue
    if ws:
        w0,w1=ws[0]["start"],ws[-1]["end"]
    else:
        w0,w1=seg.get("start",0.0),seg.get("end",0.0)
    si=seg_of((w0+w1)/2)
    o=[]
    if len(ws)==len(f) and ws:
        for w,txt in zip(ws,f):
            s,e=newt(w["start"],si),newt(w["end"],si)
            if e<=s: e=s+0.12
            o.append({"t":txt,"s":round(s,3),"e":round(e,3),"hot":txt in HOT})
    else:
        for txt,s,e in spread(f, newt(w0,si), newt(w1,si)):
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
