# `fx/behind_text.js`

`video-editor/scripts/fx/behind_text.js` · node · **macOS only**

> The three "person cutout" effects. Cuts the speaker out of each frame using the macOS
> Vision framework (via `personmask.swift`), so text/kashida can be drawn passing behind
> their head. Also builds the face-bounding-box data the compositor uses.

## CLI

```
node fx/behind_text.js <work> plan             # list sentences that fit (≤ 4 words, ≥ 0.85 s)
node fx/behind_text.js <work> build 1 9         # whole sentences 1 and 9
node fx/behind_text.js <work> build 2:6-8       # words 6–8 of sentence 2
node fx/behind_text.js <work> cutout 23.8-26.6  # speaker cut out, standing in front of the design, no card
node fx/behind_text.js <work> headout 23.8-26.6 # video in a small card, head pokes above its top edge
node fx/behind_text.js <work> off               # delete build/person-cutout.json
```

| Exit code | Meaning |
|---|---|
| 2 | bad arguments |
| 3 | no `<work>/build/frames-source` folder |
| 4 | `swiftc` missing (not macOS / no Xcode CLT) |

## Inputs

| File | Role |
|---|---|
| `<work>/build/captions.json` | sentence / word selection |
| `<work>/build/frames-source/*.jpg` | source frames (only the needed ones are copied to `build/person-cutout/src/`) |
| `scripts/fx/personmask.swift` | compiled once to `<work>/build/person-cutout/personmask` (`swiftc -O`) |
| `<work>/build/person-cutout.json` | existing file — `cutout`/`headout` **append** to it |

## Outputs

| File | Shape |
|---|---|
| `<work>/build/person-cutout/src/*.jpg` | copied source frames |
| `<work>/build/person-cutout/mask/*.png` + `mask/meta.json` | grayscale person masks + face boxes |
| `<work>/build/person-cutout/person/*.png` | RGBA person-only frames (via ffmpeg `alphamerge`) |
| `<work>/build/person-cutout.json` | `{ lines, ranges, faces, cutouts?, headouts? }` — see [data-contracts.md](../data-contracts.md#buildperson-cutoutjson--person-cutout-data-macos-effect) |

## How it works

1. Build `build/person-cutout/personmask` from `personmask.swift` once.
2. Copy only the needed `build/frames-source/` frames (a sentence's word range ± padding
   → a frame range).
3. Run `personmask <src> <mask> accurate 2.5` (both under `build/person-cutout/`) — writes
   a mask PNG per frame + `meta.json`.
4. `ffmpeg` `alphamerge` the mask into the source frame →
   `build/person-cutout/person/%05d.png` (RGBA).
5. Write `build/person-cutout.json` (`build`) or append to it (`cutout` / `headout`).

The actual compositing — kashida-stretched Arabic word passing behind the head, person
redrawn on top, `personStage`, `headOut` — lives in `compose.reference.html`, not here.

## External tools

`swiftc` (Xcode command-line tools), the compiled `personmask` binary, `ffmpeg`. Uses
`cp.execSync` with Unix-style command strings.

## Cross-platform

**macOS only.** On non-mac, `swiftc` is absent → prints `xcode-select --install` and
`process.exit(4)`. Does **not** use `lib/platform.js`. The binary path is
`build/person-cutout/personmask` with no `.exe`. Fallback: don't use the effect —
`render_frames.js` only activates the overlay when `build/person-cutout.json` exists, so
the rest of the pipeline is unaffected.

## Place in the flow

Stages 7.5 / 7.6, after scene design. Then re-render: `render_frames.js <work> all --force`
(for `build`) or `render_frames.js <work> range <a> <b>` (for `cutout` / `headout`).

## Gotchas

- Twice per video at most, and ≥ 8 s between two moments — invariant #8. `plan` reads
  `build/person-cutout.json` and flags a candidate within 8 s of one already built (and
  `build` prints the same warning if a single call asks for too many, or too close). Both
  are advisory — they never block.
- Rules the `plan` command checks: sentence 1–4 words, duration ≥ 0.85 s. Best on the hook.
- The regular caption card auto-hides during a `build` range so the text isn't shown twice.
- Cost: ≈ 0.15 s per frame for the cut (a 2 s sentence ≈ 10 s of work).
- **Migrated to the `build/` layout (issue #59, 2026-09-05)** — `vfr` → `build/frames-source`,
  `bt/` → `build/person-cutout/`, `behind.json` → `build/person-cutout.json`.
