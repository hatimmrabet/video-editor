# Data contracts

Every JSON file that flows between pipeline stages, with field-by-field schemas and the
scripts that read/write each. All files live in the work directory `<work>/`.

Legend: **W** = written by, **R** = read by, **M** = mutated in place by.

---

## `theme.json` — visual identity (hand-authored)

**W** hand-authored (SKILL.md step 1) · **R** `reframe.py`, `render_frames.js`,
`safe_check.js`, `compose.html`, `remotion.sh`

```jsonc
{
  "bg":    "#101828",   // background hex — every card/panel/shadow color derives from this. Dark or light both work.
  "ink":   "#F5F7FA",   // primary text / strokes / shadows
  "acc":   "#F2B33D",   // accent — highlight pills, active words, CTAs
  "clay":  "#C98B18",   // secondary accent (defaults to acc if absent)
  "mut":   "#98A2B3",   // muted / secondary text
  "font":  "Tajawal",   // Google Fonts family; non-Cairo is injected at runtime (weights 400/600/700/800/900)
  "handle":"@his_handle",// account handle (drawn LTR)
  "logo":  "logo.png",  // logo filename inside <work>

  "grade":      false,  // reframe.py: apply eq/colorbalance grade to the video. OFF by default — invariant #4
  "faceAnchor": 0.30,   // compose.html: vertical face position inside the video card (0 top .. 1 bottom)
  "xAnchor":    0.5,    // reframe.py: horizontal crop anchor for a landscape source (0 left .. 1 right)
  "yAnchor":    0.30,   // reframe.py: vertical crop anchor for a landscape source
  "grid":       true,   // compose.html: faint 60px background grid (false disables)
  "badgeUntil": 0,      // seconds the account badge stays on screen. 0 = never, -1 = whole video
  "badge":      false   // legacy boolean — true→badgeUntil 3, false→0 (kept for back-compat)
}
```

Only `bg / ink / acc / clay / mut / font / handle` (and `badgeUntil`, via `theme.ts`)
reach the Remotion engine. `grade / xAnchor / yAnchor` are read by `reframe.py` only.
`faceAnchor / grid` are read by `compose.html` only.

Consumers use hardcoded **fallbacks** if the file or a key is missing — `compose.html`:
cream/clay Claude theme; `theme.ts`: `#101828 / #F5F7FA / #F2B33D / #C98B18 / #98A2B3 / Cairo`.

---

## `cut.json` — silence-cut plan

**W** `plan_cuts.py` · **M** `edit_script.py` · **R** `captions.py`, `reframe.py`

```jsonc
{
  "keep":    [[0.42, 3.55], [4.10, 9.87], ...],  // [start, end] pairs on the ORIGINAL source timeline, seconds
  "total":   46.078,                              // sum of kept durations
  "src_dur": 98.4                                 // original source duration
}
```

Segments are padded by `PAD=0.13 s`, gaps `< MERGE=0.20 s` merged, fragments `< 0.30 s` dropped.

---

## `a.json` — transcript (openai-whisper shape)

**W** `transcribe.py` · **R** `captions.py`

```jsonc
{
  "text": "full transcript as one string",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.2,
      "text": " sentence text ",
      "words": [ { "word": "الكلمة", "start": 0.0, "end": 0.42 }, ... ]
    }
  ],
  "language": "ar"
}
```

`transcribe.py` also emits this shape to `fa.json` in the pre-delivery sync check
(`--wav fa.wav --out fa.json`).

---

## `fixes.json` — corrected transcript + hot words (hand-authored)

**W** hand-authored (SKILL.md step 5) · **R** `captions.py`

```jsonc
{
  "fix": [
    ["كل", "شي", "تشوفه"],   // corrected words for Whisper segment 0
    ["الكابشن", "الزوم"]      // ... segment 1
  ],
  "hot": ["تشوفه", "الزوم"]   // words that get the animated accent pill when spoken
}
```

