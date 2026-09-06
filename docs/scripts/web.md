# `web.py` · `web.sh`

`video-editor/scripts/web.py` · python (stdlib only) · the local web UI server

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
| `GET /` | the SPA (`scripts/web/index.html`, issue #99) or a placeholder |
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

## Place in the flow

Optional, an alternative front end to `SKILL.md`'s agent conversation. Not part of any
pipeline stage.
