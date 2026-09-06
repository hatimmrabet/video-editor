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
| `POST /projects` `{name, format?}` | create → `{ id }` (slug; de-duplicated). Copies `compose.html` / `studio.html` in. `format:"long"` seeds `config/project.config.json` for a long-form project. |
| `POST /projects/<id>/rush` | raw body + **`X-Filename`** header → `rush/<filename>` (no multipart — `cgi` is gone in 3.13). `X-Filename` may name a subdir (`broll/screen.mp4`); parent dirs are created. |
| `GET /projects/<id>/config` | the merged config (`lib.config.load`) |
| `PUT /projects/<id>/config` `{…}` | write `config/project.config.json` |
| `PUT /projects/<id>/decision/<name>` | write a decision file — `name` ∈ `transcript-fixes` · `sound-cues` · `scenes` · `chapters` · `broll` |
| `POST /projects/<id>/edit` `{op, sentences}` | shell `edit_script.py` (`op` ∈ drop / keep / undo) |
| `POST /projects/<id>/montage` `{op, clips}` | shell `montage_mode.py` `drop` / `keep` / `undo` (the montage `pick` checkpoint) |
| `POST /projects/<id>/tighten` `{apply?}` | shell `tighten.py` (propose) or `tighten.py apply` (fold in) — the long-form `tighten` checkpoint |
| `POST /projects/<id>/preview` `{times}` | `render_frames.js preview` → `{ files }` (paths under `build/prev/`) |
| `GET /motifs` | `scripts/motifs/index.json` (the scenes screen's motif list) |
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

Pure stdlib `http.server` + `subprocess`. Spawns `uv run` for `run.py` / `edit_script.py`
/ `montage_mode.py` / `tighten.py` and `node` for `render_frames.js`, with `cwd` = the
skill dir; the `/run` stream sets `PYTHONUNBUFFERED=1` so lines arrive live. `web.sh`
sources `lib/platform.sh` for `VEVO_SKILL_DIR`.

## The SPA — `scripts/web/`

`index.html` + `app.js` + `app.css`, **no build step, no framework** — vanilla DOM. Served
by `web.py` at `/`, `/app.js`, `/app.css`.

- **Project list** — cards, a "New project" name field + a **type picker** (reel /
  montage / long-form). `long-form` is written through as `config.format:"long"`; `montage`
  is a per-project `localStorage` hint (`run.py` confirms `broll-montage` once the clips
  land). The hint drives the drop zone before any file exists.
- **Project view** — the config form (a live view of `GET/PUT /config`), a drop zone
  (multi-file for montage / long-form; montage also takes a background track →
  `rush/bg-audio.mp3`), then the **stage list** (verdicts from `GET /state`, with the
  world shown as a pill) and a **Run** button that opens the SSE stream into a live
  `<pre>` log. The Run button's reach is capped (`?to=`) at the stage before the next
  un-passed advisory checkpoint.
- Each `run.py` checkpoint gets a panel:
  - **Config** — a form over `GET/PUT /config`.
  - **Transcript** (`transcript-fix`) — one editable row per Whisper sentence, prefilled
    with its words, a live `edited / Whisper` word count (Save is blocked on a mismatch),
    a global "hot words" field → `PUT /decision/transcript-fixes`.
  - **Trim** (`script-review`) — a checkbox per caption sentence (checked = keep),
    restatement pairs flagged by a client-side shared-word ratio → `POST /edit` `{op:"drop"}`
    (1-indexed).
  - **Scenes** (`scenes`) — one card per sentence: a layout `<select>`, a motif `<select>`
    (the `implemented` names from `GET /motifs`), a params JSON field (a template appears
    when you pick a motif). "Save + preview" writes `config/scenes.json` and renders a
    still per sentence via `POST /preview`. "Continue (captions only)" is a valid choice.
  - **Sound** (`sound-cues`) — an end-card-length field and a `<canvas>` waveform (decoded
    from `build/transcribe-input.wav`, sentence boundaries drawn in); click to drop a
    `whoosh_up` / `whoosh_down` / `thud` / `tap` cue, click a chip to remove it →
    `build/sound-cues.json`.
  - **Pick** (`pick`, montage) — the `build/montage-contact-sheet.jpg` + a keep/drop
    checkbox per clip → `POST /montage` (`keep` with the checked set). "Keep all" skips it.
  - **Tighten** (`tighten`, long-form) — "Propose the cuts" runs `tighten.py` (`POST
    /tighten`), then a `before → after (−saved)` line + the filler list with context, and
    **Apply the cuts** (`POST /tighten {apply:true}`) / **Continue without applying** /
    **Re-propose**.
  - **Chapters** (`chapters`, long-form) — a sentence-number + title row editor →
    `config/chapters.json` (`[{ref:{sentence}, title}]`). "Skip — no chapters" is valid.
  - **B-roll** (`broll`, long-form) — a `when` (`12.5-18` range or `s34` sentence) + clip
    + `at` row editor, plus a clip uploader (→ `rush/broll/`) → `config/broll.json`.
  - any other checkpoint — a note + Continue + re-check.

An advisory checkpoint (`script-review`, `scenes`, `pick`, `chapters`, `broll`) re-appears
every refresh — the SPA tracks a client-side "passed" set so it doesn't block once you've
continued past it, and `runTarget()` stops a "Run the pipeline" click at the stage before
the next un-passed one (`run.py` only *halts* at a blocking checkpoint, so without the cap
it would run straight past). A runnable stage that writes no file (`safe` — a verification
gate) is always `RUN` in `run.py`'s view; the SPA steps past it rather than stalling on it
(the full-pipeline Run button and the Result "Re-run" both still execute it, and a genuine
failure there keeps `master` / `subs` at `RUN`, so a broken cut never reaches the Result
screen).

- **Result** — once the deliverable stages are `SKIP` (`safe` may still show `RUN`): a
  `<video>` of `video-final.mp4`, its size (via a `HEAD`, flagged over 30 MB), download
  links (`.srt` + post caption except for montage; `.chapters.txt` for long-form), and a
  "Re-run" button — all through the path-jailed `file/` endpoint.

## Place in the flow

Optional, an alternative front end to `SKILL.md`'s agent conversation. Not part of any
pipeline stage.
