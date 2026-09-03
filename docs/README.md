# video-editor — Documentation

Technical reference for **video-editor** — a Claude Code skill that turns a talking-head
video into a captioned vertical 9:16 ad. Origin and history: [`../FORK.md`](../FORK.md).

This directory is the map of the codebase: what every script does, how data flows
between them, how the two rendering engines work, and where the project is heading.

> **Audience & language.** These docs are for contributors and maintainers, and are
> written in **English**, as is `video-editor/SKILL.md` (the skill instructions). The
> end-user `video-editor/GUIDE.pdf` and the on-screen caption / trigger-phrase text are
> **Arabic** — that's output content, not instruction, and is not duplicated here.

## How to read this

Start here, in order:

| Doc | Read it when you want to… |
|---|---|
| [architecture.md](architecture.md) | Understand the big picture — two modes, two engines, the "work dir" model, "the whole edit is code". |
| [pipeline.md](pipeline.md) | Follow the exact stage order and which file each stage reads/writes. |
| [data-contracts.md](data-contracts.md) | Look up the schema of any JSON file (`theme.json`, `caps.json`, `cut.json`, …). |
| [engines.md](engines.md) | Understand the light (canvas/Puppeteer) engine vs the Remotion engine, and where they have drifted. |
| [invariants.md](invariants.md) | Know the rules you must not break — ten bugs found in real runs, distilled. |
| [windows.md](windows.md) | Run or debug the pipeline on Windows. |
| [glossary.md](glossary.md) | Decode a term (hook, safe zone, kashida, hot word, stage/rect mode, LUFS…). |
| [scripts/](scripts/) | Read the reference page for one specific script. |
| [design/](design/) | See the target architecture — where the project is going, not where it is. |
| [project-tracking.md](project-tracking.md) | See how work is tracked (GitHub Issues + Projects) and the seed backlog. |

## One-paragraph summary

You record yourself talking to a camera. The pipeline removes the silences, transcribes
your speech with per-word timing, lets you delete whole sentences from the text (they
drop out of the video too), reframes to vertical 9:16, draws synced Arabic captions and
code-drawn motion graphics over the video, adds procedurally-generated sound effects and
an end card, normalizes the audio to platform loudness (−14 LUFS), and checks that no
text hides under Instagram's buttons. Output: one publish-ready MP4 plus an `.srt` and a
plain-text transcript. Everything runs on your machine; **no video is uploaded anywhere.**

A second, independent **montage mode** takes a folder of speechless clips (café, travel,
product, place) and cuts them into one rhythmic montage, picking the best moment of each
clip by sharpness / motion / lighting / color.

## Repo layout (orientation)

```
video-editor/                     ← repo root
  README.md                        landing page + install instructions
  FORK.md                          origin + roadmap
  CONTRIBUTING.md                  where things live, how work is tracked
  docs/                            ← you are here
  video-editor/                    ← the actual skill (installed to ~/.claude/skills/video-ad-editor)
    SKILL.md                       the Claude skill spec — operational source of truth
    GUIDE.html / GUIDE.pdf         13-page end-user guide (Arabic)
    package.json                   one dep: puppeteer-core
    scripts/                       the pipeline (see scripts/)
      lib/                         cross-platform helpers (platform.sh, platform.js)
      fx/                          macOS-only person-cutout effects
      remotion/                    the second engine (driver + template/)
      compose.reference.html       the light engine's drawing surface
      studio.html                  standalone scrubber for the light engine
      PIPELINE.md                  thin pointer to docs/pipeline.md
```
