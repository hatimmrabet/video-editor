---
name: video-editor
description: Edits a video of someone talking to camera (selfie / teleprompter / a talk / a lesson) into a finished, captioned video — removes the silences, transcribes the speech with per-word timing, cuts out the repeated takes, tightens the pauses and the filler words, adds word-synced captions in the speaker's own dialect, builds code-drawn motion graphics scenes, an end card, and chapter markers on a long recording. **The output keeps the orientation it was shot in** — a vertical recording gives a vertical video for Instagram / TikTok / Shorts, a horizontal one gives a horizontal video for YouTube; there is no format to choose. One recording, or several takes of the same talk, which get joined. ALWAYS use this skill when the user says "edit this clip", "turn this video into a reel", "make a short out of this", "produce this clip", "remove the silences / the dead air / the pauses", "cut the silence", "add captions", "add subtitles", "I want motion graphics on the video", "make a YouTube video out of this", "edit this into a YouTube video", "tighten this talk", "cut the pauses out of this lecture", "add chapters", "add a chapter index" — or their French equivalents ("monte cette vidéo", "fais-moi un reel", "enlève les silences / les blancs", "coupe les temps morts", "ajoute les sous-titres", "je veux des animations sur la vidéo", "fais-en une vidéo YouTube", "resserre cette prise de parole", "ajoute des chapitres") — or sends a talking video and asks for an edit. NOT for assembling a folder of unrelated clips into a montage, NOT for carousels (use carousel-creator) and NOT for video covers (use animated-video-cover).
---

# Video editing — no editing app

## The idea

The whole edit is code: ffmpeg cuts, Whisper transcribes with per-word timing, and the
renderer composites the captions and motion graphics over the video. The output is one
publish-ready MP4.

**This is an editing skill, not an ad format.** The creator is making a reel for Instagram,
TikTok or YouTube Shorts — usually explaining a subject, sometimes a lesson or an
announcement, occasionally a promotion. Never call the result "an ad" and never assume the
video is selling something. It is *their video*, edited.

## What this edits — and what it does not

**One input: a recording of someone talking to camera.** A selfie, a teleprompter take, a
lesson, a talk — one file, or several takes of the same talk (they get joined). That is the
whole scope: this skill edits *a* video, it does not assemble footage into something new.

**There is no format, no aspect-ratio question and no mode to pick.** A vertical recording
gives a vertical video for Instagram / TikTok / Shorts, a horizontal one gives a horizontal
video for YouTube — the source decides, and nothing is ever cropped to a different shape. A
30-second reel and a 40-minute talk run the exact same steps; a long one simply has more to
tighten and is worth proposing chapters for.

**What it is not for:** assembling a folder of unrelated clips into a montage, B-roll
cutaways, or anything where the edit is not driven by what the person is saying. The speech
is the spine of every decision here — the silences, the repeated takes, the pauses, the
filler words, the captions. Without it there is nothing to edit.

---

## The rendering engine — don't say a word about it

The scenes are drawn by Remotion. **The user never needs to know that.** Never say
"Remotion", "React", "render engine" or "composition" — the person in front of you wants
their video edited, not to pick a technology. Everything installs itself on first render
(~500 MB, once); there is no setup step to announce and none to forget.

**There is a live editing screen**, and you open it only if **they** ask, after seeing the
result:
> "I want to edit it myself" · "I don't like where this sits, I want to move it" · "is
> there a screen where I can see the edit?" · "I want to try things myself"

Then say one jargon-free sentence: "I'll open you a live editing screen where you see the
video and move anything and see the result instantly." After they agree:
`remotion/remotion.sh <work> studio`. **Never redo an earlier step** — the cut, the
transcription and the captions are all shared; the work carries over as-is.

**One thing to tell them, once, if they are a company:** the renderer is free for
individuals and small teams, but a company with 4 or more employees needs a paid licence.
Say it plainly when it applies and move on.

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
                                         build/   (every intermediate file)
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

