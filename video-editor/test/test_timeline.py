# -*- coding: utf-8 -*-
"""scripts/lib/timeline.py — the projection from source time to output time, and the word
alignment `words()` computes fresh from `text` on every call.

This is the most load-bearing logic in the pipeline: every caption, every sound cue and
every rendered segment gets its position from it. Output time is never stored, only
computed, so the cases worth pinning are the ones where a time falls somewhere awkward —
inside a removed silence, past the end of a shortened sentence, or in a segment that was cut.

Run: uv run python -m unittest discover test
"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
from lib import timeline as tl  # noqa: E402


def fixture():
    """Three sentences. Line 2 has a hole in it (a silence removed mid-sentence) and line 3
    is cut. Durations: line 1 2.0s, line 2 1.5+1.0 = 2.5s, line 3 excluded."""
    return {
        "version": tl.VERSION,
        "source": {"file": "build/source-joined.mp4", "duration": 60.0},
        "segments": [
            {"source": [[10.0, 12.0]], "text": "one two"},
            {"source": [[20.0, 21.5], [23.0, 24.0]], "text": "three four",
             "scene": {"type": "STAMP"}},
            {"source": [[30.0, 35.0]], "text": "five six", "on": False, "why": "retake"},
        ],
    }


class Durations(unittest.TestCase):
    def test_holes_cost_nothing(self):
        t = fixture()
        self.assertAlmostEqual(tl.entry_duration(t["segments"][1]), 2.5)

    def test_cut_segment_is_excluded_from_the_total(self):
        t = fixture()
        self.assertAlmostEqual(tl.duration(t), 4.5)          # 2.0 + 2.5, line 3 dropped

    def test_reviving_a_cut_segment_just_adds_it_back(self):
        t = fixture()
        t["segments"][2]["on"] = True
        self.assertAlmostEqual(tl.duration(t), 9.5)

    def test_zero_length_spans_are_ignored(self):
        t = fixture()
        t["segments"][0]["source"] = [[10.0, 10.0], [11.0, 12.0]]
        self.assertAlmostEqual(tl.entry_duration(t["segments"][0]), 1.0)


class OutStart(unittest.TestCase):
    def test_segments_stack_in_order(self):
        t = fixture()
        self.assertAlmostEqual(tl.out_start(t, t["segments"][0]), 0.0)
        self.assertAlmostEqual(tl.out_start(t, t["segments"][1]), 2.0)

    def test_a_cut_segment_has_no_place_on_the_output(self):
        t = fixture()
        self.assertIsNone(tl.out_start(t, t["segments"][2]))

    def test_a_segment_from_a_different_timeline_has_no_place_here(self):
        self.assertIsNone(tl.out_start(fixture(), {"source": [[0.0, 1.0]], "text": "x"}))

    def test_cutting_an_earlier_segment_pulls_later_ones_back(self):
        t = fixture()
        t["segments"][0]["on"] = False
        self.assertAlmostEqual(tl.out_start(t, t["segments"][1]), 0.0)


class ProjectSrc(unittest.TestCase):
    def test_inside_the_first_span(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 20.5), 2.5)   # 2.0 + 0.5

    def test_inside_the_second_span_skips_the_hole(self):
        t = fixture()
        # 23.5s is 0.5s into the second span; the 1.5s hole (21.5-23.0) costs nothing
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 23.5), 4.0)   # 2.0+1.5+0.5

    def test_a_time_inside_a_removed_silence_lands_on_the_near_edge(self):
        t = fixture()
        # 22.0s was cut out of the montage; it must not project into material that is gone
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 22.0), 3.5)   # end of span 1

    def test_before_the_segment_clamps_to_its_start(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 5.0), 2.0)

    def test_past_the_last_span_clamps_to_the_end(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 99.0), 4.5)

    def test_span_boundaries_are_inclusive_and_continuous(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 21.5), 3.5)   # end of span 1
        self.assertAlmostEqual(tl.project_src(t, t["segments"][1], 23.0), 3.5)   # start of span 2

    def test_a_cut_segment_projects_nowhere(self):
        t = fixture()
        self.assertIsNone(tl.project_src(t, t["segments"][2], 31.0))


class Program(unittest.TestCase):
    def test_one_item_per_surviving_piece_of_source(self):
        p = tl.program(fixture())
        self.assertEqual([x["line"] for x in p], [1, 2, 2])

    def test_output_is_gapless_and_starts_at_zero(self):
        p = tl.program(fixture())
        self.assertAlmostEqual(p[0]["out"][0], 0.0)
        for a, b in zip(p, p[1:]):
            self.assertAlmostEqual(a["out"][1], b["out"][0])

    def test_each_item_keeps_its_source_length(self):
        for x in tl.program(fixture()):
            self.assertAlmostEqual(x["src"][1] - x["src"][0], x["out"][1] - x["out"][0])

    def test_it_ends_on_the_total_duration(self):
        t = fixture()
        self.assertAlmostEqual(tl.program(t)[-1]["out"][1], tl.duration(t))

    def test_an_empty_timeline_is_an_empty_program(self):
        self.assertEqual(tl.program(tl.blank()), [])


class Unproject(unittest.TestCase):
    def test_the_roundtrip_is_exact(self):
        """project(unproject(x)) == x is the invariant that holds everywhere, seams
        included. The other direction cannot: a seam has two source times mapping to the
        same output instant, so unproject has to pick one."""
        t = fixture()
        seg = t["segments"][1]
        start = tl.out_start(t, seg)
        for rel in (0.0, 0.4, 1.5, 1.6, 2.5):
            self.assertAlmostEqual(tl.project_src(t, seg, tl.unproject_rel(seg, rel)), start + rel)

    def test_it_inverts_project_src_away_from_the_seams(self):
        t = fixture()
        seg = t["segments"][1]
        for t_src in (20.0, 20.7, 23.4, 24.0):
            rel = tl.project_src(t, seg, t_src) - tl.out_start(t, seg)
            self.assertAlmostEqual(tl.unproject_rel(seg, rel), t_src)

    def test_it_never_returns_a_time_inside_the_hole(self):
        seg = fixture()["segments"][1]          # hole at 21.5-23.0
        for rel in (1.4, 1.49, 1.5, 1.51, 1.6):
            got = tl.unproject_rel(seg, rel)
            self.assertFalse(21.5 + 1e-9 < got < 23.0 - 1e-9,
                             "unproject_rel(%g) = %g, inside the removed silence" % (rel, got))

    def test_it_clamps_at_both_ends(self):
        seg = fixture()["segments"][1]
        self.assertAlmostEqual(tl.unproject_rel(seg, -1.0), 20.0)
        self.assertAlmostEqual(tl.unproject_rel(seg, 99.0), 24.0)

    def test_a_segment_with_no_span(self):
        self.assertIsNone(tl.unproject_rel({"source": []}, 1.0))


def raw_transcript_fixture():
    """A temp work dir whose timeline.json is `fixture()` and whose
    build/transcript-raw.json carries the real Whisper words `words()` aligns `text`
    against — "one"/"two"/"three"/"four" exactly, so line 1 and 2 resolve to real timings
    matching the old (pre-alignment) fixture's numbers exactly."""
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, "build"))
    raw = {"language": "en", "segments": [
        {"words": [{"word": "one", "start": 10.0, "end": 10.8},
                   {"word": "two", "start": 11.0, "end": 12.0}]},
        {"words": [{"word": "three", "start": 20.0, "end": 21.5},
                   {"word": "four", "start": 23.0, "end": 24.0}]},
    ]}
    with open(os.path.join(d, "build", "transcript-raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw, f)
    tl.save(d, fixture())
    return tl.load(d)


class Words(unittest.TestCase):
    def test_words_resolve_onto_the_output(self):
        t = raw_transcript_fixture()
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["t"] for x in w], ["one", "two"])
        self.assertAlmostEqual(w[0]["s"], 0.0)
        self.assertAlmostEqual(w[1]["e"], 2.0)

    def test_matched_words_keep_their_real_source_timing(self):
        t = raw_transcript_fixture()
        w = tl.words(t, t["segments"][0])
        self.assertEqual(w[0]["src"], [10.0, 10.8])
        self.assertEqual(w[1]["src"], [11.0, 12.0])

    def test_a_word_across_a_hole_projects_correctly(self):
        t = raw_transcript_fixture()
        w = tl.words(t, t["segments"][1])
        four = w[1]
        self.assertEqual(four["t"], "four")
        self.assertAlmostEqual(four["s"], 3.5)
        self.assertAlmostEqual(four["e"], 4.5)

    def test_a_cut_segment_still_has_words_but_no_output_time(self):
        t = raw_transcript_fixture()
        w = tl.words(t, t["segments"][2])
        self.assertEqual(w, [])

    def test_a_segment_with_empty_text_has_no_words(self):
        t = raw_transcript_fixture()
        t["segments"][0]["text"] = ""
        self.assertEqual(tl.words(t, t["segments"][0]), [])


