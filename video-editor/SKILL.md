---
name: video-editor
description: Edits a talking-to-camera video (selfie / teleprompter) into a finished vertical 9:16 reel for Instagram, TikTok or YouTube Shorts — removes the silences, transcribes the speech with per-word timing, adds synced captions in the speaker's own dialect, builds code-drawn motion graphics and B-roll scenes, and an end card. Whatever the video is for — explaining a subject, a lesson, an announcement, a promotion — it is an edit, not an ad format. It also has a second montage mode: a folder of speechless clips (cafés, travel, a product, a place) — it picks the best moment of each clip and assembles them into one rhythmic montage. And a third long-form mode: one or more long talking recordings become an edited 16:9 YouTube video — pauses and filler words cut tight, chapter markers, optional B-roll cutaways, soft subtitles. ALWAYS use this skill when the user says "edit this clip", "montage this video", "turn this video into a reel", "make a short out of this", "produce this clip", "remove the silences / the dead air / the pauses", "cut the silence", "add captions", "add subtitles", "I want motion graphics on the video", "I have 30 clips, make me one video out of them", "make me a montage from these clips", "pick the best shots", "make a YouTube video out of this", "edit this into a YouTube video", "tighten this talk", "cut the pauses out of this lecture", "add chapters", "add a chapter index" — or their French equivalents ("monte cette vidéo", "fais-moi un reel", "enlève les silences / les blancs", "coupe les temps morts", "ajoute les sous-titres", "je veux des animations sur la vidéo", "fais un montage avec ces clips", "choisis les meilleurs plans", "fais-en une vidéo YouTube", "resserre cette prise de parole", "ajoute des chapitres") — or sends a talking video, a folder of clips, or a long recording and asks for an edit. NOT for carousels (use carousel-creator) or video covers (use animated-video-cover).
---

# Video editing — no editing app

## The idea

The whole edit is code: ffmpeg cuts, Whisper transcribes with per-word timing, and a
drawing engine composites the captions and motion graphics over the video. The output is
one publish-ready MP4.

**This is an editing skill, not an ad format.** The creator is making a reel for Instagram,
TikTok or YouTube Shorts — usually explaining a subject, sometimes a lesson or an
announcement, occasionally a promotion. Never call the result "an ad" and never assume the
video is selling something. It is *their video*, edited.

## Three modes — decide which one you're in, in your first line

| | **Talking video** (default) | **Clip montage** | **Long-form** |
|---|---|---|---|
| Input | one video of a person talking | a folder with many speechless clips | one or more long talking recordings |
| Example | selfie · teleprompter · explainer | café · trip · product · place · event | a YouTube talk · a lesson · a podcast |
| Output | 9:16 captioned reel | one rhythmic MP4 | **16:9** edited talk with chapters |
| Selection driven by | the speech (remove silences + repeats) | the shot itself (sharpness · motion · lighting) | the speech (**tight** jump cuts + filler words) |
| Captions? | yes, word-synced burned-in | **no** | soft `.srt` only |
| Steps | 1–13 below | the "Montage mode" section | the "Long-form mode" section |

**How do you know the mode without asking?** A **folder** / more than one clip with no
speech = montage. **A single file with speech** = talking video. They ask for a **YouTube
edit**, "tighten this talk", "cut the pauses in this lecture", "add chapters", or hand you
a long recording for YouTube = long-form — and you set `"format": "long"` in the config
(it's the one thing that can't be read from the footage). If a folder turns out to have
audible speech and they want captions, run the talking-video flow on the main clip.

**Do not ask "which mode do you want?"** — read the input, go, and tell them in one
sentence what you understood.

## Two engines — but don't ask the user anything about them

The skill is one thing; the engine that draws the scenes is two. **The choice is yours,
not theirs.**

**Always start with the light engine, silently.** Never say the word "Remotion" or
"canvas" or "engine", and never offer two options — the person in front of you wants their
video edited, not to pick a technology.

**When do you open the second one?** Only if **they** say something like this, after
seeing the result:
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
- **When in doubt, ask. Always.** Never decide on a supposition, never act on a guess. If
  two readings of the input are possible, stop and show both. This outranks every "don't
  ask" instruction below: those apply only to what the input can actually settle.
