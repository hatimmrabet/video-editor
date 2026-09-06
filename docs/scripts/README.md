# Script reference

One page per script. Each follows [`_template.md`](_template.md).

| Script | Engine | One-liner |
|---|---|---|
| [`run.py`](run.md) | shared | config-driven conductor — runs the stages below, pausing at decisions |
| [`join_takes.py`](join_takes.md) | long-form | join the `rush/` recording take(s) → `build/source-joined.mp4` |
| [`tighten.py`](tighten.md) | long-form | jump-cut + filler pass (word-level cuts from `captions.json`) |
| [`lib/timeline.py`](lib-timeline.md) | shared | timeline surgery shared by `edit_script.py` + `tighten.py` |
| [`setup.sh`](setup.md) | shared | check / install tools |
| [`lib/platform.sh` + `.js`](lib-platform.md) | shared | cross-platform helpers (paths, Chrome, OS) |
| [`lib/config.py` + `.js`](lib-config.md) | shared | `project.config.json` load/merge (no legacy bridge) |
| [`lib/transitions.py` + `.js`](lib-transitions.md) | shared | `scripts/transitions.json` — transition + easing vocabulary |
| [`lib/rush.py`](lib-rush.md) | shared | resolves the input file(s) in `rush/` without a fixed name |
| [`transcribe.py`](transcribe.md) | shared | speech → `build/transcript-raw.json` (faster-whisper GPU/CPU ← whisper) |
| [`plan_cuts.py`](plan_cuts.md) | shared | detect silences → `build/cut-plan.json` |
| [`captions.py`](captions.md) | shared | per-word caption timing → `build/captions.json` |
| [`edit_script.py`](edit_script.md) | shared | drop sentences from the transcript (+ video/audio/sfx) |
| [`reframe.py`](reframe.md) | shared | cut + 9:16 reframe + zoom + bt709 → `build/video-reframed.mp4` |
| [`sound_fx.py`](sound_fx.md) | shared | numpy-synthesized sound bed → `build/sound-effects.wav` |
| [`render_frames.js`](render_frames.md) | light | composite `compose.html` + frames → `build/frames-composited/*.jpg` |
| [`encode.sh`](encode.md) | light | mux frames + audio → `build/video-raw.mp4` |
| [`safe_check.js`](safe_check.md) | light | Instagram safe zone + hook check |
| [`master_audio.sh`](master_audio.md) | shared | −14 LUFS + optional ducked background audio |
| [`contact_sheet.sh`](contact_sheet.md) | shared | one contact sheet from N timestamps |
| [`subtitles.py`](subtitles.md) | shared | `build/captions.json` → `video-final.srt` + `post-caption.txt` |
| [`montage_mode.py`](montage_mode.md) | independent | folder of clips → one rhythmic montage |
| [`fx/behind_text.js`](fx-behind_text.md) | light (macOS) | person-cutout effects (behind / cutout / headout) |
| [`fx/personmask.swift`](fx-personmask.md) | light (macOS) | Vision person segmentation + face box |
| [`remotion/remotion.sh`](remotion-remotion_sh.md) | Remotion | scaffold / sync / studio / render |
| [Remotion template](remotion-template.md) | Remotion | the `src/*` files the engine renders |
| [`compose.reference.html`](compose_html.md) | light | the canvas drawing surface + `window.*` contract |
| [`studio.html`](studio_html.md) | light | standalone scrubber (third copy of the drawing code) |

For the order these run in and the files that flow between them, see
[../pipeline.md](../pipeline.md). For the JSON schemas, see
[../data-contracts.md](../data-contracts.md).

## Coverage

Every script under `video-editor/scripts/` must have a page here (CLAUDE.md rule). Verify
it with:

```
node docs/check-script-coverage.mjs
```

It fails if a script is undocumented, if a page is an orphan, or if the coverage table in
that script points at a path that no longer exists. Run it after adding or renaming a
script.
