# File layout — `rush` / `config` / `build`

**Implemented** (issue #59, 2026-09-05) — decided in a design session with @hatimmrabet
the same day. Depends on [project-config.md](project-config.md) (Pass 2) for the config
file itself; this document covers the *directory* structure around it.

## Problem

Today everything lives flat in one `<work>/` directory (see
[architecture.md](../architecture.md)'s inventory): the raw source video sits next to
hand-authored config, next to hundreds of intermediate JPEGs, next to the file the user
actually has to find and watch. Names like `a.json`, `cutz.mp4`, `ad-final.mp4` /
`ad-master.mp4` don't say what they are or which one is the deliverable.

## Proposal — three folders + a root deliverable

```
<work>/
  config/
    project.config.json      ← the only file a human edits directly
    logo.png
  rush/
    <source file(s), exactly as given — a single video, or many clips for montage>
    broll/
      <cutaway clips, exactly as given — a folder, because it may hold several>
  build/
    <everything intermediate — disposable, regenerable>
  video-final.mp4             ← the deliverable, same name regardless of mode
  video-final.srt             (speech-ad only)
  post-caption.txt            (speech-ad only)
  compose.html / Scenes.tsx / remotion/   ← root, temporary — removed once Pass 4 lands
```

**Why the deliverable sits at the root, not in `build/`:** the person opening the project
folder should see the working directories, and right next to them, the finished video —
not have to go hunting inside a folder full of intermediate JPEGs.

**Why `rush/` never renames the user's files:** we cannot ask a user to name "the audio"
and "the video" — whatever they hand us keeps its name. The only structural rule is the
`broll/` subfolder: anything under it is cutaway footage, not part of the primary input;
everything else at `rush/`'s root is the primary material (one video for `reel-speech`,
many clips for `broll-montage`).

**Why `video-final.mp4` regardless of mode:** a montage and a speech ad are not two kinds
of output — they're the same kind of deliverable produced by a different subset of
pipeline stages (`world` in `project.config.json`, see [worlds.md](worlds.md)). Naming the
deliverable `montage-final.mp4` in one case and `video-final.mp4` in the other implied a
difference that isn't real. `video-final.srt` and `post-caption.txt` only exist when the
mode actually produced captions/a transcript (`reel-speech`) — montage has neither.

## Rename table

| Today | New | What it is |
|---|---|---|
| `src.mov` | `rush/<original name>` | source video, untouched |
| `bg-audio.mp3` | `rush/bg-audio.mp3` | user-supplied background audio — an **input**, not generated |
| — | `rush/broll/*` | cutaway clips, a folder (may hold several) |
| `theme.json` / `stage.json` / `outro.json` / `safe.json` | *(absorbed into `config/project.config.json`, Pass 2)* | no more separate hand-edited files |
| `logo.png` | `config/logo.png` | |
| `cut.json` | `build/cut-plan.json` | silence-removal plan |
| `a.wav` | `build/transcribe-input.wav` | mono 16kHz audio extracted for Whisper |
| `a.json` | `build/transcript-raw.json` | Whisper's raw output (words + timings) |
| `fixes.json` | `build/transcript-fixes.json` | hand corrections + hot words |
| `caps.json` | `build/captions.json` | final per-word caption timing |
| `script.txt` | `build/transcript-editable.txt` | numbered sentence list, for choosing what to cut |
| `cutz.mp4` | `build/video-reframed.mp4` | cut + 9:16-cropped, before compositing |
| `vfr/*.jpg` | `build/frames-source/*.jpg` | extracted source frames (30 fps) |
| `sfx.json` | `build/sound-cues.json` | sound-effect cue timings |
| `sfx.wav` | `build/sound-effects.wav` | rendered sound-effect bed |
| `behind.json` + `bt/` | `build/person-cutout.json` + `build/person-cutout/` | macOS person-cutout data |
| `out/*.jpg` | `build/frames-composited/*.jpg` | frames after scene graphics are drawn |
| `ad-final.mp4` | `build/video-raw.mp4` | muxed, **before** loudness mastering — not the deliverable |
| `ad-master.mp4` | `video-final.mp4` (root) | after `master_audio.sh` — **the actual deliverable** |
| `ad-master.srt` | `video-final.srt` (root) | |
| `ad-master.txt` | `post-caption.txt` (root) | the speech's full text, meant to be pasted as the post's caption — not a technical artifact |
| `safe.jpg` | `build/safe-zone-check.jpg`, **only written when a violation is found** | today it's written unconditionally every run; nobody looks at it on a pass — see "Safe zone" below |
| `montage.json` | `build/montage-plan.json` | |
| `montage-sheet.jpg` | `build/montage-contact-sheet.jpg` | |
| `montage.mp4` / `montage-master.mp4` | `build/montage-raw.mp4` → `video-final.mp4` (root) | same raw/final split, same final name as speech-ad |

The naming rule going forward: **`-raw` = before loudness mastering, `-final` = the actual
deliverable** — applied consistently, not just to this one pair.

`compose.html`, `Scenes.tsx` and `remotion/` stay at the project root, unchanged from
today. They are explicitly **temporary** — Pass 4 (scenes-as-data) removes the need to
hand-edit them per project. Flagging this here so it isn't forgotten when Pass 4 lands.

## Engine decision (reaffirmed)

Keeping both engines — dropping Remotion would drop the only interactive-editing surface
in the codebase, and dropping the light engine would make every automated render pay
Remotion's per-project setup cost and licensing exposure for no benefit. Full reasoning in
[orchestrator.md](orchestrator.md) discussion history; summary:

- **Light stays the silent default** — zero recurring setup cost, no license question.
- **Remotion can be driven entirely by code** (`remotion.sh render` is fully headless —
  `npx remotion render` needs no human), so "edit visually" isn't the *only* way to use it;
  it's just the reason it exists at all.
- **Make Remotion's `node_modules` a shared, skill-level install** (mirrors how `setup.sh`
  installs Puppeteer's Chromium once, not per project) instead of the current
  `<work>/remotion/node_modules` — see `scripts/remotion/remotion.sh`, where `R="$W/remotion"`
  is per-project today. Only `Scenes.tsx` (the hand-edited creative file) must stay
  per-project and be synced into the shared install before each render/studio call, and
  copied back after edits — otherwise switching projects silently carries over the
  previous project's scene code into the next one. A full trap-audit happens at
  implementation time, not in this design pass.

## Safe zone — provisional, needs empirical verification

Researched published safe-zone specs for Instagram Reels, TikTok, and YouTube Shorts
(2026-09-05). **The published numbers disagree substantially across sources for the same
platform** — e.g. Instagram Reels safe margins are reported as both ~108/320/60px and
~270/670/65px (top/bottom/side) depending on the source, and Meta's own business page
links only to downloadable `.psd`/`.ppt` templates, no inline pixel spec. TikTok's own
help center states the safe zone actually *varies with caption length* — it isn't a fixed
rectangle. YouTube Shorts guidance is mostly expressed as a percentage, not pixels.

The numbers already in `safe_check.js`/`SKILL.md` for Instagram (top 150px · bottom 300px
· right 130px, `x≥950` for `y 1100–1750`) look more trustworthy than anything found in this
search, because they read like something **measured against a real recording**, not
copied from a blog. That's the model to repeat for TikTok and YouTube Shorts rather than
trust the conflicting published numbers outright.

**Final decision (2026-09-05, superseding "provisional" above):** don't chase separate
per-platform numbers. **Keep the existing, already-validated Instagram values (top 150px ·
bottom 300px · right 130px, `x≥950` for `y 1100–1750`) and reuse the exact same rects and
the exact same calculation for every short-form platform** — Instagram, TikTok, YouTube
Shorts alike. Revisit only if a real post surfaces an actual, observed problem on a
specific platform — not preemptively. This avoids sinking more effort into unreliable
published specs (see above) for a difference that may never matter in practice.

- **No stored reference image.** The safe-zone boxes are numeric rects, kept as shared
  skill-level data (not a downloaded template picture) — used only to check, never
  displayed unless there's a violation.
- **`safe-zone-check.jpg` (renamed `safe.jpg`) is written only when a violation is
  found.** On a clean pass, nothing is saved — there's nothing to look at.
- **One safe zone per `format`, not per platform.** `project.config.json`'s `format`
  (`short`/`long`, see [project-config.md](project-config.md)) carries the only distinction
  that matters — no separate `output.platform` field, and no per-platform rect variants.
- **Only what we draw respects the zone — not the source video.** There's rarely anything
  essential right at the edge of a talking-head shot, so the person's video is allowed to
  run under a platform's buttons; only overlay graphics/captions/cards must stay inside.

## Config as a mandatory first phase

See [orchestrator.md](orchestrator.md) for the full flow. Summary: reading/building
`project.config.json` is never skipped, and always ends in an explicit confirmation before
anything downstream runs. `.auto-memory/creator-profile.md` is **dropped from the design
entirely** — with a single user today, the simpler and equally effective convenience is to
copy the previous project's `project.config.json` as the starting point for a new one and
only ask what changed, rather than maintain a second cross-project memory file.

## B-roll

`rush/broll/` is a **folder**, not a single assumed file — a creator may film several
separate clips meant as cutaway footage. This also means B-roll selection can reuse
`montage_mode.py`'s existing scorer (sharpness/motion/lighting) to auto-pick good moments
from among several clips, rather than requiring the user to hand-specify exact time
ranges — the same technique `worlds.md` already earmarks for `long-form`'s B-roll
cutaways.
