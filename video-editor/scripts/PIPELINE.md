# PIPELINE.md — ordre d'exécution

Les scripts ne sont plus numérotés. L'ordre du pipeline vit ici et dans `SKILL.md`.
Chaque script prend `<work>` (le dossier de travail de la vidéo) en premier argument
et lit/écrit ses fichiers là.

## Mode « reel parlé » (défaut)

| # | Script | Entrée → Sortie | Notes |
|---|--------|-----------------|-------|
| 0 | `setup.sh` | — | vérifie/installe les outils (macOS · Windows · Linux) |
| 1 | `plan_cuts.py` | `src.mov` → `cut.json` | détecte les silences |
| 2 | `transcribe.py` | `a.wav` → `a.json` | `--language` · faster-whisper GPU/CPU ← whisper |
| 3 | *(correction manuelle)* | `a.json` + `fixes.json` | Claude corrige le texte avec l'utilisateur |
| 4 | `captions.py` | `cut.json` + `a.json` + `fixes.json` → `caps.json` | timing par mot sur la nouvelle timeline |
| 5 | `edit_script.py` | `caps.json` | `show` · `dupes` · `drop`/`keep`/`undo` — **avant** de dessiner les scènes |
| 6 | `reframe.py` | `src.mov` + `cut.json` → `cutz.mp4` | coupe + reframe 9:16 (accepte paysage) + zoom |
| — | *(extraire les frames)* | `cutz.mp4` → `vfr/*.jpg` | `ffmpeg -i cutz.mp4 -vf fps=30 vfr/%05d.jpg` |
| 7 | *(design)* | copier `compose.reference.html` → `<work>/compose.html`, réécrire les scènes |
| 8 | `sound_fx.py` | `sfx.json` → `sfx.wav` | effets générés (numpy) |
| 9 | `render_frames.js` | `compose.html` + `vfr/` → `out/*.jpg` | `all` · `range a b` · `preview t…` · `--force` |
| 10 | `safe_check.js` | `out/` → verdict (+ `safe.jpg`) | zone de sécurité Instagram + hook |
| 11 | `encode.sh` | `out/` + `cutz.mp4` + `sfx.wav` → `ad-final.mp4` | |
| 12 | `master_audio.sh` | `ad-final.mp4` → `ad-master.mp4` | −14 LUFS (+ `bg-audio.mp3` optionnel) |
| 13 | `subtitles.py` | `caps.json` → `ad-master.srt` + `.txt` | sous-titres + texte pour la légende |

Utilitaires : `contact_sheet.sh` (planche-contact), `remotion/remotion.sh` (moteur timeline live).
Options macOS : `fx/behind_text.js` + `fx/personmask.swift` (texte derrière la personne).

## Mode « montage b-roll » (indépendant, pas de parole)

`montage_mode.py <work> scan <dossier> → show → sheet → drop/keep → plan → build`
puis `master_audio.sh` sur le résultat.

## Helpers partagés

`lib/platform.sh` (scripts shell) · `lib/platform.js` (scripts Node) — détection OS, chemins,
Chrome, URL `file://`. À jour = ne rien coder en dur ailleurs.
