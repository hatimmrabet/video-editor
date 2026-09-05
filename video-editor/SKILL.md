---
name: video-editor
description: Turns a talking-to-camera video (selfie / teleprompter) into a full vertical 9:16 ad — removes the silences, transcribes the speech with per-word timing, adds synced Arabic captions, builds code-drawn motion graphics and B-roll scenes, and an end card with a call to interact — all in the content creator's own colors. It also has a second montage mode: a folder of speechless clips (cafés, travel, a product, a place) — it picks the best moment of each clip and assembles them into one rhythmic montage. ALWAYS use this skill when the user says "منتج هذا المقطع", "سو من هذا الفيديو إعلان", "شيّل السكتات", "حوّل الفيديو لريل", "ركّب كابشن عربي", "ابي موشن قرافيكس على الفيديو", "اقص الصمت", "عندي ٣٠ مقطع سوّ لي منها فيديو", "ركّب لي مونتاج من هالمقاطع", "اختار أحلى اللقطات", or the English equivalents ("edit this clip into an ad", "turn this video into a reel", "remove the silences / dead air", "add Arabic captions", "make a montage from these clips", "pick the best shots"), or sends a talking video or a folder of clips and asks for an edit or an ad. NOT for carousels (use carousel-creator) or video covers (use animated-video-cover).
---

# Video ad montage — no editing app

## The idea

The whole edit is code: ffmpeg cuts, Whisper transcribes with per-word timing, and a
drawing engine composites the captions and motion graphics over the video. The output is
one publish-ready MP4.

## Two modes — decide which one you're in, in your first line

| | **Speech ad** (default) | **Clip montage** |
|---|---|---|
| Input | one video of a person talking | a folder with many speechless clips |
| Example | selfie · teleprompter · explainer | café · trip · product · place · event |
| Selection driven by | the speech (you remove silences and repeated sentences) | the shot itself (sharpness · motion · lighting) |
| Captions? | yes, word-synced | **no** — no transcription at all |
| Steps | 0–11 below | the "Montage mode" section, on its own |

**How do you know the mode without asking?** They gave you a **folder** or more than one
clip = montage. They gave you **a single file with speech** = speech ad. If a folder turns
out to have audible speech and they want captions, run the speech-ad flow on the main clip.

**Do not ask "which mode do you want?"** — read the input, go, and tell them in one
sentence what you understood.

## Two engines — but don't ask the user anything about them

The skill is one thing; the engine that draws the scenes is two. **The choice is yours,
not theirs.**

**Always start with the light engine, silently.** Never say the word "Remotion" or
"canvas" or "engine", and never offer two options — the person in front of you wants an
ad, not to pick a technology.

**When do you open the second one?** Only if **they** say something like this, after
seeing the ad:
> "I want to edit it myself" · "I don't like where this sits, I want to move it" · "is
> there a screen where I can see the edit?" · "I want to try things myself"

Then say one jargon-free sentence: "I'll open you a live editing screen where you see the
video and move anything and see the result instantly — the download takes 5 minutes,
once. Shall I start?" After they agree: `remotion/remotion.sh <work> setup` then `studio`.
**Never redo an earlier step** — the cut, the transcription, the captions and the effects
are all shared; the work carries over as-is.

