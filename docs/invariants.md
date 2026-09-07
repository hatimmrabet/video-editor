# Invariants — rules you must not break

Two sets of rules. The first is design policy (from `SKILL.md`). The second is ten bugs
found in real production runs — each is fixed in code, and the fix must not be undone.

---

## Design policy (`SKILL.md` "Fixed rules")

1. **Every sound effect is tied to a meaningful moment** — a number dropping, something
   breaking, a scene transition. Max 15 events/minute; peak below −18 dBFS; show the user
   where they landed before export. (Spraying a tick on every word was tried — it reads as
   noise.)
2. **Western digits always** (0–9).
3. **Colors from `project.config.json`'s `theme.*` only** (via `lib/config`) — no hardcoded
   color anywhere in scene code.
4. **No color or filter over the person's image** — no grade, tint, LUT, or colored layer
   over the video. Original colors always, unless the user explicitly asks. Colors are for
   cards and text only. (`reframe.py` only re-tags to bt709; `grade` is off by default.)
5. **Correct the Whisper transcript** before captioning.
6. **Do not invent content the speaker didn't say.** Every on-screen text comes from their
   speech; generalize rather than guess.
7. **No publishing, no scheduling** — deliver a file only.
8. **"Behind the person": twice per video at most, and ≥ 8 s between two moments** —
   closer together (or every sentence) it reads as an over-used gimmick. A candidate is a
   1–4 word sentence lasting ≥ 0.85 s; `fx/behind_text.js plan` filters those and flags a
   pick that lands within 8 s of one already in `build/person-cutout.json`.
9. **Call it "background audio file", not "music"** — the user decides the content.
10. **Invent new scenes every time.** `compose.reference.html` is a pattern library, not a
    template to copy.

### Layout rule (user-approved — do not change)

| Moment | Rectangle | Shape |
|---|---|---|
| speech, no graphic | `R_FULL` | face fills the screen, caption at y 1460 |
| any graphic / motion | `R_DOWN` (default) | graphic on top (y 280–520) ← caption riding the video edge ← face below, full screen width |
| B-roll / big panel | `R_LOWER` | big card on top ← caption ← small face below |

Don't overuse `R_DOWN`: the hook (first 3–4 s) is always full-screen; any peak / emotion /
question is full-screen; never more than half the video in `R_DOWN`, never more than 8 s
continuous. (The old middle-of-screen rects `R_STAGE` / `R_SIDE` were removed from both
engines — issue #26.)

### Instagram safe zone

No text in: top 150 px · bottom 300 px (caution belt from 1500) · right 130 px (x ≥ 950)
for y 1100–1750. First caption must appear within the first 0.5 s. Verified by
[`safe_check.js`](scripts/safe_check.md) (exit 3 on violation) — these are the exact
`DEF.zones` it enforces; [`SKILL.md`](../video-editor/SKILL.md) still describes the right
belt as 180 px wide.

---

## The ten bugs (found in real runs — never reintroduce)

### 1. Draw-state accumulation blackens the video

A scene that throws after `X.save()` without `X.restore()` leaves canvas state corrupted;
the corruption compounds frame over frame and **the video goes black from the middle
onward**. Fix: `safe()` wraps every scene in `save`/`restore` inside `try/finally`, and
`draw()` resets all canvas state (`setTransform`, `globalAlpha`, `filter`, shadow,
composite-op) at the top of every frame. — `compose.reference.html`

### 2. Missing scene functions halt rendering

When scene functions are rewritten per video, a stale reference to a deleted function
(`glitch`, `outro`, `RECAP`…) throws and stops the whole render. Fix: guarded calls
(`if (typeof glitch === 'function')`) and definitions inside the per-project file; `safe()`
swallows and logs once. — `compose.reference.html`

### 3. Image-load race

`img.onload` is not enough — the frame can draw before the bitmap is decoded. Fix:
`img.src = …` then `img.decode()` inside `setFrame` / `setPerson`. — `compose.reference.html`,
`render_frames.js`

### 4. Chrome caches `compose.html`

Headless Chrome serves a stale `compose.html` between runs. Fix: `page.setCacheEnabled(false)`
in `render_frames.js` and `safe_check.js`.

### 5. Captions cover the speaker's face

With a side-card layout the caption landed on the face. Fixed by the layout rule above
(`R_DOWN` default, caption rides the video edge) and by positioning the caption from
`vtarget(t)` (the *target* rect, not the animating one) so it doesn't jump.

### 6. Fixed crop ignored the speaker's position

The vertical crop was a constant. Fix: `crop.faceAnchor` in `project.config.json` (default
0.30; a value like 0.45 for a speaker who sits low). `crop.xAnchor`/`crop.yAnchor` added
for landscape sources. — `reframe.py`, `compose.reference.html`

### 7. "Behind the person" required a short sentence

The effect only accepted a whole 1–4 word sentence. Fix: word-range selection within a
sentence (`build 2:6-8`). — `fx/behind_text.js`

### 8. Safe-zone check gave false positives

Card-edge pixels and card shadows were counted as intruding text. Fixes in `safe_check.js`:
24 px edge margin; background threshold 50 (ignores shadows); exclude the video card's
frame via `window.vrect`; skip any sample where the two flat-color draws didn't differ
(the video didn't render, so the measurement is invalid).

### 9. `drawtext` is missing from many ffmpeg builds

`ffmpeg`'s `drawtext` filter is absent from many builds (including Majed's own). Scripts
that used it fell back silently to an unlabeled output — a contact sheet with no
timestamps that *looks* labeled. Fix: labels are drawn with **Python/PIL** in
`contact_sheet.sh` and `montage_mode.py`; ffmpeg only grabs frames. **Do not add
`drawtext` to any new script.**

### 10. `master_audio.sh` broke on a silent track

A montage with no background audio measures `−inf` LUFS; `loudnorm` rejects the value and
halts the pipeline. Fix: `master_audio.sh` detects a silent/`−inf` track, skips
normalization, and prints a one-line note.

---

## Cross-platform invariants

- Every Python script keeps `sys.stdout.reconfigure(encoding="utf-8")` at the top and
  writes files with explicit `encoding="utf-8"`. Removing this breaks Arabic output on
  Windows (cp1252).
- Every `.sh` script sources `lib/platform.sh` and resolves its work dir through
  `vevo_abspath` before passing it to Python/Node.
- Node scripts build `file://` URLs through `fileUrl()` from `lib/platform.js`, never by
  string concatenation.
- See [windows.md](windows.md) for the full list.
