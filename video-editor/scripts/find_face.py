# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Measures where the speaker's face is. A MEASUREMENT, not a decision.

    uv run scripts/find_face.py <workdir>

Reads : build/source-joined.mp4
Writes: <work>/build/framing.json

    {"source": "...", "duration": 142.267, "interval": 0.5,
     "samples": [{"t": 0.0, "cx": 0.51, "cy": 0.44, "h": 0.27}, ...]}   # fractions of the frame

`cx`/`cy` is the face's centre, `h` its height — both as a fraction of the SOURCE frame, so
they read the same regardless of the composition's own size. Sampled every `interval`
seconds (OpenCV's Haar cascade, no model download); a frame with no face detected, or more
than one (the largest is kept — a second person in frame is not who is speaking), reuses the
nearest earlier reading, then every sample is smoothed (a short moving average) so a punch-in
never jitters frame to frame.

This file is never edited by anything, which is why it can sit outside timeline.json without
becoming a second source of truth. render_data.py turns it into a zoom/anchor per piece —
the layout in play at that point in the video says where the face should land; the compile
just makes it so. A recording with no detected face anywhere leaves `samples` empty; the
render falls back to a centred crop, exactly as before this measurement existed.
"""
import json
import os
import sys

import cv2
import numpy as np

from lib import rush

INTERVAL = 0.5          # seconds between samples — plenty for a slow-moving crop
SMOOTH_WINDOW = 5        # samples either side, moving average


def detect(cascade, frame_bgr):
    """The largest face in this frame, as (cx, cy, h) fractions of the frame — or None."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(80, 80))
    if len(faces) == 0:
        return None
    h_img, w_img = gray.shape[:2]
    x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
    return ((x + w / 2) / w_img, (y + h / 2) / h_img, h / h_img)


def smooth(values, window):
    """A short centred moving average — enough to kill per-sample jitter without lagging a
    real, sustained move."""
    out = []
    for i in range(len(values)):
        lo, hi = max(0, i - window), min(len(values), i + window + 1)
        chunk = values[lo:hi]
        out.append(sum(chunk) / len(chunk))
    return out


def main(argv):
    work = os.path.abspath(argv[1])
    src = rush.find_source(work)
    os.makedirs(os.path.join(work, "build"), exist_ok=True)

    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        sys.exit("[X] could not open %s" % src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if frame_count and fps else 0.0

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    times, raw, hits = [], [], 0
    t = 0.0
    step = max(1, int(round(INTERVAL * fps)))
    last = None
    while duration <= 0 or t < duration:
        frame_no = int(round(t * fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        ok, frame = cap.read()
        if not ok:
            break
        found = detect(cascade, frame)
        if found is None:
            found = last          # hold the last good reading across a missed frame
        else:
            last = found
            hits += 1
        if found is not None:
            times.append(round(t, 3))
            raw.append(found)
        t += step / fps
    cap.release()

    if raw:
        cx = smooth([r[0] for r in raw], SMOOTH_WINDOW)
        cy = smooth([r[1] for r in raw], SMOOTH_WINDOW)
        ch = smooth([r[2] for r in raw], SMOOTH_WINDOW)
        samples = [{"t": tt, "cx": round(a, 4), "cy": round(b, 4), "h": round(c, 4)}
                   for tt, a, b, c in zip(times, cx, cy, ch)]
    else:
        samples = []

    doc = ("Where the speaker's face is, in source-frame fractions. A raw measurement: "
           "nothing ever edits this file, so it cannot disagree with the montage. "
           "render_data.py turns it into a zoom/anchor per piece, aimed at the active "
           "layout's own face target.")
    payload = {"_doc": doc, "source": os.path.basename(src), "duration": round(duration, 3),
               "interval": INTERVAL, "samples": samples}
    with open(os.path.join(work, "build", "framing.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write("\n")

    if not samples:
        print("no face detected anywhere - the render will fall back to a centred crop")
    else:
        hs = np.array([s["h"] for s in samples])
        print("face detected in %d/%d sample(s) - height %.0f%%-%.0f%% of frame (median %.0f%%)"
              % (hits, len(times), hs.min() * 100, hs.max() * 100, float(np.median(hs)) * 100))
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: find_face.py <work>")
    sys.exit(main(sys.argv))
