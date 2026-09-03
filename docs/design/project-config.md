# `project.config.json` — the per-project config

## Problem

Configuration for one video is scattered across up to six files with overlapping and
inconsistent reach:

- `theme.json` — colours, font, logo, handle, **and** crop anchors, grade flag, grid flag,
  badge timing (mixed concerns). Only `bg/ink/acc/clay/mut/font/handle` reach Remotion.
- `stage.json` — video-rectangle schedule. **Remotion only** — the light engine hardcodes
  `SCENES` inline.
- `outro.json` — end-card copy. **Remotion only** — the light engine hardcodes `RECAP`.
- `safe.json` — safe-zone overrides.
- `sfx.json` — sound cues + `outro` duration.
- the scene code itself — inline in `compose.html` **and** `Scenes.tsx` **and** `studio.html`.

Nothing says "this is the project". There is no place to record language, source
orientation, or which engine/style to use.

## Proposal

One file per video: `<work>/project.config.json`. A **superset** of everything above, with
concerns separated. Global defaults live in the skill dir (`defaults.config.json`) and/or
a per-creator `creator-profile` (already referenced by `SKILL.md` as
`.auto-memory/creator-profile.md`).

```jsonc
{
  "world":  "reel-speech",          // reel-speech | broll-montage | long-form   (see worlds.md)
  "engine": "auto",                 // auto | light | remotion

  "theme": {
    "bg": "#101828", "ink": "#F5F7FA", "acc": "#F2B33D",
    "clay": "#C98B18", "mut": "#98A2B3",
    "font": "Tajawal", "logo": "logo.png", "handle": "@his_handle"
  },

  "source": {
    "orientation": "auto",          // auto | vertical | landscape
    "xAnchor": 0.5, "yAnchor": 0.30,
    "faceAnchor": 0.30,
    "grade": false                  // invariant #4 — off unless the user asks
  },

  "captions": {
    "language": "ar",               // or ar-MA / darija … → hard-dialect mode
    "hardDialect": false,
    "hot": ["تشوفه", "الزوم"],
    "grid": true
  },

  "layout": {                       // replaces stage.json
    "schedule": [
      { "s": 0.0, "e": 3.5, "m": "FULL" },
      { "s": 3.5, "e": 8.0, "m": "DOWN", "gb": 480 }
    ]
  },

  "scenes": [ /* … see scenes-as-data.md … */ ],

  "audio": {                        // replaces sfx.json cues
    "outro": 5.2,
    "cues": {
      "whoosh_up": [3.1, 11.25], "whoosh_down": [7.85],
      "thud": [27.27], "tap": [23.08]
    },
    "background": "bg-audio.mp3",
    "lufs": -14
  },

  "outro": {                        // replaces outro.json
    "line": "", "recap": [], "cta_top": "علّق بكلمة", "cta_word": "فيديو", "tail": ""
  },

  "safe": {                         // replaces safe.json
    "zones": null,                  // null = built-in defaults
    "hookMax": 0.5,
    "guides": false
  },

  "badge": { "until": 0 }           // 0 = off, -1 = whole video
}
```

## Migration — the adapter

Add `scripts/lib/config.py` and `scripts/lib/config.js`:

- `load(work)` → returns the merged config (`defaults.config.json` ← `creator-profile` ←
  `<work>/project.config.json`).
- `emit_legacy(work)` → writes `theme.json`, `stage.json`, `outro.json`, `safe.json`, and
  the cue portion of `sfx.json` from the merged config, **so the existing scripts keep
  working untouched**.
- Back-compat the other way: if `project.config.json` is absent but `theme.json` exists,
  synthesize a config from the legacy files. So a project made the old way still runs.

Scripts then migrate to `config.load()` one at a time, lowest-risk first
(`reframe.py`'s `grade`/anchors; then `render_frames.js`'s theme; then the Remotion
generator; …). No big-bang change.

## Open questions

- Should `scenes` and `layout.schedule` be one thing? A scene already implies a layout
  mode for its span. Possibly `layout` is derived from `scenes` + explicit overrides.
- `creator-profile` format — Markdown (as `SKILL.md` implies) or JSON? A small parser vs a
  strict schema.
- Where do B-roll declarations (`BR_NEED` today) live — under `source` or `scenes`?