| | **Light** (default) | **Editing screen** |
|---|---|---|
| When | every time, no question | only if they ask to edit themselves |
| Download | zero extra | ~500 MB, once |
| What they see | frames you show them | a live video they scrub and see instantly |
| License | free | a company with 4+ employees pays (tell them if they're a company) |
| Command | `render_frames.js` | `remotion/remotion.sh` |

---

## Your style with the user — read this before anything

**You do the preparing, not them.** The person in front of you may not know what ffmpeg is
and doesn't want to. Never hand them a list of commands to run.

- **Don't present requirements or ask "do you have X?"** — check yourself, and if something
  is missing say: "I'm missing two tools, I'll set them up for you now, it takes two
  minutes — start?" After they agree, install them yourself.
- **No jargon.** Don't say "puppeteer" or "codec" — say "a tool that draws the slides" and
  "video quality".
- **Tell them where you are at each step**, with a time estimate: "Removed the silences —
  half the video is gone. Now transcribing your speech, 3 minutes."
- **Ask for one thing at a time.** Don't ask for the video and the colors and the account
  in one sentence.
- **Never deliver without showing.** After each major stage, show a frame or a summary.

---

## Step 0 — prepare silently

```bash
bash scripts/setup.sh
```
- Returned "✅ ready." → don't mention it at all, move to the next step.
- Returned something missing → tell them in one sentence what you'll install and why, get
  their consent, then:
```bash
bash scripts/setup.sh --install
```
If something fails tell them the fix in one human sentence, without pasting the error message.

**Dependencies are isolated.** `setup.sh --install` installs only **ffmpeg**, **Node** and
**uv** at the system level (via brew / winget / apt). Everything else is contained:
Python packages go in a `uv`-managed `.venv/` (never the system Python), and the browser
that draws the scenes is downloaded by `npm` into the skill's `node_modules/` — **no
separate Chrome install**. `uv run scripts/…` re-syncs the venv on its own if needed.

**Platforms:** macOS, Windows (Git-Bash/WSL) and Linux. The macOS-only features (steps 7.5
· 7.6 · "speech behind the person") skip themselves automatically elsewhere, and the rest
of the pipeline runs normally.

Prepare a work directory: create its `rush/`, `config/` and `build/` subfolders, and copy
`scripts/compose.reference.html` into it as `compose.html`, and `scripts/studio.html` too
(both stay at the work-dir root — see [`docs/design/file-layout.md`](../docs/design/file-layout.md)).

---

## Step 1 — configuration (mandatory, never silent)

**Never assume the cream-and-clay theme.** That's Claude's theme, not everyone's.

This step is never skipped and never silent — it always ends in an explicit confirmation
before anything downstream runs.

**`<work>/config/project.config.json` already exists?** Read it, show a short recap
(language, theme colors, handle), and ask: "Still good, or does anything change?" Don't
move on until they confirm.

**No config yet?** Build it one question at a time, then reconfirm before saving:
1. Ask **one question** about their account colors: "What are your account's colors? Give
   me the background color, the accent color, and your logo (or your account link and
   I'll pull them)."
2. Ask the video's language (see step 4 for why it matters): `ar` · `fr` · `en` · or a hard
   dialect (`ar-MA` / `ar-DZ` / `darija`).
3. Copy their logo into `<work>/config/logo.png`, and set `theme.logo` to `"config/logo.png"`
   in the file you write below (a path relative to the work-dir root — where `compose.html`
   and `remotion.sh` resolve it from — not relative to `config/` itself).
4. **Before writing anything**, give one final complete recap and get an explicit
   confirmation — only then save the file. It becomes the single source everything
   downstream reads; there's no second place any of this lives.

Write `<work>/config/project.config.json`:
```json
{
  "format": "short",
  "engine": "light",
  "language": "ar",
  "grade": false,
  "crop": { "xAnchor": 0.5, "yAnchor": 0.30, "faceAnchor": 0.30 },
  "theme": { "bg":"#101828", "ink":"#F5F7FA", "acc":"#F2B33D", "clay":"#C98B18", "mut":"#98A2B3",
             "font":"Tajawal", "handle":"@his_handle", "logo":"config/logo.png", "grid": true }
}
```
`format` is always `"short"` today — `"long"` is reserved for a future long-form pipeline
that doesn't exist yet; it's not a real choice to offer. `engine` is always `"light"` —
never ask, never write `"auto"` (see "Two engines" above: the choice is yours, not
theirs). Every scene derives its colors from `theme` automatically — the cards, the
shadows, and the text color over the accent pills (computed from the color's luminance).
A dark or a light background both work.

**The color grade (`grade`) is off by default** — the video keeps its original colors.
Don't turn it on unless they explicitly ask, or complain the image looks cold / washed
out. If you turn it on, tell them you did.

`crop`'s defaults (0.5 / 0.30 / 0.30) are right for almost every video — only revisit
`xAnchor` / `faceAnchor` after previewing a frame, if the speaker turns out off-center
(step 6). **There is no account badge field** — it's off by default, and if someone asks
for it as a one-off, set `BADGE_UNTIL` directly in that project's `<work>/compose.html`
(step 7) rather than through the config.

Every script downstream reads this file via `config.load()` (see
[`docs/scripts/lib-config.md`](../docs/scripts/lib-config.md)) — nothing needs asking twice.

---

## Step 2 — get the video from them

Ask for it in one simple sentence, and accept any method:

| Method | When | How |
|---|---|---|
| **A file on their machine** ← best | always if possible | they give you the path, you copy it to `<work>/rush/` **keeping its original name** — no upload wait, no renaming |
| **A Google Drive link** | they shoot on their phone and Drive auto-uploads | have them set sharing to "anyone with the link", then:<br>`curl -sL "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t" -o <work>/rush/<name>.mov`<br>the ID is the part between `/d/` and `/view`. Tested on a 441 MB file |
| **Google Drive connector** | the file is private and they don't want to change sharing | use the connector tools available in the session |

**About resolution:** 4K is better because the zoom crops from the original so you lose no
sharpness. But 1080p works fine — the difference is the zoom range gets tighter. **Do not
reject a 1080p video and do not ask them to re-shoot.**

`rush/` never renames the file — whatever name it arrives with, it keeps (see
[`docs/design/file-layout.md`](../docs/design/file-layout.md)). `rush/` must hold **exactly
one file** for the speech-ad flow (`lib/rush.py`'s `find_source()` enforces this) — put
`bg-audio.mp3` there too later if they give you one, it's excluded from the count.

Verify it arrived: `ffprobe -v error -show_entries format=duration -of csv=p=0 <work>/rush/<name>`

---

## Steps 3–11 — production

### 3) Cut plan
```bash
uv run scripts/plan_cuts.py <work>
```
Tell them how much was removed: "Removed 52 seconds of dead air — the video is 46 now, not 98."

### 4) Transcription with per-word timing
```bash
mkdir -p <work>/build
ffmpeg -v error -i <work>/rush/<name> -vn -ac 1 -ar 16000 -y <work>/build/transcribe-input.wav
uv run scripts/transcribe.py <work> --language <LANG> --model large-v3
```
- `<LANG>` = the video's language: `ar` · `fr` · `en` · or a hard dialect `ar-MA` /
  `ar-DZ` / `darija` (which enables hard-dialect mode on its own).
- The engine picks itself: faster-whisper on GPU (fastest) ← CPU ← openai-whisper fallback.
- On GPU it finishes in seconds; on CPU it takes minutes — run it in the background.
- Produces `<work>/build/transcript-raw.json` in the openai-whisper shape (segments · words · timings).

**Ask about the language before this step** — if the video is in a dialect and the
transcription comes out in another language or empty, the language is probably wrong.
Moroccan / Algerian darija: Whisper makes a lot of mistakes even with the best model —
warn the user up front, and show them the full text to correct (step 5).

### 5) Correction and captions
Read `build/transcript-raw.json`, correct every sentence (Whisper makes mistakes in
colloquial Arabic — Gulf and Maghrebi especially), and write `<work>/build/transcript-fixes.json`:
```json
{ "fix": [["كل","شي","تشوفه"], ["الكابشن","الزوم"]], "hot": ["تشوفه","الزوم"] }
```
`hot` = the words that get held in the accent pill when spoken. **The word count of each
sentence must equal Whisper's word count for that sentence** or the timings break (the
script stops you if they differ).
```bash
uv run scripts/captions.py <work>
```

### 5.5) Show them the text — and drop any sentence they don't want ← a strong feature, don't skip it
```bash
uv run scripts/edit_script.py <work> show
```
Prints their speech, numbered and timecoded, and writes `build/transcript-editable.txt`.
**Show them the list in the chat and say: "What do you want me to remove?"**

**And the important one — the repeated sentence:** the script warns you automatically
about any two similar sentences within two sentences of each other. When the speaker
rephrases a sentence, **the first is the mistake and the second is the correction** — show
them the pair and suggest dropping the first:
> "You said the sentence twice — 'we could solve the cause' then 'we could identify the
> cause'. Drop the first?"
```bash
uv run scripts/edit_script.py <work> dupes
```
```bash
uv run scripts/edit_script.py <work> drop 6 8       # removes both sentences from video and audio
uv run scripts/edit_script.py <work> keep 1 2 5 9   # keeps only these (for a shortened cut)
uv run scripts/edit_script.py <work> undo           # undo
```
The sentence is removed from the video and the audio, everything after it shifts back, and
`build/cut-plan.json`, `build/captions.json` and `build/sound-cues.json` all update.

**Do this here — before designing the scenes.** If you drop a sentence after designing
the scenes, all their times shift and you have to redo them. And after any deletion: re-run
`reframe.py`, re-extract the frames, and re-render with `--force`.

### 6) Cut and reframe
```bash
uv run scripts/reframe.py <work>
mkdir -p <work>/build/frames-source && ffmpeg -v error -i <work>/build/video-reframed.mp4 -vf fps=30 -q:v 3 -y <work>/build/frames-source/%05d.jpg
```
- Vertical source (selfie) → passes through as-is.
- **Landscape** source (16:9) → a vertical 9:16 frame is cropped from it; if the speaker
  isn't centered, set `crop.xAnchor` in `project.config.json` (0 = left · 0.5 = center · 1 = right).
  Preview one frame before continuing.

### 7) Design the scenes ← the most important step
Copy `compose.reference.html` to `<work>/compose.html` and rewrite the scene functions.

**The structure is ready, don't touch it:** shrinking the video into a card (`R_FULL` /
`R_DOWN` / `R_LOWER` with a smooth transition), the account badge, the progress bar, the
caption cards with the spoken word highlighted, the end card, and deriving the colors from
the theme.

**What you invent:** the scenes. Brainstorm 3–4 ideas per sentence; the idea must be a
**visual metaphor for what's being said**, not decoration:

| Says | Scene |
|---|---|
| counts things off | cards enter one per word, then flip with a checkmark |
| a number or a price | a counter rolls and lands on the number with a beat |
| "transcribe my words" | a transcript panel, each word dropping in on its line and timing |
| "broke / an error" | a glitch that displaces the image slices + cracks |
| a technical problem | the video card goes black with a warning mark over it |
| a fix | a progress bar + a list checking itself off |
| "one file" | a file card, and chips flying in and merging into it |
| a call to comment | a comment box, and the word typing itself letter by letter |

Each scene function takes `t` and draws based on the word timing from `build/captions.json` — the
scene sticks to the word, not to an approximate time.

**No account badge over the video** (`BADGE_UNTIL=0` in `compose.html` — the default):
the name is on the platform itself and on the end card, and the top of the screen is
space for the graphics. If someone asks for it, set `BADGE_UNTIL=3` directly in that
project's `compose.html` — it puts it in the first 3 seconds only. Not a config field
(see step 1) — it's a rare, per-project exception, not a base setting.

**Layout rule (user-approved — do not break it):**

| Moment | Rectangle | Shape |
|---|---|---|
| speech, no graphic | `R_FULL` | face fills the screen, caption below at 1460 |
| any graphic or motion | `R_DOWN` (default) | **graphic on top (y 280–520) ← caption riding the video's edge ← face below, full screen width** |
| B-roll or a big panel | `R_LOWER` | the big card on top ← caption ← small face below |

**Why:** the old layout (`R_STAGE`/`R_SIDE`: video in the middle, graphic above the head,
caption below) creates three separated focus points and the viewer gets lost.

**Three details that matter (from the layout revision):**
1. **The video is the full screen width, no margins, no rounded corners** — the face comes
   out one and a half times bigger than in the narrow card. The cost: the top and bottom
   edges of the frame get cropped, and that's acceptable because the face is what matters.
2. **The caption rides the video's edge** (42% of its height above the edge, 58% below) —
   it ties the two halves of the screen together so they don't look like two stuck-on pieces.
3. **A faint background grid** every 60px at 7.5% opacity — gives depth without pulling the
   eye (`theme.grid:false` in `project.config.json` turns it off).

**Don't overuse `R_DOWN`.** It's the default for graphic moments, not for the whole video:
- **The hook (first 3–4 seconds) is always full-screen** — their whole face, no panel
  pulling the eye.
- Any sentence with a **peak, an emotion, or a question to the viewer** → full-screen, let
  them see their eyes.
- **Never exceed half the video's duration** in `R_DOWN`, and never leave it continuous
  for more than **8 seconds** without a full-screen shot in between — otherwise the video
  becomes a static panel with a small face under it.
- No graphic at this moment? Then full-screen. **The panel comes for the idea, not to fill.**

**"Full screen" is defined by area, not by corners** (`isFull()`): `R_DOWN` now has no
rounded corners, like `R_FULL`, so any old check that relies on `r` is fooled and triggers
"speech behind the person" at a moment that isn't full-screen. With `R_DOWN` the eye
travels in one line top to bottom. **And the card is flexible:** it shrinks in proportion
(9:16) based on the graphic's bottom (`gb` per scene, e.g. `{s,e,m:R_DOWN,gb:480}`) and
the number of caption lines at that moment, so the graphic and the caption never crowd
each other. Panels are drawn at coordinates `130..950 × 278..458` inside `panelIn()` and
they scale to 1.2 on their own. `R_STAGE` and `R_SIDE` remain in the file for
back-compat only — **do not use them in a new video.**

**B-roll shots (optional):** put the cutaway clip(s) in `<work>/rush/broll/` (a folder —
it may hold several, see [`docs/design/file-layout.md`](../docs/design/file-layout.md)),
extract the useful segments to frames in `<work>/build/broll-frames/<name>_%04d.jpg`,
declare their range in `BR_NEED`, and show them with `brCard()` and `R_LOWER`. `BRCROP`
trims burned-in subtitles from the bottom of a shot. 3–4 shots in a video is enough.

**"Explanation on top, video below" mode (`R_LOWER`)** — for B-roll and big panels: the
video moves to the bottom and fills the lower screen (the speaker's head gets cropped a
little from the top, which is intentional and visually acceptable), and the panels and
caption all sit above it. **This mode deliberately enters the Instagram belt** — and it's
allowed, because what's covered is image, not text. Use it when the panel is large
(lists, comparisons, tables) and the top half isn't enough. The caption moves above the
video card automatically in this mode.

**Safe zone — Instagram covers the screen edges with its buttons:**

| Zone | Don't put text there |
|---|---|
| top | first 150 px |
| bottom | last 300 px (and a caution belt from 1500) |
| right | 180 px wide, y from 1100 to 1750 (like · comment · share) |

The reference file is already set correctly: the badge at 190, the progress bar at 1600,
and the caption card's bottom edge at 1500. **And the first caption must appear in the
first half second** — a late hook loses half the viewers before the speech even starts.

Preview before rendering everything:
```bash
node scripts/render_frames.js <work> preview 4.6 12.3 27.6 31.0 48.4
bash scripts/contact_sheet.sh <work> <work>/build/contact-sheet.jpg 4.6 12.3 27.6 31.0 48.4
```

**Opened the editing screen for them (at their request)?** Scenes are written in
`<work>/remotion/src/Scenes.tsx` (same logic: each scene takes `t`):
```bash
bash scripts/remotion/remotion.sh <work> setup            # once — after their consent (~500 MB)
bash scripts/remotion/remotion.sh <work> studio           # a live timeline in the browser
```
The video display rectangles are written in `<work>/config/stage.json` and the end-card
text in `<work>/config/outro.json` — and both are reflected in both engines.
**Read `build/contact-sheet.jpg` as one image — don't read the frames one by one.** One
sheet = one read instead of five. **Don't render the whole video before previewing at
least 6 shots**, and show the sheet to the user.

Interactive studio (scrub the timeline, draw live):
```bash
uv run python -m http.server 8791 --directory <work>   # then /studio.html
```

### 7.5) Speech passing behind the person (optional — but powerful)

The word is written large and stretched with the Arabic kashida to the width of the
speaker's body, so the elongation alone passes behind their head and the letters stay
visible on either side. It uses the macOS built-in framework (Vision) — zero download,
zero cost.

```bash
node scripts/fx/behind_text.js <work> plan        # lists the suitable sentences
node scripts/fx/behind_text.js <work> build 8     # cuts the person out of that sentence's frames
node scripts/render_frames.js <work> all --force
node scripts/fx/behind_text.js <work> off         # cancel
```

**When to use it — the rule:**
1. **Once or twice in the whole video.** Repeated every sentence, it flips from "wow" to noise.
2. **Best on the hook** (the first sentence) or the idea's peak — the sentence you want
   them to remember.
3. The conditions the script checks: the sentence is **one to four words** · its duration
   is ≥ 0.85 s.
4. And it works **at full-screen moments only** — if the video is in a small card at that
   moment, it skips it on its own.
5. The regular caption card **hides itself automatically** at that moment so the text isn't
   shown twice.
6. If the sentence is long or the person is standing at the frame edge, the text shrinks
   itself — and if no room is left for the letters, don't force it.

**Cost:** ~0.15 s per frame for the cut (a two-second sentence ≈ 10 seconds of work). Needs
macOS + Xcode CLT (`xcode-select --install`); if unavailable, the script tells you in one
sentence and the rest of the pipeline runs normally.

### 7.6) The three cutout styles (optional — need macOS)

Same person-cutout technique, in three uses. Each is one command then re-rendering only
its window:

| Style | Shape | Command |
|---|---|---|
| **Speech behind the person** | the word stretches with the kashida and passes behind the head | `build 2:6-8` |
| **Standing in front of the panel** | no card — the person is cut out and standing in front of the design | `cutout 23.8-26.6` |
| **Head outside the rectangle** | the video is in a small card and the head pokes above its edge | `headout 23.8-26.6` |

```bash
node scripts/fx/behind_text.js <work> headout 23.8-26.6
node scripts/render_frames.js <work> range 23.6 26.8
```

**When to use "head outside the rectangle" or "standing in front of the panel"?**
When you have an **explanation, a graphic, or an infographic that needs space** — the card
drops to the bottom small (`R_LOWER`) and leaves **two-thirds of the screen** for the
design. And in this mode **you're allowed to break the Instagram belt** — what's covered
is image, not text.

**The engine handles it automatically:** the caption goes above the head · the progress
bar hides · the size and position are computed from the person's body bounds every frame
so it doesn't jitter.

### 8) Sound effects
Write `<work>/build/sound-cues.json`:
```json
{ "outro": 5.2, "whoosh_up": [3.1,11.25], "whoosh_down": [7.85],
  "thud": [27.27,29.47], "tap": [23.08,24.06] }
```
```bash
uv run scripts/sound_fx.py <work>
```

### 9) Final render and assembly

**Light:**
```bash
node scripts/render_frames.js <work> all          # resumes where it stopped — doesn't redo a finished frame
bash scripts/encode.sh <work> <work>/build/video-raw.mp4
```
Edited one scene after rendering? Don't redo everything — re-render its window, then assemble:
```bash
node scripts/render_frames.js <work> range 26.4 31.2
```
(`--force` with `all` re-renders from scratch. The script warns you if a frame is missing
before assembly.)

**Remotion:** produces an MP4 directly, no frames:
```bash
bash scripts/remotion/remotion.sh <work> render <work>/build/video-raw.mp4
```

### 10) Audio mastering (+ optional background audio)
```bash
bash scripts/master_audio.sh <work> <work>/build/video-raw.mp4 <work>/video-final.mp4
```
Brings the audio to −14 LUFS — the same loudness as the other videos in the feed; without
it their audio comes out quieter than what's before and after it. And if you put
`<work>/rush/bg-audio.mp3`, a **background audio file that ducks automatically whenever they
speak** is mixed in, coming back in the pauses. The video is copied as-is, no re-encode.

**Naming:** say "background audio file", not "music" — they decide the content, and you
handle the file as-is.

### 11) Subtitle file
```bash
uv run scripts/subtitles.py <work>
```
Produces `<work>/video-final.srt` (YouTube and LinkedIn read it) and
`<work>/post-caption.txt` = their full speech text, ready for the post caption.

---

# Montage mode — speechless clips

A folder with many clips (café · trip · product · place · event) and the ask is one video
with rhythm. **No transcription, no captions, no drawn scenes.** The selection is
entirely about the shot itself. You need one thing from them: **the clip folder.** Copy
its clips into `<work>/rush/`, keeping their names — don't ask about colors or a logo or
an account — there's no text at all.

**How the engine chooses:** every moment of every clip is measured on four axes —
sharpness · motion by amount · lighting · color. Sharpness is **relative** (it compares
your clips to each other); motion and lighting are **absolute**. And frozen / dark / shaky
scores are **multiplied, not subtracted**: their other qualities can't save them. The
first and last third-second of each clip are trimmed — the hand-on-device moment.

### 1) Scan
```bash
uv run scripts/montage_mode.py <work> scan --shot 1.5
```
Scans `<work>/rush/` by default (pass an explicit folder only if the clips aren't copied
in yet). Scans four clips at a time. Our measured rate: **30 s of video ≈ 15 s of
scanning** — so 30 clips of 10 s each ≈ two and a half minutes. Run it in the background
and tell them what to expect. It prints each clip with its score and best moment, and
writes `build/montage-plan.json`.

### 2) Show them the shots — one numbered sheet
```bash
uv run scripts/montage_mode.py <work> sheet --cols 6
```
Each shot has its clip number on it. **Read the sheet as one image — don't read the frames
one by one.** And show it to them: "This is the best moment of each clip — what do you want
me to remove?"

### 3) Remove the ones they don't want
```bash
uv run scripts/montage_mode.py <work> drop 4 11      # removes
uv run scripts/montage_mode.py <work> keep 1 2 5 9   # keeps only these
uv run scripts/montage_mode.py <work> undo           # undo
```

### 4) Order and rhythm
```bash
uv run scripts/montage_mode.py <work> plan --dur 30 --shot 1.5
```
| | |
|---|---|
| `--order energy` (default) | alternates moving/calm, strongest shot first |
| `--order best` \| `folder` | by score · by folder order |
| `--bpm 96` | shot lengths on the beat — the cuts land with the sound |
| `--dur 0` | all clips, no cap |

Shot lengths vary in a repeating pattern (1.0 · 0.82 · 1.24 · 0.94 of `--shot`) so it
doesn't get monotonous.

### 5) Build
```bash
uv run scripts/montage_mode.py <work> build
```
| | |
|---|---|
| `--ar 9:16` | aspect ratio: `9:16` · `4:5` · `1:1` · `16:9` (center crop) |
| `--transition dissolve:0.3` | a transition between shots instead of a hard cut — a name or `name:duration:param` (`dissolve` · `wipe:0.4:left` · `push:0.3:up` · `iris:0.5:open` · `zoom-blur` · `glitch`); default `cut`. A `transition` on a `plan[]` entry in `build/montage-plan.json` overrides it for the cut into that clip. |
| `--zoom 0` | turns off the faint internal push-in |
| `--amb 0.3` | keeps the clips' ambience at low volume (needs every clip to have audio and no transition) |

**The zoom only works if the source is at least 1.5× bigger than the output** (4K, say),
otherwise the engine turns it off itself and tells you — because cropping a source the
same size as the output makes the zoom look choppy.

### 6) Audio and delivery — same as the speech pipeline
```bash
bash scripts/master_audio.sh <work> <work>/build/montage-raw.mp4 <work>/video-final.mp4
```
Put their audio file at `<work>/rush/bg-audio.mp3` first. The montage comes
out with a silent track if you don't ask for ambience, so the background audio file here
isn't decoration — without it the video is silent.

### Mode rules
1. **Don't transcribe and don't caption.** If the clips turn out to have important speech,
   that's the speech mode, not montage.
2. **Show them the sheet before building** — they remove what they don't like, not you.
3. **No theme, no colors, no grade** — the image comes out in its original colors (same as
   rule 4).
4. Reasonable duration is **20–40 seconds**; longer and the viewer gets bored.
5. **No publishing, no scheduling** — delivery is a file only.

---

## Fixed rules

1. **A sound effect is tied to a meaningful moment** — a number dropping, something
   breaking, a scene transition. The problem isn't the kind of sound, it's spraying it on
   every word (we tried it and it came out as noise). Don't exceed 15 events per minute,
   keep the peak below −18 dBFS, and show the user where you placed them before export.
2. **Western digits always** (0–9).
3. **Colors from `project.config.json`'s `theme` only** — no hardcoded color in the code.
4. **No color or filter over their image** — no grade, no tint, no LUT, no colored layer
   over the video. The image always comes out in its original colors, unless they
   explicitly ask. (Colors are for cards and text only.)
5. **Correct the Whisper transcript** before captioning.
6. **Don't invent content the speaker didn't say.** Every text comes from their speech;
   and if you need to describe something you don't know, generalize rather than guess.
7. **No publishing, no scheduling** — delivery is a file only.
8. **"Behind the person" once or twice in the video** — no more, or it loses its effect.
9. **Call it a "background audio file"** — not "music". The user decides its content (a
   human voice, ambience, or anything), and you name it by its neutral form and put it in
   `rush/bg-audio.mp3`.
10. **Invent new scenes every time.** The reference file is a pattern library, not a
    template to copy.

---

## Verification before delivery (mandatory)

0. **Safe zone and hook** — an automated check, doesn't need your eyes:
```bash
node scripts/safe_check.js <work> --shot
```
It draws each moment twice with two colors where the video is, and whatever doesn't change
= your graphics — so it counts your text inside the Instagram button zones precisely, and
confirms the first caption is before half a second. It exits with code 3 if there's a
violation, and produces `build/safe-zone-check.jpg` (only when there's a violation to show)
with the red shot showing where the problem is. The bounds are adjusted with
`<work>/config/safe.json` if you need to (a TikTok video with tighter bounds, say) — the
same rects are reused for every short-form platform by default (see
[`docs/design/file-layout.md`](../docs/design/file-layout.md)), so this is a rare override,
not something to set per project.

1. **Sync** — transcribe the output audio again and compare sentence starts to
   `build/captions.json`; the difference should be under 0.1 seconds:
```bash
ffmpeg -v error -i <work>/video-final.mp4 -vn -ac 1 -ar 16000 -y <work>/build/fa.wav
uv run scripts/transcribe.py <work> --language <LANG> --model medium --wav <work>/build/fa.wav --out <work>/build/fa.json
```
Compare the sentence starts of `build/fa.json` to `build/captions.json`.
2. **Audio** — after `master_audio.sh` it prints the final loudness: it must be ≈ −14 LUFS
   with a peak of −1.5 dBTP or lower.
3. **The eye** — a 6-shot contact sheet, actually looked at.
4. **Size** — under 30 MB.

## Token economy — images are the enemy

**By actual measurement: images eat 80–85% of the conversation context.** A 1080-wide
image ≈ 150k characters; the same at 300 wide ≈ 20k.

1. **Every shot is shrunk before it's shown:** `-vf scale=300:-1` — plenty for a visual
   judgment.
2. **One contact sheet** instead of separate images (`contact_sheet.sh`) — five shots in
   one image.
3. **One shot per stage**, not per attempt. Changed something? Check it by the numbers
   first, the image last.
4. **The automated check instead of the eye:** `safe_check.js` gives you a one-line verdict
   — use it before you take a screenshot.
5. **ffmpeg output** is always trimmed: `2>&1 | tail -2`.
6. **Don't read `compose.html` whole** — `grep -n` for the function you need.

**Don't show an image except for a visual question that nothing else answers.**

## Token economy (general)

The expensive thing isn't the rendering, it's **the number of turns** — every turn resends
the whole conversation.

1. **A clean session per video.**
2. **A contact sheet instead of separate images.**
3. **Batch independent commands into one turn.**
4. **Run the long thing in the background** and wait for the completion notification once.
5. **Don't change the architecture in prose** — build on the reference file.
6. **Save `build/captions.json` and `build/cut-plan.json`** — any later edit won't need re-transcription.

## Delivery

Present the file with: the duration, how much dead air was removed, the number of scenes,
and the final loudness. Deliver alongside it the `.srt` and the `.txt` (their speech text
for the post caption). And mention that you didn't publish anything.

---

## Script map

| | Does what | Engine |
|---|---|---|
| `setup.sh` | installs ffmpeg/Node/uv (system), then `uv sync` + `npm ci` (isolated) | shared |
| `lib/platform.sh` · `lib/platform.js` | cross-platform helpers (paths · `VEVO_PY` · browser · OS) | shared |
| `lib/config.py` · `lib/config.js` | reads/merges `project.config.json` | shared |
| `lib/rush.py` | finds the input file(s) in `rush/` without assuming a fixed name | shared |
| `transcribe.py` | transcription → `build/transcript-raw.json` (faster-whisper GPU/CPU ← whisper) | shared |
| `plan_cuts.py` | measures the silences and produces the speech segments | shared |
| `captions.py` | per-word timing on the new timeline | shared |
| `reframe.py` | cut + 9:16 reframe (accepts a landscape source) + zoom + bt709 tag | shared |
| `render_frames.js` | draws the frames (resume + window) | light |
| `remotion/remotion.sh` | prepares / opens / renders a Remotion project | Remotion |
| `sound_fx.py` | the sound effects from `build/sound-cues.json` | shared |
| `encode.sh` | assembles the frames + audio | light |
| `master_audio.sh` | −14 LUFS + ducked background audio | shared |
| `contact_sheet.sh` | one contact sheet (token economy) | shared |
| `safe_check.js` | safe zone + hook | light (and Remotion: `"guides":true` gives you the zones live in the studio) |
| `subtitles.py` | subtitle file + caption text | shared |
| `edit_script.py` | drop a sentence from the text → it drops from the video | shared |
| `fx/behind_text.js` + `personmask.swift` | the three cutout styles (behind the person · in front of the panel · head outside the card) | light |
| `montage_mode.py` | **montage mode**: scans a clip folder, picks the best moment of each, and assembles them | independent |

Full contributor documentation (data flow, the two engines, the ten real-run bugs, the
target architecture): **`../docs/`** at the repo root.
