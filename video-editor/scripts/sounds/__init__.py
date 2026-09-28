# -*- coding: utf-8 -*-
"""Sounds: the punctuation cues of the sound bed. An entry's `sfx` lists them —
[{"cue": "WHOOSH_UP", "at": 0.0}] — and sound_fx.py synthesises the bed from them.

Each cue has its own file, named after its UPPERCASE keyword, and that file is the whole
reference: what it is (ABOUT), when to use it (WHEN), how loud it sits in the bed (GAIN) and how
it is synthesised (render()). To know which cues exist, list this folder and read the file. Adding
a cue means adding a file here and one line below — nothing else names them.
"""
import difflib

from . import THUD, TAP, WHOOSH_DOWN, WHOOSH_UP

CUES = {"WHOOSH_UP": WHOOSH_UP, "WHOOSH_DOWN": WHOOSH_DOWN, "THUD": THUD, "TAP": TAP}


def problem(cue):
    """What is wrong with `cue` as an author's choice, worded so it can be fixed — or None."""
    if cue in CUES:
        return None
    near = difflib.get_close_matches(str(cue), list(CUES), n=1)
    return "unknown cue %r%s (choices: %s)" % (
        cue, " - did you mean %s?" % near[0] if near else "", " · ".join(CUES))