**Hard constraint:** `len(fix[i])` must equal the number of Whisper words in segment `i`,
or `captions.py` aborts — the per-word timings come from Whisper positionally.

---

## `caps.json` — caption card timings (the central contract)

**W** `captions.py` · **M** `edit_script.py` · **R** `sound_fx.py`, `render_frames.js`,
`safe_check.js`, `subtitles.py`, `fx/behind_text.js`, `remotion.sh` (copied verbatim into
`remotion/src/caps.json`)

```jsonc
{
  "total": 46.078,   // end of speech on the NEW (compressed) timeline, seconds
  "cards": [
    {
      "s": 0.12,     // card show time
      "e": 3.40,     // card hide time (clamped so cards never overlap)
      "w": [
        { "t": "الكلمة", "s": 0.12, "e": 0.55, "hot": false }
      ]
    }
  ]
}
```

Card start = `first word − 0.10 s` (clamped to segment start); card end =
`max word end + 0.28 s` (clamped to segment end). Word `e` is bumped to `s + 0.12` if
Whisper gave a zero-length word.

---

## `sfx.json` — sound-effect cues (hand-authored)

**W** hand-authored (SKILL.md step 8) · **M** `edit_script.py` · **R** `sound_fx.py`,
`render_frames.js`, `encode.sh`, `safe_check.js`

```jsonc
{
  "outro":       5.2,             // end-card duration (seconds) added after caps.total. REQUIRED — several scripts read it
  "whoosh_up":   [3.1, 11.25],    // timestamps on the new timeline
  "whoosh_down": [7.85],
  "thud":        [27.27, 29.47],
  "tap":         [23.08, 24.06]
}
```

`render_frames.js`, `encode.sh` and `safe_check.js` only use `.outro` (to compute total
frame count / duration). Only `sound_fx.py` uses the cue arrays. `edit_script.py` shifts
every timestamp in every list-valued key and drops cues that fall inside a deleted range.

---

## `sfx.wav` — rendered sound bed

**W** `sound_fx.py` · **R** `encode.sh` (mixed with `cutz.mp4` audio)

48 kHz, 16-bit, stereo. Length = `caps.total + outro + 1 s`. Peak clipped to ±0.95.

---

## `behind.json` — person-cutout data (macOS effect)

**W** `fx/behind_text.js` · **R** `render_frames.js`

```jsonc
{
  "lines": [
    { "card": 7, "s": 23.6, "e": 26.8,
      "words": [ { "t": "كلمة", "s": 23.7, "e": 24.1 } ] }
  ],
  "ranges": [ [708, 792], ... ],           // inclusive vfr frame-number ranges the cutout covers
  "faces":  { "708": { "x": 402, "y": 210, "w": 300, "h": 360 } },  // per-frame face box in pixels
  "cutouts":  [ [23.8, 26.6] ],             // added by the `cutout` subcommand
  "headouts": [ [23.8, 26.6] ]              // added by the `headout` subcommand
}
```

`build` writes `lines` + `ranges` + `faces`. `cutout` / `headout` **append** to an
existing `behind.json` (adding `cutouts` / `headouts` and more `ranges`/`faces`).

`bt/mask/meta.json` (written by `personmask.swift`, consumed by `behind_text.js`):
`[ { "f": "00708.jpg", "face": { "x", "y", "w", "h" } }, ... ]` — face box in top-left
pixel coords.

---

## `safe.json` — safe-zone overrides (optional, hand-authored)

**W** hand-authored (optional) · **R** `safe_check.js`; `.guides` also read by `remotion.sh`

```jsonc
{
  "zones": [
    { "k": "label", "x": 0, "y": 0, "w": 1080, "h": 150, "hard": true, "max": 0.004 }
  ],
  "hook_max": 0.5,   // first caption must start before this (seconds)
  "guides":   false  // true → red Instagram-zone overlays render live in Remotion studio
}
```

Merged shallowly over the built-in `DEF` in `safe_check.js`. Defaults:

