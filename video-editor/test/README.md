# `test/` — the headless suite

Regression tests for the parts of the skill that have moving JavaScript: the ffmpeg
resolver and the motif registry. There is **no test for the pipeline output itself** —
"testing" a pipeline change still means running it on a real video (see the repo
`CLAUDE.md`).

The scene and motif *code* is type-checked instead of tested here: it is TypeScript, so
`tsc --noEmit` (CI, and `remotion.sh <work> check` locally) does exactly what the old
`lint_compose.js` approximated with regexes.

There used to be a local web UI (`scripts/web.py` + `scripts/web/`, five of the seven test
files here) — a full second front end over `run.py`, built before the retakes rework
(#131) and never touched since. It duplicated decisions SKILL.md already makes through
Claude, had drifted from the pipeline it fronted (its transcript screen still enforced a
word-count match that `captions.py` stopped requiring, and its duplicate-sentence detector
was the pattern-matching approach #131 tried and abandoned), and nobody used it. Removed
along with it: Puppeteer, `.puppeteerrc.cjs`, and the top-level `package.json` — nothing
left at the skill root pulls in an npm dependency.

## Run

```bash
cd video-editor
node test/run.mjs                 # the whole suite
node test/run.mjs motifs          # only files whose name contains an argument
node test/run.mjs --list
```

Needs **ffmpeg** and **Node** — no `npm install`, no browser. The Python side is stdlib
only — `ffmpeg-resolver.test.js` shells `run.py` via `lib.platform.python_argv()` (`uv run`,
else the `.venv`, else `python3`), so **no `uv sync` is required** for the suite.

## Layout

| | |
|---|---|
| `_lib.js` | the shared harness — `T.node(name, body)`: no browser, no server, just `check()` + exit 0/1. Plus `tmp()` and a cross-platform venv-python resolver. |
| `*.test.js` | one file per area. Each is a standalone Node script: it prints per-assertion `ok` / `FAIL` lines, then `PASS` / `FAIL`, and exits 0 / 1. |
| `run.mjs` | the runner — runs each `*.test.js` in turn, applies `VE_TEST_TIMEOUT` (default 180 s), exits non-zero on any failure. |

| file | covers |
|---|---|
| `ffmpeg-resolver.test.js` | `$VEVO_FFMPEG` / `$VEVO_FFPROBE` through `lib/platform.{py,js,sh}` + `run.py` (#44) |
| `motifs.test.js` | the motif registry — every implemented motif in `motifs/index.json` is imported, dispatched by `SceneList.tsx`, backed by a component, and its declared params match that component's type |

## Notes

- Node's global `fetch` (undici) asserts when a keep-alive socket is force-killed on
  teardown; `_lib`'s `harden()` swallows exactly that — harmless now that nothing here
  opens a socket, kept because `T.node` still calls it.
- `ffmpeg-resolver`'s shell check self-skips when the available `bash` can't source
  `platform.sh` (WSL mounts the FS differently than the Git-Bash the pipeline uses).
