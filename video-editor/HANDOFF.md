# HANDOFF — video-editor

> 🍴 Fork of **[majedphotos/video-ad-editor](https://github.com/majedphotos/video-ad-editor)**
> (MIT, © Majed Alzaabi). Fork-specific changes and the roadmap live in
> [`../FORK.md`](../FORK.md).

This file used to carry the full architecture, the bug history and the "what's next" list.
That content has moved:

| Was here | Now |
|---|---|
| Architecture, pipeline, engine internals | [`../docs/`](../docs/) |
| "العلل العشر" — the ten bugs found in real runs | [`../docs/invariants.md`](../docs/invariants.md) |
| Data-file schemas | [`../docs/data-contracts.md`](../docs/data-contracts.md) |
| "المطلوب بعدها" — the next-work list | [`../docs/project-tracking.md`](../docs/project-tracking.md) → GitHub Issues |
| Roadmap | [`../docs/design/roadmap.md`](../docs/design/roadmap.md) |

The operational source of truth for running the skill is [`SKILL.md`](SKILL.md) (Arabic).

## Current status

- **Skill is production-ready.** A real 4K video has gone through the whole pipeline
  (76 s 4K → 48.7 s ad); final safe-zone check all green; audio −14.0 LUFS / −1.6 dBTP.
- **Cross-platform pass done** (branch `feature/windows-i18n-rename`, not yet merged to
  `main`): macOS · Windows (Git-Bash) · Linux; `transcribe.py` (faster-whisper GPU);
  landscape → 9:16; scripts renamed. See [`../FORK.md`](../FORK.md).
- **Documentation pass** (this: `../docs/`) in progress on branch
  `docs/cartography-architecture`.
- **Nothing has been published.** Delivery is a file only.
- **Montage mode works** (speechless clips) — tested on synthetic clips, still needs a
  real varied set.

## Pointers

- Full script list + one page each: [`../docs/scripts/`](../docs/scripts/)
- How the stages connect: [`../docs/pipeline.md`](../docs/pipeline.md)
- Windows gotchas: [`../docs/windows.md`](../docs/windows.md)
- Upstream on GitHub: <https://github.com/majedphotos/video-ad-editor>
