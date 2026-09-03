# `fx/personmask.swift`

`video-editor/scripts/fx/personmask.swift` · Swift · **macOS only**

> Per-frame person segmentation + largest-face rectangle, using Apple Vision. Writes an
> 8-bit grayscale PNG mask per input JPEG plus a `meta.json` of face boxes. This is the
> **single hard macOS dependency** in the repo.

## CLI

```
personmask <inDir> <outDir> [fast|balanced|accurate] [feather]
```

Defaults: quality `accurate`, feather `2.5`. `behind_text.js` calls it as
`personmask <bt/src> <bt/mask> accurate 2.5`.

## Inputs

`*.jpg` files in `<inDir>`.

## Outputs

| File | Shape |
|---|---|
| `<outDir>/<name>.png` | 8-bit grayscale (`.L8`) person mask, scaled to the source size, optionally Gaussian-feathered |
| `<outDir>/meta.json` | `[ { "f": "00708.jpg", "face": { "x", "y", "w", "h" } }, ... ]` — largest face box, Vision's bottom-left normalized coords converted to top-left pixels |

## How it works

- `VNGeneratePersonSegmentationRequest` (quality `fast` / `balanced` / `accurate`),
  `outputPixelFormat = kCVPixelFormatType_OneComponent8`.
- `VNDetectFaceRectanglesRequest` — the largest face by bounding-box width.
- `CIContext(useSoftwareRenderer: false)`; feather = `CIGaussianBlur` clamped to extent.

## External deps

`Foundation`, `Vision`, `CoreImage` — macOS frameworks. Compiled on demand by
`behind_text.js` (`swiftc -O`).

## Cross-platform

**macOS only. No fallback.** Everything that needs it (behind-text / cutout / headout,
`SKILL.md` 7.5 / 7.6) skips itself on other platforms.

## Place in the flow

Called only by `fx/behind_text.js`. Never invoked directly by the skill.

## Gotchas

- If anyone ports this (e.g. to `rembg` / MediaPipe on Windows), keep the `meta.json`
  contract identical — `behind_text.js` reads `m.f` (filename) and `m.face` (top-left
  pixel box).
