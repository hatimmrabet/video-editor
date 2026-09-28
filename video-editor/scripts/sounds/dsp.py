# -*- coding: utf-8 -*-
"""The signal processing every cue is built from: the sample rate and the pieces they share.
Numpy only — no sample files, no other dependency."""
import numpy as np

SR = 48000          # samples per second of the sound bed


def lowpass(x, a0, a1):
    """A one-pole low-pass whose coefficient glides from a0 to a1 along the signal: a filter
    sweep, which is what makes noise sound like a whoosh."""
    y = np.empty_like(x)
    z = 0.0
    for i in range(len(x)):
        a = a0 + (a1 - a0) * (i / len(x))
        z += a * (x[i] - z)
        y[i] = z
    return y


def normalised(x):
    """The signal scaled so its peak is 1.0."""
    return x / (np.max(np.abs(x)) + 1e-9)


def whoosh(seconds, rising, seed=11):
    """Filtered noise sweeping up or down in brightness, swelling and fading out."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    noise = np.random.RandomState(seed).randn(n)
    y = normalised(lowpass(noise, 0.03, 0.30) if rising else lowpass(noise, 0.30, 0.03))
    return y * np.sin(np.pi * np.clip(t / seconds, 0, 1)) ** 1.6
