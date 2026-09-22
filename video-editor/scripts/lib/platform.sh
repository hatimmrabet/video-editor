#!/bin/bash
# Cross-platform helpers shared by the shell scripts (Windows/Git-Bash · Linux).
# Source it at the top of a script:   . "$(dirname "$0")/lib/platform.sh"   (adjust the path)

# UTF-8 for Python's print() — without it cp1252 breaks Arabic output on Windows.
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

# Racine de la skill (indépendant du script qui source ce fichier — via BASH_SOURCE).
VEVO_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"          # .../scripts/lib
VEVO_SKILL_DIR="$(cd "$VEVO_LIB_DIR/../.." && pwd)"                   # racine de la skill
export VEVO_SKILL_DIR

# Interpréteur Python isolé : uv > .venv de la skill > python3 système (dernier recours).
# Tableau bash — s'utilise "${VEVO_PY[@]}" -c "..."  /  "${VEVO_PY[@]}" script.py
if command -v uv >/dev/null 2>&1; then
  VEVO_PY=(uv run --project "$VEVO_SKILL_DIR" python)
elif [ -x "$VEVO_SKILL_DIR/.venv/bin/python" ]; then
  VEVO_PY=("$VEVO_SKILL_DIR/.venv/bin/python")
elif [ -x "$VEVO_SKILL_DIR/.venv/Scripts/python.exe" ]; then          # disposition venv Windows
  VEVO_PY=("$VEVO_SKILL_DIR/.venv/Scripts/python.exe")
else
  VEVO_PY=(python3)
fi
# (VEVO_PY est un tableau bash — pas exportable ; les scripts qui sourcent ce fichier l'ont directement.)

# ffmpeg / ffprobe : $VEVO_FFMPEG / $VEVO_FFPROBE l'emportent (mêmes noms côté Python/JS),
# sinon le nom nu résolu via PATH — sinon le nom nu tel quel (peut arriver avant setup.sh).
: "${VEVO_FFMPEG:=$(command -v ffmpeg 2>/dev/null || echo ffmpeg)}"
: "${VEVO_FFPROBE:=$(command -v ffprobe 2>/dev/null || echo ffprobe)}"
export VEVO_FFMPEG VEVO_FFPROBE

# Current OS: windows | linux
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)  VEVO_OS=windows ;;
  Linux*)                VEVO_OS=linux ;;
  *)                     VEVO_OS=unknown ;;
esac
export VEVO_OS

# Resolve a work dir to an absolute path native Python can use.
# Git-Bash returns /c/... which Windows Python doesn't understand -> `pwd -W` gives C:/...
vevo_abspath() {
  ( cd "$1" 2>/dev/null && { pwd -W 2>/dev/null || pwd; } )
}

# System package manager per OS (for setup.sh).
vevo_pkg_mgr() {
  case "$VEVO_OS" in
    windows) command -v winget >/dev/null 2>&1 && echo winget ;;
    linux)   command -v apt-get >/dev/null 2>&1 && echo apt || { command -v dnf >/dev/null 2>&1 && echo dnf; } ;;
  esac
}