**Platforms:** Windows (Git-Bash/WSL) and Linux.

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
| `grade` | `false` | never ask about this |

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
`faceAnchor` after previewing a frame, if the speaker turns out off-centre (step 9).
**Don't ask about the account badge** — `theme.badgeUntil` is 0, and it only ever changes
if the creator asks for it on one video (step 8).

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
  5  Correct the transcript (I do it)                  on
  6  Finalize the script: repeats gone, your edits      on
  7  Tighten the pauses + the filler words             on
  8  Chapter markers                                   off  (long recordings only)
  9  Cut and assemble                                  on
 10  On-screen captions + animations                   on   (language: darija)
 11  Sound effects                                     on
 12  Final render + audio mastering                    on
 13  Subtitle file (.srt) + post caption               on

Say "everything" and I start, or name what to drop
("no animations", "captions in French", "no sound effects").
```

**Every step is a switch except 1, 2, 9 and 12** — preparation, settings, assembling the
cut and the render are what make a file at all. Everything else is the creator's call, and
the answer is theirs, not yours.

**When a switch is off, say what it changes** in one line, and honour the dependencies:

| Turned off | What happens |
|---|---|
| 3 cut the silences | the original pace is kept, the video stays its full length; the clean-frame pass goes with it |
| 4 transcribe | **forces 5, 6, 7, 8, 10, 13 off** — no text means no word timings, so no tightening, no chapters, no captions and no `.srt` |
| 5 correct the transcript | Whisper's raw text is used, mistakes and all — in darija that is a lot |
| 6 finalize the script | repeats, stammers and false starts stay in, and whole sentences the speaker wanted gone stay in too — **both halves of this step drop together** |
| 7 tighten | the pauses and the "euh"s stay as recorded — the natural pace, at the natural length |
| 8 chapters | no `video-final.chapters.txt`; it is off by default anyway |
| 10 captions + animations | **two switches in one step.** "No animations" gives a captions-only reel — a valid choice, not a failure. "No captions" gives picture only. The caption language is chosen here, not in the settings |
| 11 sound effects | a silent bed, the speaker's voice untouched |
| 13 subtitle file | no `.srt`, no post caption text |

**Running the mechanical stages.** `uv run scripts/run.py <work>` runs them in order, skips
whatever is already up to date, and stops at the points that need the creator. `run.py
<work> --dry` shows the plan, `--from <stage>` resumes, `--only <stage>` runs one. The
canonical stage list is `scripts/pipeline/<world>.json`; the steps below say *how* to do
each one, and the conversation stays yours.

---

## Steps 3–13 — production

### 3) Measure the silences
```bash
uv run scripts/find_silences.py <work>
```
Records where the speaker is quiet, into `build/silences.json`. That file is a
**measurement** — nothing ever edits it — so the montage can always be rebuilt from it.
The padding (asymmetric: more air before each line than after, tunable in the `cut` config
block) is applied in step 5, when the timeline is built, and the cut-in points are nudged
onto clean frames there too.

### 4) Transcribe the speech
```bash
mkdir -p <work>/build
ffmpeg -v error -i <work>/rush/<name> -vn -ac 1 -ar 16000 -y <work>/build/transcribe-input.wav
uv run scripts/transcribe.py <work> --language <LANG>
```
- `<LANG>` = the video's language: `ar` · `fr` · `en` · or a hard dialect `ar-MA` /
  `ar-DZ` / `darija` (which turns hard-dialect mode on by itself).
- The model picks itself: `transcribe.model` in the config, else the darija fine-tune for
  a hard dialect, else `large-v3`. **Step 1's `setup.sh --install` already prepared the
  darija fine-tune** if the default language calls for it — nothing to do here. Engine:
  faster-whisper GPU ← CPU ← openai-whisper.
- **The command always prints `model: <name>`** — read it back to the user in one line
  ("transcribing with the darija fine-tune" / "transcribing with large-v3") so which one
  ran is never a guess. `build/transcript-raw.json` records it too (`"model"` field).
- CPU takes minutes — run it in the background.
- Produces `<work>/build/transcript-raw.json` (segments · words · timings).

**Confirm the language before this step** — if the transcript comes out in the wrong
language or empty, `<LANG>` is wrong. Darija is rough even with a fine-tune; that is what
step 5 is for — and it is *your* job, not the user's.

### 5) Build the timeline, then correct the transcript — Claude does it

**5a — build the timeline.**
```bash
uv run scripts/build_timeline.py <work>
uv run scripts/settle_cuts.py <work>
```
`build_timeline.py` crosses the silences with the transcript into **`<work>/timeline.json`** —
one segment per spoken sentence, read top to bottom like the script of the finished video.
**From here on, that one file is the montage**: the cuts, the captions, the scenes, the
sound cues, the chapters. Nothing else holds editing state. Then `settle_cuts.py` nudges
every cut-in onto the first sharp, still frame, so a line never starts blurred or
mid-reposition; it only ever eats into the lead-in pad, never a spoken word.

Tell them how much was removed: "Removed 52 seconds of dead air — the video is 46 now, not 98."

A segment looks like this, and everything about it is local to it:
```jsonc
{ "source": "1:52.3-1:55.82",     // what is kept, a readable range in SOURCE time
  "text": "..." }                 // edit this to reword it — nothing else to touch
