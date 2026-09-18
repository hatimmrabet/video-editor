# -*- coding: utf-8 -*-
"""build_timeline.py — the montage must be the same seconds the old pipeline produced.

The whole migration rests on one claim: moving from cut-plan.json + captions.json to
timeline.json changes the DATA MODEL, not the edit. This file pins that claim without
needing a video:

  - speech_runs() is checked against plan_cuts.py's own algorithm, copied verbatim below,
    over randomised silence patterns.
  - the entries are checked to PARTITION that kept speech: union of every entry's `src`
    == the kept runs, exactly. Nothing orphaned, nothing counted twice.

Run: uv run python -m unittest discover test
"""
import contextlib
import io
import json
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import build_timeline as bt  # noqa: E402
from lib import timeline as tl  # noqa: E402

PAD_IN, PAD_OUT, MERGE = 0.22, 0.10, 0.20


def plan_cuts_reference(sil, dur, pad_in=PAD_IN, pad_out=PAD_OUT, merge=MERGE):
    """plan_cuts.py's body, copied verbatim as it stood before issue #144 (commit bf90249).
    This is the oracle: whatever it keeps, build_timeline.py must keep."""
    keep = []
    cur = 0.0
    for a, b in sil:
        if a - cur > 0.01:
            keep.append([cur, a])
        cur = b
    if dur - cur > 0.01:
        keep.append([cur, dur])
    keep = [[max(0, a - pad_in), min(dur, b + pad_out)] for a, b in keep]
    m = []
    for seg in keep:
        if m and seg[0] - m[-1][1] < merge:
            m[-1][1] = seg[1]
        else:
            m.append(seg)
    return [x for x in m if x[1] - x[0] >= 0.30]


def random_silences(rng, dur):
    """A plausible silence pattern: alternating speech and quiet across the recording."""
    out, t = [], 0.0
    while t < dur:
        t += rng.uniform(0.4, 4.0)                      # speech
        if t >= dur:
            break
        gap = rng.uniform(0.35, 2.5)                    # quiet
        out.append([round(t, 3), round(min(dur, t + gap), 3)])
        t += gap
    return out


def total(spans):
    return round(sum(b - a for a, b in spans), 6)


class SpeechRuns(unittest.TestCase):
    def test_it_matches_plan_cuts_on_the_shape_of_a_real_recording(self):
        rng = random.Random(20260915)
        for _ in range(200):
            dur = rng.uniform(20.0, 600.0)
            sil = random_silences(rng, dur)
            self.assertEqual(bt.speech_runs(sil, dur, PAD_IN, PAD_OUT, MERGE),
                             plan_cuts_reference(sil, dur))

    def test_no_silence_at_all_keeps_the_whole_recording(self):
        self.assertEqual(bt.speech_runs([], 60.0, PAD_IN, PAD_OUT, MERGE), [[0.0, 60.0]])

    def test_silence_everywhere_keeps_nothing(self):
        self.assertEqual(bt.speech_runs([[0.0, 60.0]], 60.0, PAD_IN, PAD_OUT, MERGE), [])

    def test_runs_never_leave_the_source(self):
        runs = bt.speech_runs([[0.1, 1.0], [58.0, 59.9]], 60.0, PAD_IN, PAD_OUT, MERGE)
        for a, b in runs:
            self.assertGreaterEqual(a, 0.0)
            self.assertLessEqual(b, 60.0)

    def test_a_sliver_of_speech_between_two_silences_is_dropped(self):
        """0.05s of noise between two long silences is not a sentence. With no padding to
        inflate it, it stays under the 0.30s floor and never reaches the montage."""
        runs = bt.speech_runs([[0.0, 10.0], [10.05, 60.0]], 60.0, 0.0, 0.0, 0.0)
        self.assertEqual(runs, [])


class Claims(unittest.TestCase):
    def test_claims_cover_the_whole_source_without_overlapping(self):
        bounds = [(1.0, 3.0), (5.0, 8.0), (10.0, 12.0)]
        cl = bt.claims(bounds, 20.0)
        self.assertAlmostEqual(cl[0][0], 0.0)
        self.assertAlmostEqual(cl[-1][1], 20.0)
        for a, b in zip(cl, cl[1:]):
            self.assertAlmostEqual(a[1], b[0])

    def test_a_single_sentence_claims_everything(self):
        self.assertEqual(bt.claims([(4.0, 9.0)], 20.0), [[0.0, 20.0]])

    def test_claims_meet_at_the_midpoint_between_neighbours(self):
        cl = bt.claims([(1.0, 3.0), (5.0, 8.0)], 20.0)
        self.assertAlmostEqual(cl[0][1], 4.0)           # (3 + 5) / 2


