# -*- coding: utf-8 -*-
from . import dsp

ABOUT = "A filtered-noise sweep that darkens as it falls."
WHEN = "A scene or a graphic leaving the screen."
GAIN = 0.075        # its level in the bed; every cue stays under -18 dBFS
SECONDS = 0.30


def render():
    """The cue as float samples at dsp.SR, peak 1.0."""
    return dsp.whoosh(SECONDS, rising=False)
