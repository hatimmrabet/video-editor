# -*- coding: utf-8 -*-
"""tighten.py — the jump-cut pass, and why applying it twice is safe.

The headline test here is test_applying_twice_changes_nothing_the_second_time: `apply`
always measures the CURRENT timeline rather than a cached plan, so a second run finds no
gap over the threshold and is a structural no-op, not a second cut.

Run: uv run python -m unittest discover test
"""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import tighten  # noqa: E402
from lib import timeline as tl  # noqa: E402

PAUSE, KEEP = 0.25, 0.09
EUH = [["euh"]]


def work_with(entries, raw_segments, lang="fr"):
    """A work dir whose timeline.json is `entries` and whose build/transcript-raw.json
    carries the real words `tl.words()` aligns `text` against — exactly the same tokens as
    `entries`' own `text`, so every word resolves to its real (non-interpolated) timing."""
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, "build"), exist_ok=True)
    os.makedirs(os.path.join(d, "config"), exist_ok=True)
    with open(os.path.join(d, "config", "project.config.json"), "w", encoding="utf-8") as f:
        json.dump({"language": lang, "tighten": {"pauseMs": PAUSE * 1000, "keepMs": KEEP * 1000}}, f)
    with open(os.path.join(d, "build", "transcript-raw.json"), "w", encoding="utf-8") as f:
        json.dump({"language": lang, "segments": raw_segments}, f, ensure_ascii=False)
    t = tl.blank({"file": "s.mp4", "duration": 120.0})
    t["segments"] = entries
    tl.save(d, t)
    return d


def raw(words):
    return [{"words": [{"word": w, "start": s, "end": e} for w, s, e in words]}]


def run(work, *args):
    with contextlib.redirect_stdout(io.StringIO()) as out:
        tighten.main(["tighten.py", work] + list(args))
    return out.getvalue()


class PlanSegment(unittest.TestCase):
    def loaded(self, entries, raw_words):
        """`plan_segment` (via tl.words -> out_start) matches a segment by IDENTITY against
        `t["segments"]`, so the segment it is called with must be the SAME object a real
        `tl.load()` produced — never a separate dict that merely looks the same."""
        d = work_with(entries, raw(raw_words))
        t = tl.load(d)
        seg = t["segments"][0]
        return seg, tl.words(t, seg)

    def test_a_long_pause_between_words_is_trimmed_to_keepMs(self):
        # source ends on the last word, so the inter-word pause is the only gap in play
        seg, words = self.loaded([{"source": [[10.0, 13.5]], "text": "un deux"}],
                                 [("un", 10.0, 10.5), ("deux", 13.0, 13.5)])
        spans, _, gaps = tighten.plan_segment(seg, words, [], PAUSE, KEEP)
        self.assertEqual(len(gaps), 1)
        self.assertAlmostEqual(spans[0][0], 10.59)      # 10.5 + 0.09 kept
        self.assertAlmostEqual(spans[0][1], 13.0)

    def test_a_short_pause_is_left_alone(self):
        seg, words = self.loaded([{"source": [[10.0, 11.0]], "text": "un deux"}],
                                 [("un", 10.0, 10.5), ("deux", 10.6, 11.0)])
        spans, _, gaps = tighten.plan_segment(seg, words, [], PAUSE, KEEP)
        self.assertEqual(gaps, [])
        self.assertEqual(spans, [])

    def test_the_air_at_either_end_counts_as_a_pause(self):
        seg, words = self.loaded([{"source": [[9.0, 15.0]], "text": "un deux"}],
                                 [("un", 10.0, 10.5), ("deux", 10.6, 11.0)])
        _, _, gaps = tighten.plan_segment(seg, words, [], PAUSE, KEEP)
        self.assertEqual(len(gaps), 2, "the lead-in and the tail should both register")

    def test_a_filler_word_is_found_with_its_span(self):
        seg, words = self.loaded([{"source": [[10.0, 12.0]], "text": "alors euh voila"}],
                                 [("alors", 10.0, 10.4), ("euh", 10.5, 10.8), ("voila", 10.9, 11.4)])
        spans, found, _ = tighten.plan_segment(seg, words, EUH, PAUSE, KEEP)
        self.assertEqual([f["text"] for f in found], ["euh"])
        self.assertIn([10.5, 10.8], spans)

    def test_a_segment_with_no_source_yields_nothing(self):
        seg = {"source": [], "text": ""}
        self.assertEqual(tighten.plan_segment(seg, [], EUH, PAUSE, KEEP), ([], [], []))


