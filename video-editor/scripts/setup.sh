#!/bin/bash
# Check / prepare the toolchain — macOS · Windows (Git-Bash/WSL) · Linux.
#   ./setup.sh            → report only (no installs, no downloads)
#   ./setup.sh --install  → install missing system tools, then sync the isolated envs
#
# What lives where:
#   - System (installed here via brew/winget/apt): ffmpeg, node, uv
#   - Python deps  → uv-managed venv at ../.venv  (from ../pyproject.toml + ../uv.lock)
#   - Node deps    → ../node_modules  (npm ci; `puppeteer` brings its own Chromium)
#   - macOS only   → Xcode CLT for `swiftc` (person-cutout effect; skips itself elsewhere)
set -u
. "$(dirname "$0")/lib/platform.sh"
INSTALL=0; [ "${1:-}" = "--install" ] && INSTALL=1
SKILL="$VEVO_SKILL_DIR"
NOTE=()
have(){ command -v "$1" >/dev/null 2>&1; }
line(){ printf '%s\n' "$1"; }
pyok(){ "${VEVO_PY[@]}" -c "$1" >/dev/null 2>&1; }

line "os: $VEVO_OS · skill: $SKILL"
PKG="$(vevo_pkg_mgr)"
GPU=0; have nvidia-smi && GPU=1

# ─────────────────────────── report mode ──────────────────────────────────
if [ $INSTALL -eq 0 ]; then
  miss=()
  have "$VEVO_FFMPEG" || miss+=("ffmpeg")   # honours $VEVO_FFMPEG if it points elsewhere (issue #44)
  have node   || miss+=("node")
  have uv     || miss+=("uv")
  pyok "import numpy, PIL" || miss+=("python-env (.venv)")
  { pyok "import faster_whisper" || pyok "import whisper"; } || NOTE+=("no transcription engine yet — 'uv sync' pulls faster-whisper")
  node -e "require.resolve('puppeteer')" 2>/dev/null || miss+=("node-deps (puppeteer + Chromium)")
  if [ $GPU -eq 1 ] && pyok "import ctranslate2"; then
    if pyok "import nvidia.cublas, nvidia.cudnn"; then
      line "🎮 NVIDIA GPU + CUDA libs → transcription on GPU"
    else
      NOTE+=("GPU detected but CUDA libs not installed (nvidia-cublas/cudnn) — uv sync --extra gpu, or transcription falls back to CPU on its own (issue #130)")
    fi
  fi
  [ ${#NOTE[@]} -gt 0 ] && printf 'ℹ️  %s\n' "${NOTE[@]}"
  if [ ${#miss[@]} -eq 0 ]; then line "✅ ready."; exit 0; fi
  line "missing: ${miss[*]}"
  line "run: $0 --install"
  exit 10
fi

# ─────────────────────────── install mode ─────────────────────────────────
sys_install(){   # $1 = tool
  case "$PKG:$1" in
    brew:*)         brew install "$1" ;;
    winget:ffmpeg)  winget install --id Gyan.FFmpeg       -e --accept-source-agreements --accept-package-agreements --disable-interactivity ;;
    winget:node)    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --disable-interactivity ;;
    winget:uv)      winget install --id astral-sh.uv      -e --accept-source-agreements --accept-package-agreements --disable-interactivity ;;
    apt:ffmpeg)     sudo apt-get update -qq && sudo apt-get install -y ffmpeg ;;
    apt:node)       sudo apt-get update -qq && sudo apt-get install -y nodejs npm ;;
    dnf:*)          sudo dnf install -y "$1" ;;
    *)              return 1 ;;
  esac
}
uv_bootstrap(){
  have uv && return 0
  sys_install uv && have uv && return 0
  line "⏬ uv (standalone installer)…"
  if   have curl; then curl -LsSf https://astral.sh/uv/install.sh | sh
  elif have wget; then wget -qO- https://astral.sh/uv/install.sh | sh
  fi
  for d in "$HOME/.local/bin" "$HOME/.cargo/bin"; do [ -d "$d" ] && PATH="$d:$PATH"; done
  have uv
}