```
**There are no ids.** A tool that needs to name one segment addresses it by its LINE
NUMBER — its position in the file, exactly as `cut_entries.py show` prints it (see step 6).
**Word timings are never stored.** They are computed fresh, every time, by matching `text`'s
own words against the real transcript — so a rewording can never leave a stale timing behind,
and there is nothing to re-space by hand.

**5b — correct the whole transcript.** Read the segments end to end. For
every sentence: if it is garbled, first try to recover what was actually said; if you
cannot, **reword it so it reads correctly and means what they were saying**, in the
video's own language and register — darija stays darija, same level of speech. Do **not**
switch to Modern Standard Arabic or another language unless the user explicitly asked for
the captions in that language. Edit that segment's `text` **in `timeline.json` itself** —
there is nothing else to touch, and no separate fixes file to satisfy.

- `*word*` (or `*several words*`) in `text` = held in the accent pill when spoken. Keep the
  markers when you reword a sentence that had one, unless the word itself is gone.
- **This is not a line-by-line session with the user.** Do it yourself, then show a short
  summary: "23 sentences · 6 reworded (Whisper had them garbled) · the rest as spoken".

Then mark the step done, so `run.py` knows the transcript was actually reviewed (not just
that `timeline.json` exists):
```bash
uv run scripts/mark_checkpoint.py <work> transcript-fix
```

### 6) Finalize the script — repeats gone, then your edits

**One step, you do both parts before showing anything.**

**6a — cut the repeats and false starts yourself, first.** Read the segments end to end.
The creator often restarts an idea — stops after 3 words, tries again at 5, gets it right
at 9 — no two attempts the same length. Find every one of these, and **treat the LAST
attempt as the real source** of what gets shown. There is no detection script for this: you
decide, from the text and its timing, exactly like you're doing when you read a transcript
in conversation.

Switch those segments off — set `"on": false` and a `"why"` directly in `timeline.json`, or:
```bash
uv run scripts/cut_entries.py <work> drop 7 12 --why "restarted 3x, kept the last"
```
Nothing is deleted: the segment stays in the file with its text, and `restore` puts it back.
There are no ids — `7`/`12` are LINE NUMBERS, the segment's position as `show` prints it.

**Don't show this list before cutting.** Apply it, then fold it into the recap at the end
of this step (before/after text, how much shorter). Most passages are clear-cut — decide
and move on.

**Genuinely unsure whether a passage is a repeat or real content?** That's the one time to
stop and ask — and when you do, hand over everything needed to check it in seconds: the
exact line numbers of both passages, their exact text, and why you're unsure. Never guess
on a real doubt, and never make the user go hunting for what you're asking about.

**6b — then, and only then, the creator's own edits.**
```bash
uv run scripts/cut_entries.py <work> show
```
Prints the now-clean speech, one numbered line per sentence, and writes
`build/transcript-editable.txt`. **Show them the list in the chat and say: "What do you want
me to remove?"** — this part *is* shown before cutting, because dropping a whole sentence (a
tangent, a point that didn't land) is the creator's call, not yours. `dupes` still flags any
two whole sentences that rephrase each other, in case one slipped through 6a:
```bash
uv run scripts/cut_entries.py <work> dupes
uv run scripts/cut_entries.py <work> drop 6 8     # out of the video and the audio
uv run scripts/cut_entries.py <work> keep 1 2     # keep only these (a shortened cut)
uv run scripts/cut_entries.py <work> restore 6    # put one back
```

**This can happen in any order relative to scene design.** A scene lives as long as its own
segment, so cutting a sentence elsewhere cannot move it. After any cut, re-render — that is
all: the render cuts the source itself, straight from `timeline.json`. **Cutting and
restoring never change anyone's line number** (only `on` flips); the one thing that does is
`split` (step 10) — re-run `show` before targeting a line past a split you just made.

Then, whether or not anything was cut:
```bash
uv run scripts/mark_checkpoint.py <work> cut-review
```

### 7) Tighten the pauses and the filler words
```bash
uv run scripts/tighten.py <work>              # proposes the cuts, writes nothing
```
It trims every inter-word pause over 250 ms down to 90 ms (hard jump cuts) and drops filler
words (`um`, `euh`, `يعني` …) from `scripts/fillers.json`. **Show the user the summary** —
"847 micro-cuts, 41 fillers, 3m12s removed, 18m04 → 14m52" — and the filler list in
context. If they want a specific filler kept or an extra one dropped, adjust and re-run:
```bash
uv run scripts/tighten.py <work> apply        # commits into timeline.json
```
**Safe to re-run**: it measures the current timeline, so a second `apply` finds nothing
left over the threshold and says so. Thresholds live under `tighten` in the config
(`pauseMs` 250, `keepMs` 90, `fillers` true); the defaults are good, only touch them if the
user wants a looser or tighter cut.

**On a short reel this usually finds little** — say so in one line and move on. On a long
recording it is the single biggest win of the whole edit.

```bash
uv run scripts/mark_checkpoint.py <work> tighten
```

### 8) Chapters — only worth proposing on a long recording
Read the corrected transcript and **propose 3–8 chapter breaks** — the topic shifts, keyed
to a sentence. After they confirm, give the segment where each one starts a `chapter` field:
```jsonc
{ "source": "0:00.6-0:04.1", "text": "...", "chapter": "Intro" }
```
The segment itself is the anchor — no id, no separate list — so cutting a sentence
elsewhere can never silently move a chapter or drop it. Optional, and pointless under a few
minutes: no chapters means no markers. With them,
`subtitles.py` also writes `video-final.chapters.txt` (the first is forced to `00:00`) —
the list to paste into a YouTube description.

Whether or not you proposed any:
```bash
uv run scripts/mark_checkpoint.py <work> chapters
```

### 9) Measure the framing, check it
```bash
uv run scripts/find_face.py <work>
```
Measures where the speaker's face is across the whole recording (a face detector, sampled
twice a second, smoothed) into `build/framing.json` — a measurement, like the silences and
the transcript: nothing ever edits it. At render time, each layout aims for its own face
target (how big, how centred) and the render derives the zoom/anchor that gets the MEASURED
face there — there is nothing to configure. **The output keeps the source's orientation and
size** — nothing is cropped to a different aspect; the zoom crops *inside* the frame.

A segment's own hand-set `zoom`/`anchor` ([x, y] fraction of the source frame) overrides the
measurement outright — reach for it only when a shot needs something the automatic framing
gets wrong (two people in frame, a deliberate off-centre composition). Preview a few frames
before continuing, as one sheet:
```bash
bash scripts/remotion/remotion.sh <work> still 4.6 20.1
bash scripts/contact_sheet.sh <work> <work>/build/contact-sheet.jpg 4.6 20.1
```
If a shot is framed wrong and it is not a detection fluke (check the sheet, and
`build/framing.json`'s numbers around that timestamp), set that segment's `zoom`/`anchor` by
hand and look again.

### 10) Design the scenes and the on-screen captions ← the most important step
Scenes are data, authored directly on the segment in `timeline.json` — there is no scene code
to write or file to open. A segment can carry a layout, a filter, a transition into it and a
scene:

```jsonc
{ "source": "...", "text": "...",
  "layout": "SPLIT", "transition": "WIPE", "filter": "BLACK_AND_WHITE",
  "scene": { "type": "STAMP", "params": { "text": "3 etapes" } } }
