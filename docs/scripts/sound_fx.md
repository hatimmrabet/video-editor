# `sound_fx.py`

`video-editor/scripts/sound_fx.py` · python · shared

> Synthesizes a stereo sound-effect bed procedurally with numpy — no sample files. Places
> each effect at the timestamps listed in `sfx.json`. Fixed seed (`RandomState(11)`),
> `SR = 48000`.

## CLI

```
uv run scripts/sound_fx.py <work>
```

## Inputs

| File | Shape | Required |
|---|---|---|
| `<work>/caps.json` | `.total` | yes |
| `<work>/sfx.json` | `{ outro, whoosh_up:[t], whoosh_down:[t], thud:[t], tap:[t] }` | yes — hand-authored |

## Outputs

| File | Shape |
|---|---|
| `<work>/sfx.wav` | 48 kHz, 16-bit, stereo. Length = `caps.total + outro + 1 s`. Peak clipped to ±0.95 |

## Synthesised effects

| Effect | How | Gain when placed |
|---|---|---|
| `whoosh_up` / `whoosh_down` | filtered white noise, low-pass sweeping up (0.03→0.30) or down, `sin^1.6` envelope | 0.085 / 0.075 |
| `thud` | sine glide `135 → 58 Hz`, `exp(-t/0.085)` decay + a noise transient | 0.115 |
| `tap` | short filtered-noise click, `exp(-t/0.013)` decay | 0.075 |

## External tools

None (numpy, `wave`).

## Cross-platform

`S = os.path.abspath(sys.argv[1]) + "/"` — the hardcoded `/` is harmless (Python on
Windows accepts forward slashes). UTF-8 reconfigure. Called directly by the skill — pass a
Windows-style path.

## Place in the flow

Stage 8, after `sfx.json` is authored. The `.wav` is mixed with the `cutz.mp4` audio by
`encode.sh`. `render_frames.js` reads only `.outro` from `sfx.json` (for frame count).

## Gotchas

- Every cue must correspond to a meaningful on-screen moment (invariant #1): max 15
  events/minute, peak below −18 dBFS, and show the user where they land before export.
- `edit_script.py` shifts these timestamps when a sentence is dropped — re-run `sound_fx.py`
  afterwards.
