# -*- coding: utf-8 -*-
"""render_data.py — flattening timeline.json into what the Remotion template reads.

Two things worth pinning: the scenes-key omission is deliberate (theme.ts falls back to
the hand-written Scenes.tsx on `null`, but an empty array is truthy in JS and would
silently disable it), and the `bottom` passthrough is the fix for issue #147 — the old
resolver dropped a motif's own declared height and every DOWN rect defaulted to 500px.

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

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def entry(eid, src, words=None, **extra):
    e = {"id": eid, "src": [list(s) for s in src]}
    if words:
        e["caption"] = {"text": " ".join(w for w, _, _ in words),
                        "words": [{"t": w, "src": [s, e_]} for w, s, e_ in words]}
    e.update(extra)
    return e


def work_with(entries, outro=None, theme=None):
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, "config"), exist_ok=True)
    with open(os.path.join(d, "config", "project.config.json"), "w", encoding="utf-8") as f:
        json.dump({"language": "en", "theme": theme or {}}, f)
    t = tl.blank({"file": "s.mp4", "duration": 120.0})
    t["timeline"] = entries
    if outro is not None:
        t["outro"] = outro
    tl.save(d, t)
    return d


def render(work, registry=None):
    remotion_dir = tempfile.mkdtemp()
    real = rd.motif_registry
    if registry is not None:
        rd.motif_registry = lambda skill_dir: registry
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            rc = rd.main(["render_data.py", work, remotion_dir])
    finally:
        rd.motif_registry = real
    with open(os.path.join(remotion_dir, "src", "timeline.json"), encoding="utf-8") as f:
        return rc, json.load(f)


class NoScenes(unittest.TestCase):
    def test_no_scenes_key_at_all(self):
        """theme.ts does `P.scenes || null`; an empty list is truthy in JS, so emitting one
        would silently disable the hand-written Scenes.tsx fallback."""
        work = work_with([entry("e001", [[0.0, 2.0]], [("hi", 0.0, 1.0)])])
        rc, payload = render(work)
        self.assertEqual(rc, 0)
        self.assertNotIn("scenes", payload)

    def test_the_summary_line_does_not_crash_without_scenes(self):
        """render_data.py:194-196 used to do len(payload["scenes"]) unconditionally, which
        KeyErrors on every video without a data-driven scene — i.e. most of them."""
        work = work_with([entry("e001", [[0.0, 2.0]])])
        rc, _ = render(work)
        self.assertEqual(rc, 0)


class Scenes(unittest.TestCase):
    def test_a_scene_is_projected_onto_the_output_clock(self):
        work = work_with([entry("e001", [[10.0, 14.0]],
                                [("a", 10.0, 11.0), ("b", 12.0, 13.0)],
                                scene={"motif": "stamp", "at": 0.5, "dur": 1.0})])
        _, payload = render(work, registry={"stamp": {"kind": "scene", "bottom": 480}})
        self.assertEqual(len(payload["scenes"]), 1)
        sc = payload["scenes"][0]
        self.assertAlmostEqual(sc["s"], 0.5)
        self.assertAlmostEqual(sc["e"], 1.5)

    def test_bottom_from_the_registry_reaches_the_stage_schedule(self):
        """Issue #147: the old resolver copied only an explicit layout.gb and dropped the
        motif's own declared bottom, so a tall motif got a 500px-default rect."""
        work = work_with([entry("e001", [[0.0, 2.0]], [("hi", 0.0, 1.0)],
                                video={"layout": "DOWN"},
                                scene={"motif": "comment-box"})])
        _, payload = render(work, registry={"comment-box": {"kind": "scene", "bottom": 1244}})
        self.assertEqual(payload["stage"][0]["gb"], 1244)
        self.assertEqual(payload["scenes"][0]["bottom"], 1244)

    def test_an_explicit_gb_overrides_the_registry(self):
        work = work_with([entry("e001", [[0.0, 2.0]], [("hi", 0.0, 1.0)],
                                video={"layout": "DOWN", "gb": 600},
                                scene={"motif": "stamp"})])
        _, payload = render(work, registry={"stamp": {"kind": "scene", "bottom": 400}})
        self.assertEqual(payload["stage"][0]["gb"], 600)

    def test_an_unimplemented_motif_is_dropped_not_fatal(self):
        work = work_with([entry("e001", [[0.0, 2.0]], [("hi", 0.0, 1.0)],
                                scene={"motif": "does-not-exist"})])
        rc, payload = render(work, registry={})
        self.assertEqual(rc, 0)
        self.assertNotIn("scenes", payload)

    def test_an_unknown_layout_falls_back_to_full(self):
        work = work_with([entry("e001", [[0.0, 2.0]], video={"layout": "SIDEWAYS"})])
        _, payload = render(work)
        self.assertEqual(payload["stage"][0]["m"], "FULL")


class Stage(unittest.TestCase):
    def test_identical_neighbouring_spans_are_merged(self):
        work = work_with([entry("e001", [[0.0, 2.0]]), entry("e002", [[5.0, 7.0]])])
        _, payload = render(work)
        self.assertEqual(len(payload["stage"]), 1, "both entries render FULL - one span")

    def test_a_layout_change_splits_the_schedule(self):
        work = work_with([entry("e001", [[0.0, 2.0]], video={"layout": "FULL"}),
                          entry("e002", [[5.0, 7.0]], video={"layout": "DOWN"})])
        _, payload = render(work)
        self.assertEqual(len(payload["stage"]), 2)

    def test_the_last_span_reaches_the_true_total(self):
        work = work_with([entry("e001", [[0.0, 2.0]])])
        _, payload = render(work)
        self.assertAlmostEqual(payload["stage"][-1]["e"], payload["total"])

    def test_a_cut_entry_is_absent_from_cards_and_stage(self):
        work = work_with([entry("e001", [[0.0, 2.0]], [("hi", 0.0, 1.0)]),
                          entry("e002", [[5.0, 7.0]], [("bye", 5.0, 6.0)], on=False)])
        _, payload = render(work)
        self.assertEqual(len(payload["cards"]), 1)


class Basics(unittest.TestCase):
    def test_outro_seconds_come_from_the_timeline_not_a_default(self):
        work = work_with([entry("e001", [[0.0, 2.0]])], outro={"seconds": 7.5})
        _, payload = render(work)
        self.assertAlmostEqual(payload["outro"], 7.5)

    def test_theme_passes_through_verbatim(self):
        """A whitelist would silently drop keys it did not know, or falsy-but-valid values
        like 0 or false. project.config.json still merges over the skill's own defaults
        (lib/config.py), so check the project's values won rather than an exact dict."""
        work = work_with([entry("e001", [[0.0, 2.0]])], theme={"bg": "#111", "badgeUntil": 0})
        _, payload = render(work)
        self.assertEqual(payload["theme"]["bg"], "#111")
        self.assertEqual(payload["theme"]["badgeUntil"], 0)

    def test_total_excludes_the_outro(self):
        work = work_with([entry("e001", [[0.0, 2.0]])], outro={"seconds": 100.0})
        _, payload = render(work)
        self.assertAlmostEqual(payload["total"], 2.0)


if __name__ == "__main__":
    unittest.main()
