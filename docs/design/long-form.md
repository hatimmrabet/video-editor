# `long-form` — the YouTube world

Status: **design (issue #23)** — nothing built. This page is the spec + the implementation
plan for roadmap Pass 6. It builds on [worlds.md](worlds.md#long-form--new-youtube) and
resolves that section's three open questions.

## Problem

`reel-speech` makes a 9:16 ad: silences out, one talking take, word-synced caption cards,
code-drawn motif scenes, an end card. A long-form YouTube edit is a different shape:

- a **16:9** recording (often several takes stitched), 5–40 minutes
- the cut is **much tighter** — every dead beat between phrases goes, not just the long
  silences, plus filler words (*euh*, *يعني*, *like*)
- **no motion-graphics scenes** — the reel's motif system doesn't apply
- **chapters** — the YouTube description's `00:00 Intro` list, and chapter markers
- captions are **optional** and, when shown, a lower-third — not a centred card
- **B-roll cutaways** over the speaker at marked moments, picked by the montage scorer

It reuses the primitives (`transcribe.py`, the silence-detection idea, the montage shot
scorer, `master_audio.sh`, `subtitles.py`, the transitions vocabulary) but it is its own
stage list and its own (much smaller) render path.

## Is it one world or two?

**One.** A "podcast-style" static long-form is just `long-form` with no B-roll and no
reframe — a subset, not a second world. No split. (Minimalism — same call as not splitting
`reel-speech` by whether it has scenes.)

## Selecting the world

`long-form` **cannot** be inferred from `rush/` — a folder of takes looks like
`broll-montage`, a single take looks like `reel-speech`. So it is the one case that reads
`project.config.json`: **`format: "long"` → `long-form`**, checked before the
`rush/`-count inference. `format` is already the reserved field for exactly this
([worlds.md](worlds.md#the-abstraction-boundary), [project-config.md](project-config.md)).
`run.py` gains: `world = "long-form" if cfg.get("format") == "long" else infer_world(work)`.

## The stage list

`scripts/pipeline/long-form.json`, same grammar as the other two manifests
([orchestrator.md](orchestrator.md#the-stage-manifest)):

```
join → audio → transcribe → ⟨transcript-fix⟩ → captions → ⟨tighten⟩ → ⟨chapters⟩
     → reframe → ⟨broll⟩ → assemble → master → subs
```

| id | run | notes |
|---|---|---|
| `join` | `ffmpeg` concat (only if `rush/` has >1 take) → `build/source-joined.mp4` | skipped for a single take; `{source}` resolves to the join output or the lone file |
| `audio` | `ffmpeg -vn -ar 16000` | same as reel |
| `transcribe` | `transcribe.py --language {language}` | same |
| `transcript-fix` | **checkpoint, block** — `build/transcript-fixes.json` | rule #5, same as reel |
| `captions` | `captions.py` | per-word timing on the joined timeline |
| `tighten` | **checkpoint, block** — `tighten.py` proposes, agent + user confirm, `tighten.py apply` → `build/tighten-plan.json` + mutates `cut-plan.json`/`captions.json` | the jump-cut + filler pass, below |
| `chapters` | **checkpoint, advisory** — author `config/chapters.json` | optional; no file → one continuous video, no markers |
| `reframe` | `reframe.py` — `format:"long"` branch keeps 16:9 (crop/letterbox a vertical source, pass a 16:9 through) + bt709 | opposite of the reel's "landscape → 9:16" |
| `broll` | **checkpoint, advisory** — mark cutaway ranges in `config/broll.json`, scored from `rush/broll/` by the montage scorer | optional |
| `assemble` | `assemble_longform.py` — apply the cut list to the reframed video, overlay each B-roll range, → `build/video-raw.mp4` | no frame-by-frame render; ffmpeg filter graph |
| `master` | `master_audio.sh` | −14 LUFS, same |
| `subs` | `subtitles.py` — `.srt` **and**, from `config/chapters.json`, `video-final.chapters.txt` (`00:00 Title` lines for the description) | one new output |

No `render`/`encode`/`safe`/`sound`/`scenes` stages — long-form has no motif layer, no
sound-cue layer, and the Instagram safe zone is a short-form concept.

## The tighten pass (`tighten.py`) — the heart of it

Two kinds of word-level cut, both driven by `build/captions.json`'s per-word timings:

1. **Inter-phrase gaps.** Any gap between consecutive words longer than
   `longform.pauseMs` (config, default **250 ms**) is trimmed to a fixed
   `longform.keepMs` (default **90 ms**) — a hard jump cut. This is the "tighten every
   pause" behaviour; `plan_cuts.py`'s silence threshold is too coarse for it.
2. **Filler words.** Words (or short runs) matching `scripts/fillers.json` for the
   project language are dropped, gap closed.

`scripts/fillers.json` (static skill file, versioned):

```jsonc
{
  "ar": ["يعني", "اه", "ايه", "زي ما قلت"],
  "fr": ["euh", "bah", "en fait", "du coup", "voilà"],
  "en": ["um", "uh", "like", "you know", "i mean"]
}
```

A curated list, **not** model-chosen per run — reproducible, inspectable, editable. The
agent can still hand-drop a specific instance the list misses (same review step), but the
automated pass only touches the list.

`tighten.py` (no apply) prints the proposed cuts — count, seconds saved, and every filler
in context — and writes `build/tighten-plan.json`. The agent shows the user the summary
("847 micro-cuts, 41 fillers, 3m12s removed — 18m04 → 14m52"), the user says
drop-all / keep-these, `tighten.py apply` commits it: it folds the word drops into
`build/cut-plan.json` (as extra non-keep ranges) and rewrites `build/captions.json` on the
new timeline, exactly like `edit_script.py apply` does for whole sentences.

**Ordering:** `tighten` runs *after* `captions` and *before* `reframe` — same rule as
`edit_script.py` for the reel (it shifts every downstream timestamp).

## Chapters

`config/chapters.json`, hand-authored, optional — same family as `config/scenes.json` /
`config/outro.json`:

```jsonc
[
  { "ref": { "sentence": 0 },  "title": "Intro" },
  { "ref": { "sentence": 34 }, "title": "The three mistakes" },
  { "ref": { "sentence": 88 }, "title": "How to fix it" }
]
```

`ref` binds to a caption sentence (survives `tighten`), resolved by `lib/scenes.py`'s
existing `_resolve_ref`. **No topic-shift heuristic in code** — chapter breaks are the
agent's judgment call, made in the conversation from the transcript (like scene design),
then confirmed by the user and written to the file. `subtitles.py` reads it and emits
`video-final.chapters.txt` (`MM:SS Title`, first entry forced to `00:00` — YouTube's rule).

## B-roll cutaways

`config/broll.json`, optional:

```jsonc
[
  { "ref": { "range": [72.0, 78.5] }, "clip": "screen-recording.mp4", "crop": "cover" }
]
```

Clips live in `rush/broll/` ([file-layout.md](file-layout.md)). `montage_mode.py`'s
scorer picks the best moment of each clip; `assemble_longform.py` overlays it full-frame
for the range (audio stays the speaker's). Reuses `montage_mode.py`'s scan + the
transitions vocabulary for the in/out (default `dissolve` 0.25).

## `project.config.json` additions

```jsonc
{
  "format": "long",              // the world switch — already reserved
  "longform": {                  // all optional; defaults in defaults.config.json
    "pauseMs":  250,             // gap over this is jump-cut
    "keepMs":   90,              // …down to this
    "fillers":  true,            // run the filler pass
    "captions": "soft"           // "soft" = .srt only (default) · "burned" = lower-third (later)
  }
}
```

Burned lower-third captions are **out of scope for Pass 6** — `captions: "burned"` is
reserved. Soft `.srt` is what YouTube wants anyway; burning is a stripped `compose.html`
mode we can add once the world exists.

## Data contracts (new)

| File | W / R | Shape |
|---|---|---|
| `scripts/fillers.json` | hand-edited, versioned · `tighten.py` | `{ lang: [word\|phrase, …] }` |
| `scripts/pipeline/long-form.json` | versioned · `run.py` | the stage manifest |
| `build/tighten-plan.json` | `tighten.py` · `tighten.py apply` | `{ cuts: [[t0,t1], …], fillers: [{word,at}], saved: <s> }` |
| `config/chapters.json` | hand-authored, optional · `subtitles.py` | `[{ ref, title }]` |
| `config/broll.json` | hand-authored, optional · `assemble_longform.py` | `[{ ref, clip, crop }]` |
| `video-final.chapters.txt` | `subtitles.py` | `MM:SS Title` per line |

## What's reused vs new

**Reused unchanged:** `transcribe.py`, `captions.py`, `master_audio.sh`, `edit_script.py`
(whole-sentence drops still apply), `montage_mode.py` scorer, `lib/config`, `lib/rush`,
`lib/scenes._resolve_ref`, `run.py` + the manifest grammar, the transitions vocabulary.

**New:** `tighten.py`, `assemble_longform.py`, `scripts/fillers.json`,
`scripts/pipeline/long-form.json`, a `format:"long"` branch in `reframe.py` and `run.py`,
a chapters branch in `subtitles.py`.

**Not touched:** the whole motif / scene system, both render engines, `safe_check.js`,
`sound_fx.py`, `compose.html`.

## Implementation tickets (Pass 6 milestone)

1. **`format:"long"` world switch** — `run.py` checks `config.format`;
   `scripts/pipeline/long-form.json` with the stage list above; `defaults.config.json`
   gains the `longform` block. *(area:orchestrator)*
2. **`tighten.py`** — the jump-cut + filler pass + `scripts/fillers.json` + `apply` that
   folds into `cut-plan.json` / `captions.json`. Doc page. *(area:pipeline)*
3. **`reframe.py` 16:9 branch** — `format:"long"` keeps/produces 16:9 instead of 9:16.
   *(area:pipeline)*
4. **`assemble_longform.py`** — cut list → video, `config/broll.json` overlays. Doc page.
   *(area:pipeline)*
5. **Chapters** — `config/chapters.json` contract + `subtitles.py` emits
   `video-final.chapters.txt`. *(area:pipeline area:docs)*
6. **`SKILL.md` — the `long-form` flow** — a new top-level section (like "Montage mode"),
   the checkpoints, the "propose chapters / propose B-roll" conversation. *(area:docs)*

Ship 1–5 as code with a real ≥ 5-minute recording run end-to-end; 6 lands with them.