class HotWords(unittest.TestCase):
    def test_a_marked_word_is_hot(self):
        t = raw_transcript_fixture()
        t["segments"][0]["text"] = "one *two*"
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["hot"] for x in w], [False, True])

    def test_a_marked_run_is_all_hot(self):
        t = raw_transcript_fixture()
        t["segments"][1]["text"] = "*three four*"
        w = tl.words(t, t["segments"][1])
        self.assertEqual([x["hot"] for x in w], [True, True])

    def test_the_stars_never_reach_the_word_text(self):
        t = raw_transcript_fixture()
        t["segments"][0]["text"] = "*one* two"
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["t"] for x in w], ["one", "two"])


class Rewording(unittest.TestCase):
    """Word timing is computed fresh from `text` every call — the direct replacement for the
    old, persisted sync_words(): a token that survives a rewording must keep its REAL
    timing, and only a token that actually changed gets an interpolated one."""

    def test_matching_text_keeps_every_real_timing(self):
        t = raw_transcript_fixture()
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["src"] for x in w], [[10.0, 10.8], [11.0, 12.0]])

    def test_an_inserted_word_does_not_disturb_its_matched_neighbours(self):
        t = raw_transcript_fixture()
        t["segments"][0]["text"] = "one and two"
        w = tl.words(t, t["segments"][0])
        self.assertEqual([x["t"] for x in w], ["one", "and", "two"])
        self.assertEqual(w[0]["src"], [10.0, 10.8])    # "one": untouched
        self.assertEqual(w[2]["src"], [11.0, 12.0])    # "two": untouched
        self.assertGreaterEqual(w[1]["src"][0], w[0]["src"][1])   # "and" sits between them
        self.assertLessEqual(w[1]["src"][1], w[2]["src"][0])

    def test_a_fully_new_sentence_still_stays_inside_the_segment(self):
        t = raw_transcript_fixture()
        t["segments"][1]["text"] = "a bb ccc dddd eeeee"
        self.assertEqual(tl.validate(t), [])
        w = tl.words(t, t["segments"][1])
        self.assertEqual(len(w), 5)
        self.assertGreaterEqual(w[0]["s"], tl.out_start(t, t["segments"][1]))

    def test_new_words_never_land_in_a_removed_silence(self):
        t = raw_transcript_fixture()
        t["segments"][1]["text"] = "a b c d e f g h"   # hole at 21.5-23.0
        for w in tl.words(t, t["segments"][1]):
            for x in w["src"]:
                self.assertFalse(21.5 + 0.001 < x < 23.0 - 0.001,
                                 "word boundary %g landed inside the removed silence" % x)

    def test_words_stay_in_order_and_do_not_overlap(self):
        t = raw_transcript_fixture()
        t["segments"][1]["text"] = "alpha beta gamma delta"
        ws = tl.words(t, t["segments"][1])
        for a, b in zip(ws, ws[1:]):
            self.assertLessEqual(a["e"], b["s"] + 1e-9)

    def test_emptying_the_text_empties_the_words(self):
        t = raw_transcript_fixture()
        t["segments"][0]["text"] = ""
        self.assertEqual(tl.words(t, t["segments"][0]), [])


