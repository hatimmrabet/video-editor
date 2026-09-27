# -*- coding: utf-8 -*-
"""render_data.py — compiling timeline.json into <remotion-dir>/src/plan.json.

Worth pinning: `scenes` and `overlays` are always present, even empty — nothing renders a
scene besides `scenes/SceneList.tsx`, so there's no fallback for an empty list to disable.
Which keywords exist is no business of this script: layouts, transitions, scenes and filters
pass through as written and the Remotion template's option folders judge them.

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
import render_data as rd  # noqa: E402
from lib import timeline as tl  # noqa: E402


def segment(source, text="", **extra):
    return dict({"source": [list(s) for s in source], "text": text}, **extra)


def work_with(entries, words=None, outro=None, theme=None, cfg_extra=None):
    """A work dir with `entries` as timeline.json and, when `words` is given,
    build/transcript-raw.json carrying those real Whisper words — so render_data.py's own
    call to tl.words() resolves each segment's `text` to real timings, not interpolated
    ones."""
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, "config"), exist_ok=True)
    conf = {"language": "en", "theme": theme or {}}
    if cfg_extra:
        conf.update(cfg_extra)
    with open(os.path.join(d, "config", "project.config.json"), "w", encoding="utf-8") as f:
        json.dump(conf, f)
    if words:
        os.makedirs(os.path.join(d, "build"), exist_ok=True)
        raw = {"language": "en", "segments": [{"words": [
            {"word": w, "start": s, "end": e} for w, s, e in words]}]}
        with open(os.path.join(d, "build", "transcript-raw.json"), "w", encoding="utf-8") as f:
            json.dump(raw, f)
    t = tl.blank({"file": "s.mp4", "duration": 120.0})
    t["segments"] = entries
    if outro is not None:
        t["outro"] = outro
    tl.save(d, t)
    return d


def render(work):
    remotion_dir = tempfile.mkdtemp()
    with contextlib.redirect_stdout(io.StringIO()):
        rc = rd.main(["render_data.py", work, remotion_dir])
    with open(os.path.join(remotion_dir, "src", "plan.json"), encoding="utf-8") as f:
        return rc, json.load(f)


class NoScenes(unittest.TestCase):
    def test_scenes_key_is_an_empty_list_not_omitted(self):
        """There is no fallback renderer for an omitted/empty `scenes` key to disable, so
        the key is always present, even for a project with no data-driven scene."""
        work = work_with([segment([[0.0, 2.0]], "hi")], words=[("hi", 0.0, 1.0)])
        rc, payload = render(work)
        self.assertEqual(rc, 0)
        self.assertEqual(payload["scenes"], [])

    def test_the_summary_line_does_not_crash_without_scenes(self):
        """The summary print must handle a project with no data-driven scene at all — the
        common case, not the exception."""
        work = work_with([segment([[0.0, 2.0]])])
        rc, _ = render(work)
        self.assertEqual(rc, 0)


class Scenes(unittest.TestCase):
    def test_a_scene_spans_its_whole_segment(self):
        """There is no more at/dur inside a segment: a scene lives exactly as long as the
        segment that carries it."""
        work = work_with([segment([[10.0, 14.0]], "a b", scene={"type": "STAMP"})],
                         words=[("a", 10.0, 11.0), ("b", 12.0, 13.0)])
        _, payload = render(work)
        self.assertEqual(len(payload["scenes"]), 1)
        sc = payload["scenes"][0]
        self.assertAlmostEqual(sc["s"], 0.0)
        self.assertAlmostEqual(sc["e"], 4.0)

    def test_a_scenes_words_are_its_segments_own(self):
        work = work_with([segment([[10.0, 14.0]], "a b", scene={"type": "STAMP"})],
                         words=[("a", 10.0, 11.0), ("b", 12.0, 13.0)])
        _, payload = render(work)
        self.assertEqual([w["t"] for w in payload["scenes"][0]["words"]], ["a", "b"])


class Stage(unittest.TestCase):
    def test_identical_neighbouring_spans_are_merged(self):
        work = work_with([segment([[0.0, 2.0]]), segment([[5.0, 7.0]])])
        _, payload = render(work)
        self.assertEqual(len(payload["stage"]), 1, "both segments render the same layout - one span")

    def test_a_layout_change_splits_the_schedule(self):
        work = work_with([segment([[0.0, 2.0]], layout="FULL"),
                          segment([[5.0, 7.0]], layout="SPLIT")])
        _, payload = render(work)
        self.assertEqual(len(payload["stage"]), 2)

    def test_the_last_span_reaches_the_true_total(self):
        work = work_with([segment([[0.0, 2.0]])])
        _, payload = render(work)
        self.assertAlmostEqual(payload["stage"][-1]["e"], payload["total"])

    def test_stage_spans_carry_their_line_number(self):
        work = work_with([segment([[0.0, 2.0]], layout="FULL"),
                          segment([[5.0, 7.0]], layout="SPLIT")])
        _, payload = render(work)
        self.assertEqual([s["line"] for s in payload["stage"]], [1, 2])

    def test_a_cut_segment_is_absent_from_cards_and_stage(self):
        work = work_with([segment([[0.0, 2.0]], "hi"), segment([[5.0, 7.0]], "bye", on=False)],
                         words=[("hi", 0.0, 1.0), ("bye", 5.0, 6.0)])
        _, payload = render(work)
        self.assertEqual(len(payload["cards"]), 1)


class Basics(unittest.TestCase):
    def test_outro_seconds_come_from_the_timeline_not_a_default(self):
        work = work_with([segment([[0.0, 2.0]])], outro={"seconds": 7.5})
        _, payload = render(work)
        self.assertAlmostEqual(payload["outro"], 7.5)

    def test_theme_passes_through_verbatim(self):
        """A whitelist would silently drop keys it did not know, or falsy-but-valid values
        like 0 or false. project.config.json still merges over the skill's own defaults
        (lib/config.py), so check the project's values won rather than an exact dict."""
        work = work_with([segment([[0.0, 2.0]])], theme={"bg": "#111", "badgeUntil": 0})
        _, payload = render(work)
        self.assertEqual(payload["theme"]["bg"], "#111")
        self.assertEqual(payload["theme"]["badgeUntil"], 0)

    def test_total_excludes_the_outro(self):
        work = work_with([segment([[0.0, 2.0]])], outro={"seconds": 100.0})
        _, payload = render(work)
        self.assertAlmostEqual(payload["total"], 2.0)

    def test_a_piece_carries_its_own_filter_and_zoom(self):
        work = work_with([segment([[0.0, 2.0]], filter="BLACK_AND_WHITE", zoom=1.1)])
        _, payload = render(work)
        self.assertEqual(payload["pieces"][0]["filter"], "BLACK_AND_WHITE")
        self.assertAlmostEqual(payload["pieces"][0]["z"], 1.1)

    def test_grade_passes_through(self):
        work = work_with([segment([[0.0, 2.0]])], cfg_extra={"grade": True})
        _, payload = render(work)
        self.assertTrue(payload["grade"])


if __name__ == "__main__":
    unittest.main()
