# Glossary

**work dir (`<work>`)** — the per-video working directory, first argument to every script.
Holds all inputs and outputs. See [architecture.md](architecture.md#the-work-dir-model).

**speech-ad mode** — the default: one talking-head video → captioned 9:16 ad.

**montage mode** — independent: a folder of speechless clips → one rhythmic montage.
No transcription, no captions. [`montage_mode.py`](scripts/montage_mode.md).

**light engine** — the default renderer: headless Chrome draws `compose.html` frame by
frame to JPEGs. [engines.md](engines.md#light-engine-puppeteer--canvas-2d).

**Remotion engine** — the opt-in renderer: React + Remotion renders an MP4 directly, with
a live studio timeline. [engines.md](engines.md#remotion-engine).

**hook** — the first few seconds of the video, and specifically the moment the first
caption appears. It must appear within 0.5 s (`hook_max`) — a late hook loses half the
viewers. Checked by [`safe_check.js`](scripts/safe_check.md).

**safe zone** — the screen regions Instagram covers with its own UI (name + follow button
on top, caption + audio on the bottom, like/comment/share on the right); the same rects
are reused for TikTok and YouTube Shorts by default. No caption text may enter them.
[`config/safe.json`](data-contracts.md#configsafejson--safe-zone-overrides-optional-hand-authored-rare).

**hot word** — a word listed in `build/transcript-fixes.json`'s `hot` array; it gets an
animated accent pill behind it when spoken. Stored per-word as `"hot": true` in
`build/captions.json`.

**caption card** — one on-screen caption unit (`build/captions.json` `cards[]`), with a
show/hide time and a list of words each carrying its own start/end and `hot` flag.

**stage / rect mode** — how big the video is and where it sits on screen at a given time.
Modes: `FULL` (fills screen), `DOWN` (video below, graphic above — flexes per caption
lines), `LOWER` (small card). (`STAGE` / `SIDE` were removed — issue #26.) The schedule is
`SCENES` (inline in `compose.html`), `config/stage.json` (Remotion), or derived from
`config/scenes.json`. [engines.md](engines.md).

**rect / `R_*`** — a rectangle `{x, y, w, h, r}` (r = corner radius) that a stage mode
maps to. `vrect(t)` interpolates between consecutive rects over `TR = 0.42 s`.

**scene / scene function** — a code-drawn motion-graphic tied to a specific sentence and
its word timings. A visual metaphor for what's being said. Invented per video.

**motif** (design term, not in code yet) — a reusable, parameterized scene type
(counter, card-stack, checklist, transcript-panel, glitch…). See
[design/scenes-as-data.md](design/scenes-as-data.md).

**behind text / "الكلام ورا الشخص"** — the effect where a spoken word is stretched with
the Arabic **kashida** (tatweel, `ـ`) to the width of the speaker's body, so the
elongation alone passes behind their head while the letters stay readable on either side.
macOS only. [`fx/behind_text.js`](scripts/fx-behind_text.md).

**kashida / tatweel (`ـ`)** — the Arabic character that elongates a word by extending the
connecting stroke between letters. Used to stretch a word to an exact pixel width.

**cutout / headout** — two more uses of the person-cutout technique: `cutout` = the
speaker stands cut-out in front of the design with no card; `headout` = the video is in a
small card and the speaker's head pokes above its top edge.

**reframe** — cutting the silences and cropping/scaling to vertical 9:16.
[`reframe.py`](scripts/reframe.md). Vertical sources pass through; landscape sources are
center-cropped first.

**bt709 tag** — a color-primaries tag written onto `build/video-reframed.mp4`. iPhone HDR/HLG footage
arrives tagged bt2020/HLG and renders orange in a browser; re-tagging to bt709 fixes it.

**contact sheet** — one wide image built from several timestamps so Claude reads one
image instead of N (images eat 80–85 % of context). [`contact_sheet.sh`](scripts/contact_sheet.md).

**LUFS** — Loudness Units relative to Full Scale, the platform loudness standard. The
pipeline normalizes to **−14 LUFS** with a true peak ≤ −1.5 dBTP.
[`master_audio.sh`](scripts/master_audio.md).

**ducking / sidechain** — lowering the background audio automatically whenever the speaker
talks, so it never competes with the voice.

**dupe / repeated sentence** — when a speaker restates a sentence, the first version is
assumed wrong and the second is the correction. `edit_script.py dupes` detects these.

**`build/frames-source/`** (was `vfr/`) — the folder of source frames extracted from
`build/video-reframed.mp4` at 30 fps (`%05d.jpg`), consumed by the light engine and the
cutout effect.

**`build/frames-composited/`** (was `out/`) — the folder of composited frames the light
engine writes, muxed by `encode.sh`.

**hard dialect** — Maghrebi Arabic (`ar-MA`, `ar-DZ`, `ar-TN`, `ar-LY`, "darija") where
Whisper is unreliable even with `large-v3`. `transcribe.py` maps these to ISO `ar`,
enables VAD + repetition penalty + a higher no-speech threshold, and warns that the text
will need manual correction.

**`vevo_*`** — prefix on the shell helper functions in `lib/platform.sh`
(`vevo_abspath`, `vevo_chrome_path`, `vevo_pkg_mgr`) and the `VEVO_OS` variable.

**world** (design term) — an editing family: `reel-speech`, `broll-montage`, `long-form`.
See [design/worlds.md](design/worlds.md).
