# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Shared project.config.json — load() reads it and merges it over the skill defaults.
Full schema: docs/design/project-config.md. Does not invent a missing `theme` or
`language` — that's the configuration phase's job (SKILL.md), not load()'s.

No bridge to the old theme.json/stage.json/outro.json/safe.json: one user, no existing
project to preserve — the scripts that consume those fields migrate straight to
config.load() (see docs/design/roadmap.md, Pass 2)."""
import json
import os

_DEFAULTS_NAME = "defaults.config.json"


def _skill_dir():
    # scripts/lib/config.py -> scripts/lib -> scripts
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read_json(path, default=None):
    if os.path.exists(path):
        # utf-8-sig: tolerate a BOM if the file was saved from a Windows editor
        with open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    return {} if default is None else default


def _deep_merge(base, override):
    """Merge `override` onto `base` — dicts merge field by field, any other value
    replaces the one below it entirely."""
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load(work):
    """The merged config: defaults.config.json (skill) <- project.config.json (project).
    No project.config.json? Just the skill defaults — the configuration phase is meant to
    have written one before any script needs it."""
    work = os.path.abspath(work)
    defaults = _read_json(os.path.join(_skill_dir(), _DEFAULTS_NAME))
    project = _read_json(os.path.join(work, "config", "project.config.json"))
    return _deep_merge(defaults, project)


if __name__ == "__main__":
    import sys
    print(json.dumps(load(sys.argv[1]), ensure_ascii=False, indent=1))
