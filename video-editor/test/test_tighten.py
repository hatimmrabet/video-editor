# -*- coding: utf-8 -*-
"""tighten.py — the jump-cut pass, and the double-cut it used to commit (issue #144).

The old tighten.py cached build/tighten-plan.json and, on a later `apply`, re-applied
timestamps measured against a timeline that had moved underneath it. The headline test here
is test_applying_twice_changes_nothing_the_second_time: it is the regression that motivated
the rewrite, and it passes now for a structural reason — `apply` measures the CURRENT
timeline, so the second run finds no gap over the threshold.

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


def entry(eid, src, words):
    return {"id": eid, "src": [list(s) for s in src],
            "caption": {"text": " ".join(w for w, _, _ in words),
                        "words": [{"t": w, "src": [s, e]} for w, s, e in words]}}


def work_with(entries, lang="fr"):
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, "config"), exist_ok=True)
    with open(os.path.join(d, "config", "project.config.json"), "w", encoding="utf-8") as f:
        json.dump({"language": lang, "tighten": {"pauseMs": PAUSE * 1000, "keepMs": KEEP * 1000}}, f)
    t = tl.blank({"file": "s.mp4", "duration": 120.0})
    t["timeline"] = entries
    tl.save(d, t)
    return d


def run(work, *args):
    with contextlib.redirect_stdout(io.StringIO()) as out:
        tighten.main(["tighten.py", work] + list(args))
    return out.getvalue()


class PlanEntry(unittest.TestCase):
    def test_a_long_pause_between_words_is_trimmed_to_keepMs(self):
        # src ends on the last word, so the inter-word pause is the only gap in play
        e = entry("e001", [[10.0, 13.5]], [("un", 10.0, 10.5), ("deux", 13.0, 13.5)])
        spans, _, gaps = tighten.plan_entry(e, [], PAUSE, KEEP)
        self.assertEqual(len(gaps), 1)
        self.assertAlmostEqual(spans[0][0], 10.59)      # 10.5 + 0.09 kept
        self.assertAlmostEqual(spans[0][1], 13.0)

    def test_a_short_pause_is_left_alone(self):
        e = entry("e001", [[10.0, 11.0]], [("un", 10.0, 10.5), ("deux", 10.6, 11.0)])
        spans, _, gaps = tighten.plan_entry(e, [], PAUSE, KEEP)
        self.assertEqual(gaps, [])
        self.assertEqual(spans, [])

    def test_the_air_at_either_end_counts_as_a_pause(self):
        e = entry("e001", [[9.0, 15.0]], [("un", 10.0, 10.5), ("deux", 10.6, 11.0)])
        _, _, gaps = tighten.plan_entry(e, [], PAUSE, KEEP)
        self.assertEqual(len(gaps), 2, "the lead-in and the tail should both register")

    def test_a_filler_word_is_found_with_its_span(self):
        e = entry("e001", [[10.0, 12.0]],
                  [("alors", 10.0, 10.4), ("euh", 10.5, 10.8), ("voila", 10.9, 11.4)])
        spans, found, _ = tighten.plan_entry(e, EUH, PAUSE, KEEP)
        self.assertEqual([f["text"] for f in found], ["euh"])
        self.assertIn([10.5, 10.8], spans)

    def test_an_entry_with_no_src_yields_nothing(self):
        self.assertEqual(tighten.plan_entry({"id": "e1", "src": []}, EUH, PAUSE, KEEP),
                         ([], [], []))


class Apply(unittest.TestCase):
    def setUp(self):
        self.work = work_with([
            entry("e001", [[10.0, 14.0]], [("un", 10.0, 10.5), ("deux", 13.0, 13.5)]),
            entry("e002", [[20.0, 21.0]], [("trois", 20.0, 20.4), ("quatre", 20.5, 21.0)]),
        ])

    def test_it_shortens_the_video(self):
        before = tl.duration(tl.load(self.work))
        run(self.work, "apply")
        self.assertLess(tl.duration(tl.load(self.work)), before)

    def test_proposing_writes_nothing(self):
        before = json.dumps(tl.load(self.work))
        run(self.work)
        self.assertEqual(json.dumps(tl.load(self.work)), before)

    def test_applying_twice_changes_nothing_the_second_time(self):
        """THE regression (issue #144): the old version re-applied a cached plan against a
        timeline that had already moved, cutting the same seconds twice."""
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
        e = tl.by_id(tl.load(self.work), "e001")
        self.assertEqual(len(e["src"]), 2, "the trimmed pause should split the entry's src")
        self.assertAlmostEqual(e["src"][0][1], 10.59)
        self.assertAlmostEqual(e["src"][1][0], 13.0)

    def test_surviving_words_keep_their_source_timings(self):
        """Source time is the authority: a cut elsewhere must not rewrite a word."""
        run(self.work, "apply")
        e = tl.by_id(tl.load(self.work), "e001")
        self.assertEqual([w["src"] for w in e["caption"]["words"]], [[10.0, 10.5], [13.0, 13.5]])

    def test_the_result_validates(self):
        run(self.work, "apply")
        self.assertEqual(tl.validate(tl.load(self.work)), [])

    def test_an_untouched_entry_is_untouched(self):
        before = json.dumps(tl.by_id(tl.load(self.work), "e002"))
        run(self.work, "apply")
        self.assertEqual(json.dumps(tl.by_id(tl.load(self.work), "e002")), before)

    def test_a_cut_entry_is_skipped(self):
        t = tl.load(self.work)
        tl.by_id(t, "e001")["on"] = False
        tl.save(self.work, t)
        run(self.work, "apply")
        self.assertEqual(tl.by_id(tl.load(self.work), "e001")["src"], [[10.0, 14.0]])


class Fillers(unittest.TestCase):
    def setUp(self):
        self.work = work_with([entry("e001", [[10.0, 11.5]],
                                     [("alors", 10.0, 10.4), ("euh", 10.45, 10.8),
                                      ("voila", 10.85, 11.4)])])
        # inject the filler list directly rather than depending on fillers.json's contents
        self._real = tighten.filler_tokens
        tighten.filler_tokens = lambda w: ("fr", EUH)

    def tearDown(self):
        tighten.filler_tokens = self._real

    def test_the_filler_leaves_both_the_audio_and_the_caption(self):
        run(self.work, "apply")
        e = tl.by_id(tl.load(self.work), "e001")
        self.assertEqual([w["t"] for w in e["caption"]["words"]], ["alors", "voila"])
        self.assertEqual(e["caption"]["text"], "alors voila")

    def test_the_text_and_the_words_still_agree(self):
        """If they drifted apart, sync_words would re-space the whole sentence on the next
        correction pass and throw away Whisper's timings."""
        run(self.work, "apply")
        e = tl.by_id(tl.load(self.work), "e001")
        self.assertFalse(tl.sync_words(e))

    def test_the_fillers_seconds_are_gone_from_the_montage(self):
        run(self.work, "apply")
        e = tl.by_id(tl.load(self.work), "e001")
        for a, b in e["src"]:
            self.assertFalse(a < 10.6 < b, "the filler's audio is still in the montage")


if __name__ == "__main__":
    unittest.main()