def build(work, sil, dur, segments, cfg=None):
    os.makedirs(os.path.join(work, "build"), exist_ok=True)
    os.makedirs(os.path.join(work, "config"), exist_ok=True)
    with open(os.path.join(work, "build", "silences.json"), "w", encoding="utf-8") as f:
        json.dump({"source": "s.mp4", "duration": dur, "silences": sil}, f)
    with open(os.path.join(work, "build", "transcript-raw.json"), "w", encoding="utf-8") as f:
        json.dump({"language": "ar", "segments": segments}, f, ensure_ascii=False)
    with open(os.path.join(work, "config", "project.config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg or {"cut": {"padIn": PAD_IN, "padOut": PAD_OUT, "merge": MERGE}}, f)
    with contextlib.redirect_stdout(io.StringIO()):
        bt.main(["build_timeline.py", work])
    return tl.load(work)


def seg(i, words):
    return {"id": i, "start": words[0][1], "end": words[-1][2], "text": " ".join(w[0] for w in words),
            "words": [{"word": w, "start": s, "end": e} for w, s, e in words]}


class Partition(unittest.TestCase):
    """The load-bearing property: the entries carve up the kept speech and lose none of it."""

    def setUp(self):
        self.dur = 40.0
        self.sil = [[5.0, 6.0], [12.0, 14.0], [20.0, 20.5], [28.0, 30.0]]
        self.segments = [
            seg(0, [("one", 0.5, 1.2), ("two", 1.4, 2.0)]),
            seg(1, [("three", 7.0, 7.8), ("four", 15.0, 15.9)]),     # straddles the 12-14 silence
            seg(2, [("five", 21.0, 21.6), ("six", 22.0, 22.7)]),
            seg(3, [("seven", 31.0, 31.8), ("eight", 33.0, 34.2)]),
        ]

    def test_the_entries_reproduce_the_kept_speech_exactly(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.segments)
        runs = bt.speech_runs(self.sil, self.dur, PAD_IN, PAD_OUT, MERGE)
        pieces = sorted([x["src"] for x in tl.program(t)])
        merged, cur = [], None
        for a, b in pieces:                              # re-join the pieces split at a claim
            if cur and abs(a - cur[1]) < 0.002:
                cur[1] = b
            else:
                cur = [a, b]
                merged.append(cur)
        self.assertEqual(len(merged), len(runs))
        for got, want in zip(merged, runs):
            self.assertAlmostEqual(got[0], want[0], places=2)
            self.assertAlmostEqual(got[1], want[1], places=2)

    def test_the_total_duration_matches_the_old_cut_plan(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.segments)
        self.assertAlmostEqual(tl.duration(t), total(plan_cuts_reference(self.sil, self.dur)),
                               places=2)

    def test_no_second_is_claimed_twice(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.segments)
        pieces = sorted([x["src"] for x in tl.program(t)])
        for a, b in zip(pieces, pieces[1:]):
            self.assertLessEqual(a[1], b[0] + 1e-9, "overlapping source pieces: %s %s" % (a, b))

    def test_a_sentence_across_a_silence_becomes_one_entry_with_a_hole(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.segments)
        e = tl.by_id(t, "e002")
        self.assertGreater(len(e["src"]), 1, "the 12-14s silence should split e002's src")
        self.assertEqual(len(tl.entries(t)), 4, "but it is still ONE entry")

    def test_the_result_validates(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.segments)
        self.assertEqual(tl.validate(t), [])

    def test_words_keep_whispers_own_timings(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.segments)
        self.assertEqual(tl.by_id(t, "e001")["caption"]["words"][0]["src"], [0.5, 1.2])


class Guard(unittest.TestCase):
    def test_it_refuses_to_clobber_an_existing_timeline(self):
        """The guard the old pipeline lacked: re-running captions.py silently destroyed
        every cut and correction. Rebuilding must be an explicit choice."""
        with tempfile.TemporaryDirectory() as d:
            build(d, [[5.0, 6.0]], 20.0, [seg(0, [("a", 1.0, 2.0)])])
            t = tl.load(d)
            t["timeline"][0]["on"] = False               # a decision worth protecting
            tl.save(d, t)
            with self.assertRaises(SystemExit):
                bt.main(["build_timeline.py", d])
            self.assertFalse(tl.load(d)["timeline"][0]["on"], "the decision was overwritten")

    def test_force_rebuilds(self):
        with tempfile.TemporaryDirectory() as d:
            build(d, [[5.0, 6.0]], 20.0, [seg(0, [("a", 1.0, 2.0)])])
            t = tl.load(d)
            t["timeline"][0]["on"] = False
            tl.save(d, t)
            with contextlib.redirect_stdout(io.StringIO()):
                bt.main(["build_timeline.py", d, "--force"])
            self.assertTrue(tl.is_on(tl.load(d)["timeline"][0]))

    def test_a_missing_measurement_is_a_clear_exit(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "build"))
            with self.assertRaises(SystemExit):
                bt.main(["build_timeline.py", d])


if __name__ == "__main__":
    unittest.main()
