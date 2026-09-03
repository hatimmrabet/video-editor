# `master_audio.sh`

`video-editor/scripts/master_audio.sh` · bash · shared

> Loudness-normalizes the finished video to −14 LUFS (platform standard) and optionally
> mixes in a background audio file that ducks under speech via sidechain compression. The
> video stream is stream-copied — no re-encode, no quality loss. Guards against a silent
> track.

## CLI

```
bash master_audio.sh <work> <in.mp4> [out.mp4]     # default out: ${in%.mp4}-master.mp4
```

| Env var | Default | Effect |
|---|---|---|
| `BG` / `MUSIC` | auto-discover | explicit background audio path |
| `BG_GAIN` / `MUSIC_GAIN` | `0.28` | background level |
| `LUFS` | `-14` | target integrated loudness |
| `NO_LOUDNORM` | — | `1` skips normalization |

## Inputs

| File | Role |
|---|---|
| `<in.mp4>` | the video to master |
| background audio | auto-discovered as `<work>/{bg-audio,bg,sound,music}.{mp3,m4a,wav,aac}` |

## Outputs

| File | Encoding |
|---|---|
| `<out.mp4>` | video **copied**, audio `aac 192k 48kHz`, `+faststart`. Prints final loudness + `ffprobe` summary |

Temp files `<work>/.master-mix.wav` and `.master-norm.wav` are created then `rm -f`'d.

## Audio graph

1. **With background:** resample both to 48 kHz stereo; background at `BG_GAIN`, trimmed to
   duration, `afade` in 1.0 s / out 1.4 s; `sidechaincompress` keyed on the speech
   (`threshold=0.035 ratio=9 attack=8 release=320`); `amix` with the speech.
2. **Without background:** just extract the speech to stereo 48 kHz.
3. `loudnorm` two-pass (measure → apply with `measured_*` + `linear=true`), target
   `I=<LUFS> TP=-1.5 LRA=11`.
4. Mux: `-map 0:v:0 -map 1:a:0 -c:v copy`.

## External tools

`ffmpeg` (two-pass loudnorm, sidechaincompress, amix), `ffprobe`, `python3` (inline JSON
parsing of the loudnorm stats), `grep`.

## Cross-platform

Sources `lib/platform.sh`; `W="$(vevo_abspath "$1")"`. Uses bash process substitution
(`read -r … < <(…)`) and `${IN%.mp4}` — **needs a real bash**, not `cmd`/PowerShell.
`set -e`.

## Place in the flow

Stage 10 (speech ad) and stage 6 (montage). `montage_mode.py build` prints it as the next step.

## Gotchas

- **Silent track:** a montage with no background audio measures `−inf` LUFS; the script
  detects `input_i` that is NaN or `< −70`, skips normalization, and prints
  `🔇 المسار الصوتي صامت`. This is invariant #10 — don't remove the guard.
- Call it "background audio file", not "music" (invariant #9).
