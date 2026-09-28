# -*- coding: utf-8 -*-
"""build_timeline.py — the montage keeps exactly the seconds a silence-complement
algorithm says to keep, no more and no less, split into sentence-sized segments. This file
pins that guarantee without needing a video:

  - speech_runs() is checked against a reference silence-complement algorithm (copied
    verbatim below) over randomised silence patterns.
  - sentence_groups()/split_long_groups() are checked directly: punctuation splits, a cap
    split lands on a real silence, nothing is lost or reordered.
  - end to end, the segments are checked to PARTITION the kept speech: union of every
    segment's `source` == the kept runs, exactly. Nothing orphaned, nothing counted twice.

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
    """A reference silence-complement algorithm, copied verbatim here as the oracle:
    whatever it keeps, build_timeline.py must keep."""
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


def word(t, s, e):
    return {"word": t, "start": s, "end": e}


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


class SentenceGroups(unittest.TestCase):
    def test_splits_at_sentence_punctuation(self):
        words = [word("Hello", 0.0, 0.5), word("world.", 0.6, 1.0),
                 word("Bye", 2.0, 2.3), word("now.", 2.4, 2.8)]
        groups = bt.sentence_groups(words)
        self.assertEqual([[w["word"] for w in g] for g in groups],
                         [["Hello", "world."], ["Bye", "now."]])

    def test_a_trailing_run_with_no_punctuation_is_still_one_group(self):
        words = [word("Hello", 0.0, 0.5), word("world", 0.6, 1.0)]
        self.assertEqual(len(bt.sentence_groups(words)), 1)

    def test_the_arabic_question_mark_ends_a_sentence(self):
        words = [word("شو", 0.0, 0.3), word("داير؟", 0.4, 0.8), word("زوين", 1.0, 1.3)]
        self.assertEqual(len(bt.sentence_groups(words)), 2)

    def test_a_raw_segment_boundary_is_not_a_sentence_boundary(self):
        """The darija fine-tune returns long, paragraph-sized chunks with no punctuation
        inside them — a sentence can and does span more than one raw Whisper segment."""
        seg_a = [word("Hello", 0.0, 0.5)]
        seg_b = [word("world.", 0.6, 1.0)]
        groups = bt.sentence_groups(seg_a + seg_b)
        self.assertEqual(len(groups), 1)


class SplitLongGroups(unittest.TestCase):
    def test_a_short_group_is_left_alone(self):
        g = [word("a", 0.0, 1.0), word("b.", 1.2, 2.0)]
        self.assertEqual(bt.split_long_groups([g], [], 8.0), [g])

    def test_a_long_group_splits_at_its_one_internal_silence(self):
        words = [word("a", 0.0, 1.0), word("b", 2.0, 3.0), word("c", 5.6, 6.0), word("d", 10.0, 11.9)]
        out = bt.split_long_groups([words], [[5.0, 5.6]], 8.0)
        self.assertEqual([[w["word"] for w in piece] for piece in out], [["a", "b"], ["c", "d"]])

    def test_a_long_group_with_no_internal_silence_is_left_over_cap(self):
        """There is nowhere to cut that would not land mid-word - better one long segment
        than a cut through speech."""
        words = [word("a", 0.0, 1.0), word("b", 9.0, 9.5)]
        self.assertEqual(bt.split_long_groups([words], [], 8.0), [words])

    def test_every_resulting_piece_is_under_cap_when_a_fitting_silence_exists(self):
        words = [word("a", 0.0, 0.5), word("b", 3.0, 3.5), word("c", 6.5, 7.0), word("d", 9.5, 10.0)]
        out = bt.split_long_groups([words], [[4.0, 4.2], [8.0, 8.2]], 6.0)
        for piece in out:
            self.assertLessEqual(piece[-1]["end"] - piece[0]["start"], 6.0)

    def test_nothing_is_lost_or_reordered(self):
        words = [word(str(i), float(i) * 3, float(i) * 3 + 0.5) for i in range(12)]
        sil = [[float(i) * 3 + 0.6, float(i) * 3 + 2.9] for i in range(11)]
        out = bt.split_long_groups([words], sil, 5.0)
        self.assertEqual([w for piece in out for w in piece], words)


def build(work, sil, dur, raw_segments, cfg=None):
    os.makedirs(os.path.join(work, "build"), exist_ok=True)
    os.makedirs(os.path.join(work, "config"), exist_ok=True)
    with open(os.path.join(work, "build", "silences.json"), "w", encoding="utf-8") as f:
        json.dump({"source": "s.mp4", "duration": dur, "silences": sil}, f)
    with open(os.path.join(work, "build", "transcript-raw.json"), "w", encoding="utf-8") as f:
        json.dump({"language": "ar", "segments": raw_segments}, f, ensure_ascii=False)
    with open(os.path.join(work, "config", "project.config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg or {"cut": {"padIn": PAD_IN, "padOut": PAD_OUT, "merge": MERGE}}, f)
    with contextlib.redirect_stdout(io.StringIO()):
        bt.main(["build_timeline.py", work])
    return tl.load(work)


class Partition(unittest.TestCase):
    """The load-bearing property: the segments carve up the kept speech and lose none of
    it — sentence-sized splitting must not change that."""

    def setUp(self):
        self.dur = 40.0
        self.sil = [[5.0, 6.0], [12.0, 14.0], [20.0, 20.5], [28.0, 30.0]]
        self.raw_segments = [{"words": [
            word("one", 0.5, 1.2), word("two.", 1.4, 2.0),
            word("three", 7.0, 7.8), word("four.", 15.0, 15.9),   # straddles the 12-14 silence
            word("five", 21.0, 21.6), word("six.", 22.0, 22.7),
            word("seven", 31.0, 31.8), word("eight.", 33.0, 34.2),
        ]}]
        # a generous cap: this class is about sentence PUNCTUATION and holes, not the cap
        # split — that has its own coverage in SplitLongGroups above.
        self.cfg = {"cut": {"padIn": PAD_IN, "padOut": PAD_OUT, "merge": MERGE, "maxSegment": 100.0}}

    def test_the_segments_reproduce_the_kept_speech_exactly(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
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
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
        self.assertAlmostEqual(tl.duration(t), total(plan_cuts_reference(self.sil, self.dur)),
                               places=2)

    def test_no_second_is_claimed_twice(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
        pieces = sorted([x["src"] for x in tl.program(t)])
        for a, b in zip(pieces, pieces[1:]):
            self.assertLessEqual(a[1], b[0] + 1e-9, "overlapping source pieces: %s %s" % (a, b))

    def test_sentence_punctuation_produces_four_segments(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
        self.assertEqual(len(t["segments"]), 4)

    def test_a_sentence_across_a_silence_becomes_one_segment_with_a_hole(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
        seg = t["segments"][1]
        self.assertGreater(len(seg["source"]), 1, "the 12-14s silence should split its source")

    def test_the_result_validates(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
        self.assertEqual(tl.validate(t), [])

    def test_text_matches_the_words_in_order(self):
        with tempfile.TemporaryDirectory() as d:
            t = build(d, self.sil, self.dur, self.raw_segments, self.cfg)
        self.assertEqual(t["segments"][0]["text"], "one two.")


class Guard(unittest.TestCase):
    def test_it_refuses_to_clobber_an_existing_timeline(self):
        """Rebuilding the timeline discards every cut and correction in it, so it must be
        an explicit choice, never a silent side effect of re-running the stage."""
        with tempfile.TemporaryDirectory() as d:
            build(d, [[5.0, 6.0]], 20.0, [{"words": [word("a.", 1.0, 2.0)]}])
            t = tl.load(d)
            t["segments"][0]["on"] = False               # a decision worth protecting
            tl.save(d, t)
            with self.assertRaises(SystemExit):
                bt.main(["build_timeline.py", d])
            self.assertFalse(tl.load(d)["segments"][0]["on"], "the decision was overwritten")

    def test_force_rebuilds(self):
        with tempfile.TemporaryDirectory() as d:
            build(d, [[5.0, 6.0]], 20.0, [{"words": [word("a.", 1.0, 2.0)]}])
            t = tl.load(d)
            t["segments"][0]["on"] = False
            tl.save(d, t)
            with contextlib.redirect_stdout(io.StringIO()):
                bt.main(["build_timeline.py", d, "--force"])
            self.assertTrue(tl.is_on(tl.load(d)["segments"][0]))

    def test_a_missing_measurement_is_a_clear_exit(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "build"))
            with self.assertRaises(SystemExit):
                bt.main(["build_timeline.py", d])

    def test_the_segment_cap_is_configurable(self):
        with tempfile.TemporaryDirectory() as d:
            # one 20s sentence, no punctuation, no silence to split on either way
            words = [word(str(i), float(i) * 2, float(i) * 2 + 1.0) for i in range(10)]
            t = build(d, [], 20.0, [{"words": words}], cfg={"cut": {"maxSegment": 100.0}})
        self.assertEqual(len(t["segments"]), 1, "a generous cap must not split it")


if __name__ == "__main__":
    unittest.main()
