# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Synthesises the sound-effect bed: <work>/build/sound-effects.wav.

    uv run scripts/sound_fx.py <work>

Reads : <work>/timeline.json - each entry's `sfx` list, plus `outro.seconds`
Writes: <work>/build/sound-effects.wav (48 kHz, 16-bit, stereo, VEND + outro long)

A cue is authored on its own segment, and always plays at that segment's own start:

    { "source": "0:14.0-0:16.3", "text": "...", "sfx": ["WHOOSH_UP"] }

so it stays glued to the sentence it punctuates no matter what gets cut elsewhere. A cue
mid-sentence means splitting the sentence there first (`cut_entries.py split`), not an offset
inside this list. This script places every segment's cues on the output clock and mixes them.

Which cues exist, what each one is for and how it is synthesised is the business of the sounds/
package — one file per cue, named after its keyword. An unknown cue stops the run with the list of
accepted ones; nothing is ever skipped silently.

Exit: 0 done · 1 an entry names a cue that does not exist.

Keep it under ~15 events per minute: past that it stops reading as punctuation and starts reading
as noise (this script warns).
"""
import os
import sys
import wave

import numpy as np

import sounds
from lib import timeline as tl
from sounds import dsp

CEILING = 0.95          # the mix is clipped here, well short of full scale


def main(argv):
    work = os.path.abspath(argv[1])
    t = tl.load(work)
    vend = tl.duration(t)
    outro = float((t.get("outro") or {}).get("seconds", 5.0))

    placed, wrong = {}, []
    for i, seg in enumerate(tl.segments(t), 1):
        at = tl.out_start(t, seg)
        for cue in seg.get("sfx") or []:
            why = sounds.problem(cue)
            if why:
                wrong.append("line %d: sfx %s" % (i, why))
                continue
            if at is not None:
                placed.setdefault(cue, []).append(at)
    if wrong:
        for w in wrong:
            print("  ! " + w)
        return 1

    n = int((vend + outro) * dsp.SR) + dsp.SR
    bed = np.zeros(n)
    for cue, times in placed.items():
        cue_module = sounds.CUES[cue]
        signal = cue_module.render()
        for at in times:
            i = max(0, int(at * dsp.SR))
            j = min(n, i + len(signal))
            bed[i:j] += signal[:j - i] * cue_module.GAIN
    bed = np.clip(bed, -CEILING, CEILING)

    pcm = (bed * 32767).astype("<i2")
    stereo = np.repeat(pcm[:, None], 2, axis=1).ravel()
    os.makedirs(os.path.join(work, "build"), exist_ok=True)
    with wave.open(os.path.join(work, "build", "sound-effects.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(dsp.SR)
        w.writeframes(stereo.tobytes())

    count = sum(len(v) for v in placed.values())
    print("sfx ok  %d cue(s)  peak %.3f  dur %.2fs" % (count, float(np.max(np.abs(bed))), len(pcm) / dsp.SR))
    if vend and count / (vend / 60.0) > 15:
        print("  ! %.0f events/min - past ~15 it reads as noise, not punctuation" % (count / (vend / 60.0)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
