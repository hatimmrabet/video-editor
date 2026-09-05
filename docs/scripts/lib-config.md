# `lib/config.py` + `lib/config.js`

`video-editor/scripts/lib/` · python (source of truth) + node (thin subprocess wrapper) · shared

> Reads and merges `project.config.json`. Schema:
> [`docs/design/project-config.md`](../design/project-config.md).

---

## One implementation, not two

**`lib/config.py` is the only place the merge logic lives.** `lib/config.js` does not
reimplement it — it shells out to `config.py` (via [`pythonCmd()`](lib-platform.md), the
same uv → skill `.venv` → system `python3` resolution `platform.sh` uses for shell
scripts) and parses its JSON output. One `load()` call per script run, so the subprocess
cost is irrelevant next to the rest of the pipeline — and Python is already a hard
requirement for this pipeline (`transcribe.py`, `plan_cuts.py`, …), so this doesn't add a
dependency that wasn't already there.

This is different from `lib/platform.sh` + `lib/platform.js`, which genuinely are two
independent implementations — that pair exists because Node needs Chrome/Puppeteer-specific
logic Python has no reason to touch. Config merging has no such constraint, so it doesn't
get a second implementation to maintain in parallel.

## What it does

One function: **`load(work)`** → the merged config: `scripts/defaults.config.json`
(skill-level defaults for `format`/`engine`/`grade`/`crop`) with
`<work>/config/project.config.json` merged over it. No `project.config.json` yet? Just the
defaults — `load()` never invents a missing `theme` or `language` (no sensible default
exists), and there is no fallback to any old `theme.json`/`stage.json`/etc. either.

**Deliberately no legacy bridge.** A single-user project with no installed base of
old-style work dirs has no back-compat problem to solve — see
[project-config.md](../design/project-config.md)'s "Migration — direct, no bridge". Each
script that currently reads the old per-file JSONs migrates to `config.load()` directly,
deleting its old file-reading code in the same change, rather than gaining a second path
that reads the new file while the old one still works too.

### `defaults.config.json`

`video-editor/scripts/defaults.config.json` — skill-level fallbacks for the fields that
have a genuine universal default:

```jsonc
{ "format": "short", "engine": "light", "grade": false,
  "crop": { "xAnchor": 0.5, "yAnchor": 0.30, "faceAnchor": 0.30 } }
```

Deliberately has no `theme` or `language` default — `SKILL.md` explicitly forbids assuming
a theme, and the language must come from an actual conversation with the user, never a
guess.

## Usage

```python
import sys; sys.path.insert(0, "scripts")   # only needed if scripts/ isn't already on sys.path
from lib import config
cfg = config.load(work)
```

```js
const config = require('./lib/config');   // spawns python under the hood — see above
const cfg = config.load(work);
```

Both tolerate a leading BOM on read (`utf-8-sig` in Python) — a Windows editor can save a
config file with one, and a hard failure on that would be a bad first impression for a
hand-edited `project.config.json`.

## Consumers

Fully wired in as of 2026-09-05 (Pass 2). `SKILL.md` step 1 writes `project.config.json`
(#10); `reframe.py` (#8), `render_frames.js` (#55), `safe_check.js` (#56) and the Remotion
generator in `remotion.sh` (#9) all read it via `load()`. `theme.json` is retired — see
[data-contracts.md](../data-contracts.md).
