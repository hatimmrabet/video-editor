# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is **not an application** — it is a Claude Code **skill**. `video-editor/SKILL.md` is
the entry point: it instructs the model to run a pipeline of small scripts
(`video-editor/scripts/`) that turn a talking-to-camera video into a captioned vertical
9:16 ad, entirely locally. There is no server, no build step, and no test suite.

The skill installs to `~/.claude/skills/video-editor/` (skill `name: video-editor`). When
developing, symlink the folder so edits are live:
`ln -s "$(pwd)/video-editor" ~/.claude/skills/video-editor`.

## Documentation is the source of truth for architecture

**`docs/` is comprehensive and current — read it before changing anything non-trivial.**

| Need | Read |
|---|---|
| Big picture (modes, engines, work-dir model) | `docs/architecture.md` |
| Exact stage order + data flow (with diagrams) | `docs/pipeline.md` |
| Every JSON schema + who reads/writes it | `docs/data-contracts.md` |
| The two rendering engines + where they've drifted | `docs/engines.md` |
| **Rules that must not be broken** (ten real-run bugs) | `docs/invariants.md` |
| Windows-specific gotchas | `docs/windows.md` |
| One reference page per script | `docs/scripts/` |
| Where the project is heading (design only, not built) | `docs/design/` |
| Roadmap → GitHub milestones/issues | `docs/design/roadmap.md`, `docs/project-tracking.md` |

The operational spec (`video-editor/SKILL.md`) is in English; on-screen caption text, the
end-card copy, and the trigger phrases stay Arabic (that is output content). `GUIDE.pdf`
is the Arabic end-user guide.

## Running the pipeline (there are no unit tests)

"Testing" a change means running the relevant pipeline stage on a real video. Every script
takes a **work directory** `<work>` as its first argument and reads/writes its files
there.

```bash
# check / install tools (ffmpeg, node, puppeteer-core, a Whisper engine, Chrome)
bash video-editor/scripts/setup.sh              # probe
bash video-editor/scripts/setup.sh --install    # install what's missing

# speech-ad pipeline (see docs/pipeline.md for the full order + manual steps)
python3 video-editor/scripts/plan_cuts.py <work>                 # src.mov -> cut.json
python3 video-editor/scripts/transcribe.py <work> --language ar --model large-v3
python3 video-editor/scripts/captions.py <work>                  # -> caps.json
python3 video-editor/scripts/edit_script.py <work> show          # drop sentences (BEFORE scene design)
python3 video-editor/scripts/reframe.py <work>                   # -> cutz.mp4
node   video-editor/scripts/render_frames.js <work> all          # -> out/*.jpg  (resume; --force re-renders)
node   video-editor/scripts/render_frames.js <work> range 12 18  # re-render one window after editing a scene
node   video-editor/scripts/render_frames.js <work> preview 4.6 12.3   # stills for review
bash   video-editor/scripts/encode.sh <work>                     # -> ad-final.mp4
node   video-editor/scripts/safe_check.js <work> --shot          # MANDATORY: safe zone + hook, exit 3 on violation
bash   video-editor/scripts/master_audio.sh <work> <work>/ad-final.mp4 <work>/ad-master.mp4

# Remotion engine (opt-in, replaces render_frames.js + encode.sh)
bash video-editor/scripts/remotion/remotion.sh <work> setup      # ~500 MB, once
bash video-editor/scripts/remotion/remotion.sh <work> render <work>/ad-final.mp4

# montage mode (independent — folder of speechless clips)
python3 video-editor/scripts/montage_mode.py <work> scan <clipdir> --shot 1.5
python3 video-editor/scripts/montage_mode.py <work> sheet --cols 6
python3 video-editor/scripts/montage_mode.py <work> plan --dur 30
python3 video-editor/scripts/montage_mode.py <work> build <work>/montage.mp4
```

Token economy matters here: a 1080-wide image ≈ 150k chars of context. Always review via
one `contact_sheet.sh` image at `scale=300:-1`, not separate stills; prefer
`safe_check.js`'s one-line verdict over screenshots; `grep -n` into `compose.html` rather
than reading it whole.

## Architecture essentials

- **Two modes, chosen from the input, never asked:** a single file with speech → speech
  ad (stages 0–13); a folder of clips → `montage_mode.py` (no transcription, no captions,
  no theme).
- **Two rendering engines with identical visual style:** the *light* engine
  (`render_frames.js` drives `compose.html` in headless Chrome, frame-by-frame to JPEGs)
  is always the default; the *Remotion* engine (`remotion.sh`, a live studio) is opened
  only if the user asks to edit visually. They share `caps.json`, `theme.json`, `sfx.wav`,
  `cutz.mp4`. **They have drifted** (rect values, caption widths — see
  `docs/engines.md`); a change to one usually needs the mirror change to the other.
- **Scenes are per-video code, not data (yet):** designing scenes = copying
  `compose.reference.html` → `<work>/compose.html` and rewriting the scene functions (and
  `Scenes.tsx` for Remotion). Timestamps are hardcoded per video. `edit_script.py` shifts
  all times, so run it *before* scene design. Making scenes data-driven is the largest
  item in `docs/design/`.
- **Cross-platform layer:** `scripts/lib/platform.sh` (sourced by every `.sh`) and
  `scripts/lib/platform.js` (required by the Node scripts) absorb macOS/Windows/Linux
  differences. Nothing else may hard-code a path or a Chrome location.
- **One hard macOS dependency:** `fx/personmask.swift` (Apple Vision) and therefore
  `fx/behind_text.js`. Everything that needs it skips itself elsewhere.

## Constraints when editing

- **Read `docs/invariants.md` before touching either engine.** The ten listed bugs are
  fixed in code and must not regress — especially: every scene call wrapped in `safe()`
  (save/restore + try/finally); `draw()` resets canvas state every frame; `img.decode()`
  after `img.src`; `setCacheEnabled(false)`.
- **No hardcoded colors in scene code** — everything derives from `theme.json` via the
  theme helpers (`rgba`, `lum`, `onACC`).
- **No color grade / filter over the person's video** by default (`reframe.py` only
  re-tags to bt709). `grade` is opt-in.
- **Never add ffmpeg `drawtext`** to any script — it is missing from many ffmpeg builds
  and fails silently. Burn text labels with Python/PIL (`contact_sheet.sh`,
  `montage_mode.py` do this).
- **Python scripts** keep `sys.stdout.reconfigure(encoding="utf-8")` at the top and write
  files with explicit `encoding="utf-8"` (Windows cp1252 otherwise breaks Arabic).
- **`.sh` scripts** need Git-Bash/WSL and resolve `<work>` through `vevo_abspath` before
  passing it to Python/Node. The Python scripts the skill calls directly do
  `os.path.abspath(sys.argv[1])` — the caller must pass a Windows-style path, not `/c/...`.
- **Docs live with the change:** a new script gets a `docs/scripts/` page; a changed JSON
  shape updates `docs/data-contracts.md`.

## Git / workflow

`main` is the fork's line (reset to v2.4 as the base for the rename + docs work; the
upstream v2.5 is preserved on the `majed-v2.5` branch, to be ported into the renamed
structure later). Upstream references to `majedphotos/video-ad-editor` are left as-is.
Branch names: `docs/<topic>`, `feat/<topic>`, `fix/<topic>`, `chore/<topic>`. Work is
tracked as GitHub Issues + the "video-editor roadmap" Project (see
`docs/project-tracking.md`).
