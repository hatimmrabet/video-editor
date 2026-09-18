# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Measures where the speaker is silent. A MEASUREMENT, not a decision (issue #144).

    uv run scripts/find_silences.py <workdir>

Reads : the rush source (via lib/rush) · <work>/config/project.config.json (`cut` block)
Writes: <work>/build/silences.json

    {"source": "...", "duration": 612.4,
     "detect": {"noiseDb": -32, "minSilence": 0.35},
     "silences": [[0.0, 1.842], [12.31, 13.08], ...]}      # absolute source seconds

This file is never edited by anything, which is why it can sit outside timeline.json
without becoming a second source of truth: nothing can make it disagree with the montage,
and the montage can always be rebuilt from it. build_timeline.py turns it into entries.

WHAT BELONGS HERE AND WHAT DOES NOT. `noiseDb` and `minSilence` shape the measurement
itself — what counts as silence — so they live here and are recorded in the output. The
padding and merging (`padIn`, `padOut`, `merge`) are editorial: how much air to keep around
speech. Those are applied by build_timeline.py, against this same raw list.

`cut` config used here (defaults in brackets):
  noiseDb     [-32]   silencedetect threshold in dB — lower keeps more quiet tails
  minSilence  [0.35]  a gap must be at least this long (s) to register as silence
"""
import json
import os
import re
import subprocess
import sys

from lib import rush, platform as _plat, config as _cfg

W = os.path.abspath(sys.argv[1])
SRC = rush.find_source(W)
os.makedirs(os.path.join(W, "build"), exist_ok=True)

_c = _cfg.load(W).get("cut", {}) or {}
NOISE_DB = float(_c.get("noiseDb", -32))
MIND = float(_c.get("minSilence", 0.35))

dur = float(subprocess.run(
    [_plat.FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SRC],
    capture_output=True, text=True).stdout.strip())

out = subprocess.run(
    [_plat.FFMPEG, "-hide_banner", "-nostats", "-i", SRC, "-af",
     "silencedetect=noise=%gdB:d=%g" % (NOISE_DB, MIND), "-f", "null", "-"],
    capture_output=True, text=True).stderr

sil = []
s = None
for mm in re.finditer(r"silence_(start|end): ([0-9.]+)", out):
    k, v = mm.group(1), float(mm.group(2))
    if k == "start":
        s = v
    else:
        sil.append([0.0 if s is None else s, v])
        s = None
if s is not None:
    sil.append([s, dur])

doc = ("Where the speaker is silent, in absolute source seconds. A raw measurement: nothing "
       "ever edits this file, so it cannot disagree with the montage. Padding and merging are "
       "applied by build_timeline.py, not here. See scripts/find_silences.py and issue #144.")
payload = {"_doc": doc, "source": os.path.basename(SRC), "duration": round(dur, 3),
           "detect": {"noiseDb": NOISE_DB, "minSilence": MIND},
           "silences": [[round(a, 3), round(b, 3)] for a, b in sil]}
with open(os.path.join(W, "build", "silences.json"), "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=1)
    f.write("\n")

quiet = sum(b - a for a, b in sil)
print("noise=%gdB minSilence=%gs" % (NOISE_DB, MIND))
print("source %.2fs — %d silence(s), %.2fs quiet (%.0f%%)"
      % (dur, len(sil), quiet, (quiet / dur * 100) if dur else 0))
