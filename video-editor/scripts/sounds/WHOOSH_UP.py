# -*- coding: utf-8 -*-
from . import dsp

ABOUT = "A filtered-noise sweep that brightens as it rises."
WHEN = "A scene or a graphic entering the screen."
GAIN = 0.085        # its level in the bed; every cue stays under -18 dBFS
SECONDS = 0.34


def render():
    """The cue as float samples at dsp.SR, peak 1.0."""
    return dsp.whoosh(SECONDS, rising=True)