have uv     || { uv_bootstrap || NOTE+=("uv: install manually — https://docs.astral.sh/uv"); }
have "$VEVO_FFMPEG" || { line "⏬ ffmpeg…"; sys_install ffmpeg || NOTE+=("ffmpeg: install manually ($PKG unavailable)"); }
have node   || { line "⏬ node…";   sys_install node   || NOTE+=("node: install manually — need >= 22.12"); }
. "$(dirname "$0")/lib/platform.sh"          # re-source: pick up a freshly-installed uv

if have uv; then
  EXTRA=(); [ $GPU -eq 1 ] && { EXTRA=(--extra gpu); line "🎮 NVIDIA GPU → adding CUDA libs (large, one-time)"; }
  line "⏬ python deps (uv sync)…"
  ( cd "$SKILL" && uv sync "${EXTRA[@]}" ) || NOTE+=("uv sync failed — retry: cd '$SKILL' && uv sync")
else
  NOTE+=("uv missing → Python scripts fall back to system python3 (numpy/pillow/faster-whisper must be there)")
fi

if have npm; then
  line "⏬ node deps + Chromium (npm ci)…"
  ( cd "$SKILL" && npm ci --silent ) || ( cd "$SKILL" && npm install --silent ) || NOTE+=("npm failed — retry: cd '$SKILL' && npm ci")
fi

# ── darija fine-tune (issue #126) — automatic, not a step to remember by hand ──────
# `--needed` is cheap (no torch/transformers import): exit 0 only if defaults.config.json's
# language is a hard dialect AND the model isn't built yet. The extra is dropped again
# right after (`uv sync "${EXTRA[@]}"`) so the runtime venv doesn't carry
# torch/transformers/peft. Re-passing "${EXTRA[@]}" both times keeps the `gpu` extra (if it
# was synced above) from being stripped by these follow-up syncs — `uv sync` makes the venv
# match exactly the extras given *this* call, it doesn't add to what's already there (issue #130).
if have uv && ( cd "$SKILL" && uv run scripts/prepare_darija_model.py --needed ) >/dev/null 2>&1; then
  line "⏬ darija fine-tune (one-time, ~1.7 GB — issue #126)…"
  ( cd "$SKILL" && uv sync "${EXTRA[@]}" --extra darija-convert \
      && uv run scripts/prepare_darija_model.py \
      && uv sync "${EXTRA[@]}" ) \
    || NOTE+=("darija model prep failed — retry: cd '$SKILL' && uv sync --extra darija-convert && uv run scripts/prepare_darija_model.py && uv sync")
fi

# ─────────────────────────── verify ───────────────────────────────────────
FAIL=0
have "$VEVO_FFMPEG" || { FAIL=1; NOTE+=("ffmpeg still missing"); }
have node   || { FAIL=1; NOTE+=("node still missing"); }
pyok "import numpy, PIL" || { FAIL=1; NOTE+=("python deps not importable"); }
{ pyok "import faster_whisper" || pyok "import whisper"; } || NOTE+=("no transcription engine")
node -e "require.resolve('puppeteer')" 2>/dev/null || { FAIL=1; NOTE+=("puppeteer not installed"); }
[ $GPU -eq 1 ] && ! pyok "import nvidia.cublas, nvidia.cudnn" \
  && NOTE+=("GPU detected but CUDA libs not installed (nvidia-cublas/cudnn) — uv sync --extra gpu, or transcription falls back to CPU on its own (issue #130)")

[ ${#NOTE[@]} -gt 0 ] && printf 'ℹ️  %s\n' "${NOTE[@]}"
[ $FAIL -eq 0 ] && { line "✅ ready."; exit 0; }
line "❌ still incomplete — see notes above."; exit 11
