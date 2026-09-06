#!/usr/bin/env bash
# Launch the local web UI.  bash scripts/web.sh [port]   (default 8800)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/platform.sh"
cd "$VEVO_SKILL_DIR"
exec uv run scripts/web.py "${1:-8800}"
