# -*- coding: utf-8 -*-
"""scripts/lib/timeline.py — the projection from source time to output time (issue #144).

This is the most load-bearing logic in the pipeline: every caption, every sound cue and
every rendered segment gets its position from it. The old design shifted stored timestamps
on every cut, which is what made a re-run resurrect deleted speech; here nothing is stored,
so the cases worth pinning are the ones where a time falls somewhere awkward — inside a
removed silence, past the end of a shortened sentence, or in an entry that was cut.

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
    """Three sentences. e002 has a hole in it (a silence removed mid-sentence) and e003
    is cut. Durations: e001 2.0s, e002 1.5+1.0 = 2.5s, e003 excluded."""
    return {
        "version": 1,
        "source": {"file": "build/source-joined.mp4", "duration": 60.0},
        "timeline": [
            {"id": "e001", "src": [[10.0, 12.0]],
             "caption": {"text": "one two",
                         "words": [{"t": "one", "src": [10.0, 10.8]},
                                   {"t": "two", "src": [11.0, 12.0], "hot": True}]}},
            {"id": "e002", "src": [[20.0, 21.5], [23.0, 24.0]],
             "caption": {"text": "three four",
                         "words": [{"t": "three", "src": [20.0, 21.5]},
                                   {"t": "four", "src": [23.0, 24.0]}]},
             "scene": {"motif": "stamp", "at": 0.5, "dur": 1.0}},
            {"id": "e003", "src": [[30.0, 35.0]], "on": False, "why": "retake"},
        ],
        "spans": [{"kind": "badge", "from": "e001", "to": "e002"}],
        "chapters": [{"at": "e001", "title": "Intro"}],
    }


class Durations(unittest.TestCase):
    def test_holes_cost_nothing(self):
        t = fixture()
        self.assertAlmostEqual(tl.entry_duration(tl.by_id(t, "e002")), 2.5)

    def test_cut_entry_is_excluded_from_the_total(self):
        t = fixture()
        self.assertAlmostEqual(tl.duration(t), 4.5)          # 2.0 + 2.5, e003 dropped

    def test_reviving_a_cut_entry_just_adds_it_back(self):
        t = fixture()
        tl.by_id(t, "e003")["on"] = True
        self.assertAlmostEqual(tl.duration(t), 9.5)

    def test_zero_length_spans_are_ignored(self):
        t = fixture()
        tl.by_id(t, "e001")["src"] = [[10.0, 10.0], [11.0, 12.0]]
        self.assertAlmostEqual(tl.entry_duration(tl.by_id(t, "e001")), 1.0)


class OutStart(unittest.TestCase):
    def test_entries_stack_in_order(self):
        t = fixture()
        self.assertAlmostEqual(tl.out_start(t, "e001"), 0.0)
        self.assertAlmostEqual(tl.out_start(t, "e002"), 2.0)

    def test_a_cut_entry_has_no_place_on_the_output(self):
        self.assertIsNone(tl.out_start(fixture(), "e003"))

    def test_unknown_id(self):
        self.assertIsNone(tl.out_start(fixture(), "nope"))

    def test_cutting_an_earlier_entry_pulls_later_ones_back(self):
        t = fixture()
        tl.by_id(t, "e001")["on"] = False
        self.assertAlmostEqual(tl.out_start(t, "e002"), 0.0)


class ProjectSrc(unittest.TestCase):
    def test_inside_the_first_span(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, "e002", 20.5), 2.5)   # 2.0 + 0.5

    def test_inside_the_second_span_skips_the_hole(self):
        t = fixture()
        # 23.5s is 0.5s into the second span; the 1.5s hole (21.5-23.0) costs nothing
        self.assertAlmostEqual(tl.project_src(t, "e002", 23.5), 4.0)   # 2.0 + 1.5 + 0.5

    def test_a_time_inside_a_removed_silence_lands_on_the_near_edge(self):
        t = fixture()
        # 22.0s was cut out of the montage; it must not project into material that is gone
        self.assertAlmostEqual(tl.project_src(t, "e002", 22.0), 3.5)   # end of the first span

    def test_before_the_entry_clamps_to_its_start(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, "e002", 5.0), 2.0)

    def test_past_the_last_span_clamps_to_the_end(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, "e002", 99.0), 4.5)

    def test_span_boundaries_are_inclusive_and_continuous(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_src(t, "e002", 21.5), 3.5)   # end of span 1
        self.assertAlmostEqual(tl.project_src(t, "e002", 23.0), 3.5)   # start of span 2

    def test_a_cut_entry_projects_nowhere(self):
        self.assertIsNone(tl.project_src(fixture(), "e003", 31.0))


class ProjectRel(unittest.TestCase):
    def test_a_hand_authored_cue_is_relative_to_its_entry(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_rel(t, "e002", 0.5), 2.5)

    def test_a_cue_past_a_shortened_sentence_fires_at_its_end(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_rel(t, "e002", 99.0), 4.5)

    def test_negative_is_clamped(self):
        t = fixture()
        self.assertAlmostEqual(tl.project_rel(t, "e002", -3.0), 2.0)

    def test_it_survives_a_cut_upstream(self):
        """The point of entry-relative time: shortening e001 moves the cue, but keeps it
        at the same place *within its own sentence*."""
        t = fixture()
        tl.by_id(t, "e001")["src"] = [[10.0, 11.0]]
        self.assertAlmostEqual(tl.project_rel(t, "e002", 0.5), 1.5)


class Program(unittest.TestCase):
    def test_one_item_per_surviving_piece_of_source(self):
        p = tl.program(fixture())
        self.assertEqual([x["entry"] for x in p], ["e001", "e002", "e002"])

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


class Words(unittest.TestCase):
    def test_words_resolve_onto_the_output(self):
        w = tl.words(fixture(), "e001")
        self.assertEqual([x["t"] for x in w], ["one", "two"])
        self.assertAlmostEqual(w[0]["s"], 0.0)
        self.assertAlmostEqual(w[1]["e"], 2.0)

    def test_hot_rides_along(self):
        self.assertEqual([x["hot"] for x in tl.words(fixture(), "e001")], [False, True])

    def test_a_word_across_a_hole_is_pulled_to_the_edge(self):
        t = fixture()
        tl.by_id(t, "e002")["caption"]["words"] = [{"t": "spanning", "src": [21.0, 23.5]}]
        w = tl.words(t, "e002")[0]
        self.assertAlmostEqual(w["s"], 3.0)
        self.assertAlmostEqual(w["e"], 4.0)

    def test_an_entry_with_no_caption(self):
        self.assertEqual(tl.words(fixture(), "e003"), [])


class Unproject(unittest.TestCase):
    def test_the_roundtrip_is_exact(self):
        """project(unproject(x)) == x is the invariant that holds everywhere, seams
        included. The other direction cannot: a seam has two source times mapping to the
        same output instant, so unproject has to pick one."""
        t = fixture()
        e = tl.by_id(t, "e002")
        start = tl.out_start(t, e)
        for rel in (0.0, 0.4, 1.5, 1.6, 2.5):
            self.assertAlmostEqual(tl.project_src(t, e, tl.unproject_rel(e, rel)), start + rel)

    def test_it_inverts_project_src_away_from_the_seams(self):
        t = fixture()
        e = tl.by_id(t, "e002")
        for t_src in (20.0, 20.7, 23.4, 24.0):
            rel = tl.project_src(t, e, t_src) - tl.out_start(t, e)
            self.assertAlmostEqual(tl.unproject_rel(e, rel), t_src)

    def test_it_never_returns_a_time_inside_the_hole(self):
        e = tl.by_id(fixture(), "e002")          # hole at 21.5-23.0
        for rel in (1.4, 1.49, 1.5, 1.51, 1.6):
            got = tl.unproject_rel(e, rel)
            self.assertFalse(21.5 + 1e-9 < got < 23.0 - 1e-9,
                             "unproject_rel(%g) = %g, inside the removed silence" % (rel, got))

    def test_it_clamps_at_both_ends(self):
        e = tl.by_id(fixture(), "e002")
        self.assertAlmostEqual(tl.unproject_rel(e, -1.0), 20.0)
        self.assertAlmostEqual(tl.unproject_rel(e, 99.0), 24.0)

    def test_an_entry_with_no_span(self):
        self.assertIsNone(tl.unproject_rel({"src": []}, 1.0))


class SyncWords(unittest.TestCase):
    def test_matching_text_is_left_alone(self):
        """Whisper's own per-word timing must survive on every sentence that was not
        reworded — this is the whole reason sync_words is conditional."""
        t = fixture()
        e = tl.by_id(t, "e001")
        before = json.dumps(e["caption"]["words"])
        self.assertFalse(tl.sync_words(e))
        self.assertEqual(json.dumps(e["caption"]["words"]), before)

    def test_a_reworded_sentence_gets_new_timings(self):
        t = fixture()
        e = tl.by_id(t, "e001")
        e["caption"]["text"] = "one two three four"
        self.assertTrue(tl.sync_words(e))
        self.assertEqual([w["t"] for w in e["caption"]["words"]], ["one", "two", "three", "four"])

    def test_new_words_stay_inside_the_entry(self):
        t = fixture()
        e = tl.by_id(t, "e002")
        e["caption"]["text"] = "a bb ccc dddd eeeee"
        tl.sync_words(e)
        self.assertEqual(tl.validate(t), [])

    def test_new_words_never_land_in_a_removed_silence(self):
        t = fixture()
        e = tl.by_id(t, "e002")          # hole at 21.5-23.0
        e["caption"]["text"] = "a b c d e f g h"
        tl.sync_words(e)
        for w in e["caption"]["words"]:
            for x in w["src"]:
                self.assertFalse(21.5 + 0.001 < x < 23.0 - 0.001,
                                 "word boundary %g landed inside the removed silence" % x)

    def test_hot_survives_a_rewording(self):
        t = fixture()
        e = tl.by_id(t, "e001")          # "two" is hot
        e["caption"]["text"] = "zero one two"
        tl.sync_words(e)
        self.assertEqual([w.get("hot", False) for w in e["caption"]["words"]], [False, False, True])

    def test_emptying_the_text_empties_the_words(self):
        t = fixture()
        e = tl.by_id(t, "e001")
        e["caption"]["text"] = ""
        self.assertTrue(tl.sync_words(e))
        self.assertEqual(e["caption"]["words"], [])

    def test_words_stay_in_order_and_do_not_overlap(self):
        t = fixture()
        e = tl.by_id(t, "e002")
        e["caption"]["text"] = "alpha beta gamma delta"
        tl.sync_words(e)
        ws = tl.words(t, e)
        for a, b in zip(ws, ws[1:]):
            self.assertLessEqual(a["e"], b["s"] + 1e-9)


class Spans(unittest.TestCase):
    def test_a_span_window_is_anchored_on_entry_ids(self):
        self.assertEqual(tl.span_window(fixture(), {"from": "e001", "to": "e002"}), [0.0, 4.5])

    def test_it_follows_the_entries_when_one_is_cut(self):
        t = fixture()
        tl.by_id(t, "e001")["on"] = False
        self.assertEqual(tl.span_window(t, {"from": "e002", "to": "e002"}), [0.0, 2.5])


class Validate(unittest.TestCase):
    def test_the_fixture_is_sound(self):
        self.assertEqual(tl.validate(fixture()), [])

    def test_duplicate_id(self):
        t = fixture()
        t["timeline"][1]["id"] = "e001"
        self.assertIn("duplicate id", " ".join(tl.validate(t)))

    def test_overlapping_src_spans(self):
        t = fixture()
        tl.by_id(t, "e002")["src"] = [[20.0, 23.0], [22.0, 24.0]]
        self.assertIn("overlap", " ".join(tl.validate(t)))

    def test_src_past_the_end_of_the_source(self):
        t = fixture()
        tl.by_id(t, "e001")["src"] = [[10.0, 900.0]]
        self.assertIn("past the source", " ".join(tl.validate(t)))

    def test_an_active_entry_with_nothing_to_show(self):
        t = fixture()
        tl.by_id(t, "e001")["src"] = []
        self.assertIn("no usable src span", " ".join(tl.validate(t)))

    def test_a_cut_entry_with_no_span_is_fine(self):
        t = fixture()
        tl.by_id(t, "e003")["src"] = []
        self.assertEqual(tl.validate(t), [])

    def test_unknown_layout(self):
        t = fixture()
        tl.by_id(t, "e001")["video"] = {"layout": "SIDEWAYS"}
        self.assertIn("unknown layout", " ".join(tl.validate(t)))

    def test_a_word_outside_its_entry(self):
        t = fixture()
        tl.by_id(t, "e001")["caption"]["words"][0]["src"] = [50.0, 51.0]
        self.assertIn("falls outside the entry", " ".join(tl.validate(t)))

    def test_a_span_pointing_at_a_ghost(self):
        t = fixture()
        t["spans"][0]["to"] = "e999"
        self.assertIn("unknown entry", " ".join(tl.validate(t)))

    def test_a_chapter_pointing_at_a_ghost(self):
        t = fixture()
        t["chapters"][0]["at"] = "e999"
        self.assertIn("unknown entry", " ".join(tl.validate(t)))


class SaveLoad(unittest.TestCase):
    def test_roundtrip_keeps_everything(self):
        t = fixture()
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            back = tl.load(d)
        self.assertEqual(back["timeline"], t["timeline"])
        self.assertAlmostEqual(tl.duration(back), tl.duration(t))

    def test_save_restates_the_doc_and_version(self):
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, {"timeline": []})
            back = tl.load(d)
        self.assertEqual(back["version"], tl.VERSION)
        self.assertTrue(back["_doc"])

    def test_non_ascii_survives_windows(self):
        """Arabic captions through a cp1252 default encoding is the bug that keeps
        recurring (#134, #140) — save() must write utf-8 explicitly."""
        t = tl.blank()
        t["timeline"] = [{"id": "e001", "src": [[0.0, 1.0]],
                          "caption": {"text": "كل شي", "words": [{"t": "كل", "src": [0.0, 0.5]}]}}]
        with tempfile.TemporaryDirectory() as d:
            tl.save(d, t)
            with open(tl.path(d), encoding="utf-8") as f:
                raw = json.load(f)
        self.assertEqual(raw["timeline"][0]["caption"]["text"], "كل شي")


if __name__ == "__main__":
    unittest.main()
