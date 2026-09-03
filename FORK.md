# FORK.md — video-editor

Fork de **[majedphotos/video-ad-editor](https://github.com/majedphotos/video-ad-editor)** (MIT, © Majed Alzaabi).
Objectif à terme : un système de montage vidéo local piloté par un agent, avec config par projet,
multi-langue, bibliothèque de styles, et plus tard une interface web. Voir la roadmap en bas.

Mainteneur du fork : Hatim Mrabet.

**Documentation technique complète : [`docs/`](docs/)** — cartographie des scripts, flux de
données, moteurs de rendu, invariants, et architecture cible ([`docs/design/`](docs/design/)).
Suivi d'avancement : [`docs/project-tracking.md`](docs/project-tracking.md).

---

## Ce que cette branche a changé (passe 1 — nettoyage)

### 1. Multiplateforme (macOS · Windows · Linux)
Rien de cassé côté macOS — on a seulement ajouté les branches Windows/Linux.

- **`scripts/lib/platform.js`** — `fileUrl()` (URL `file://` correcte via `pathToFileURL`),
  `chromePath()` (candidats par OS), `launchOptions()`, `resolvePuppeteer()`.
- **`scripts/lib/platform.sh`** — détection OS (`VEVO_OS`), `vevo_abspath()` (chemin
  Python-safe : Git-Bash renvoie `/c/...` que le Python natif ne comprend pas → `pwd -W`),
  `vevo_chrome_path()`, `vevo_pkg_mgr()`. Force aussi `PYTHONUTF8=1` (sinon les `print()`
  arabes plantent en cp1252 sous Windows).
- `render_frames.js` / `safe_check.js` : utilisent `lib/platform.js` au lieu de chemins codés en dur.
- `encode.sh` / `master_audio.sh` / `contact_sheet.sh` / `remotion/remotion.sh` : sourcent `lib/platform.sh`.
- Les scripts Python : garde `sys.stdout.reconfigure(encoding="utf-8")` en tête.
- `contact_sheet.sh` : ajoute les polices Windows à la liste PIL.

### 2. `scripts/transcribe.py` — nouveau, remplace l'appel direct à `python -m whisper`
- Moteurs, dans l'ordre : **faster-whisper GPU** (CUDA + `nvidia-cublas-cu12` / `nvidia-cudnn-cu12`)
  → faster-whisper CPU (int8) → openai-whisper CPU (fallback).
- Sortie `a.json` **identique** au format openai-whisper (segments · words · timings).
- `--language` (fr/en/ar/…), `--model`, `--engine`, `--device`, `--hard-dialect`, `--wav`, `--out`.
- `--hard-dialect` (auto pour `ar-MA` / `ar-DZ` / `darija`…) : VAD + anti-répétition +
  seuil no-speech élevé, et **avertit que le texte devra être corrigé à la main**
  (Whisper reste mauvais sur le darija même en large-v3).

### 3. `scripts/reframe.py` — accepte les sources paysage
- Source verticale (~9:16) → passe telle quelle (comportement d'origine inchangé).
- Source **16:9** → découpe un cadre vertical 9:16 avant le zoom.
- `theme.json` : `xAnchor` (0–1, horizontal · déf. 0.5), `yAnchor` (0–1 · déf. 0.30).

### 4. Renommage
Les scripts numérotés (`01_cut_plan.py`, `04b_remotion.sh`, …) → noms descriptifs.
L'ordre du pipeline vit dans `SKILL.md` + `scripts/PIPELINE.md`, plus dans les noms de fichiers.
Sous-dossiers : `scripts/lib/`, `scripts/remotion/`, `scripts/fx/`.
Dossier de la skill : `video-ad-editor/` → `video-editor/`.
Nom de la skill (`SKILL.md` frontmatter) : `video-ad-editor` → `video-editor`,
et le paquet de distribution devient `video-editor.skill`.

---

## Roadmap (passes suivantes — chacune son propre design)

1. **Système de config par projet** — `project.config.json` dans le dossier de la vidéo
   (langue, thème, orientation source, style de scènes) + defaults globaux.
2. **Bibliothèque de styles / thèmes** — presets de scènes réutilisables, rotation, personnalisation.
3. **Agent orchestrateur** — skills + workflows qui déroulent le pipeline sans commandes manuelles.
4. **Montage long-format YouTube** — moteur distinct du reel (jump cuts en masse, b-roll, chapitrage).
5. **Interface web** — dépôt vidéo + formulaire + bouton générer, sur le même moteur.
