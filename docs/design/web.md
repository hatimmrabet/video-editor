# Web interface — a local UI over `run.py`

Status: **design (issue #24)** — nothing built. Spec + implementation plan for roadmap
Pass 7, the capstone. It assumes Pass 5 ([`run.py`](orchestrator.md)) and, ideally, Pass 4
(`config/scenes.json`) exist — both do.

## Problem

Today the whole edit is a conversation with an agent typing commands. That's the skill's
strength, but it means: no way for the creator to run a repeat job without an agent, no
visual scrub of the decisions (which sentences to cut, which scene where), and no on-ramp
for someone who just wants to drop a video and get a reel.

`run.py` already turned the pipeline into "run the mechanical spans, stop at the four
decisions". The web UI is the thin visual layer over exactly that: **a form writes the
config, a button calls `run.py`, and each `run.py` checkpoint becomes a screen.**

## Principles

1. **Local only.** Binds `127.0.0.1`, no auth, no accounts, no cloud, no telemetry. The
   video never leaves the machine (invariant — "local only" is the whole point of the
   skill). No publishing, no scheduling (invariant #7).
2. **Thin over `run.py`.** The server shells out to `run.py` and the same scripts; it does
   **not** re-implement any pipeline logic. If `run.py` can't do it, the UI can't either —
   fix `run.py`.
3. **Same engine.** The light engine renders headless exactly as it does from the CLI.
   "Edit it visually" still means the Remotion studio, launched as its own window — the
   web UI doesn't embed it.
4. **The config file is the source of truth.** The form is a view of
   `config/project.config.json` (+ `config/scenes.json`, `config/chapters.json`, …). Save
   = write the file. There is no separate UI-state store.
5. **One project at a time, resumable.** Close the tab mid-edit, reopen, `run.py`'s
   timestamp logic picks up where it stopped — the UI just renders that state.

## Architecture

```
┌─ browser (SPA, one static page) ──────────────────────────┐
│  drop zone · config form · per-checkpoint screens · preview │
└───────────────────────┬───────────────────────────────────┘
                        │  fetch / SSE  (localhost only)
┌───────────────────────┴───────────────────────────────────┐
│  scripts/web.py  — stdlib http.server, ~250 lines          │
│    • serves the SPA + build/ artifacts                     │
│    • REST for config + decision files                      │
│    • POST /run  → subprocess run.py, streams stdout (SSE)  │
│    • GET  /state → parses `run.py --dry` into JSON         │
└───────────────────────┬───────────────────────────────────┘
                        │  subprocess (cwd = skill dir)
                run.py  →  plan_cuts / transcribe / … / encode
```

- **`scripts/web.py`** — Python, `http.server.ThreadingHTTPServer` + a small hand-rolled
  router. **No web framework** — the surface is ~8 endpoints; Flask/FastAPI would be a new
  isolated dep for very little. (Noted tradeoff: if the endpoint count grows past ~15,
  revisit.)
- **The SPA** — one `scripts/web/index.html` + `app.js` + `app.css`, no build step, no
  framework (vanilla or a single small lib via the same CDN allowlist the artifacts use).
  Matches the repo's "no build step" ethos.
- Launched by `bash scripts/web.sh` (or `uv run scripts/web.py`) → opens
  `http://127.0.0.1:8800`.

## Projects on disk

The UI manages work dirs under a root (`~/.video-editor/projects/<slug>/` by default,
override with `VEVO_PROJECTS_DIR`). Each is a normal work dir — `rush/` `config/`
`build/` + the deliverable — so a project created in the UI is fully usable from the CLI
and vice-versa. "New project" = pick a name, drop a video → copied to `rush/` under its
own name.

## The screen flow — each screen is a `run.py` checkpoint

`GET /state` runs `run.py <work> --dry` and returns the parsed verdict table: which stages
are `SKIP`/`RUN`, and the first `HALT` (the current decision). The SPA renders the screen
for that halt.

| `run.py` state | Screen | Reads | Writes | Then |
|---|---|---|---|---|
| before `cut` | **Config** | `config/project.config.json` (or defaults) | `config/project.config.json` (+ `config/logo.png` upload) | `POST /run?to=transcribe` |
| `HALT transcript-fix` | **Transcript** — editable text, one row per Whisper sentence, word count shown | `build/transcript-raw.json` | `build/transcript-fixes.json` | `POST /run?to=captions` |
| `CHECKPOINT script-review` | **Trim** — numbered sentence list, checkboxes, dupe pairs flagged | `build/captions.json`, `build/transcript-editable.txt` | calls `edit_script.py drop …` via `POST /edit` | `POST /run?to=frames` |
| `CHECKPOINT scenes` | **Scenes** — per sentence: a motif dropdown (`motifs/index.json`), a params form, a live preview still | `build/captions.json`, `scripts/motifs/index.json` | `config/scenes.json` | `POST /run?to=render` after each change re-previews that window |
| `HALT sound-cues` | **Sound** — a waveform, click to place whoosh/thud/tap, `outro` length field | `build/captions.json`, the audio | `build/sound-cues.json` | `POST /run` (to the end) |
| all `SKIP` | **Result** — `<video>` of `video-final.mp4`, the `.srt`, the post caption, the safe-check verdict, size/LUFS | the deliverables | — | download links (local files) |

`broll-montage` and `long-form` get their own (shorter) flows behind a project-type
picker; same pattern — the UI renders whatever checkpoint `run.py` reports for that world.

## API

| Method + path | Does |
|---|---|
| `GET /` | the SPA |
| `GET /projects` · `POST /projects` | list / create work dirs |
| `POST /projects/<id>/rush` | multipart upload → `rush/<filename>` |
| `GET` · `PUT /projects/<id>/config` | `config/project.config.json` |
| `PUT /projects/<id>/decision/<name>` | write one of `transcript-fixes.json` / `scenes.json` / `chapters.json` / `sound-cues.json` |
| `POST /projects/<id>/edit` | `{op:"drop", sentences:[…]}` → shells `edit_script.py` |
| `POST /projects/<id>/run?from=&to=` | spawn `run.py`, stream stdout as SSE, final event = exit code |
| `GET /projects/<id>/state` | parsed `run.py --dry` |
| `GET /projects/<id>/file/<path>` | serve a `build/` or root artifact (frames, captions.json, mp4) — path-jailed to the work dir |

All bound to `127.0.0.1`. `file` reads are confined to the work dir with
`os.path.realpath` prefix checks (same jail bug class fixed in the #20 studio test).

## New vs reused

**New:** `scripts/web.py`, `scripts/web/` (the SPA), `scripts/web.sh`, a `--json` flag on
`run.py` so `/state` doesn't screen-scrape (small addition — `--dry --json` emits the
verdict list as JSON).

**Reused:** everything else. `run.py`, every stage script, `lib/config`, `lib/rush`,
`lib/scenes`, `edit_script.py`, `render_frames.js` preview mode, the motif registry.

**Not touched:** the pipeline, both engines, `SKILL.md` (the agent flow stays; the web UI
is an alternative front end, not a replacement).

## Non-goals

- No hosting / deploy / share links. It's a localhost tool.
- No account or platform integration, no auto-publish (invariant).
- No visual drag-to-position editor — that's the Remotion studio, opened separately.
- No mobile layout beyond "it doesn't break" — this is a desktop tool.
- Not a multi-user or multi-project-at-once app.

## Implementation tickets (Pass 7 milestone)

1. **`run.py --dry --json`** — machine-readable verdict output for `/state`.
   *(area:orchestrator)*
2. **`scripts/web.py`** — the server: router, project CRUD, config + decision file
   endpoints, path-jailed file serving. Doc page. *(area:web)*
3. **`POST /run` streaming** — subprocess `run.py` with SSE stdout + exit code.
   *(area:web)*
4. **The SPA shell** — drop zone, project list, the config form, the state-driven screen
   router. *(area:web)*
5. **Checkpoint screens: transcript + trim** — the two blocking text decisions.
   *(area:web)*
6. **Checkpoint screen: scenes** — motif dropdown + params form + per-window preview.
   *(area:web area:scenes)*
7. **Checkpoint screen: sound + Result** — cue placement, then the deliverable view.
   *(area:web)*
8. **`broll-montage` + `long-form` flows** — the two shorter front ends. *(area:web)*

Ship 1–7 for `reel-speech` end to end first (drop a real video → download a reel without
touching a terminal); 8 follows.

## Toward the far future (not Pass 7)

If it ever needs to be more than localhost — a packaged desktop app (Tauri/Electron
wrapping the same server), or a self-hosted instance — the server/SPA split above is
already the right shape. That's explicitly out of scope now; noted so Pass 7 doesn't paint
into a corner.
