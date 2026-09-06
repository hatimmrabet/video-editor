# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Remove any sentence from the video by deleting it from the transcript.

    python3 edit_script.py <work> show              # prints numbered sentences (and flags repeated ones)
    python3 edit_script.py <work> dupes             # repeated sentences only
    python3 edit_script.py <work> drop 3 7 12       # removes these sentences from the video
    python3 edit_script.py <work> keep 1 2 5 6      # keeps only these, removes the rest
    python3 edit_script.py <work> apply             # reads the edited transcript-editable.txt, drops whatever's missing
    python3 edit_script.py <work> undo              # restores the last edit
    (add --dry to any command: shows the result without changing anything)

The idea: the sentence removed from the transcript has its video+audio segment removed too,
and everything after it shifts back into place.
Edits: build/cut-plan.json (video segments) · build/captions.json (captions) ·
       build/sound-cues.json (sound-effect timings).
Afterward: rebuild the video ← reframe.py, then extract frames, then render.
"""
import json, os, sys, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import timeline   # shared with tighten.py

W = os.path.abspath(sys.argv[1])
CMD = sys.argv[2] if len(sys.argv) > 2 else "show"
DRY = "--dry" in sys.argv
ARGS = [a for a in sys.argv[3:] if not a.startswith("--")]
os.makedirs(os.path.join(W, "build"), exist_ok=True)
P = lambda n: os.path.join(W, n)
CUT, CAPS, SFX, SCRIPT = (os.path.join("build", "cut-plan.json"), os.path.join("build", "captions.json"),
                          os.path.join("build", "sound-cues.json"), os.path.join("build", "transcript-editable.txt"))
PAD_L, PAD_R, MIN_SEG = 0.08, 0.12, 0.20

def load(n): return json.load(open(P(n), encoding="utf-8"))
def save(n, d):
    if DRY: return
    if os.path.exists(P(n)):
        if not os.path.exists(P(n + ".orig")): shutil.copy(P(n), P(n + ".orig"))
        shutil.copy(P(n), P(n + ".bak"))
    json.dump(d, open(P(n), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


# ── repeated-sentence detection ─────────────────────────────────────────────
# When a speaker restates a sentence, the first is usually the mistake and the second the correction.
import re as _re, difflib
_STOP = {"في","من","على","الى","إلى","عن","مع","هذا","هذي","هذه","ذلك","اللي","الي",
         "و","او","أو","ثم","بس","يا","ان","أن","إن","ما","لا","كل","كان","صار","هو","هي"}
def _norm(w):
    w = _re.sub(r"[\u064B-\u0652\u0640]", "", w)          # strip diacritics and tatweel (elongation)
    w = w.replace("أ","ا").replace("إ","ا").replace("آ","ا").replace("ة","ه").replace("ى","ي")
    if len(w) > 4 and w.startswith("ال"): w = w[2:]
    return w
def _words(c): return [_norm(x["t"]) for x in c["w"]]
def _sim(a, b):
    """Similarity between two sentences: shared-word ratio (of the shorter) + character similarity"""
    wa, wb = [w for w in a if w not in _STOP], [w for w in b if w not in _STOP]
    if not wa or not wb: return 0.0
    shared = len(set(wa) & set(wb)) / min(len(wa), len(wb))
    chars  = difflib.SequenceMatcher(None, " ".join(a), " ".join(b)).ratio()
    return max(shared, chars)
def find_dupes(cards, win=2, th=0.60):
    out = []
    for i in range(len(cards) - 1):
        for j in range(i + 1, min(i + 1 + win, len(cards))):
            r = _sim(_words(cards[i]), _words(cards[j]))
            if r >= th: out.append((i, j, r)); break
    return out

caps = load(CAPS); cards = caps["cards"]
def line(i, c):
    txt = " ".join(w["t"] for w in c["w"])
    return f"{i+1:>3}  [{int(c['s']//60):02d}:{c['s']%60:05.2f}]  {txt}"

# ── show ──────────────────────────────────────────────────────────────────
if CMD == "show":
    body = ("# Delete any line you don't want in the video, save the file, then:  python3 edit_script.py <work> apply\n"
            "# (don't change the numbers — they're what ties a line to its segment)\n\n"
            + "\n".join(line(i, c) for i, c in enumerate(cards)) + "\n")
    if not DRY: open(P(SCRIPT), "w", encoding="utf-8").write(body)
    print(body)
    print(f"Current duration: {caps['total']:.2f}s · {len(cards)} sentences")
    d = find_dupes(cards)
    if d:
        print("\n🔁 Sentences that look repeated — the first is likely the mistake:")
        for i, j, r in d:
            print(f"   {i+1} ← {j+1}  (similarity {r*100:.0f}%)")
            print(f"      {i+1}: " + " ".join(w['t'] for w in cards[i]['w']))
            print(f"      {j+1}: " + " ".join(w['t'] for w in cards[j]['w']))
        print("   Suggestion: drop " + " ".join(str(i+1) for i,_,_ in d) + "   (show this to the user before doing it)")
    sys.exit(0)

if CMD == "dupes":
    d = find_dupes(cards)
    if not d: print("No repeated sentences."); sys.exit(0)
    for i, j, r in d:
        print(f"{i+1} ← {j+1}  (similarity {r*100:.0f}%)")
        print(f"   {i+1}: " + " ".join(w['t'] for w in cards[i]['w']))
        print(f"   {j+1}: " + " ".join(w['t'] for w in cards[j]['w']))
    print("\nTo drop the first of each pair:  drop " + " ".join(str(i+1) for i,_,_ in d))
    sys.exit(0)

if CMD == "undo":
    n = 0
    for f in (CUT, CAPS, SFX):
        if os.path.exists(P(f + ".bak")): shutil.copy(P(f + ".bak"), P(f)); n += 1
    print(f"↩️ Restored {n} file(s) to their last version." if n else "No previous version saved.")
    sys.exit(0)

# ── which sentences get removed? ──────────────────────────────────────────
if CMD == "drop":
    drop = {int(a) - 1 for a in ARGS}
elif CMD == "keep":
    keep_i = {int(a) - 1 for a in ARGS}
    drop = {i for i in range(len(cards)) if i not in keep_i}
elif CMD == "apply":
    if not os.path.exists(P(SCRIPT)): sys.exit("❌ no transcript-editable.txt — run show first")
    alive = set()
    for ln in open(P(SCRIPT), encoding="utf-8"):
        ln = ln.strip()
        if not ln or ln.startswith("#"): continue
        head = ln.split(None, 1)[0]
        if head.isdigit(): alive.add(int(head) - 1)
    drop = {i for i in range(len(cards)) if i not in alive}
else:
    sys.exit("Commands: show · dupes · drop · keep · apply · undo")

drop = {i for i in drop if 0 <= i < len(cards)}
if not drop: sys.exit("No sentence to remove — nothing changed.")
if len(drop) == len(cards): sys.exit("❌ This would remove the whole video — cancelled.")

# ── deletion intervals on the current timeline ────────────────────────────
iv = []
for i in sorted(drop):
    c = cards[i]
    a = max(0.0, c["w"][0]["s"] - PAD_L)
    b = min(caps["total"], c["w"][-1]["e"] + PAD_R)
    if i + 1 < len(cards):                       # don't eat into the next sentence's start
        b = min(b, cards[i + 1]["w"][0]["s"] - 0.02)
    if b > a: iv.append([a, b])
merged = timeline.merge(iv)
gone = sum(b - a for a, b in merged)
shift, inside = timeline.make_shift(merged)

print("About to remove:")
for i in sorted(drop): print("  ✂️ " + line(i, cards[i]).strip())
print(f"Duration: {caps['total']:.2f}s → {caps['total']-gone:.2f}s (‎-{gone:.2f})")
if DRY: sys.exit(0)

# ── 1) cut-plan.json: map the deletion intervals back to the original timeline ──
cut = load(CUT)
cut["keep"], cut["total"] = timeline.remap_keep(cut["keep"], merged, MIN_SEG)
save(CUT, cut)

# ── 2) captions.json: remove the sentences and shift the rest ────────────
new_cards = []
for i, c in enumerate(cards):
    if i in drop: continue
    ws = [{**w, "s": round(shift(w["s"]), 3), "e": round(shift(w["e"]), 3)} for w in c["w"]]
    new_cards.append({"s": round(shift(c["s"]), 3), "e": round(shift(c["e"]), 3), "w": ws})
for i in range(len(new_cards) - 1):              # cards must not overlap after the shift
    if new_cards[i]["e"] > new_cards[i + 1]["s"]:
        new_cards[i]["e"] = round(new_cards[i + 1]["s"] - 0.02, 3)
# final duration = the actual video length after the cut (not the theoretical calc), so no extra frame
new_total = round(min(caps["total"] - gone, cut["total"]), 3)
save(CAPS, {"total": new_total, "cards": new_cards})

# ── 3) sound-cues.json: sound-effect timings ──────────────────────────────
if os.path.exists(P(SFX)):
    sfx = load(SFX); moved = 0; killed = 0
    for k, v in list(sfx.items()):
        if not isinstance(v, list): continue
        out = []
        for t in v:
            if inside(t): killed += 1
            else: out.append(round(shift(t), 3)); moved += 1
        sfx[k] = out
    save(SFX, sfx)
    print(f"Sound effects: {moved} shifted · {killed} removed")

print(f"""
✅ Done. Now rebuild the video:
   python3 scripts/reframe.py {W}
   mkdir -p {W}/build/frames-source && ffmpeg -v error -i {W}/build/video-reframed.mp4 -vf fps=30 -q:v 3 -y {W}/build/frames-source/%05d.jpg
   node scripts/render_frames.js {W} all --force     (or remotion/remotion.sh {W} render)
⚠️ If you already designed scenes with hardcoded timestamps — they've shifted, review them.
↩️ To undo: python3 scripts/edit_script.py {W} undo""")
