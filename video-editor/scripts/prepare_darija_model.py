# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""One-time setup for the darija Whisper fine-tune (issue #126). Run once per machine.

    uv sync --extra darija-convert         # pulls torch + transformers + peft (~1-2 GB,
                                            # build-time only — NOT part of the runtime venv)
    uv run scripts/prepare_darija_model.py         # downloads, merges, converts (~5-10 min, ~3 GB disk)
    uv run scripts/prepare_darija_model.py --force # redo even if already prepared

What it does: downloads openai/whisper-large-v3-turbo (~1.6 GB) + the anaszil/
whisper-large-v3-turbo-darija LoRA adapter (~55 MB, MIT), merges the adapter into the base
model, converts the result to a CTranslate2 int8 model, and writes it to
<skill>/.models/darija-large-v3-turbo-ct2/ (gitignored — this is a local machine asset,
not something to commit or publish).

Once this directory exists, transcribe.py picks it up automatically for `ar-ma` (no config
change needed) — see DIALECT_MODEL in transcribe.py. Nothing downloads at pipeline run
time; this script is the only place that touches the network for the model.

Why this model: on a 5-sentence spot-check against real darija audio (the
abnajlae/darija-asr-benchmark-6speaker set), it fixed several words large-v3 got wrong
(e.g. "خصني ندير" vs large-v3's "خسنين دير") while costing nothing to run (CPU int8, same
as large-v3 today). Reported WER 24.88% vs. large-v3's un-tuned darija performance, which
is well above that. Not perfect — Claude still corrects the transcript whole (SKILL.md
step 5) before captioning.

Everything here is 100% local once downloaded — no API, no account, no per-minute cost
(the alternative, a cloud transcriber, was ruled out for exactly that reason).
"""
import os
import shutil
import sys

SKILL_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SKILL_DIR, ".models", "darija-large-v3-turbo-ct2")
BASE = "openai/whisper-large-v3-turbo"
ADAPTER = "anaszil/whisper-large-v3-turbo-darija"
FORCE = "--force" in sys.argv


def have(mod):
    import importlib.util
    return importlib.util.find_spec(mod) is not None


def main():
    if os.path.isdir(OUT) and not FORCE:
        print(f"✅ already prepared: {OUT}\n   (--force to redo)")
        return

    missing = [m for m in ("torch", "transformers", "peft", "ctranslate2") if not have(m)]
    if missing:
        sys.exit("❌ missing: " + ", ".join(missing) +
                  "\n   run first: uv sync --extra darija-convert")

    import tempfile
    from transformers import WhisperForConditionalGeneration, WhisperProcessor
    from peft import PeftModel

    with tempfile.TemporaryDirectory(prefix="darija-merge-") as tmp:
        merged = os.path.join(tmp, "merged")
        print(f"downloading + loading base model ({BASE})…")
        model = WhisperForConditionalGeneration.from_pretrained(BASE)
        print(f"downloading + applying adapter ({ADAPTER})…")
        model = PeftModel.from_pretrained(model, ADAPTER)
        print("merging the adapter into the base weights…")
        model = model.merge_and_unload()
        model.save_pretrained(merged)
        # save_pretrained on the processor doesn't always write preprocessor_config.json
        # under that exact name in every transformers version — copy it from the base
        # model explicitly. Its feature_size (128 mel bins for large-v3 family) is what
        # ctranslate2 needs to build the right encoder; getting it wrong fails at
        # transcribe time with "Invalid input features shape".
        proc = WhisperProcessor.from_pretrained(BASE)
        proc.save_pretrained(merged)
        pre = os.path.join(merged, "preprocessor_config.json")
        if not os.path.exists(pre):
            from huggingface_hub import hf_hub_download
            shutil.copy(hf_hub_download(BASE, "preprocessor_config.json"), pre)

        print("converting to CTranslate2 (int8)…")
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        if os.path.isdir(OUT):
            shutil.rmtree(OUT)
        from ctranslate2.converters import TransformersConverter
        TransformersConverter(merged, copy_files=["tokenizer.json"]).convert(
            OUT, quantization="int8", force=True)
        shutil.copy(pre, os.path.join(OUT, "preprocessor_config.json"))

    print(f"✅ {OUT}")
    print("transcribe.py will use it automatically for language ar-ma / darija / moroccan.")


if __name__ == "__main__":
    main()
