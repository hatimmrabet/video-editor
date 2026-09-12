# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Word-level speech transcription → <work>/build/transcript-raw.json (openai-whisper shape).

  python3 transcribe.py <work> [--language ar] [--model large-v3]
                               [--engine auto|faster-whisper|whisper]
                               [--device auto|cuda|cpu] [--hard-dialect]

Reads : <work>/build/transcribe-input.wav · <work>/config/project.config.json (transcribe.model)
Writes: <work>/build/transcript-raw.json  = {"text":..., "segments":[{id,start,end,text,words:[{word,start,end}]}], "language":...}

Engines (auto = tries the fastest first):
  faster-whisper on GPU  ← fastest (needs CUDA + the nvidia-cublas-cu12 / nvidia-cudnn-cu12 packages)
  faster-whisper on CPU  ← ~4x faster than openai-whisper, same quality
  openai-whisper on CPU  ← fallback

Model: --model wins; else `transcribe.model` in project.config.json; else the per-dialect
fine-tune in DIALECT_MODEL (issue #126); else large-v3.

--hard-dialect : for Moroccan/Algerian darija etc. — enables VAD + no cross-segment
                 priming (kept deliberately WITHOUT a repetition penalty, so retakes.py
                 can still see the stammers). The transcript is still rough — Claude
                 re-reads and rewrites it whole before captioning (SKILL.md step 5).
"""
import argparse, importlib.util, json, os, wave


# ── dialects Whisper struggles with: mapped down to an acceptable ISO code, hard-dialect mode enabled ──
HARD_DIALECTS = {
    "ar-ma": "ar", "ar-dz": "ar", "ar-tn": "ar", "ar-ly": "ar",
    "darija": "ar", "maghrebi": "ar", "moroccan": "ar",
}

# ── a fine-tuned model to use instead of large-v3 for a hard dialect (issue #126) ──
# ar-ma → the local CT2 conversion of anaszil/whisper-large-v3-turbo-darija (a LoRA over
# whisper-large-v3-turbo, MIT, WER 24.88% on its own eval set). Spot-checked against 5 real
# darija sentences from abnajlae/darija-asr-benchmark-6speaker: it fixed several words
# large-v3 got wrong ("خصني ندير" vs large-v3's "خسنين دير") at the same CPU/int8 cost.
# `uv run scripts/prepare_darija_model.py` builds it once (see that script's docstring);
# until then this silently falls back to large-v3. `transcribe.model` in
# project.config.json, or --model on the CLI, overrides this either way.
_DARIJA_CT2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".models",
                            "darija-large-v3-turbo-ct2")
DIALECT_MODEL = {
    "ar-ma": _DARIJA_CT2 if os.path.isdir(_DARIJA_CT2) else None,
}


def enable_cuda_libs():
    """Makes CUDA libraries installed via pip visible to CTranslate2 on Windows (harmless elsewhere)."""
    found = []
    for mod in ("nvidia.cublas", "nvidia.cudnn"):
        try:
            spec = importlib.util.find_spec(mod)
            if not spec or not spec.submodule_search_locations:
                continue
            base = list(spec.submodule_search_locations)[0]
            for sub in ("bin", "lib"):
                d = os.path.join(base, sub)
                if os.path.isdir(d):
                    if hasattr(os, "add_dll_directory"):
                        try:
                            os.add_dll_directory(d)
                        except OSError:
                            pass
                    os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
                    found.append(d)
        except Exception:
            pass
    return found


def have(mod):
    return importlib.util.find_spec(mod) is not None


def cuda_available():
    if not have("ctranslate2"):
        return False
    enable_cuda_libs()
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


def to_a_json(segments, language, out_path):
    segs, full = [], []
    for i, s in enumerate(segments):
        words = [{"word": w["word"], "start": round(w["start"], 3), "end": round(w["end"], 3)}
                 for w in s.get("words", []) if w.get("start") is not None]
        segs.append({"id": i, "start": round(s["start"], 3), "end": round(s["end"], 3),
                     "text": s["text"], "words": words})
        full.append(s["text"].strip())
        print(f"[{s['start']:7.2f}-{s['end']:7.2f}] {s['text'].strip()}")
    json.dump({"text": " ".join(full), "segments": segs, "language": language},
              open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✅ {out_path}  — {len(segs)} segment(s)")


def run_faster_whisper(wav, language, model, device, hard):
    from faster_whisper import WhisperModel
    compute = "int8_float16" if device == "cuda" else "int8"
    print(f"🚀 faster-whisper · {model} · {device} · {compute}")
    m = WhisperModel(model, device=device, compute_type=compute)
    kw = dict(language=language, word_timestamps=True, temperature=0)
    if hard:
        # VAD + no cross-segment priming. NO repetition_penalty / no_repeat_ngram_size:
        # those hide the retakes and stammers that retakes.py needs to see (issue #126).
        kw.update(condition_on_previous_text=False, vad_filter=True,
                  vad_parameters=dict(min_silence_duration_ms=350, speech_pad_ms=200))
    segs_iter, info = m.transcribe(wav, **kw)
    segs = []
    for s in segs_iter:
        segs.append({"start": s.start, "end": s.end, "text": s.text,
                     "words": [{"word": w.word, "start": w.start, "end": w.end}
                               for w in (s.words or [])]})
    return segs, info.language


def run_openai_whisper(wav, language, model, hard):
    import whisper
    print(f"🐢 openai-whisper · {model} · cpu")
    m = whisper.load_model(model)
    kw = dict(language=language, word_timestamps=True, fp16=False, temperature=0)
    if hard:
        kw.update(condition_on_previous_text=False, no_speech_threshold=0.95)
    r = m.transcribe(wav, **kw)
    segs = [{"start": s["start"], "end": s["end"], "text": s["text"],
             "words": [{"word": w["word"], "start": w["start"], "end": w["end"]}
                       for w in s.get("words", [])]}
             for s in r["segments"]]
    return segs, r.get("language", language)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work")
    ap.add_argument("--language", default="ar")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--engine", default="auto", choices=["auto", "faster-whisper", "whisper"])
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--hard-dialect", action="store_true")
    ap.add_argument("--wav", help="alternate input file (default <work>/build/transcribe-input.wav)")
    ap.add_argument("--out", help="alternate output file (default <work>/build/transcript-raw.json)")
    args = ap.parse_args()

    W = os.path.abspath(args.work)
    os.makedirs(os.path.join(W, "build"), exist_ok=True)
    wav = os.path.abspath(args.wav) if args.wav else os.path.join(W, "build", "transcribe-input.wav")
    if not os.path.exists(wav):
        _sys.exit(f"❌ couldn't find {wav} — extract it first: ffmpeg -i <rush source> -vn -ac 1 -ar 16000 {wav}")

    lang = args.language.lower()
    hard = args.hard_dialect or lang in HARD_DIALECTS
    language = HARD_DIALECTS.get(lang, args.language)

    # model: --model if the caller set it explicitly, else transcribe.model from the
    # project config, else a per-dialect fine-tune (issue #126), else large-v3.
    model = args.model
    if model == "large-v3":
        cfg_model = None
        try:
            _sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from lib import config as _cfg
            cfg_model = (_cfg.load(W).get("transcribe", {}) or {}).get("model")
        except Exception:
            pass
        model = cfg_model or DIALECT_MODEL.get(lang) or "large-v3"

    if hard:
        print(f"⚠️  Hard dialect ({model}) — the automatic transcription is still likely wrong: "
              "Claude re-reads and corrects the whole transcript before captioning (SKILL.md step 5).")

    with wave.open(wav) as wf:
        dur = wf.getnframes() / wf.getframerate()
    print(f"audio {dur:.1f}s · language {language}")

    engine = args.engine
    if engine == "auto":
        engine = "faster-whisper" if have("faster_whisper") else "whisper"
    device = args.device
    if device == "auto":
        device = "cuda" if (engine == "faster-whisper" and cuda_available()) else "cpu"

    out = os.path.abspath(args.out) if args.out else os.path.join(W, "build", "transcript-raw.json")
    try:
        if engine == "faster-whisper":
            if not have("faster_whisper"):
                _sys.exit("❌ faster-whisper not installed — pip install faster-whisper")
            if device == "cuda":
                enable_cuda_libs()
            segs, detected = run_faster_whisper(wav, language, model, device, hard)
        else:
            if not have("whisper"):
                _sys.exit("❌ no engine installed — pip install faster-whisper  (or openai-whisper)")
            segs, detected = run_openai_whisper(wav, language, model, hard)
    except Exception as e:
        if engine == "faster-whisper" and have("whisper"):
            # openai-whisper can't load a local CTranslate2 dir (our darija fine-tune) or
            # any other CT2-only model id — fall back to the stock model by name.
            fallback_model = model if not os.path.isdir(model) else "large-v3"
            print(f"⚠️  faster-whisper failed ({e}) — trying openai-whisper ({fallback_model})…")
            segs, detected = run_openai_whisper(wav, language, fallback_model, hard)
        else:
            raise

    to_a_json(segs, detected, out)


if __name__ == "__main__":
    main()