class Apply(unittest.TestCase):
    def setUp(self):
        self.entries = [
            {"source": [[10.0, 14.0]], "text": "un deux"},
            {"source": [[20.0, 21.0]], "text": "trois quatre"},
        ]
        self.raw = raw([("un", 10.0, 10.5), ("deux", 13.0, 13.5),
                        ("trois", 20.0, 20.4), ("quatre", 20.5, 21.0)])
        self.work = work_with(self.entries, self.raw)

    def test_it_shortens_the_video(self):
        before = tl.duration(tl.load(self.work))
        run(self.work, "apply")
        self.assertLess(tl.duration(tl.load(self.work)), before)

    def test_proposing_writes_nothing(self):
        before = json.dumps(tl.load(self.work)["segments"])
        run(self.work)
        self.assertEqual(json.dumps(tl.load(self.work)["segments"]), before)

    def test_applying_twice_changes_nothing_the_second_time(self):
        """Applying twice must never cut the same seconds twice."""
        run(self.work, "apply")
        once = tl.duration(tl.load(self.work))
        run(self.work, "apply")
        twice = tl.duration(tl.load(self.work))
        self.assertAlmostEqual(once, twice, places=6)

    def test_the_second_run_says_so(self):
        run(self.work, "apply")
        self.assertIn("already tight", run(self.work, "apply"))

    def test_the_hole_lands_where_the_pause_was(self):
        run(self.work, "apply")
        seg = tl.load(self.work)["segments"][0]
        self.assertEqual(len(seg["source"]), 2, "the trimmed pause should split the segment's source")
        self.assertAlmostEqual(seg["source"][0][1], 10.59)
        self.assertAlmostEqual(seg["source"][1][0], 13.0)

    def test_surviving_words_keep_their_source_timings(self):
        """Source time is the authority: a cut elsewhere must not rewrite a word."""
        run(self.work, "apply")
        t = tl.load(self.work)
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["src"] for x in w], [[10.0, 10.5], [13.0, 13.5]])

    def test_the_result_validates(self):
        run(self.work, "apply")
        self.assertEqual(tl.validate(tl.load(self.work)), [])

    def test_an_untouched_segment_is_untouched(self):
        before = json.dumps(tl.load(self.work)["segments"][1])
        run(self.work, "apply")
        self.assertEqual(json.dumps(tl.load(self.work)["segments"][1]), before)

    def test_a_cut_segment_is_skipped(self):
        t = tl.load(self.work)
        t["segments"][0]["on"] = False
        tl.save(self.work, t)
        run(self.work, "apply")
        self.assertEqual(tl.load(self.work)["segments"][0]["source"], [[10.0, 14.0]])


class Fillers(unittest.TestCase):
    def setUp(self):
        entries = [{"source": [[10.0, 11.5]], "text": "alors euh voila"}]
        raw_words = raw([("alors", 10.0, 10.4), ("euh", 10.45, 10.8), ("voila", 10.85, 11.4)])
        self.work = work_with(entries, raw_words)
        # inject the filler list directly rather than depending on fillers.json's contents
        self._real = tighten.filler_tokens
        tighten.filler_tokens = lambda w: ("fr", EUH)

    def tearDown(self):
        tighten.filler_tokens = self._real

    def test_the_filler_leaves_both_the_audio_and_the_text(self):
        run(self.work, "apply")
        seg = tl.load(self.work)["segments"][0]
        self.assertEqual(seg["text"], "alors voila")

    def test_the_surviving_words_still_resolve_to_their_real_timings(self):
        """If the rebuilt `text` drifted from what is really in the source, the surviving
        words would fall back to interpolation instead of keeping Whisper's own timing."""
        run(self.work, "apply")
        t = tl.load(self.work)
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["src"] for x in w], [[10.0, 10.4], [10.85, 11.4]])

    def test_the_fillers_seconds_are_gone_from_the_montage(self):
        run(self.work, "apply")
        seg = tl.load(self.work)["segments"][0]
        for a, b in seg["source"]:
            self.assertFalse(a < 10.6 < b, "the filler's audio is still in the montage")


if __name__ == "__main__":
    unittest.main()
