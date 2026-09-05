# `safe_check.js`

`video-editor/scripts/safe_check.js` · node · light-engine verifier

> Automated pre-delivery check of (a) the **hook** — the first caption must appear before
> `hook_max` (0.5 s) — and (b) **Instagram safe-area intrusion**. Renders each sample time
> twice with two flat colours swapped in for the video pixels; pixels that *don't* change
> between the two draws are "your graphics", so it counts ink inside Instagram's button
> zones without depending on theme colours.

## CLI

```
node safe_check.js <work>          # check and print
node safe_check.js <work> --shot   # also write build/safe-zone-check.jpg IF there's a violation (worst frame with zones in red)
```

**Exit code 3** on any hard-zone violation or a late hook.

## Inputs (in `<work>`)

| File | Role | Required |
|---|---|---|
| `build/sound-cues.json` | `.outro` | yes |
| `build/captions.json` | cards + hook time | yes |
| `config/project.config.json` (via [`lib/config.js`](lib-config.md)'s `load()`) | `theme.bg` (flat-fill background reference), `theme.font`, `crop.faceAnchor` | optional |
| `config/scenes.json` (via [`lib/scenes.js`](lib-scenes.md)'s `load()`) | its `schedule` → `window.init({schedule})` so `vrect` matches a scenes-driven project (issue #17); the graphics aren't drawn here | optional |
| `config/safe.json` | zone / `hook_max` / `guides` overrides, merged over `DEF` — rare, same rects reused for every short-form platform by default | optional |
| `compose.html` | the drawing surface — **if absent, only the hook check runs** | for the pixel check |
| `build/frames-source/*.jpg` | for the `--shot` output | for `--shot` |

## Outputs

| File | When |
|---|---|
| `<work>/build/safe-zone-check.jpg` | `--shot` **and** a violation was found — never written on a clean pass (issue #59) |

## Default zones (`DEF`)

| Zone | x, y, w, h | hard | max ink |
|---|---|---|---|
| top (name + follow button) | 0, 0, 1080, 150 | yes | 0.4 % |
| bottom (IG caption + audio) | 0, 1620, 1080, 300 | yes | 0.2 % |
| bottom caution belt | 0, 1500, 1080, 120 | no | 1.0 % |
| right (like · comment · share) | 950, 1100, 130, 650 | yes | 1.0 % |

`hook_max: 0.5`.

## How the pixel check works

- Sample times: every 0.4 s + start/mid of each caption + the outro.
- For each time: draw with `FLAT_A` (red) as the video, read pixels; draw with `FLAT_B`
  (green), read pixels. Pixels that changed = the video; pixels that stayed = your graphics.
- If fewer than 5 % of pixels changed, the video didn't render — the sample is **skipped**
  (bug #8 fix).
- Inside each zone, count non-background, non-shadow, stable pixels, excluding a 24 px
  edge margin and a 14 px band around the video card frame (`window.vrect`). Report the
  worst fraction and the time it occurred.

## External tools

`node`, `puppeteer` (bundled Chromium).

## Cross-platform

Uses `lib/platform.js`. Windows-capable. `setCacheEnabled(false)`.

## Gotchas

- **Migrated to `config.load()` (issue #56, 2026-09-05)** — no longer reads `theme.json`
  directly. Same pattern as `render_frames.js` (issue #55): no `project.config.json` yet?
  Falls back to `defaults.config.json`, same numbers as before.
- **Migrated to the `build`/`config` layout (issue #59, 2026-09-05)** — `safe.json` moved
  to `config/safe.json`; the diagnostic image is only written on an actual violation now
  (previously unconditional whenever `--shot` was passed).

## Place in the flow

Mandatory pre-delivery check 0. For the Remotion engine there is no pixel check — set
`"guides": true` in `config/safe.json` and open the studio to see the red zones live.

## Gotchas

- `config/safe.json` is a rare, per-project exception now — the default zones are reused
  for every short-form platform (Instagram, TikTok, YouTube Shorts) rather than set per
  platform (see [design/file-layout.md](../design/file-layout.md)); only widen them if a
  real post surfaces an actual problem.
- A late hook loses half the viewers — this is a hard failure, not a warning.
