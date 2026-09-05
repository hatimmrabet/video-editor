# `lib/rush.py`

`video-editor/scripts/lib/` · python · shared

> Resolves the input file(s) under `rush/` without assuming a fixed name. `rush/` keeps
> whatever filename the creator's own file already had (see
> [`docs/design/file-layout.md`](../design/file-layout.md)) — scripts that used to
> hardcode `src.mov` call this instead.

---

## What it does

| Function | Returns |
|---|---|
| `find_source(work)` | the one file at `rush/`'s root, excluding `bg-audio.mp3` — **reel-speech** (a single talking-head video). Raises `SystemExit` if there isn't exactly one. |
| `find_clips(work)` | every file at `rush/`'s root, sorted, excluding `bg-audio.mp3` — **broll-montage** (many clips). |
| `find_broll(work)` | every file under `rush/broll/`, sorted — `[]` if the folder doesn't exist. Always optional. |
| `background_audio(work)` | `rush/bg-audio.mp3`'s path if the creator supplied one, else `None`. |

No JS mirror — nothing under `scripts/*.js` needs to resolve the source file directly
today (`render_frames.js`/`safe_check.js` only touch `build/frames-source/`, already
extracted by the time they run).

## Usage

```python
from lib import rush
SRC = rush.find_source(W)     # reframe.py, plan_cuts.py
```

## Consumers

`plan_cuts.py`, `reframe.py` (`find_source`); `montage_mode.py`'s `scan` defaults to
`rush/` directly rather than importing this (it already had its own file-listing logic —
see [montage_mode.md](montage_mode.md)).
