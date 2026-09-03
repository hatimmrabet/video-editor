# `transcribe.py`

`video-editor/scripts/transcribe.py` · python · shared

> Word-level speech transcription → `a.json` (openai-whisper JSON shape). Auto-selects the
> engine: faster-whisper on CUDA (fastest) → faster-whisper CPU → openai-whisper CPU
> fallback. Handles "hard dialects" (Maghrebi Arabic / darija) by mapping to ISO `ar` and
> enabling VAD + repetition penalty + a higher no-speech threshold, and warning that the
> text will need manual correction. Replaces a plain `python -m whisper` invocation and
> adds Windows GPU support.

## CLI

```
uv run scripts/transcribe.py <work> [--language ar] [--model large-v3]
                             [--engine auto|faster-whisper|whisper]
                             [--device auto|cuda|cpu] [--hard-dialect]
                             [--wav PATH] [--out PATH]
```

| Flag | Default | Notes |
|---|---|---|
| `--language` | `ar` | `ar` / `fr` / `en` / … or a hard dialect `ar-MA` / `ar-DZ` / `ar-TN` / `ar-LY` / `darija` / `maghrebi` / `moroccan` |
| `--model` | `large-v3` | Whisper model name (downloaded on first run) |
| `--engine` | `auto` | `auto` picks faster-whisper if importable, else whisper |
| `--device` | `auto` | `auto` picks `cuda` if faster-whisper + `ctranslate2.get_cuda_device_count() > 0` |
| `--hard-dialect` | off | forced automatically for the hard-dialect language codes |
| `--wav` | `<work>/a.wav` | alternate input |
| `--out` | `<work>/a.json` | alternate output (used as `fa.json` in the sync check) |

## Inputs

| File | Shape | Required |
|---|---|---|
| `<work>/a.wav` (or `--wav`) | WAV, opened with `wave` for duration | yes — extract it first: `ffmpeg -i src.mov -vn -ac 1 -ar 16000 -y a.wav` |

## Outputs

| File | Shape |
|---|---|
| `<work>/a.json` (or `--out`) | `{ "text", "segments":[{id,start,end,text,words:[{word,start,end}]}], "language" }` — see [data-contracts.md](../data-contracts.md#ajson--transcript-openai-whisper-shape) |

## Hard-dialect mode

Triggered by `--hard-dialect` or a hard-dialect language code. Maps the code to `ar`,
prints `⚠️ لهجة صعبة …`, and:

- **faster-whisper:** `condition_on_previous_text=False`, `repetition_penalty=1.3`,
  `no_repeat_ngram_size=3`, `vad_filter=True` (`min_silence_duration_ms=350`, `speech_pad_ms=200`)
- **openai-whisper:** `condition_on_previous_text=False`, `no_speech_threshold=0.95`

Whisper is still poor on darija even with `large-v3` — the correction step (stage 4/5) is mandatory.

## External tools

Python libs `faster_whisper` / `whisper` / `ctranslate2`. Downloads model weights on first run.

## Cross-platform

`enable_cuda_libs()` (lines 34–55) is explicit Windows CUDA support — walks the
`nvidia.cublas` / `nvidia.cudnn` pip packages, calls `os.add_dll_directory()` and prepends
their `bin`/`lib` to `PATH`. See [../windows.md](../windows.md#gotcha-4--cuda-on-windows).
UTF-8 reconfigure at the top. Called directly by the skill — pass a Windows-style path.

## Place in the flow

Stage 3. Also re-run in the mandatory pre-delivery sync check
(`--model medium --wav fa.wav --out fa.json`, then compare `fa.json` sentence starts to
`caps.json`). On CPU it takes minutes — run it in the background.

## Gotchas

- If faster-whisper is selected but fails at runtime and openai-whisper is importable, it
  automatically retries with openai-whisper.
- The output `words[]` drops any word Whisper returned with a null `start`.
