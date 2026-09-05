# `montage_mode.py`

`video-editor/scripts/montage_mode.py` · python · independent mode

> The whole **montage mode** — no transcription, no captions. Scans a folder of silent
> clips, scores each moment on four axes (sharpness, motion, exposure, colour), picks the
> best window per clip, lets the user drop/keep, plans shot lengths (a repeating rhythm
> pattern or BPM-locked), and concatenates with ffmpeg.

## CLI

```
uv run scripts/montage_mode.py <work> scan [clipdir] [--shot 1.5] [--fps 4]
uv run scripts/montage_mode.py <work> show
uv run scripts/montage_mode.py <work> sheet [out.jpg] [--cols 6]
uv run scripts/montage_mode.py <work> drop 3 7   |  keep 1 2 5   |  undo
uv run scripts/montage_mode.py <work> plan [--dur 30] [--shot 1.5] [--bpm 0] [--order energy|best|folder]
uv run scripts/montage_mode.py <work> build [out.mp4] [--ar 9:16|1:1|16:9|4:5] [--xfade 0] [--amb 0] [--zoom 1]
```

`scan`'s `clipdir` is optional since issue #59 — defaults to `<work>/rush` (put the clips
there first); pass a folder explicitly to scan somewhere else instead.

## Inputs

| Source | Role |
|---|---|
| `<work>/rush/` (or an explicit folder) | `.mov .mp4 .m4v .avi .mkv .webm .mts .m2ts`, non-dot files, excluding `bg-audio.mp3` |
| `<work>/build/montage-plan.json` | state (see [data-contracts.md](../data-contracts.md#buildmontage-planjson--montage-mode-state)) |
| `<work>/rush/bg-audio.mp3` | later, via `master_audio.sh` |

## Outputs

| File | Shape |
|---|---|
| `<work>/build/montage-plan.json` | state + `plan` |
| `<work>/build/montage-plan.json.bak` | before `drop`/`keep` |
| `<work>/build/montage-contact-sheet.jpg` | numbered contact sheet |
| `<work>/build/montage-raw.mp4` | the built montage, before mastering |

Temp dirs `build/.mscan`, `build/.msheet` are removed.

## Scoring

Per-frame metrics from one ffmpeg pass (`fps`, `scale=320:-2`, `blurdetect`, `signalstats`,
`metadata=print`):

| Axis | Source | Scale |
|---|---|---|
| sharpness | `lavfi.blur` vs the batch median (`medb`) | **relative** — works at any resolution / scene |
| motion | `signalstats.YDIF` (mean inter-frame luma diff) | absolute: frozen `< 0.5` = bad; `8–16` = alive; `> 16` = shake |
| exposure | `signalstats.YAVG` | absolute: `≤ 40` or `≥ 225` rejected outright |
| colour | `signalstats.SATAVG` percentile | relative |

Final: `base = 0.40·life(mot) + 0.25·steady + 0.15·colour + 0.20`, then
`score = base · (0.20 + 0.80·sharp) · expo(lum) · (0.35 if mot < 0.5 else 1.0)`.
**Sharpness, exposure and the frozen penalty multiply — they don't add.** A shaky, dark or
frozen shot can't be rescued by its other qualities. (A dark image also fools the sharpness
metric — fewer details read as "sharp" — so exposure counteracts it.)

The first and last third-second of every clip are trimmed (hand-on-device moment).

## Planning

- `--bpm 96` → shot lengths lock to the beat with a pattern that breaks monotony
  (`[k, k, k, k+1]` or `[k, k, k-1, k+1]`).
- else → pattern `shot × (1.0, 0.82, 1.24, 0.94)`.
- `--order energy` (default): alternate high/low motion, strongest shot first.
  `best` = by score; `folder` = folder order.

## Building

- Per clip: `setpts`, `fps=30`, optional slow push-in zoom (only if source ≥ 1.4× output),
  scale + centre-crop to the AR, `setparams` bt709, `yuv420p`.
- `--xfade 0.25` → chained `xfade=transition=fade` (only `fade` is wired). Default is a
  hard `concat`.
- `--amb 0.3` → keep clip ambience at low volume — requires every clip to have audio and
  `--xfade 0`. Otherwise a silent `anullsrc` track (then `master_audio.sh` is mandatory).
- Encode: `libx264 -preset slow -crf 20 -maxrate 8M`, `aac 160k`, `-shortest`, `+faststart`.

## External tools

`ffprobe`, `ffmpeg` (`blurdetect`, `signalstats`, `metadata=print`, `crop`/`scale`/`xfade`/
`concat`/`tile`), Python `PIL` (optional — numbered sheet, else ffmpeg `tile`),
`ThreadPoolExecutor` (4 parallel probes).

## Cross-platform

`os.path.abspath` / `os.path.join`. PIL font list includes `C:/Windows/Fonts/arialbd.ttf`.
UTF-8 reconfigure. **No shell wrapper — run via `uv run`, Windows-friendly.** Handles mobile
rotation side-data and the ffmpeg 7-vs-8 `crop:eval=frame` difference.

## Place in the flow

The entire montage mode (`SKILL.md` "Montage mode"). Independent of the speech-ad flow —
no theme, no colours, no logo. After `build`: `master_audio.sh <work>
build/montage-raw.mp4 video-final.mp4` with `rush/bg-audio.mp3` in place. Same deliverable
name (`video-final.mp4`, at the work-dir root) as the speech-ad flow — see
[design/file-layout.md](../design/file-layout.md).

## Gotchas

- A montage with no ambience is a **silent track** — the background audio file here is not
  decoration.
- Reasonable duration is 20–40 s.
- Never repeat a clip; if the clips can't fill `--dur`, the script warns and suggests a
  larger `--shot`.
- **Migrated to the `rush`/`build` layout (issue #59, 2026-09-05)** — a real bug was
  caught by testing this: `scan --shot 1.0` initially misread `1.0` (the flag's value) as
  a folder argument, since the naive "skip tokens starting with `--`" filter didn't know
  to also skip the value following a recognized flag. Fixed by tracking which token is a
  flag's value, not just which token starts with `--`.
