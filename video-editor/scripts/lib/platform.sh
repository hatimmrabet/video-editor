#!/bin/bash
# Helpers multiplateforme partagés par les scripts shell (macOS · Windows/Git-Bash · Linux).
# À sourcer en début de script :   . "$(dirname "$0")/lib/platform.sh"   (ajuster le chemin relatif)
# Ne change rien au comportement macOS : ajoute seulement les branches Windows/Linux.

# UTF-8 pour les print() Python (sinon cp1252 plante sur les sorties arabes sous Windows).
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

# OS courant : mac | windows | linux
case "$(uname -s 2>/dev/null)" in
  Darwin*)               VEVO_OS=mac ;;
  MINGW*|MSYS*|CYGWIN*)  VEVO_OS=windows ;;
  Linux*)                VEVO_OS=linux ;;
  *)                     VEVO_OS=unknown ;;
esac
export VEVO_OS

# Résout un dossier de travail vers un chemin absolu utilisable par Python natif.
# Git-Bash renvoie /c/... que le Python Windows ne comprend pas -> `pwd -W` donne C:/...
vevo_abspath() {
  ( cd "$1" 2>/dev/null && { pwd -W 2>/dev/null || pwd; } )
}

# Chemin de l'exécutable Chrome (respecte $CHROME_PATH, sinon candidats par OS, sinon vide).
vevo_chrome_path() {
  if [ -n "$CHROME_PATH" ] && [ -x "$CHROME_PATH" ]; then printf '%s\n' "$CHROME_PATH"; return 0; fi
  local c
  case "$VEVO_OS" in
    mac)
      for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
               "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
        [ -x "$c" ] && { printf '%s\n' "$c"; return 0; }; done ;;
    windows)
      local pf86; pf86="$(printenv 'PROGRAMFILES(X86)' 2>/dev/null)"
      for c in "$PROGRAMFILES/Google/Chrome/Application/chrome.exe" \
               "${pf86:+$pf86/Google/Chrome/Application/chrome.exe}" \
               "$LOCALAPPDATA/Google/Chrome/Application/chrome.exe"; do
        [ -n "$c" ] && [ -f "$c" ] && { printf '%s\n' "$c"; return 0; }; done ;;
    *)
      for c in /usr/bin/google-chrome /usr/bin/google-chrome-stable \
               /usr/bin/chromium /usr/bin/chromium-browser /snap/bin/chromium; do
        [ -x "$c" ] && { printf '%s\n' "$c"; return 0; }; done ;;
  esac
  return 1
}

# Gestionnaire de paquets système par OS (pour setup.sh).
vevo_pkg_mgr() {
  case "$VEVO_OS" in
    mac)     command -v brew   >/dev/null 2>&1 && echo brew ;;
    windows) command -v winget >/dev/null 2>&1 && echo winget ;;
    linux)   command -v apt-get >/dev/null 2>&1 && echo apt || { command -v dnf >/dev/null 2>&1 && echo dnf; } ;;
  esac
}
