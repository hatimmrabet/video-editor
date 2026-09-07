# `test/` — the headless suite

Regression tests for the parts of the skill that have moving JavaScript: the local web UI
(`scripts/web.py` + `scripts/web/`), the static checks (`lint_compose.js`), the
`fx/behind_text.js` planner, the ffmpeg resolver, and the motif renderers. There is **no
test for the pipeline output itself** — "testing" a pipeline change still means running it
on a real video (see the repo `CLAUDE.md`).

## Run

```bash
cd video-editor
node test/run.mjs                 # the whole suite
node test/run.mjs sound scenes    # only files whose name contains an argument
node test/run.mjs --list
```

Needs **ffmpeg** (fixture clips) and **Node + `npm ci`** (Puppeteer's bundled Chromium).
The Python side is stdlib only — the tests spawn `scripts/web.py` and it shells `run.py` /
`tighten.py` / `montage_mode.py` via `lib.platform.python_argv()` (`uv run`, else the
`.venv`, else `python3`), so **no `uv sync` is required** for the suite.

## Layout

| | |
|---|---|
| `_lib.js` | the shared harness — `T.web(name, body)` (server + a Puppeteer page), `T.withBrowser(name, body)` (a page only), `T.node(name, body)` (neither). Plus `mkVideo` / `mkAudio` / `writeFiles` / `touchFuture` / `killTree` and a cross-platform venv-python resolver. Cross-platform (Linux CI + Windows). |
| `*.test.js` | one file per area. Each is a standalone Node script: it prints per-assertion `ok` / `FAIL` lines, then `PASS` / `FAIL`, and exits 0 / 1. |
| `run.mjs` | the runner — runs each `*.test.js` in turn (they each bind a port), applies `VE_TEST_TIMEOUT` (default 180 s), exits non-zero on any failure. Whole suite ≈ 35 s locally. |

| file | covers |
|---|---|
| `spa.test.js` | the SPA shell — list / create / config / drop zone / the state-driven stage list (#99) |
| `checkpoints.test.js` | the transcript + trim checkpoint screens (#100) |
| `scenes.test.js` | the scenes checkpoint screen — motif dropdown + params → `config/scenes.json` (#101) |
| `sound-result.test.js` | the sound (`<canvas>` waveform, cue placement) + Result screens (#102) |
| `montage-longform.test.js` | the project-type picker, montage `pick`, long-form `tighten` / `chapters` / `broll`, `runTarget` (#103) |
| `lint-compose.test.js` | `scripts/lint_compose.js` — every check on a deliberately broken `compose.html` (#53) |
| `behind-text.test.js` | `fx/behind_text.js plan` — proximity flags vs `build/person-cutout.json` (#52) |
| `ffmpeg-resolver.test.js` | `$VEVO_FFMPEG` / `$VEVO_FFPROBE` through `lib/platform.{py,js,sh}` + `run.py` (#44) |
| `motifs.test.js` | every implemented motif renders (changes pixels, no throw, no warn) on a real headless canvas |

## Notes

- The web tests stage `build/` files directly and future-date them (`touchFuture`) so
  `run.py`'s make-logic marks the earlier stages `SKIP` — they exercise **one screen**,
  not the whole pipeline.
- Node's global `fetch` (undici) asserts when a keep-alive socket is force-killed on
  teardown; `_lib`'s `harden()` swallows exactly that.
- `ffmpeg-resolver`'s shell check self-skips when the available `bash` can't source
  `platform.sh` (WSL mounts the FS differently than the Git-Bash the pipeline uses).
