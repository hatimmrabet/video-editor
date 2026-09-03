# `contact_sheet.sh`

`video-editor/scripts/contact_sheet.sh` · bash · shared · token-saving

> Builds ONE horizontal contact sheet from several timestamps, so Claude reads one image
> instead of N. Timestamp labels are burned with Python/PIL (**not** ffmpeg `drawtext`,
> which is missing from many builds); falls back to an unlabeled `hstack` if PIL is
> unavailable.

## CLI

```
bash contact_sheet.sh <work> <sheet.jpg> <t1> <t2> ...
```

| Env var | Effect |
|---|---|
| `SRC=<file.mp4>` | source override; else `<work>/ad-final.mp4`; else `<work>/prev/tNN.NN.jpg` |

## Inputs

A video (`SRC` or `ad-final.mp4`) or the `prev/*.jpg` stills from `render_frames.js preview`.

## Outputs

| File | Shape |
|---|---|
| `<sheet.jpg>` | frames at 300 px wide, side by side, each labeled with its timestamp |

Temp dir `<work>/.sheet` is removed at the end.

## External tools

`ffmpeg` (frame grabs, `scale=300:-1` for token economy), Python + PIL. PIL font search
includes `C:\Windows\Fonts\arialbd.ttf` / `segoeuib.ttf` (Windows-aware) and the macOS /
DejaVu equivalents.

## Cross-platform

Sources `lib/platform.sh`; `W="$(vevo_abspath "$1")"`. Heredoc Python, `rm -rf`, `mkdir -p`
— bash only. `set -e`.

## Place in the flow

Used for visual review — during scene design (`preview` then sheet) and in the
pre-delivery checks (a real 6-shot sheet, actually looked at).

## Gotchas

- Do not add `drawtext` — invariant #9. If PIL is missing, the sheet has no labels and the
  script prints the left-to-right order instead.
- Images eat 80–85 % of conversation context; a 1080-wide image ≈ 150k chars, the same at
  300 wide ≈ 20k. Always use one sheet, never separate stills.