- **Never deliver without showing.** After each major stage, show a frame or a summary.

### How every message is laid out — this is not a suggestion

**Always name the step you are on, and the step that comes next.** The person must never
have to wonder where they are in the flow. Head every message with
`Step N/13 — <name> — <STATE>`, the state in capitals right after the title with a dash
(`DONE`, `RUNNING`, `WAITING FOR YOU`, `SKIPPED`). End the message with the next step.

**Facts go in a list, never in a paragraph.** One line per item, a dash, the thing's name,
a colon, then its facts separated by `·`. Never a sentence that buries three numbers in
prose.

```
Step 1/13 — Preparation — DONE

Tools: everything already installed.

File taken:
- VID_20260908_122908.mp4 : 1080x1920 · 2 min 22 s · 30 fps · audio present

Folders prepared:
- work/rush/    the video
- work/config/  the settings
- work/build/   the working files

Next — step 2/13, the settings (defaults, nothing to do).
```

**Never write a paragraph announcing everything you are about to do.** No "I'll cut the
silences, transcribe your speech, add captions and animations…". That decision is not
yours: show the flow as a list and let them switch steps off (see "The flow is a list of
switches" below).

**One time estimate per step, on the step that is running** — not a forecast of the whole
pipeline: "transcribing, about 3 minutes".

---

## Step 1 — preflight: where are we, and with what

**One command does the whole step.** It checks the toolchain (it calls `setup.sh` itself),
probes every file, decides the mode, finds a config sitting beside the footage, and
prepares the ground. Look first, act second:

```bash
uv run scripts/preflight.py <the path they gave you>            # look only
uv run scripts/preflight.py <the path they gave you> --apply    # then prepare
```

**Branch on the exit code — don't parse the prose:**

| Code | What it means | What you do |
|---|---|---|
| `0` | ready | re-run with `--apply`, then go to step 2 |
| `10` | a tool is missing | one plain sentence about what you'll install and why, get their consent, `bash scripts/setup.sh --install`, then **run preflight again** |
| `20` | a human has to decide | read the `ASK:` lines and ask exactly that. **Never guess** |
| `30` | nothing usable | say what you looked at and ask for the right file or folder |

A verdict of `resume` means this project already exists — don't redo it, run
`uv run scripts/run.py <work> --dry` and tell them where it stopped.

**The work directory — one folder = one project.** The folder holding the footage *is* the
project; `preflight --apply` creates `work/` next to the footage and **moves** the material
in (moved, not copied: no quality loss, no duplicated gigabytes, and the folder is left
clean). Anything it doesn't recognise stays exactly where they left it.

```
mon-dossier/                         mon-dossier/
  video-selfie.mov                     work/
  project.config.json      ──────▶       rush/    video-selfie.mov
  logo.png                               config/  project.config.json · logo.png
                                         build/   (compose.html, studio.html and
                                                  every intermediate file)
```

`<work>` in every later step = that `work/` folder. Full reference: the docstring at the top of `scripts/preflight.py`.

**If the video isn't on their machine yet**, get it there first, then point preflight at
it. Accept any method:

| Method | When | How |
|---|---|---|
| **A file on their machine** ← best | always if possible | they give you the path |
| **A Google Drive link** | they shoot on their phone and Drive auto-uploads | have them set sharing to "anyone with the link", then:<br>`curl -sL "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t" -o <folder>/<name>.mov`<br>the ID is the part between `/d/` and `/view`. Tested on a 441 MB file |
| **Google Drive connector** | the file is private and they don't want to change sharing | use the connector tools available in the session |

**About resolution:** 4K is better because the zoom crops from the original so you lose no
sharpness. But 1080p works fine — the difference is the zoom range gets tighter. **Do not
reject a 1080p video and do not ask them to re-shoot.**

**Dependencies are isolated.** `setup.sh --install` installs only **ffmpeg**, **Node** and
**uv** at the system level (via brew / winget / apt). Everything else is contained:
Python packages go in a `uv`-managed `.venv/` (never the system Python), and the browser
that draws the scenes is downloaded by `npm` into the skill's `node_modules/` — **no
separate Chrome install**. `uv run scripts/…` re-syncs the venv on its own if needed.

**Platforms:** macOS, Windows (Git-Bash/WSL) and Linux. The macOS-only features (steps 9
and 10 — the person cutouts) skip themselves automatically elsewhere, and the rest
of the pipeline runs normally.

**End the step with a recap in the terminal** — no jargon, plain sentences:
the tools (already there / what you installed), the file(s) you'll work on with their
length and shape, anything preflight flagged (no audio, rotated, low-res, very long), the
structure you created and what each folder is for, and what happens next.

---

## Step 2 — settings (silent, no questions)

**Ask nothing.** Step 1 already wrote `<work>/config/project.config.json` from the skill
defaults — that file is now the single source for this project. Read it, show it in three
lines, move on:

```
Step 2/13 — Settings — DONE

- language : ar-MA (northern-Morocco darija — hard-dialect mode on)
- font     : Cairo
- colours  : white background · blue accent · purple second · @hatim.exp
  (written to work/config/project.config.json — edit it there if a render needs a nudge)

Next — step 3/13, cutting the silences.
```

The defaults these came from:

| Field | Value | |
|---|---|---|
| `language` | `ar-MA` | northern-Morocco **darija**, not standard Arabic. `transcribe.py` maps it to `ar` and turns hard-dialect mode on by itself |
| `theme.font` | `Cairo` | |
| `theme.bg` / `ink` | `#FFFFFF` / `#101828` | light background, dark ink |
| `theme.acc` / `clay` | `#2563EB` / `#7C3AED` | blue accent, purple second |
| `theme.mut` | `#667085` | |
| `theme.handle` | `@hatim.exp` | the same handle everywhere |
| `format` · `engine` · `grade` | `short` · `light` · `false` | never ask about these |

**Do not ask for colours, a logo, a font or a language.** The per-project *questionnaire*
is deliberately off in this version — the file is written once from the defaults and left
alone. `scripts/defaults.config.json` is the template; `<work>/config/project.config.json`
is the project's own copy, and the only one to edit from here on.

**The one thing you may still choose: the accent colour.** If the subject clearly calls for
it, propose a different `acc` in one line and let them say yes or no — never a
questionnaire. If they agree, edit `theme.acc` in `<work>/config/project.config.json`.

Every scene derives its colours from `theme` automatically — the cards, the shadows, and
the text colour over the accent pills (computed from the colour's luminance). A light or a
dark background both work.

**The colour grade (`grade`) is off** — the video keeps its original colours. Only turn it
on if they explicitly ask, or complain the image looks cold / washed out, and say so when
you do.

`crop`'s defaults (0.5 / 0.30 / 0.30) suit almost every video — only revisit `xAnchor` /
`faceAnchor` after previewing a frame, if the speaker turns out off-centre (step 7).
**There is no account-badge field** — it is off, and if it is ever wanted for one video,
set `BADGE_UNTIL` directly in that project's `<work>/build/compose.html` (step 8).

---

## The flow is a list of switches — show it, then follow it

**Right after step 1, show the whole flow as a list and let them turn steps off.** Never a
paragraph announcing what you will do. This is the message:

```
Here is the flow. Tell me if you want to drop any of it.

  1  Preparation                                       done
  2  Settings (defaults)                               done
  3  Cut the silences + clean-frame the cut points     on
  4  Transcribe the speech                             on
  5  Correct the transcript + cut the retakes (I do it) on
  6  Choose which whole sentences to keep              on
  7  Reframe to vertical 9:16                          on
  8  On-screen captions                                on   (language: darija)
  9  Animations illustrating what you say              on
 10  Effects on the person (macOS only)                off
 11  Sound effects                                     on
 12  Final render + audio mastering                    on
 13  Subtitle file (.srt) + post caption               on

Say "everything" and I start, or name what to drop
("no animations", "captions in French", "no sound effects").
```

**Every step is a switch except 1, 2, 7 and 12** — preparation, settings, reframing and the
render are what make a file at all. Everything else is the creator's call, and the answer is
theirs, not yours.

**When a switch is off, say what it changes** in one line, and honour the dependencies:

| Turned off | What happens |
|---|---|
| 3 cut the silences | the original pace is kept, the video stays its full length; the clean-frame pass goes with it |
| 4 transcribe | **forces 5, 6, 8, 13 off** — no text means no captions and no `.srt` |
| 5 correct + cut retakes | Whisper's raw text is used, mistakes and all (in darija that is a lot), and the stammers / false starts stay in the video |
| 6 choose the sentences | whole sentences the speaker wanted gone stay in |
| 8 captions + animations | **two switches in one step.** "No animations" gives a captions-only reel — a valid choice, not a failure. "No captions" gives picture only. The caption language is chosen here, not in the settings |
| 9 / 10 effects on the person | nothing lost; both are off by default and need macOS |
| 11 sound effects | a silent bed, the speaker's voice untouched |
| 13 subtitle file | no `.srt`, no post caption text |

**Running the mechanical stages.** `uv run scripts/run.py <work>` runs them in order, skips
whatever is already up to date, and stops at the points that need the creator. `run.py
<work> --dry` shows the plan, `--from <stage>` resumes, `--only <stage>` runs one. The
canonical stage list is `scripts/pipeline/<world>.json`; the steps below say *how* to do
each one, and the conversation stays yours.

---

## Steps 3–13 — production

### 3) Cut the silences
```bash
uv run scripts/plan_cuts.py <work>
uv run scripts/settle_check.py <work>
```
`plan_cuts.py` removes the silences (asymmetric pad — more air before each line than after,
tunable in the `cut` config block). Then `settle_check.py` walks every cut-in point and
nudges it to the first sharp, still frame — so a line never starts on a blurred frame or
mid-reposition. It only ever eats into the lead-in pad, never a spoken word.

Tell them how much was removed: "Removed 52 seconds of dead air — the video is 46 now, not 98."

### 4) Transcribe the speech
```bash
mkdir -p <work>/build
ffmpeg -v error -i <work>/rush/<name> -vn -ac 1 -ar 16000 -y <work>/build/transcribe-input.wav
uv run scripts/transcribe.py <work> --language <LANG>
```
- `<LANG>` = the video's language: `ar` · `fr` · `en` · or a hard dialect `ar-MA` /
  `ar-DZ` / `darija` (which turns hard-dialect mode on by itself).
- The model picks itself: `transcribe.model` in the config, else a darija fine-tune when
  one is set (issue #126), else `large-v3`. Engine: faster-whisper GPU ← CPU ← openai-whisper.
- CPU takes minutes — run it in the background.
- Produces `<work>/build/transcript-raw.json` (segments · words · timings).

**Confirm the language before this step** — if the transcript comes out in the wrong
language or empty, `<LANG>` is wrong. Darija is rough even with a fine-tune; that is what
step 5 is for — and it is *your* job, not the user's.

### 5) Correct the transcript, cut the retakes, build the captions — Claude does it

**5a — correct the whole transcript.** Read `build/transcript-raw.json` end to end. For
every sentence: if it is garbled, first try to recover what was actually said; if you
cannot, **reword it so it reads correctly and means what they were saying**, in the
video's own language and register — darija stays darija, same level of speech. Do **not**
switch to Modern Standard Arabic or another language unless the user explicitly asked for
the captions in that language. Write `<work>/build/transcript-fixes.json`:
```json
{ "fix": [["كل","شي","كتشوفو"], ["الكابشن","و","الزوم"]], "hot": ["كتشوفو","الزوم"] }
```
- One `fix` entry per Whisper segment (that structure must match). The **word count per
  sentence no longer has to match Whisper** — `captions.py` spreads a reworded sentence
  across its span.
- `hot` = words held in the accent pill when spoken.
- **This is not a line-by-line session with the user.** Do it yourself, then show a short
  summary: "23 sentences · 6 reworded (Whisper had them garbled) · the rest as spoken".

**5b — build the caption timings**
```bash
uv run scripts/captions.py <work>
```

**5c — cut the retakes** (the "I said it wrong, let me start over" runs)
```bash
uv run scripts/retakes.py <work>
```
Detects restarts, stammers and stall words → `build/retakes.json`. **Append the ones only
meaning catches** — the ones you spotted in 5a — as extra entries, and set `cut: false` on
anything that is real content. Show the user the list (before / after text), then:
```bash
uv run scripts/retakes.py <work> apply     # terminal — folds into cut-plan.json + captions.json (don't re-run captions.py after)
```

### 6) Choose which sentences to keep  ← a strong feature, don't skip it
```bash
uv run scripts/edit_script.py <work> show
```
Prints their speech, numbered and timecoded, and writes `build/transcript-editable.txt`.
**Show them the list in the chat and say: "What do you want me to remove?"**

This step is for **whole sentences the speaker wants gone** — a tangent, a point that
didn't land. Mid-sentence retakes and stammers are already handled in step 5 (`retakes.py`);
`edit_script.py dupes` still flags any two whole sentences that rephrase each other within
two of each other, in case one slipped through:
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

### 7) Reframe to vertical 9:16
```bash
uv run scripts/reframe.py <work>
mkdir -p <work>/build/frames-source && ffmpeg -v error -i <work>/build/video-reframed.mp4 -vf fps=30 -q:v 3 -y <work>/build/frames-source/%05d.jpg
```
- Vertical source (selfie) → passes through as-is.
- **Landscape** source (16:9) → a vertical 9:16 frame is cropped from it; if the speaker
  isn't centered, set `crop.xAnchor` in `project.config.json` (0 = left · 0.5 = center · 1 = right).
  Preview one frame before continuing.

### 8) Design the scenes and the on-screen captions ← the most important step
Step 1 already put `scripts/compose.reference.html` at `<work>/build/compose.html`. Rewrite
its scene functions (or author `config/scenes.json` instead — the data-driven path).

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

**No account badge over the video** (`BADGE_UNTIL=0` in `build/compose.html` — the default):
the name is on the platform itself and on the end card, and the top of the screen is
space for the graphics. If someone asks for it, set `BADGE_UNTIL=3` directly in that
project's `build/compose.html` — it puts it in the first 3 seconds only. Not a config field
(see step 2) — it's a rare, per-project exception, not a base setting.

**Layout rule (user-approved — do not break it):**

| Moment | Rectangle | Shape |
|---|---|---|
| speech, no graphic | `R_FULL` | face fills the screen, caption below at 1460 |
| any graphic or motion | `R_DOWN` (default) | **graphic on top (y 280–520) ← caption riding the video's edge ← face below, full screen width** |
| B-roll or a big panel | `R_LOWER` | the big card on top ← caption ← small face below |

**Why:** the old middle-of-screen layout (video in the middle, graphic above the head,
caption below) created three separated focus points and the viewer got lost. Those rects
(`R_STAGE` / `R_SIDE`) are gone from both engines.

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
they scale to 1.2 on their own.

**B-roll shots (optional):** put the cutaway clip(s) in `<work>/rush/broll/` (a folder —
it may hold several,),
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
uv run python -m http.server 8791 --directory <work>   # then /build/studio.html
```

### 9) Speech passing behind the person (macOS only — off by default)

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
1. **Twice in the whole video at most, and ≥ 8 s apart.** Close together, or every
   sentence, it flips from "wow" to noise. `plan` flags a pick too near one already built.
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

### 10) The three cutout styles (macOS only — off by default)

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

### 11) Sound effects
Write `<work>/build/sound-cues.json`:
```json
{ "outro": 5.2, "whoosh_up": [3.1,11.25], "whoosh_down": [7.85],
  "thud": [27.27,29.47], "tap": [23.08,24.06] }
```
```bash
uv run scripts/sound_fx.py <work>
```

### 12) Final render, assembly and audio mastering

**Light:**
```bash
node scripts/lint_compose.js <work>               # static check first — catches a broken wordsOf/SCENES/scene ref in <1 s (a full render is ~12 min)
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

#### Audio mastering (+ optional background audio)
```bash
bash scripts/master_audio.sh <work> <work>/build/video-raw.mp4 <work>/video-final.mp4
```
Brings the audio to −14 LUFS — the same loudness as the other videos in the feed; without
it their audio comes out quieter than what's before and after it. And if you put
`<work>/rush/bg-audio.mp3`, a **background audio file that ducks automatically whenever they
speak** is mixed in, coming back in the pauses. The video is copied as-is, no re-encode.

**Naming:** say "background audio file", not "music" — they decide the content, and you
handle the file as-is.

### 13) Subtitle file + post caption
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

# Long-form mode — YouTube 16:9

One or more long talking recordings, and the ask is an **edited YouTube video**: the
pauses tightened out, filler words gone, chapters in the description, maybe a few B-roll
cutaways. **No motion-graphics scenes, no sound effects, no Instagram safe-zone check** —
this is a different, much smaller path than the reel. Captions are a soft `.srt` file, not
burned in.

**The conductor runs it.** `uv run scripts/run.py <work>` runs every mechanical stage and
stops at the four points that need you and the user. Below is what to do at each stop; the
stages between them are automatic.

### 1) Configuration
Same as talking-video step 2, but write **`"format": "long"`** in
`<work>/config/project.config.json` — that's the switch that selects this world. Ask the
video's language. Theme colors barely matter here (no cards, no end card); you still need
the language. The tightening thresholds live under `longform` (`pauseMs` 250, `keepMs` 90,
`fillers` true) — defaults are good, only touch them if the user wants a looser or tighter
cut.

### 2) Get the recordings
Copy every take into `<work>/rush/` (keeping names). One file or several — `run.py`'s
`join` stage concatenates them into `build/source-joined.mp4` (the takes must be the same
resolution / codec — a single session split into files is the normal case).

```bash
uv run scripts/run.py <work>          # runs join → cut → audio → transcribe, then stops
```

### 3) Correct the transcript ← same as the reel (steps 4–5)
Read `build/transcript-raw.json` whole and reword every garbled sentence yourself, in the
video's own language and register; write `build/transcript-fixes.json` (one entry per
Whisper segment — the per-sentence word count need not match). Show a summary, not a
line-by-line session. Then: 

```bash
uv run scripts/run.py <work>          # runs captions, then stops at the tighten checkpoint
```

### 4) Tighten ← the core of this mode
```bash
uv run scripts/tighten.py <work>              # proposes the cuts, writes build/tighten-plan.json
```
It trims every inter-word pause over 250 ms down to 90 ms (hard jump cuts) and drops
filler words (`um`, `euh`, `يعني` …) from `scripts/fillers.json`. **Show the user the
summary** — "847 micro-cuts, 41 fillers, 3m12s removed, 18m04 → 14m52" — and the filler
list in context. If they want a specific filler kept or an extra one dropped, adjust and
re-run. Then:
```bash
uv run scripts/tighten.py <work> apply        # folds it into cut-plan.json + captions.json
```
This is terminal (like `edit_script.py apply`) — don't re-run `captions.py` after it. Undo
= restore the `.bak` files.

### 5) Propose chapters
Read the corrected transcript and **propose 3–8 chapter breaks** to the user — the topic
shifts, keyed to a sentence number. After they confirm, write
`<work>/config/chapters.json`:
```json
[ { "ref": { "sentence": 0 }, "title": "Intro" },
  { "ref": { "sentence": 34 }, "title": "The three mistakes" } ]
```
Optional — no file means no chapter markers. `subtitles.py` turns it into
`video-final.chapters.txt` (the first is forced to `00:00`).

### 6) B-roll cutaways (optional)
If they gave you cutaway clips, put them in `<work>/rush/broll/` and write
`<work>/config/broll.json` — each entry is a span (`{ "range": [t0,t1] }` or
`{ "sentence": N }`) + the clip filename. The clip covers the speaker for that span; the
speaker's audio keeps playing.
```json
[ { "ref": { "range": [72.0, 78.5] }, "clip": "screen-recording.mp4", "at": 0.4 } ]
```

### 7) Finish
```bash
uv run scripts/run.py <work>          # reframe (16:9) → assemble → master → subs
```
Delivers `<work>/video-final.mp4` (1920×1080), `video-final.srt`, `post-caption.txt`, and
`video-final.chapters.txt` if there are chapters. **Present it with:** the duration before
and after tightening, the number of fillers cut, the chapter list, and the final loudness.

### Long-form rules
1. **Tighten is a proposal, not an auto-apply** — always show the user the summary and the
   filler list before `apply`.
2. **Chapters are your judgment from the transcript** — there's no automatic topic
   detection. Propose, let the user adjust.
3. **Soft captions only.** No burned-in text (`longform.captions: "burned"` is reserved,
   not built). YouTube renders the `.srt`.
4. **No end card, no badge, no motion graphics, no sound effects** — this mode is the cut
   and the chapters, nothing decorative.
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
5. **Correct the Whisper transcript** before captioning — Claude reads it whole and rewords
   every garbled sentence itself (step 5), not line by line with the user.
6. **Reword for readability, never for new meaning.** A garbled sentence may be rephrased
   so it reads correctly — same language, same register, same point. Do **not** add a
   claim, a number, or a fact the speaker didn't say; if something is unclear, generalize
   rather than invent.
7. **No publishing, no scheduling** — delivery is a file only.
8. **"Behind the person" twice in the video at most, ≥ 8 s apart** — closer together it
   loses its effect. `fx/behind_text.js plan` flags picks that are too near one already built.
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
same rects are reused for every short-form platform by default, so this is a rare
override, not something to set per project.

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
6. **Don't read `build/compose.html` whole** — `grep -n` for the function you need.

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
| `preflight.py` | **step 1** — inventory the input, check the tools, build `work/{rush,config,build}` | shared |
| `lib/rush.py` | finds the input file(s) in `rush/` without assuming a fixed name | shared |
| `lib/timeline.py` | the cut-plan / caption timeline surgery shared by `edit_script.py` + `tighten.py` | shared |
| `run.py` | the config-driven conductor — runs the stages, stops at the decisions | shared |
| `transcribe.py` | transcription → `build/transcript-raw.json` (faster-whisper GPU/CPU ← whisper) | shared |
| `plan_cuts.py` | measures the silences and produces the speech segments | shared |
| `captions.py` | per-word timing on the new timeline | shared |
| `reframe.py` | cut + reframe (9:16, or 16:9 for `format:"long"`) + zoom + bt709 tag | shared |
| `join_takes.py` | **long-form**: joins the `rush/` recording take(s) → `build/source-joined.mp4` | long-form |
| `tighten.py` | **long-form**: jump-cut + filler pass (word-level cuts) | long-form |
| `assemble_longform.py` | **long-form**: B-roll overlays / remux → `build/video-raw.mp4` | long-form |
| `render_frames.js` | draws the frames (resume + window) | light |
| `remotion/remotion.sh` | prepares / opens / renders a Remotion project | Remotion |
| `sound_fx.py` | the sound effects from `build/sound-cues.json` | shared |
| `encode.sh` | assembles the frames + audio | light |
| `master_audio.sh` | −14 LUFS + ducked background audio | shared |
| `contact_sheet.sh` | one contact sheet (token economy) | shared |
| `safe_check.js` | safe zone + hook | light (and Remotion: `"guides":true` gives you the zones live in the studio) |
| `subtitles.py` | subtitle file + caption text (+ `video-final.chapters.txt` from `config/chapters.json`) | shared |
| `edit_script.py` | drop a sentence from the text → it drops from the video | shared |
| `fx/behind_text.js` + `personmask.swift` | the three cutout styles (behind the person · in front of the panel · head outside the card) | light |
| `montage_mode.py` | **montage mode**: scans a clip folder, picks the best moment of each, and assembles them | independent |

**This file is the source of truth for the pipeline.** Beyond it: each script's own
docstring, and the stage lists in `scripts/pipeline/<world>.json`. Nothing else.