class Validate(unittest.TestCase):
    def test_the_fixture_is_sound(self):
        self.assertEqual(tl.validate(fixture()), [])

    def test_overlapping_source_spans(self):
        t = fixture()
        t["segments"][1]["source"] = [[20.0, 23.0], [22.0, 24.0]]
        self.assertIn("overlap", " ".join(tl.validate(t)))

    def test_source_past_the_end_of_the_recording(self):
        t = fixture()
        t["segments"][0]["source"] = [[10.0, 900.0]]
        self.assertIn("past the recording", " ".join(tl.validate(t)))

    def test_an_active_segment_with_nothing_to_show(self):
        t = fixture()
        t["segments"][0]["source"] = []
        self.assertIn("no usable source span", " ".join(tl.validate(t)))

    def test_a_cut_segment_with_no_span_is_fine(self):
        t = fixture()
        t["segments"][2]["source"] = []
        self.assertEqual(tl.validate(t), [])

    def test_problems_are_reported_by_line_number(self):
        t = fixture()
        t["segments"][1]["source"] = [[900.0, 901.0]]
        self.assertIn("line 2", " ".join(tl.validate(t)))


class Lines(unittest.TestCase):
    """There are no ids: a segment is addressed by its 1-based position, stable across
    cut/restore (only `split` changes numbering, and it says so)."""

    def test_by_line_is_1_based(self):
        t = fixture()
        self.assertIs(tl.by_line(t, 1), t["segments"][0])
        self.assertIs(tl.by_line(t, 3), t["segments"][2])

    def test_by_line_out_of_range(self):
        t = fixture()
        self.assertIsNone(tl.by_line(t, 0))
        self.assertIsNone(tl.by_line(t, 4))

    def test_line_of_is_the_inverse_of_by_line(self):
        t = fixture()
        for n in (1, 2, 3):
            self.assertEqual(tl.line_of(t, tl.by_line(t, n)), n)

    def test_a_cut_segment_keeps_its_line_number(self):
        """Cutting only flips `on` — it must never renumber anything."""
        t = fixture()
        t["segments"][0]["on"] = False
        self.assertEqual(tl.line_of(t, t["segments"][2]), 3)


