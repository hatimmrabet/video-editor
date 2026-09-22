# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Marks a human/agent checkpoint stage addressed. python3 mark_checkpoint.py <work> <id>

    uv run scripts/mark_checkpoint.py <work> scenes

`<id>` is a checkpoint stage id from scripts/pipeline/talking-video.json (transcript-fix,
cut-review, tighten, chapters, scenes, sound-cues) — a stage with no `run` there, i.e. a
step Claude does by editing <work>/timeline.json directly rather than by running a script.

Call this once that step is genuinely done for the project — including when the honest
answer was "nothing to change" (a scenes-less video, no filler words to cut): the mark
records that the step was CONSIDERED, not that it changed something. Without it, run.py
cannot tell "reviewed, nothing needed changing" from "never looked at".

Idempotent — writes <work>/timeline.json's `checkpoints.<id> = true` and nothing else.
"""
import json
import os
import sys

from lib import timeline as tl

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def checkpoint_ids():
    p = os.path.join(SKILL_DIR, "scripts", "pipeline", "talking-video.json")
    with open(p, encoding="utf-8-sig") as f:
        manifest = json.load(f)
    return [s["id"] for s in manifest["stages"] if "run" not in s]


def main(argv):
    if len(argv) != 3:
        sys.exit("usage: mark_checkpoint.py <work> <checkpoint-id>")
    work, name = os.path.abspath(argv[1]), argv[2]
    ids = checkpoint_ids()
    if name not in ids:
        sys.exit("[X] %r is not a checkpoint stage - one of: %s" % (name, ", ".join(ids)))
    tl.mark_checkpoint(work, name)
    print("checkpoint '%s' marked done" % name)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
