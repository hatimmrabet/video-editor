# `<script name>`

`video-editor/scripts/<path>` · language · engine (shared / light / Remotion / independent / macOS)

> One-paragraph purpose: what it does and why it exists.

## CLI

```
<invocation> <work> [subcommand] [args]
```

| Command / flag | Effect |
|---|---|
| … | … |

Exit codes (if non-trivial): …

## Inputs

| File (in `<work>`) | Shape | Required |
|---|---|---|
| … | … | … |

## Outputs

| File | Shape |
|---|---|
| … | … |

## External tools

`ffmpeg` / `ffprobe` / `whisper` / `node` / `uv` (`"${VEVO_PY[@]}"`) / bundled Chromium / `swiftc` / …

## Cross-platform

How it uses `lib/platform.sh` or `lib/platform.js`; any Windows-specific concern
(path handling, bash-only constructs, macOS-only). See [../windows.md](../windows.md).

## Place in the flow

Invoked by: the skill (stage N) / another script / manually. What must run before, what
runs after.

## Gotchas

- …