class SaveLoad(unittest.TestCase):
    def test_roundtrip_keeps_everything(self):
        t = fixture()
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            back = tl.load(d)
        self.assertEqual(back["segments"], t["segments"])
        self.assertAlmostEqual(tl.duration(back), tl.duration(t))

    def test_a_single_range_writes_as_a_bare_string(self):
        t = fixture()
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            with open(tl.path(d), encoding="utf-8") as f:
                raw = json.load(f)
        self.assertEqual(raw["segments"][0]["source"], "0:10.0-0:12.0")

    def test_a_multi_range_writes_as_a_list(self):
        t = fixture()
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            with open(tl.path(d), encoding="utf-8") as f:
                raw = json.load(f)
        self.assertEqual(raw["segments"][1]["source"], ["0:20.0-0:21.5", "0:23.0-0:24.0"])

    def test_on_true_is_not_written(self):
        """What is not written is not on: the common case (`on` true, or absent) must not
        clutter every line of a 180-sentence file."""
        t = fixture()
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            with open(tl.path(d), encoding="utf-8") as f:
                raw = json.load(f)
        self.assertNotIn("on", raw["segments"][0])
        self.assertEqual(raw["segments"][2]["on"], False)

    def test_save_restates_the_doc_and_version(self):
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, {"segments": []})
            back = tl.load(d)
        self.assertEqual(back["version"], tl.VERSION)
        self.assertTrue(back["_doc"])

    def test_internal_caches_never_reach_the_file(self):
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, fixture())
            back = tl.load(d)
            tl.words(back, back["segments"][0])   # populates back["_raw"]
            with open(tl.path(d), encoding="utf-8") as f:
                raw = json.load(f)
        self.assertNotIn("_work", raw)
        self.assertNotIn("_raw", raw)

    def test_non_ascii_survives_windows(self):
        """Arabic captions through a cp1252 default encoding is the bug that keeps
        recurring (#134, #140) — save() must write utf-8 explicitly."""
        t = tl.blank()
        t["segments"] = [{"source": [[0.0, 1.0]], "text": "كل شي"}]
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            with open(tl.path(d), encoding="utf-8") as f:
                raw = json.load(f)
        self.assertEqual(raw["segments"][0]["text"], "كل شي")


if __name__ == "__main__":
    unittest.main()
