# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""تفريغ الكلام بتوقيت كل كلمة → <work>/a.json  (نفس صيغة openai-whisper).

  python3 transcribe.py <work> [--language ar] [--model large-v3]
                               [--engine auto|faster-whisper|whisper]
                               [--device auto|cuda|cpu] [--hard-dialect]

يقرأ  : <work>/a.wav
يكتب  : <work>/a.json  = {"text":..., "segments":[{id,start,end,text,words:[{word,start,end}]}], "language":...}

المحرّكات (auto = يجرّب الأسرع أولاً):
  faster-whisper على GPU  ← الأسرع (يحتاج CUDA + الحزم nvidia-cublas-cu12 / nvidia-cudnn-cu12)
  faster-whisper على CPU  ← أسرع ~4× من openai-whisper، نفس الجودة
  openai-whisper على CPU  ← الاحتياطي

--hard-dialect : للدارجة المغربية والجزائرية… إلخ — يفعّل VAD + عقوبة التكرار + عتبة صمت أعلى،
                 ويطبع تحذيراً إن التفريغ التلقائي راح يحتاج تصحيحاً يدوياً.
"""
import argparse, importlib.util, json, os, wave


# ── دارجات صعبة على Whisper: نخفّضها لرمز ISO مقبول، ونشغّل وضع hard-dialect ──
HARD_DIALECTS = {
    "ar-ma": "ar", "ar-dz": "ar", "ar-tn": "ar", "ar-ly": "ar",
    "darija": "ar", "maghrebi": "ar", "moroccan": "ar",
}


def enable_cuda_libs():
    """يجعل مكتبات CUDA المثبّتة عبر pip مرئية لـCTranslate2 على ويندوز (ولا يضرّ غيره)."""
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
    print(f"✅ {out_path}  — {len(segs)} مقطع")


def run_faster_whisper(wav, language, model, device, hard):
    from faster_whisper import WhisperModel
    compute = "int8_float16" if device == "cuda" else "int8"
    print(f"🚀 faster-whisper · {model} · {device} · {compute}")
    m = WhisperModel(model, device=device, compute_type=compute)
    kw = dict(language=language, word_timestamps=True, temperature=0)
    if hard:
        kw.update(condition_on_previous_text=False, repetition_penalty=1.3,
                  no_repeat_ngram_size=3, vad_filter=True,
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
    ap.add_argument("--wav", help="ملف صوتي بديل (افتراضي <work>/a.wav)")
    ap.add_argument("--out", help="ملف خرج بديل (افتراضي <work>/a.json)")
    args = ap.parse_args()

    W = os.path.abspath(args.work)
    wav = os.path.abspath(args.wav) if args.wav else os.path.join(W, "a.wav")
    if not os.path.exists(wav):
        _sys.exit(f"❌ ما لقيت {wav} — استخرجه أول: ffmpeg -i src.mov -vn -ac 1 -ar 16000 a.wav")

    lang = args.language.lower()
    hard = args.hard_dialect or lang in HARD_DIALECTS
    language = HARD_DIALECTS.get(lang, args.language)
    if hard:
        print("⚠️  لهجة صعبة — التفريغ التلقائي غالباً غلط: اعرض النص على المستخدم وصحّحه قبل الكابشن.")

    with wave.open(wav) as wf:
        dur = wf.getnframes() / wf.getframerate()
    print(f"صوت {dur:.1f}s · لغة {language}")

    engine = args.engine
    if engine == "auto":
        engine = "faster-whisper" if have("faster_whisper") else "whisper"
    device = args.device
    if device == "auto":
        device = "cuda" if (engine == "faster-whisper" and cuda_available()) else "cpu"

    out = os.path.abspath(args.out) if args.out else os.path.join(W, "a.json")
    try:
        if engine == "faster-whisper":
            if not have("faster_whisper"):
                _sys.exit("❌ faster-whisper غير مثبّت — pip install faster-whisper")
            if device == "cuda":
                enable_cuda_libs()
            segs, detected = run_faster_whisper(wav, language, args.model, device, hard)
        else:
            if not have("whisper"):
                _sys.exit("❌ ولا محرّك مثبّت — pip install faster-whisper  (أو openai-whisper)")
            segs, detected = run_openai_whisper(wav, language, args.model, hard)
    except Exception as e:
        if engine == "faster-whisper" and have("whisper"):
            print(f"⚠️  faster-whisper فشل ({e}) — أجرّب openai-whisper…")
            segs, detected = run_openai_whisper(wav, language, args.model, hard)
        else:
            raise

    to_a_json(segs, detected, out)


if __name__ == "__main__":
    main()
