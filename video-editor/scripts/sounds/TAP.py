# -*- coding: utf-8 -*-
import numpy as np

from . import dsp

ABOUT = "A short, soft click."
WHEN = "A light beat: an item appearing, a word emphasised."
GAIN = 0.075        # its level in the bed; every cue stays under -18 dBFS
SECONDS = 0.09


def render(seed=11):
    """The cue as float samples at dsp.SR, peak 1.0."""
    n = int(SECONDS * dsp.SR)
    t = np.arange(n) / dsp.SR
    click = dsp.lowpass(np.random.RandomState(seed).randn(n), 0.22, 0.05) * np.exp(-t / 0.013)
    click *= np.minimum(1.0, t / 0.0012)
    return dsp.normalised(click)
