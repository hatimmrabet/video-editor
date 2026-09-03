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
node fx/behind_text.js <work> off               # delete behind.json
```

| Exit code | Meaning |
|---|---|
| 2 | bad arguments |
| 3 | no `<work>/vfr` folder |
| 4 | `swiftc` missing (not macOS / no Xcode CLT) |

## Inputs

| File | Role |
|---|---|
| `<work>/caps.json` | sentence / word selection |
| `<work>/vfr/*.jpg` | source frames (only the needed ones are copied to `bt/src/`) |
| `scripts/fx/personmask.swift` | compiled once to `<work>/bt/personmask` (`swiftc -O`) |
| `<work>/behind.json` | existing file — `cutout`/`headout` **append** to it |

## Outputs

| File | Shape |
|---|---|
| `<work>/bt/src/*.jpg` | copied source frames |
| `<work>/bt/mask/*.png` + `bt/mask/meta.json` | grayscale person masks + face boxes |
| `<work>/bt/person/*.png` | RGBA person-only frames (via ffmpeg `alphamerge`) |
| `<work>/behind.json` | `{ lines, ranges, faces, cutouts?, headouts? }` — see [data-contracts.md](../data-contracts.md#behindjson--person-cutout-data-macos-effect) |

## How it works

1. Build `bt/personmask` from `personmask.swift` once.
2. Copy only the needed `vfr/` frames (a sentence's word range ± padding → a frame range).
3. Run `personmask <bt/src> <bt/mask> accurate 2.5` — writes a mask PNG per frame + `meta.json`.
4. `ffmpeg` `alphamerge` the mask into the source frame → `bt/person/%05d.png` (RGBA).
5. Write `behind.json` (`build`) or append to it (`cutout` / `headout`).

The actual compositing — kashida-stretched Arabic word passing behind the head, person
redrawn on top, `personStage`, `headOut` — lives in `compose.reference.html`, not here.

## External tools

`swiftc` (Xcode command-line tools), the compiled `personmask` binary, `ffmpeg`. Uses
`cp.execSync` with Unix-style command strings.

## Cross-platform

**macOS only.** On non-mac, `swiftc` is absent → prints `xcode-select --install` and
`process.exit(4)`. Does **not** use `lib/platform.js`. The binary path is `bt/personmask`
with no `.exe`. Fallback: don't use the effect — `render_frames.js` only activates the
overlay when `behind.json` exists, so the rest of the pipeline is unaffected.

## Place in the flow

Stages 7.5 / 7.6, after scene design. Then re-render: `render_frames.js <work> all --force`
(for `build`) or `render_frames.js <work> range <a> <b>` (for `cutout` / `headout`).

## Gotchas

- Use it once or twice per video — invariant #8.
- Rules the `plan` command enforces: sentence 1–4 words, duration ≥ 0.85 s. Best on the hook.
- The regular caption card auto-hides during a `build` range so the text isn't shown twice.
- Cost: ≈ 0.15 s per frame for the cut (a 2 s sentence ≈ 10 s of work).
