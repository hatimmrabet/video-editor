# -*- coding: utf-8 -*-
import numpy as np

from . import dsp

ABOUT = "A low sine that drops in pitch, with a soft click at the start."
WHEN = "Something lands: a number settling, a label stamped, an arrival."
GAIN = 0.115        # its level in the bed; every cue stays under -18 dBFS
SECONDS = 0.30
FROM_HZ, TO_HZ = 135, 58


def render(seed=11):
    """The cue as float samples at dsp.SR, peak 1.0."""
    n = int(SECONDS * dsp.SR)
    t = np.arange(n) / dsp.SR
    freq = FROM_HZ * np.exp(np.log(TO_HZ / FROM_HZ) * t / SECONDS)
    phase = 2 * np.pi * np.cumsum(freq) / dsp.SR
    body = np.sin(phase) * np.exp(-t / 0.085)
    click = dsp.lowpass(np.random.RandomState(seed).randn(n), 0.35, 0.05) * np.exp(-t / 0.006) * 0.35
    return dsp.normalised(body + click)
