# PIPELINE

Moved to [`../../docs/pipeline.md`](../../docs/pipeline.md) — the full stage order, a
mermaid diagram of both modes, and the data files that flow between stages.

Quick reference (speech-ad mode): `setup.sh` → `plan_cuts.py` → extract
`build/transcribe-input.wav` → `transcribe.py` → correct `build/transcript-fixes.json` →
`captions.py` → `edit_script.py` → `reframe.py` → extract `build/frames-source/` → design
scenes → `fx/behind_text.js` (macOS) → `sound_fx.py` → `render_frames.js` + `encode.sh`
(or `remotion/remotion.sh render`) → `safe_check.js` → `master_audio.sh` → `subtitles.py`.

Montage mode: `montage_mode.py <work> scan [dir] → sheet → drop/keep → plan → build`
(`scan` defaults to `<work>/rush`), then `master_audio.sh`.
