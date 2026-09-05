# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Shared transition + easing vocabulary — the reader side of scripts/transitions.json.

`load()` returns the whole table. `resolve(spec, kind)` turns a spec (a shorthand string
`"push:0.3:up"`, a dict, or None) into a full `{type, duration, easing, params}` dict,
filling anything missing from the named kind's defaults.

Full explanation: docs/design/transitions.md."""
import json
import os

_TABLE_NAME = "transitions.json"
_KINDS = ("sceneToScene", "sceneEnter", "sceneExit", "outro", "montage")


def _skill_dir():
    # scripts/lib/transitions.py -> scripts/lib -> scripts
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load():
    """The parsed scripts/transitions.json."""
    with open(os.path.join(_skill_dir(), _TABLE_NAME), encoding="utf-8-sig") as f:
        return json.load(f)


def _parse_shorthand(s, table):
    """`type` | `type:duration` | `type:duration:param` -> a partial dict."""
    parts = s.split(":")
    out = {"type": parts[0]}
    if len(parts) > 1 and parts[1] != "":
        out["duration"] = float(parts[1])
    if len(parts) > 2 and parts[2] != "":
        names = (table.get("types", {}).get(parts[0], {}) or {}).get("params", [])
        if names:
            out["params"] = {names[0]: parts[2]}
        else:
            out["params"] = {"raw": parts[2]}
    return out


def resolve(spec, kind, table=None):
    """A full `{type, duration, easing, params}` (+ `sfx` if set).

    spec: a shorthand string, a dict, or None (use the kind's default verbatim).
    kind: one of _KINDS — supplies duration / easing / params when the spec omits them.
    """
    if kind not in _KINDS:
        raise ValueError("unknown transition kind: %r (expected one of %s)" % (kind, ", ".join(_KINDS)))
    table = table or load()
    base = dict(table.get("defaults", {}).get(kind, {}))

    if spec is None:
        part = {}
    elif isinstance(spec, str):
        part = _parse_shorthand(spec, table)
    elif isinstance(spec, dict):
        part = dict(spec)
    else:
        raise TypeError("transition spec must be str, dict or None, got %r" % type(spec).__name__)

    out = dict(base)
    out.update({k: v for k, v in part.items() if k != "params"})

    # params: type-level defaults <- kind default's params <- spec's params
    tp = table.get("types", {}).get(out.get("type"), {}) or table.get("elementAnim", {}).get(out.get("type"), {})
    params = {}
    for name in tp.get("params", []) if isinstance(tp.get("params"), list) else []:
        pdef = table.get("params", {}).get(name, {})
        if "default" in pdef:
            params[name] = pdef["default"]
    if isinstance(tp.get("params"), dict):        # elementAnim carries its params as a value dict
        params.update(tp["params"])
    params.update(base.get("params", {}) or {})
    params.update((part.get("params") or {}))
    out["params"] = params

    out.setdefault("duration", base.get("duration", 0.0))
    out.setdefault("easing", base.get("easing", "linear"))
    return out


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 1:
        print(json.dumps(load(), ensure_ascii=False, indent=1))
    else:
        kind = sys.argv[1]
        spec = None
        if len(sys.argv) > 2:
            spec = sys.argv[2]
            if spec.lstrip().startswith("{"):        # an object passed as JSON (from transitions.js)
                spec = json.loads(spec)
        print(json.dumps(resolve(spec, kind), ensure_ascii=False, indent=1))