```
**The layout alone decides where the face, the caption and the scene sit** — not something to
reason about by hand. `SPLIT`/`LOWER` move the caption onto the seam between the graphic and
the face instead of leaving it at the bottom, and aim the crop at a smaller, lower face so it
never lands under the graphic; `FULL` keeps the face large and the caption at the bottom. Read
the layout's own file for the picture it aims for — never author an x/y yourself.

**A scene lives as long as its own segment** — there is no `at`/`dur` to place it inside the
sentence any more. To put a scene (or a layout, or a filter) on only PART of a sentence,
split the sentence there first, so each half is its own segment with its own look:
```bash
uv run scripts/cut_entries.py <work> split 4 "word"   # line 4 splits just before "word"
```
It prints the two new lines and their text; nothing else carries over to either half — author
the layout/scene/filter/sfx/overlay/chapter fresh on whichever half needs them. Every line
after the one you split shifted by one: re-run `show` before targeting them.

Each of `layout`/`transition`/`scene.type`/`filter` takes an UPPERCASE keyword, written bare
(every default) or as `{ "type": KEYWORD, ...parameters }`.

**Never write a keyword or a parameter from memory, and never from this file.** What each key
accepts is defined in code, one folder per key. Every option is a file named after its keyword;
the file says what it does, when to choose it and which parameters it takes, with their defaults
and ranges. List the folder, read the files that fit what is being said, then choose:

| You are writing | The valid values are the files in |
|---|---|
| `layout` | `scripts/remotion/template/src/layouts/` |
| `transition` — the change INTO this segment — and its `easing` | `scripts/remotion/template/src/transitions/` |
| `scene.type` and `scene.params` | `scripts/remotion/template/src/scenes/` |
| `filter` | `scripts/remotion/template/src/filters/` |
| `sfx[]` (step 11) | `scripts/sounds/` |

A keyword or a parameter that does not exist, or a value out of range, stops `remotion.sh` as
soon as it has built the render data, saying where (a line number) and which choices are
accepted. Read the message and correct the timeline — do not guess again.

For a logo/badge riding the video itself rather than a graphic above it, give the segment an
`overlay` instead (drawn by `VideoOverlays.tsx`, clipped to the video's own rect so it
follows the layout automatically, for as long as the segment lasts):

```jsonc
{ "overlay": [{ "src": "logo-brand.png", "pos": [0.85, 0.12], "scale": 0.14 }] }
```
`src` is a filename resolved the same way an `IMAGE_CARD`'s `params.src` is (further down in
this step) — a file you place in `<work>/config/images/`. `pos` is a fraction of the video
card's own box (`[0,0]` top-left, `[1,1]` bottom-right), `scale` a fraction of its width.

Type-check before rendering: `remotion/remotion.sh <work> check`.

**The structure is ready, don't touch it:** the layouts and the transitions between them, the
account badge, the caption cards with the spoken word highlighted (shown a page — at most 2
lines — at a time, never the whole sentence), the end card, and deriving the colors from the
theme. There is no progress bar.

**What you invent:** the scenes. The idea must be a **visual metaphor for what is being said**,
not decoration. Each scene's file says what it is for: read them, pick per sentence, and don't
paste the same scene onto every video. A scene that fits nothing being said is worse than none —
**the panel comes for the idea, not to fill.** Each layout's file also says how often and how long
it may be used: respect it.

**`IMAGE_CARD` is on you to fill, not the user.** When a sentence names something that has
a real visual (a product, a brand, a website, a public figure), go get the real thing the
same way you'd invent any other scene — don't ask the user for a file and don't wait for one:
search the web for it (`WebSearch`/`WebFetch`, or the `media-use` skill, which already
resolves logos/icons/screenshots to a frozen local file), download it into
`<work>/config/images/<file>.png`, then reference it as that segment's
`scene.params.src: "<file>.png"`. If nothing suitable turns up, fall back to a different
scene idea instead of leaving a broken reference.

**No account badge over the video** (`theme.badgeUntil: 0` — the default): the name is on
the platform itself and on the end card, and the top of the screen is space for the
graphics. If someone asks for it, set `theme.badgeUntil: 3` in that project's
`config/project.config.json` — it puts the badge in the first 3 seconds only. A rare,
per-project exception, not something to ask about (see step 2).

**Safe zone — Instagram covers the screen edges with its buttons:**

| Zone | Don't put text there |
|---|---|
| top | first 150 px |
| bottom | last 300 px (and a caution belt from 1500) |
| right | 180 px wide, y from 1100 to 1750 (like · comment · share) |

The reference file is already set correctly: the badge at 190, and the caption card's
bottom edge at 1560 — inside the caution belt, 60px clear of the hard bottom zone.
**And the first caption must appear in the first half second** — a late hook loses half
the viewers before the speech even starts.

Preview before rendering everything:
```bash
bash scripts/remotion/remotion.sh <work> still 4.6 12.3 27.6 31.0 48.4
bash scripts/contact_sheet.sh <work> <work>/build/contact-sheet.jpg 4.6 12.3 27.6 31.0 48.4
```

**Asked to edit it themselves?** Open the live timeline — it reads the same `timeline.json`,
compiled into what Remotion actually renders on the way in, so there is no separate step:
```bash
bash scripts/remotion/remotion.sh <work> studio           # a live timeline in the browser
```
**Read `build/contact-sheet.jpg` as one image — don't read the frames one by one.** One
sheet = one read instead of five. **Don't render the whole video before previewing at
least 6 shots**, and show the sheet to the user.

Once the scenes are designed — even if that means deliberately none:
```bash
uv run scripts/mark_checkpoint.py <work> scenes
```

### 11) Sound effects
Give the segments that want one an `sfx` list, in `timeline.json` — always plays at that
segment's own start:
```jsonc
{ "source": "...", "text": "...", "sfx": ["WHOOSH_UP"] }
```
A cue is an UPPERCASE keyword and, like every choice in step 10, is never written from memory:
the cues are the files in `scripts/sounds/`, each saying what it is for. `sound_fx.py` stops on
one that does not exist and lists the accepted ones. The end card's length is `outro.seconds`
at the top level. Because a cue belongs to its sentence, it stays glued to it whatever gets cut
elsewhere — a cue mid-sentence means splitting the sentence there first (step 10), not an
offset inside this list.
```bash
uv run scripts/sound_fx.py <work>
```
Keep it under ~15 events per minute — past that it stops reading as punctuation and starts
reading as noise (`sound_fx.py` warns).
```bash
uv run scripts/mark_checkpoint.py <work> sound-cues
```

### 12) Final render, assembly and audio mastering

```bash
bash scripts/remotion/remotion.sh <work> check    # type-check first — catches a broken scene in seconds, not after a long render
bash scripts/remotion/remotion.sh <work> render <work>/build/video-raw.mp4
```
`check` is worth the few seconds every time: an undefined helper or a bad prop in a scene
fails the type-check instantly, where a render would have burned minutes before dying.
The first `render` on a project downloads the toolchain (~500 MB) by itself — there is no
setup step to run first, and nothing to announce.

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
8. **Call it a "background audio file"** — not "music". The user decides its content (a
   human voice, ambience, or anything), and you name it by its neutral form and put it in
   `rush/bg-audio.mp3`.
9. **Choose scenes afresh every time.** The scenes in `scenes/` are a palette, not a template
   to copy verbatim onto every video.

---

## Verification before delivery (mandatory)

0. **Safe zone and hook** — read them off the two things you already have:
   - **Safe zone:** set `"guides": true` in `<work>/config/project.config.json` and open
     `remotion/remotion.sh <work> studio` — the platform's button zones are drawn in red
     over the live video, so a caption or a graphic straying into them is visible at a
     glance. **Turn it back off before rendering** (the render warns you if you forget —
     the guides would be burned into the file).
   - **Hook:** the first sentence must start before **0.5 s**. That is one number to read
     (`uv run scripts/lib/timeline.py <work>` prints the montage's shape), not a check to run.

1. **Sync** — transcribe the output audio again and compare sentence starts to the
   timeline's own; the difference should be under 0.1 seconds:
```bash
ffmpeg -v error -i <work>/video-final.mp4 -vn -ac 1 -ar 16000 -y <work>/build/fa.wav
uv run scripts/transcribe.py <work> --language <LANG> --model medium --wav <work>/build/fa.wav --out <work>/build/fa.json
```
Compare the sentence starts of `build/fa.json` to the segment starts in `timeline.json`
(`video-final.srt`, written by `subtitles.py` from the same segments, is the easiest side to
read).
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
4. **Numbers before pixels:** a timing question is answered by reading `timeline.json`, not
   by taking a screenshot.
5. **ffmpeg output** is always trimmed: `2>&1 | tail -2`.
6. **Don't read a scene file whole** — `grep -n` for the component you need.

**Don't show an image except for a visual question that nothing else answers.**

## Token economy (general)

The expensive thing isn't the rendering, it's **the number of turns** — every turn resends
the whole conversation.

1. **A clean session per video.**
2. **A contact sheet instead of separate images.**
3. **Batch independent commands into one turn.**
4. **Run the long thing in the background** and wait for the completion notification once.
5. **Don't change the architecture in prose** — build on the reference file.
6. **Keep `timeline.json`** — it is the whole edit. With it and the two measurements beside
   it (`build/silences.json`, `build/transcript-raw.json`), any later change re-renders
   without re-transcribing anything.

## Delivery

Present the file with: the duration, how much dead air was removed, the number of scenes,
and the final loudness. Deliver alongside it the `.srt` and the `.txt` (their speech text
for the post caption). And mention that you didn't publish anything.

---

## Script map

| | Does what | Engine |
|---|---|---|
| `setup.sh` | installs ffmpeg/Node/uv (system), then `uv sync` + `npm ci` (isolated) | shared |
| `lib/platform.sh` · `lib/platform.py` | cross-platform helpers (paths · `VEVO_PY` · ffmpeg · OS) | shared |
| `lib/config.py` | reads/merges `project.config.json` | shared |
| `preflight.py` | **step 1** — inventory the input, check the tools, build `work/{rush,config,build}` | shared |
| `lib/rush.py` | finds the input file(s) in `rush/` without assuming a fixed name | shared |
| `lib/timeline.py` | **`timeline.json` itself** — the schema, the projection from source time onto output time, and `words()` (per-word timings, computed fresh from `text`, never stored) | shared |
| `run.py` | the config-driven conductor — runs the stages, stops at the decisions | shared |
| `mark_checkpoint.py` | marks a human/agent decision step addressed, so `run.py` genuinely blocks until it is | shared |
| `transcribe.py` | transcription → `build/transcript-raw.json` (faster-whisper GPU/CPU ← whisper) | shared |
| `find_silences.py` | measures where the speaker is quiet → `build/silences.json` | shared |
| `build_timeline.py` | crosses the two measurements into `timeline.json` — one segment per sentence, split at punctuation then at silences past `cut.maxSegment` | shared |
| `settle_cuts.py` | nudges each segment's cut-in onto a sharp, settled frame | talking video |
| `cut_entries.py` | switch a sentence off (`on: false`) or back on, split one in two — repeats, tangents, whole drops, mid-sentence scenes — all by LINE NUMBER, there are no ids | shared |
| `tighten.py` | jump-cut + filler pass (word-level cuts) | talking video |
| `prepare_source.py` | joins the `rush/` recording take(s) and tags them bt709, stream copy → `build/source-joined.mp4` | talking video |
| `render_data.py` | compiles `timeline.json` into `<remotion-dir>/src/plan.json`, the single file Remotion renders from — including the pieces of source to play, with their zoom, and every word timing resolved | shared |
| `find_face.py` | measures where the speaker's face is, sampled twice a second → `build/framing.json` — `render_data.py` turns it into each piece's zoom/anchor, aimed at the active layout's own face target | talking video |
| `remotion/remotion.sh` | the renderer — `sync` · `studio` · `render` · `still` · `check` | shared |
| `remotion/template/src/{layouts,transitions,scenes,filters}/` | the options a segment can choose — one file per option, named after its keyword, holding everything about it; `options/check.ts` audits the plan against them | shared |
| `sound_fx.py` · `sounds/` | the sound bed, from each segment's `sfx` cues — one file per cue in `sounds/` | shared |
| `master_audio.sh` | −14 LUFS + ducked background audio | shared |
| `contact_sheet.sh` | one contact sheet (token economy) | shared |
| `subtitles.py` | subtitle file + caption text (+ `video-final.chapters.txt` from every segment's own `chapter`) | shared |

**This file is the source of truth for the pipeline.** Beyond it: each script's own
docstring, and the stage lists in `scripts/pipeline/<world>.json`. Nothing else.
