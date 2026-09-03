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
node safe_check.js <work> --shot   # also write safe.jpg (worst frame with zones in red)
```

**Exit code 3** on any hard-zone violation or a late hook.

## Inputs (in `<work>`)

| File | Role | Required |
|---|---|---|
| `sfx.json` | `.outro` | yes |
| `caps.json` | cards + hook time | yes |
| `theme.json` | `bg` (for the flat-fill background reference), `font` | optional |
| `safe.json` | zone / `hook_max` / `guides` overrides, merged over `DEF` | optional |
| `compose.html` | the drawing surface — **if absent, only the hook check runs** | for the pixel check |
| `vfr/*.jpg` | for the `--shot` output | for `--shot` |

## Outputs

| File | When |
|---|---|
| `<work>/safe.jpg` | `--shot` only — the worst frame with all zones overlaid in red |

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

## Place in the flow

Mandatory pre-delivery check 0. For the Remotion engine there is no pixel check — set
`"guides": true` in `safe.json` and open the studio to see the red zones live.

## Gotchas

- Widen the zones via `safe.json` for other platforms (e.g. a TikTok cut with a tighter
  bottom).
- A late hook loses half the viewers — this is a hard failure, not a warning.
