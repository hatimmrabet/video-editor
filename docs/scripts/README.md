# Script reference

One page per script. Each follows [`_template.md`](_template.md).

| Script | Engine | One-liner |
|---|---|---|
| [`setup.sh`](setup.md) | shared | check / install tools |
| [`lib/platform.sh` + `.js`](lib-platform.md) | shared | cross-platform helpers (paths, Chrome, OS) |
| [`lib/config.py` + `.js`](lib-config.md) | shared | `project.config.json` load/merge + legacy `theme.json` bridge |
| [`transcribe.py`](transcribe.md) | shared | speech → `a.json` (faster-whisper GPU/CPU ← whisper) |
| [`plan_cuts.py`](plan_cuts.md) | shared | detect silences → `cut.json` |
| [`captions.py`](captions.md) | shared | per-word caption timing → `caps.json` |
| [`edit_script.py`](edit_script.md) | shared | drop sentences from the transcript (+ video/audio/sfx) |
| [`reframe.py`](reframe.md) | shared | cut + 9:16 reframe + zoom + bt709 → `cutz.mp4` |
| [`sound_fx.py`](sound_fx.md) | shared | numpy-synthesized sound bed → `sfx.wav` |
| [`render_frames.js`](render_frames.md) | light | composite `compose.html` + frames → `out/*.jpg` |
| [`encode.sh`](encode.md) | light | mux frames + audio → `ad-final.mp4` |
| [`safe_check.js`](safe_check.md) | light | Instagram safe zone + hook check |
| [`master_audio.sh`](master_audio.md) | shared | −14 LUFS + optional ducked background audio |
| [`contact_sheet.sh`](contact_sheet.md) | shared | one contact sheet from N timestamps |
| [`subtitles.py`](subtitles.md) | shared | `caps.json` → `.srt` + `.txt` |
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
