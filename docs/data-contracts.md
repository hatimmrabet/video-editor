# Data contracts

Every JSON file that flows between pipeline stages, with field-by-field schemas and the
scripts that read/write each. Paths are relative to the work directory `<work>/`, split
across `rush/` (raw input), `config/` (hand-authored), `build/` (generated) and the root
(the deliverable) — see [design/file-layout.md](design/file-layout.md) for the full layout
(implemented 2026-09-05, issue #59).

Legend: **W** = written by, **R** = read by, **M** = mutated in place by.

---

## `config/project.config.json` — the per-project config

**W** hand-authored, via the mandatory config-confirmation phase (see
[orchestrator.md](design/orchestrator.md)) · **R**/**W** `lib/config.py` /
`lib/config.js`'s `load()` — see [lib-config.md](scripts/lib-config.md)

```jsonc
{
  "format": "short",          // short | long
  "engine": "light",          // light | remotion — literal, never "auto"
  "language": "ar",           // absent for broll-montage (no speech)
  "grade": false,
  "crop": { "xAnchor": 0.5, "yAnchor": 0.30, "faceAnchor": 0.30 },
  "theme": { "bg": "#101828", "ink": "#F5F7FA", "acc": "#F2B33D", "clay": "#C98B18",
             "mut": "#98A2B3", "font": "Tajawal", "logo": "config/logo.png", "handle": "@his_handle",
             "grid": true }
}
```

Full rationale (why it's this lean, what deliberately isn't in it) in
[design/project-config.md](design/project-config.md). **Fully wired in as of 2026-09-05**
— `SKILL.md` step 1 writes it (issue #10); `reframe.py` (#8), `render_frames.js` (#55),
`safe_check.js` (#56), and the Remotion generator (#9) all read it via `config.load()`.
`theme.json` is retired (see below). **No back-compat bridge exists or was built** — one
user, no installed base to protect; each script migrated to `config.load()` directly,
dropping its old file-reading code in the same change (see
[project-config.md](design/project-config.md#migration--direct-no-bridge)).

`logo` is a path relative to the work-dir root (where `compose.html` resolves it from) —
`"config/logo.png"` since issue #59, now that `config/` physically holds it.

---

## `scripts/transitions.json` — transition + easing vocabulary (static skill file)

**W** hand-edited, versioned with the skill (not per work-dir) · **R** both engines and
`montage_mode.py` via `lib/transitions` (added with issue #12). See
[design/transitions.md](design/transitions.md) for the full explanation.

```jsonc
{
  "easings": {                         // name -> cubic-bezier (or {overshoot} for back)
    "linear": { "bezier": [0,0,1,1] }, "ease": { "bezier": [0.215,0.61,0.355,1] },
    "eio":    { "bezier": [0.645,0.045,0.355,1] }, "back": { "overshoot": 1.9 }
  },
  "types": {                           // the 8-name curated vocabulary
    "cut": { "reel": "instant", "xfade": null, "params": [] },
    "push": { "reel": "translate-both", "xfade": "slide${dir}", "params": ["dir"] }
    // ... dissolve, rect-morph (reelOnly), wipe, zoom-blur, iris, glitch
  },
  "elementAnim": { "rise": { "params": { "y": 28, "scale": true } } },
  "params":   { "dir": { "values": ["up","down","left","right"], "default": "up" } },
  "defaults": {                        // each one == today's hand-tuned value
    "sceneToScene": { "type": "rect-morph", "duration": 0.42, "easing": "eio" },
    "sceneEnter":   { "type": "rise", "duration": 0.20, "easing": "ease",   "params": { "y": 28,  "scale": true } },
    "sceneExit":    { "type": "rise", "duration": 0.13, "easing": "linear", "params": { "y": -10, "scale": false } },
    "outro":        { "type": "wipe", "duration": 0.45, "easing": "ease",   "params": { "dir": "up" } },
    "montage":      { "type": "cut" }
  }
}
```

A transition **value** (on a schedule entry, a scene's `timing`, or a montage `plan[]`
entry) is either the object `{ type, duration?, easing?, params?, sfx? }` or the shorthand
string `"type"` / `"type:duration"` / `"type:duration:param"`, which expands against the
type's defaults. `sfx` ∈ `whoosh_up | whoosh_down | thud | tap` couples a sound cue to the
move. Unset `transition` = today's behaviour exactly.

---

## `theme.json` — retired (2026-09-05, issue #10)

Superseded by `project.config.json` above. Nothing writes or reads it anymore. Kept here
only as a pointer for anyone who finds a reference to it in an old project or an
unmigrated doc page:

| Old `theme.json` field | Now |
|---|---|
| `bg / ink / acc / clay / mut / font / handle / logo / grid` | `project.config.json`'s `theme.*` |
| `grade` | `project.config.json`'s top-level `grade` |
| `xAnchor / yAnchor / faceAnchor` | `project.config.json`'s `crop.*` |
| `badgeUntil` / `badge` | **no equivalent** — a rare, scene-design-time exception now (see [project-config.md](design/project-config.md)'s "What this file is — and isn't"), set directly in that project's `compose.html`, not a base config field. `compose.reference.html`'s own hardcoded default (`0`, off) governs otherwise. |

---

## `rush/` — raw input (hand-supplied, never renamed)

Not a data contract in the JSON sense, but the actual source of truth every script
resolves through [`lib/rush.py`](scripts/lib-rush.md) rather than a hardcoded filename:

| Path | Role |
|---|---|
| `rush/<original name>` | **reel-speech**: the one talking-head video (`find_source`) · **broll-montage**: one of many clips (`find_clips`) |
| `rush/bg-audio.mp3` | optional background audio, excluded from both of the above |
| `rush/broll/*` | optional cutaway clips, a folder (may hold several) — `find_broll` |

---

## `build/cut-plan.json` — silence-cut plan

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

## `build/transcript-raw.json` — transcript (openai-whisper shape)

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

`transcribe.py` also emits this shape to `build/fa.json` in the pre-delivery sync check
(`--wav build/fa.wav --out build/fa.json`).

---

## `build/transcript-fixes.json` — corrected transcript + hot words (hand-authored)

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

## `build/captions.json` — caption card timings (the central contract)

**W** `captions.py` · **M** `edit_script.py` · **R** `sound_fx.py`, `render_frames.js`,
`safe_check.js`, `subtitles.py`, `fx/behind_text.js`, `remotion.sh` (copied verbatim into
`remotion/src/caps.json` — that internal filename is fixed, unrelated to this rename)

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

## `build/sound-cues.json` — sound-effect cues (hand-authored)

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

## `build/sound-effects.wav` — rendered sound bed

**W** `sound_fx.py` · **R** `encode.sh` (mixed with `build/video-reframed.mp4` audio)

48 kHz, 16-bit, stereo. Length = `caps.total + outro + 1 s`. Peak clipped to ±0.95.

---

## `build/person-cutout.json` — person-cutout data (macOS effect)

**W** `fx/behind_text.js` · **R** `render_frames.js`

```jsonc
{
  "lines": [
    { "card": 7, "s": 23.6, "e": 26.8,
      "words": [ { "t": "كلمة", "s": 23.7, "e": 24.1 } ] }
  ],
  "ranges": [ [708, 792], ... ],           // inclusive build/frames-source/ frame-number ranges the cutout covers
  "faces":  { "708": { "x": 402, "y": 210, "w": 300, "h": 360 } },  // per-frame face box in pixels
  "cutouts":  [ [23.8, 26.6] ],             // added by the `cutout` subcommand
  "headouts": [ [23.8, 26.6] ]              // added by the `headout` subcommand
}
```

`build` writes `lines` + `ranges` + `faces`. `cutout` / `headout` **append** to an
existing `build/person-cutout.json` (adding `cutouts` / `headouts` and more `ranges`/`faces`).

`build/person-cutout/mask/meta.json` (written by `personmask.swift`, consumed by
`behind_text.js`): `[ { "f": "00708.jpg", "face": { "x", "y", "w", "h" } }, ... ]` — face
box in top-left pixel coords.

---

## `config/safe.json` — safe-zone overrides (optional, hand-authored, rare)

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

Merged shallowly over the built-in `DEF` in `safe_check.js`. As of the 2026-09-05 design
session, the same `DEF` rects are reused for every short-form platform (Instagram, TikTok,
YouTube Shorts alike) — see [design/file-layout.md](design/file-layout.md) — so this file
is a rare per-project exception, not something set routinely. Defaults:

| Zone | x, y, w, h | hard | max ink |
|---|---|---|---|
| top (name + follow button) | 0, 0, 1080, 150 | yes | 0.4 % |
| bottom (IG caption + audio) | 0, 1620, 1080, 300 | yes | 0.2 % |
| bottom caution belt | 0, 1500, 1080, 120 | no | 1.0 % |
| right (like · comment · share) | 950, 1100, 130, 650 | yes | 1.0 % |

---

## `config/stage.json` — video-rectangle schedule (Remotion only, optional)

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

## `config/outro.json` — end-card copy (Remotion only, optional)

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
             "font": "...", "handle": "..." },   // only the truthy keys from project.config.json's theme
  "total": 46.078,                                // round(caps.total, 3)
  "outro": 5.2,                                   // float(sound-cues.outro), default 5.0
  "sfx":   true,                                  // does <work>/build/sound-effects.wav exist
  "stage": [ { "s": 0, "e": 9999, "m": "FULL" } ],// from config/stage.json
  "outro_copy": { "line": "", "recap": [], "cta_top": "", "cta_word": "", "tail": "" },
  "guides": false                                 // from config/safe.json's guides
}
```

Sample committed at `scripts/remotion/template/src/project.sample.json`. Note the sample
uses `outro_copy` while the generator also emits `outro_copy` — the key name matches; the
`theme.ts` reader looks for `P.outro_copy`.

---

## `build/montage-plan.json` — montage-mode state

**W** / **M** `montage_mode.py` (`.bak` kept before `drop`/`keep`)

```jsonc
{
  "src":  "/path/to/work/rush",
  "shot": 1.5,                        // base shot length (seconds)
  "clips": [
    {
      "i": 1, "file": "/abs/rush/clip1.mov", "name": "clip1.mov",
      "dur": 10.2, "w": 3840, "h": 2160, "fps": 30, "audio": true,
      "skip": false,
      "win": [ { "a": 0.30, "b": 1.80, "score": 0.73, "mot": 6.1 } ],  // candidate windows
      "pick": [0.90, 2.40],           // best window [a, b]
      "score": 0.73, "mot": 6.1, "lum": 128.4, "blur": 7.2            // metrics of the pick
    }
  ],
  "plan": [                           // added by `plan`
    { "i": 1, "file": "...", "name": "...", "in": 2.10, "dur": 1.50,
      "audio": true, "w": 3840, "h": 2160,
      "transition": "push:0.3:left" }  // optional (issue #14) — the cut INTO this entry;
                                       // shorthand or object, see transitions.json. Entry 0's is ignored.
  ]
}
```

`scan` defaults `src` to `<work>/rush` (pass a folder explicitly to scan somewhere else
instead). Scoring: sharpness (relative — percentile vs the batch), motion (absolute),
exposure (absolute), color (relative). Sharpness × exposure × a frozen-clip penalty are
**multiplied**, not added — see [invariants.md](invariants.md).

---

## The deliverable — not JSON, listed here for completeness

| Path | When | Note |
|---|---|---|
| `video-final.mp4` | always | root-level, same name regardless of mode — see [design/file-layout.md](design/file-layout.md) |
| `video-final.srt` | reel-speech only | |
| `post-caption.txt` | reel-speech only | the speech's full text, meant to be pasted as the post's caption |
| `build/video-raw.mp4` | intermediate | before `master_audio.sh` — not the deliverable |
| `build/safe-zone-check.jpg` | only if `safe_check.js --shot` finds a violation | |
