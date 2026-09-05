# `reframe.py`

`video-editor/scripts/reframe.py` · python · shared

> Cuts the silences (per `build/cut-plan.json`), reframes to vertical 9:16, applies a per-segment
> zoom cycle, optionally colour-grades, and — critically — re-tags colour primaries as
> bt709 so iPhone HDR/HLG footage doesn't render orange. Vertical sources pass through
> unchanged; landscape (16:9) sources are centre-cropped to a 9:16 frame first.

## CLI

```
uv run scripts/reframe.py <work>
```

## Inputs

| File | Shape | Required |
|---|---|---|
| `<work>/rush/<name>` | source video, resolved by [`lib/rush.py`](lib-rush.md)'s `find_source()` | yes |
| `<work>/build/cut-plan.json` | `.keep` | yes |
| `<work>/config/project.config.json` (via [`lib/config.py`](lib-config.md)'s `load()`) | `grade` (bool, default false), `crop.xAnchor` (0–1, default 0.5), `crop.yAnchor` (0–1, default 0.30) | optional |

## Outputs

| File | Shape |
|---|---|
| `<work>/build/video-reframed.mp4` | 1080×1920, `libx264 -preset medium -crf 16`, `aac 192k`, `+faststart`, 30 fps, `dynaudnorm` audio, `afade` in 0.06 s |

Then extract source frames for the compositor:

```
mkdir -p <work>/build/frames-source && ffmpeg -v error -i <work>/build/video-reframed.mp4 -vf fps=30 -q:v 3 -y <work>/build/frames-source/%05d.jpg
```

## Reframe logic

- Probe source `WxH`. `TARGET = 9/16`.
- **Landscape** (`SW/SH > TARGET`): base frame `BW = SH*TARGET`, `BH = SH`; crop anchored
  by `xAnchor` horizontally, `yAnchor` vertically.
- **Narrower than 9:16** (rare): crop horizontally instead.
- **~9:16** (selfie): pass through unchanged — original behaviour.
- Per-segment zoom `Z = [1.00, 1.08, 1.00, 1.06, …]` (14 values, cycled): each kept
  segment is trimmed, cropped to `BW/z × BH/z`, scaled to 1080×1920 with lanczos, then all
  segments are concatenated.
- `fps=30`, optional `eq`/`colorbalance` grade, then
  `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`, `format=yuv420p`.

## External tools

`ffprobe` (source `WxH`) · `ffmpeg` (one big `filter_complex`: per-segment
trim/crop/scale/concat + fps + setparams + optional eq/colorbalance).

## Cross-platform

`W = os.path.abspath(sys.argv[1])`. Pure ffmpeg otherwise. UTF-8 reconfigure. Called
directly by the skill — pass a Windows-style path.

## Place in the flow

Stage 6, after `edit_script.py`. Re-run it (and re-extract frames) after any
`edit_script.py drop`. Its `build/video-reframed.mp4` is the video source for both engines
(`public/video.mp4` in Remotion) and for `build/frames-source/` frame extraction.

## Gotchas

- `grade` is **off by default** — invariant #4. Only enable it if the user explicitly
  asks, and tell them you did.
- The bt709 re-tag is not a grade — it fixes the colour-primaries metadata that browsers
  honour. Do not remove it.
- For a landscape source, preview one frame before committing (`xAnchor` may need tuning
  if the speaker is off-centre).
- **Migrated to `config.load()` (issue #8, 2026-09-05)** — no longer reads `theme.json`
  directly. No `project.config.json` yet? `config.load()` falls back to the skill's
  `defaults.config.json` (`grade:false`, `xAnchor:0.5`, `yAnchor:0.30`) — same numbers as
  before, just sourced differently. No back-compat read of the old `theme.json` is kept.
- **Migrated to `lib/rush.py` + the `build/` layout (issue #59, 2026-09-05)** — no longer
  hardcodes `src.mov`/`cut.json`/`cutz.mp4`.
