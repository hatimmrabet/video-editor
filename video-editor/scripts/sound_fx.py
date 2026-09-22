import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Synthesises the sound-effect bed: <work>/build/sound-effects.wav.

    uv run scripts/sound_fx.py <work>

Reads : <work>/timeline.json - each entry's `sfx` list, plus `outro.seconds`
Writes: <work>/build/sound-effects.wav (48 kHz, 16-bit, stereo, VEND + outro long)

A cue is authored on its own entry, at a time RELATIVE to that entry:

    {"id": "e014", ..., "sfx": [{"cue": "whoosh_up", "at": 0.0}]}

so it stays glued to the sentence it punctuates no matter what gets cut elsewhere. This
script projects those onto the output clock and renders them.

Four cues, all synthesised here with numpy - no sample files, no dependency:
  whoosh_up / whoosh_down   filtered noise sweep, for a scene entering or leaving
  thud                      pitch-dropping sine + click, for an arrival
  tap                       short filtered click, for a beat

Keep it under ~15 events/min: past that it stops reading as punctuation and starts
reading as noise.
"""
import wave,numpy as np
import sys, os
S=os.path.abspath(sys.argv[1])+"/"
os.makedirs(S+"build",exist_ok=True)
from lib import timeline as tl
SR=48000
_t=tl.load(os.path.abspath(sys.argv[1]))
VEND=tl.duration(_t); OUTRO=float((_t.get("outro") or {}).get("seconds", 5.0)); DUR=VEND+OUTRO

# every cue, projected from its entry onto the output clock
_cues={}
for _e in tl.entries(_t):
    for _c in _e.get("sfx") or []:
        _at=tl.project_rel(_t,_e,float(_c.get("at",0.0)))
        if _at is not None:
            _cues.setdefault(str(_c.get("cue","")),[]).append(_at)
n=int(DUR*SR)+SR
buf=np.zeros(n)
rng=np.random.RandomState(11)
def add(sig,t0,g=1.0):
    i=max(0,int(t0*SR)); j=min(n,i+len(sig)); buf[i:j]+=sig[:j-i]*g
def lp(x,a0,a1):
    y=np.empty_like(x); z=0.0
    for i in range(len(x)):
        a=a0+(a1-a0)*(i/len(x)); z+=a*(x[i]-z); y[i]=z
    return y
def whoosh(dur=0.34,up=True):
    L=int(dur*SR); t=np.arange(L)/SR
    x=rng.randn(L)
    y=lp(x,0.03,0.30) if up else lp(x,0.30,0.03)
    y/= (np.max(np.abs(y))+1e-9)
    env=np.sin(np.pi*np.clip(t/dur,0,1))**1.6
    return y*env
def thud(f0=135,f1=58,dur=0.30):
    L=int(dur*SR); t=np.arange(L)/SR
    f=f0*np.exp(np.log(f1/f0)*t/dur)
    ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-t/0.085)
    s+=lp(rng.randn(L),0.35,0.05)*np.exp(-t/0.006)*0.35
    return s/ (np.max(np.abs(s))+1e-9)
def tap(dur=0.09):
    L=int(dur*SR); t=np.arange(L)/SR
    s=lp(rng.randn(L),0.22,0.05)*np.exp(-t/0.013)
    s*=np.minimum(1.0,t/0.0012)
    return s/(np.max(np.abs(s))+1e-9)

W1=whoosh(0.34,True); W2=whoosh(0.30,False); TH=thud(); TP=tap()
for t0 in _cues.get("whoosh_up",[]):   add(W1,t0,0.085)
for t0 in _cues.get("whoosh_down",[]): add(W2,t0,0.075)
for t0 in _cues.get("thud",[]):        add(TH,t0,0.115)
for t0 in _cues.get("tap",[]):         add(TP,t0,0.075)
buf=np.clip(buf,-0.95,0.95)
pcm=(buf*32767).astype('<i2')
st=np.repeat(pcm[:,None],2,axis=1).ravel()
w=wave.open(S+"build/sound-effects.wav","wb");w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
w.writeframes(st.tobytes());w.close()
_n=sum(len(v) for v in _cues.values())
print("sfx ok  %d cue(s)  peak %.3f  dur %.2fs"%(_n,float(np.max(np.abs(buf))),len(pcm)/SR))
if VEND and _n/(VEND/60.0)>15: print("  ! %.0f events/min - past ~15 it reads as noise, not punctuation"%(_n/(VEND/60.0)))
