# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Resolve config/scenes.json against build/captions.json.

load(work) -> { "scenes": [...] | None, "schedule": [...] | None }

- `scenes` is None when config/scenes.json is absent (the engine then behaves exactly as
  today — inline SCENES / config/stage.json).
- each resolved scene: { s, e, mode, transition, gb, motif, params, timing, words, bottom }.
  `motif` is nulled if it isn't `status:"implemented"` in scripts/motifs/index.json (the
  layout still applies, the graphic is dropped) — invariant #2 style: a bad reference never
  stops the render.
- `schedule` is the video-rect timeline derived from the scenes' `layout`, replacing
  config/stage.json when scenes.json is present.

Schema: docs/design/scenes-as-data.md."""
import json
import os

_MODES = ("FULL", "DOWN", "LOWER")


def _skill_dir():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read_json(path, default=None):
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    return default


def _resolve_ref(ref, cards):
    """{sentence:N} | {sentence:N, words:[a,b]} | {range:[t0,t1]} -> (s, e) or None."""
    if not isinstance(ref, dict):
        return None
    if "range" in ref:
        r = ref["range"]
        try:
            return float(r[0]), float(r[1])
        except (TypeError, ValueError, IndexError):
            return None
    n = ref.get("sentence")
    if not isinstance(n, int) or n < 0 or n >= len(cards):
        return None
    c = cards[n]
    ws = c.get("w", [])
    if "words" in ref:
        try:
            a, b = ref["words"]
        except (TypeError, ValueError):
            return None
        if not (0 <= a < len(ws)) or not (0 <= b < len(ws)) or b < a:
            return None
        return float(ws[a]["s"]), float(ws[b]["e"])
    return float(c["s"]), float(c["e"])


def _ref_words(ref, cards):
    """The ref sentence's words (for timing.hold == 'words'). [] for a range ref."""
    if isinstance(ref, dict) and isinstance(ref.get("sentence"), int):
        n = ref["sentence"]
        if 0 <= n < len(cards):
            return [{"t": w.get("t", ""), "s": w["s"], "e": w["e"], "hot": bool(w.get("hot"))}
                    for w in cards[n].get("w", [])]
    return []


def _build_schedule(scenes):
    """Non-overlapping video-rect spans from the scenes, gaps filled with FULL, trailing FULL."""
    if not scenes:
        return None
    out, cursor = [], 0.0
    for sc in sorted(scenes, key=lambda x: x["s"]):
        if sc["s"] > cursor + 0.01:
            out.append({"s": round(cursor, 3), "e": round(sc["s"], 3), "m": "FULL"})
        entry = {"s": round(sc["s"], 3), "e": round(sc["e"], 3), "m": sc["mode"]}
        if sc.get("transition"):
            entry["transition"] = sc["transition"]
        if sc.get("gb") is not None:
            entry["gb"] = sc["gb"]
        out.append(entry)
        cursor = max(cursor, sc["e"])
    out.append({"s": round(cursor, 3), "e": 9999, "m": "FULL"})

    merged = [out[0]]
    for e in out[1:]:
        p = merged[-1]
        if (p["m"] == e["m"] and "transition" not in e and "gb" not in e
                and "transition" not in p and abs(p["e"] - e["s"]) < 0.01):
            p["e"] = e["e"]
        else:
            merged.append(e)
    return merged


def load(work):
    work = os.path.abspath(work)
    raw = _read_json(os.path.join(work, "config", "scenes.json"))
    if raw is None:
        return {"scenes": None, "schedule": None}
    if not isinstance(raw, list):
        return {"scenes": None, "schedule": None}

    cards = (_read_json(os.path.join(work, "build", "captions.json"), {}) or {}).get("cards", [])
    midx = (_read_json(os.path.join(_skill_dir(), "motifs", "index.json"), {}) or {}).get("motifs", {})

    scenes = []
    for sc in raw:
        if not isinstance(sc, dict):
            continue
        span = _resolve_ref(sc.get("ref", {}), cards)
        if span is None:
            continue
        s, e = span
        layout = sc.get("layout", "FULL")
        if isinstance(layout, str):
            mode, transition, gb = layout, None, None
        else:
            mode = layout.get("mode", "FULL")
            transition = layout.get("transition")
            gb = layout.get("gb")
        if mode not in _MODES:
            mode = "FULL"

        motif = sc.get("motif") or None
        mdef = midx.get(motif, {}) if motif else {}
        if motif and mdef.get("status") != "implemented":
            motif = None  # planned / unknown — keep layout, drop graphic

        scenes.append({
            "s": round(s, 3), "e": round(e, 3),
            "mode": mode, "transition": transition, "gb": gb,
            "motif": motif,
            "kind": mdef.get("kind", "scene"),   # "scene" | "overlay" (no container rise)
            "params": sc.get("params", {}) if isinstance(sc.get("params"), dict) else {},
            "timing": sc.get("timing", {}) if isinstance(sc.get("timing"), dict) else {},
            "words": _ref_words(sc.get("ref", {}), cards),
            "bottom": mdef.get("bottom"),
        })

    return {"scenes": scenes, "schedule": _build_schedule(scenes)}


if __name__ == "__main__":
    import sys
    print(json.dumps(load(sys.argv[1]), ensure_ascii=False, indent=1))
