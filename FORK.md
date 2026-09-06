# FORK.md — video-editor

Fork de **[majedphotos/video-ad-editor](https://github.com/majedphotos/video-ad-editor)** (MIT, © Majed Alzaabi).
Objectif à terme : un système de montage vidéo local piloté par un agent, avec config par projet,
multi-langue, bibliothèque de styles, et plus tard une interface web. Voir la roadmap en bas.

Mainteneur du fork : Hatim Mrabet.

**Documentation technique complète : [`docs/`](docs/)** — cartographie des scripts, flux de
données, moteurs de rendu, invariants, et architecture cible ([`docs/design/`](docs/design/)).
Suivi d'avancement : [`docs/project-tracking.md`](docs/project-tracking.md).

---

## Passe de nettoyage (multiplateforme + renommage)

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

## Roadmap

Séquençage détaillé et à jour : [`docs/design/roadmap.md`](docs/design/roadmap.md)
(chaque passe = un milestone GitHub, son propre plan avant le code). Suivi :
[`docs/project-tracking.md`](docs/project-tracking.md).

| Passe | | État |
|---|---|---|
| 0 | **Documentation** — `docs/` (cartographie, contrats de données, moteurs, invariants) | ✅ fait |
| 1 | **Exécution isolée** — `uv` pour Python, Chromium embarqué, plus de `--break-system-packages` ([`docs/design/execution.md`](docs/design/execution.md)) | ✅ fait |
| 2 | **Config par projet** — `project.config.json` (langue, thème, layout, scènes) ; migration directe, sans pont rétro-compat | ✅ fait |
| 3 | **Bibliothèque de transitions** — vocabulaire nommé et paramétré, commun aux 2 moteurs + montage | ✅ fait |
| 4 | **Scènes-données + registre de motifs** — une scène = donnée, rendue à l'identique par les 2 moteurs (fin de la triple maintenance) | ✅ fait |
| 5 | **Runner orchestrateur** — `scripts/run.py` piloté par la config, pauses aux points de décision | ✅ fait (#21 `run.py` + manifestes · #22 conception des sous-agents) |
| 6 | **Monde `long-form`** — montage YouTube 16:9 (jump cuts, chapitrage, b-roll) | 🚧 conception faite (#23 — [`docs/design/long-form.md`](docs/design/long-form.md)) |
| 7 | **Interface web** — dépôt vidéo + formulaire → `run.py`, sur le même moteur | 🚧 conception faite (#24 — [`docs/design/web.md`](docs/design/web.md)) |

Correspondance avec la vision d'origine de ce fork : config par projet → 2 · bibliothèque de
styles → 4 · agent orchestrateur → 5 · long-format YouTube → 6 · interface web → 7.
Les passes 1 (exécution) et 3 (transitions) ont été explicitées en cours de route.
