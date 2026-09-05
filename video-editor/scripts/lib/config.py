# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""project.config.json partagé — load() lit et fusionne avec les défauts du skill.
Schéma complet : docs/design/project-config.md. N'invente ni `theme` ni `language`
manquants — ça, c'est le travail de la phase de configuration (SKILL.md), pas de load().

Pas de pont vers les anciens theme.json/stage.json/outro.json/safe.json : un seul
utilisateur, aucun projet existant à préserver — les scripts qui consomment ces champs
migrent directement vers config.load() (voir docs/design/roadmap.md, Pass 2)."""
import json
import os

_DEFAULTS_NAME = "defaults.config.json"


def _skill_dir():
    # scripts/lib/config.py -> scripts/lib -> scripts
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read_json(path, default=None):
    if os.path.exists(path):
        # utf-8-sig : tolère un BOM si le fichier a été enregistré depuis un éditeur Windows
        with open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    return {} if default is None else default


def _deep_merge(base, override):
    """Fusionne `override` par-dessus `base` — les dicts se fusionnent champ par champ,
    toute autre valeur remplace entièrement celle du dessous."""
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load(work):
    """Renvoie la config fusionnée : defaults.config.json (skill) <- project.config.json
    (projet). Pas de project.config.json ? Juste les défauts du skill — c'est à la phase
    de configuration d'en avoir écrit un avant qu'un script en ait besoin."""
    work = os.path.abspath(work)
    defaults = _read_json(os.path.join(_skill_dir(), _DEFAULTS_NAME))
    project = _read_json(os.path.join(work, "config", "project.config.json"))
    return _deep_merge(defaults, project)


if __name__ == "__main__":
    import sys
    print(json.dumps(load(sys.argv[1]), ensure_ascii=False, indent=1))
