# video-editor — a Claude Code skill

**Record yourself talking. Get back a vertical 9:16 ad, ready to publish.** No editing
app, and your video is never uploaded to any server — everything runs on your machine.

![a frame from an ad produced by the skill](video-editor/img/behind.jpg)

## What it does

- **Removes the silences** — the video shrinks to roughly half and picks up pace
- **Word-synced captions** — it knows the start and end of every word, not an approximation
- **Motion graphics from your speech** — say a number, a counter rolls; list things, cards fly in
- **Speech passing behind you** — a word is stretched with the Arabic kashida to the exact
  width of your body, so the elongation alone disappears behind you and the letters stay
  readable *(macOS only)*
- **Delete any sentence from the text** — it drops out of the video, audio and captions, and
  everything after it shifts back
- **Repeated-sentence detector** — when you rephrase a sentence, it suggests dropping the first
- **Platform-loudness audio** (−14 LUFS) + optional background audio that ducks under speech
- **Safe-zone check** — verifies no text hides under Instagram's buttons
- **An `.srt` subtitle file + your full transcript** ready for the post caption

A second, independent **montage mode** takes a folder of speechless clips and cuts them
into one rhythmic montage, picking the best moment of each clip.

The captions, end card and trigger phrases are currently **Arabic**. Multi-language output
is on the [roadmap](docs/design/roadmap.md).

---

## Install

The skill is the `video-editor/` folder in this repo — it contains `SKILL.md` plus the
`scripts/`. Claude Code loads a skill from `SKILL.md` inside a directory under a skills
path.

### Option A — from a release

If a `video-ad-editor.skill` package is attached to a [Release](../../releases),
double-click it and approve the install when Claude asks. No package is published yet —
until then, use Option B or C.

### Option B — manual copy

Clone the repo and copy the skill folder into your personal skills directory:

```bash
# macOS / Linux
git clone https://github.com/hatimmrabet/video-editor.git
cp -r video-editor/video-editor ~/.claude/skills/video-ad-editor
```

```powershell
# Windows (PowerShell)
git clone https://github.com/hatimmrabet/video-editor.git
Copy-Item -Recurse video-editor\video-editor $env:USERPROFILE\.claude\skills\video-ad-editor
```

Resulting path: `~/.claude/skills/video-ad-editor/SKILL.md`.

### Option C — you forked the repo and want live edits

Symlink your working copy into the skills directory, so every change you make to
`SKILL.md` or the scripts is picked up on the next Claude Code session — no re-copy.

```bash
# macOS / Linux — from the repo root
ln -s "$(pwd)/video-editor" ~/.claude/skills/video-ad-editor
```

```powershell
# Windows (PowerShell, as admin or with Developer Mode on) — from the repo root
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\video-ad-editor" `
  -Target "$(Get-Location)\video-editor"
```

**Project-scoped instead of personal:** put the link (or copy) under `.claude/skills/` in a
specific project's directory rather than `~/.claude/skills/` — the skill is then only
available in that project.

Verify Claude Code sees it: run `/help` or start a session and check the skill appears, or
just type a trigger phrase (below).

### First run

`bash video-editor/scripts/setup.sh` checks for the tools it needs (ffmpeg, Node,
puppeteer-core, a Whisper engine, Chrome) — or the skill runs it for you and asks before
installing anything.

---

## Usage

Open Claude Code and type:

> **منتج هذا المقطع**  *("edit this clip into an ad")*

It asks for your video. Other phrasings work too: «سو من هذا الفيديو إعلان» ·
«شيّل السكتات» · «حوّل الفيديو لريل» · «ركّب كابشن عربي».

📘 **[Full guide (Arabic, PDF — 13 pages)](video-editor/GUIDE.pdf)** — in plain language,
with no command you type yourself.

## Requirements

The skill installs these for you after your approval:

| Tool | For |
|---|---|
| ffmpeg | cutting, assembling, audio |
| faster-whisper *(or openai-whisper)* | word-timed transcription — on GPU if available |
| Chrome + puppeteer-core | drawing the scenes |
| nvidia-cublas-cu12 / nvidia-cudnn-cu12 *(optional)* | GPU transcription (NVIDIA) |
| Xcode CLT *(optional, macOS only)* | the "speech behind the person" effect |
| Remotion *(optional)* | a live timeline editing screen |

Runs on **macOS · Windows (Git-Bash / WSL) · Linux**. See
[`docs/windows.md`](docs/windows.md) for Windows notes.

## Privacy

Everything is local. **Your video is never uploaded** — not to us, not to anyone.

## Documentation

- **[`docs/`](docs/)** — technical reference: a page per script, data flow, the two
  rendering engines, the invariants, and the target architecture.
- **[`FORK.md`](FORK.md)** — origin and what has changed here.
- **[`CONTRIBUTING.md`](CONTRIBUTING.md)** — where things live, how work is tracked.

## License

MIT — use it, modify it, distribute it freely.
