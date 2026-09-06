# `web.py` · `web.sh` · `web/`

`video-editor/scripts/web.py` (stdlib server) + `web/` (the SPA, no build step) · the local web UI

> A thin front end over [`run.py`](run.md). Binds `127.0.0.1` only — no auth, no cloud, no
> publishing. Shells out to `run.py` and the same scripts the CLI uses; **re-implements no
> pipeline logic**. Design: [`design/web.md`](../design/web.md).

## Run

```
uv run scripts/web.py [port]     # default 8800
bash  scripts/web.sh  [port]     # same, via lib/platform.sh
```

Opens nothing by itself — visit `http://127.0.0.1:<port>`.

## Projects on disk

Work dirs live under `~/.video-editor/projects/<slug>/` (override with
`VEVO_PROJECTS_DIR`). Each is a **normal work dir** (`rush/` `config/` `build/` + the
deliverable) — a project made in the UI is fully usable from the CLI and vice-versa.

## Endpoints

| Method + path | Does |
|---|---|
| `GET /` · `GET /app.js` · `GET /app.css` | the SPA (`scripts/web/`) or, if absent, a placeholder |
| `GET /health` | `{ ok, projects_dir }` |
| `GET /projects` | list — `[{ id, format, language, hasVideo, hasDeliverable }]` |
| `POST /projects` `{name}` | create → `{ id }` (slug; de-duplicated). Copies `compose.html` / `studio.html` in. |
| `POST /projects/<id>/rush` | raw body + **`X-Filename`** header → `rush/<filename>` (no multipart — `cgi` is gone in 3.13) |
| `GET /projects/<id>/config` | the merged config (`lib.config.load`) |
| `PUT /projects/<id>/config` `{…}` | write `config/project.config.json` |
| `PUT /projects/<id>/decision/<name>` | write a decision file — `name` ∈ `transcript-fixes` · `sound-cues` · `scenes` · `chapters` · `broll` |
| `POST /projects/<id>/edit` `{op, sentences}` | shell `edit_script.py` (`op` ∈ drop / keep / undo) |
| `GET /projects/<id>/state` | parsed `run.py <work> --json` |
| `POST /projects/<id>/run` `?from=&to=&only=&force=` | spawn `run.py`, stream output as **SSE** — `event: line` per output line, `event: done` `{exit}` at the end. Closing the connection kills the run. |
| `GET /projects/<id>/file/<path>` | serve a `build/` or root artifact, **path-jailed** to the work dir |

## Security

- **Bind is `127.0.0.1`** — never `0.0.0.0`.
- Project ids match `^[a-z0-9][a-z0-9-]{0,63}$` and every resolved path is checked with
  `os.path.realpath` to stay inside `ROOT` / the work dir (the jail-bug class from the #20
  studio test).
- No endpoint publishes, schedules, or sends anything off the machine (invariant #7).

## Cross-platform

Pure stdlib `http.server` + `subprocess`. Spawns `uv run scripts/run.py` /
`edit_script.py` with `cwd` = the skill dir; the `/run` stream sets `PYTHONUNBUFFERED=1`
so lines arrive live. `web.sh` sources `lib/platform.sh` for `VEVO_SKILL_DIR`.

## The SPA — `scripts/web/`

`index.html` + `app.js` + `app.css`, **no build step, no framework** — vanilla DOM. Served
by `web.py` at `/`, `/app.js`, `/app.css`.

- **Project list** — cards, a "New project" name field.
- **Project view** — the config form (a live view of `GET/PUT /config`), a drop zone for
  the video, then the **stage list** (verdicts from `GET /state`) and a **Run** button
  that opens the SSE stream into a live `<pre>` log.
- Each `run.py` checkpoint gets a panel:
  - **Config** — a form over `GET/PUT /config`.
  - **Transcript** (`transcript-fix`) — one editable row per Whisper sentence, prefilled
    with its words, a live `edited / Whisper` word count (Save is blocked on a mismatch),
    a global "hot words" field → `PUT /decision/transcript-fixes`.
  - **Trim** (`script-review`) — a checkbox per caption sentence (checked = keep),
    restatement pairs flagged by a client-side shared-word ratio → `POST /edit` `{op:"drop"}`
    (1-indexed).
  - `scenes` / `sound` / `tighten` / `chapters` / `broll` — a note + Continue + re-check
    (screens #101–#102; the rest handled in the terminal).
- **Result** — when every stage is `SKIP`: a `<video>` of `video-final.mp4` + download
  links, served through the path-jailed `file/` endpoint.

## Place in the flow

Optional, an alternative front end to `SKILL.md`'s agent conversation. Not part of any
pipeline stage.