| Zone | x, y, w, h | hard | max ink |
|---|---|---|---|
| top (name + follow button) | 0, 0, 1080, 150 | yes | 0.4 % |
| bottom (IG caption + audio) | 0, 1620, 1080, 300 | yes | 0.2 % |
| bottom caution belt | 0, 1500, 1080, 120 | no | 1.0 % |
| right (like · comment · share) | 950, 1100, 130, 650 | yes | 1.0 % |

---

## `stage.json` — video-rectangle schedule (Remotion only, optional)

**W** hand-authored (optional) · **R** `remotion.sh` → `project.json`. Default
`[{"s":0,"e":9999,"m":"FULL"}]`.

```jsonc
[
  { "s": 0.0, "e": 9.0,  "m": "FULL" },
  { "s": 9.0, "e": 14.0, "m": "DOWN" }
]
```

`m` ∈ `"FULL" | "DOWN" | "LOWER" | "STAGE" | "SIDE"` (STAGE/SIDE are legacy).
**The light engine ignores `stage.json`** — its equivalent `SCENES` array is inline in
`compose.html`. See [engines.md](engines.md#drift).

---

## `outro.json` — end-card copy (Remotion only, optional)

**W** hand-authored (optional) · **R** `remotion.sh` → `project.json.outro_copy`.

```jsonc
{
  "line":     "",              // sub-headline under the logo
  "recap":    [],              // 2-column recap chips, e.g. ["remove silences", "live captions"]
  "cta_top":  "علّق بكلمة",     // call-to-action headline
  "cta_word": "فيديو",          // the word in the accent chip
  "tail":     ""               // closing line
}
```

**The light engine ignores `outro.json`** — its `RECAP` array and outro copy are inline
in `compose.html`.

---

## `project.json` — generated Remotion config

**W** `remotion.sh sync_all` (inline Python), into `<work>/remotion/src/` · **R** Remotion
`theme.ts` (which re-exports typed values to every component)

```jsonc
{
  "theme": { "bg": "...", "ink": "...", "acc": "...", "clay": "...", "mut": "...",
             "font": "...", "handle": "..." },   // only the truthy keys from theme.json
  "total": 46.078,                                // round(caps.total, 3)
  "outro": 5.2,                                   // float(sfx.outro), default 5.0
  "sfx":   true,                                  // does <work>/sfx.wav exist
  "stage": [ { "s": 0, "e": 9999, "m": "FULL" } ],// from stage.json
  "outro_copy": { "line": "", "recap": [], "cta_top": "", "cta_word": "", "tail": "" },
  "guides": false                                 // from safe.json.guides
}
```

Sample committed at `scripts/remotion/template/src/project.sample.json`. Note the sample
uses `outro_copy` while the generator also emits `outro_copy` — the key name matches; the
`theme.ts` reader looks for `P.outro_copy`.

---

## `montage.json` — montage-mode state

**W** / **M** `montage_mode.py` (`.bak` kept before `drop`/`keep`)

```jsonc
{
  "src":  "/path/to/clipdir",
  "shot": 1.5,                        // base shot length (seconds)
  "clips": [
    {
      "i": 1, "file": "/abs/clip1.mov", "name": "clip1.mov",
      "dur": 10.2, "w": 3840, "h": 2160, "fps": 30, "audio": true,
      "skip": false,
      "win": [ { "a": 0.30, "b": 1.80, "score": 0.73, "mot": 6.1 } ],  // candidate windows
      "pick": [0.90, 2.40],           // best window [a, b]
      "score": 0.73, "mot": 6.1, "lum": 128.4, "blur": 7.2            // metrics of the pick
    }
  ],
  "plan": [                           // added by `plan`
    { "i": 1, "file": "...", "name": "...", "in": 2.10, "dur": 1.50,
      "audio": true, "w": 3840, "h": 2160 }
  ]
}
```

Scoring: sharpness (relative — percentile vs the batch), motion (absolute), exposure
(absolute), color (relative). Sharpness × exposure × a frozen-clip penalty are
**multiplied**, not added — see [invariants.md](invariants.md).
