# `lint_compose.js`

`video-editor/scripts/lint_compose.js` · node · pre-render static check (no deps)

> A full `render_frames.js all` pass is ~12 min. The only validation of a hand-edited
> `<work>/compose.html` today happens **at render time**, inside `safe()`
> ([invariants #1 / #2](../invariants.md)): a scene calling a deleted function or an
> out-of-range sentence index is silently skipped and logged once — found only after
> watching the render. This reads (never executes) `compose.html` and catches the common
> mistakes in well under a second. Advisory tooling — `safe()` stays the runtime backstop.

## CLI

```
node scripts/lint_compose.js <work>
```

| Exit code | Meaning |
|---|---|
| 0 | clean, or warnings only |
| 2 | at least one **error** — fix before `render_frames.js all`, or bad usage / missing input |

## Inputs (in `<work>`)

| File | Role | Required |
|---|---|---|
| `compose.html` | the file under test (read as text, never run) | yes |
| `build/captions.json` | `cards.length` + `total` — for the range / coverage checks | yes |
| `build/person-cutout.json` | `lines` / `cutouts` / `headouts` time spans — for check D | optional |
| `config/scenes.json` | if present, the render is **data-driven** and `compose.html`'s scene wiring is bypassed — checks B and D are skipped, a note is printed | optional |

## Checks

| | What | Severity |
|---|---|---|
| **A** | every `wordsOf(N)` literal is a real caption card (`0 ≤ N < cards.length`) — an out-of-range index returns `[]`, so the scene renders empty | error |
| **B** | the inline `SCENES` array is sorted, gap-free, non-overlapping, starts at `0`, reaches `caps.total`, and every `m:` names a rect defined in the file. A gap makes `vtarget()` fall back to the last entry silently | error |
| **C** | every `['name', fn]` pair in `draw()`'s scene dispatch names a function defined in `compose.html` — an undefined one is a `ReferenceError` that kills the whole render (invariant #2's failure mode, caught before the render rather than by its runtime guard) | error |
| **D** | every `build/person-cutout.json` range sits inside a full-screen (`R_FULL`) `SCENES` span — `behindText()` bails when `!isFull`, so a behind-text moment during `R_DOWN` just doesn't show ([`compose.reference.html`](compose_html.md)) | warning |

Comments in `compose.html` are stripped before matching, so a commented-out line never
trips a check.

## External tools

`node` only. No `puppeteer`, no dependencies — same spirit as
[`docs/check-script-coverage.mjs`](../check-script-coverage.mjs).

## Cross-platform

Pure string/regex analysis — runs anywhere `node` does.

## Place in the flow

Optional, between scene design (stage 7) and `render_frames.js all` (stage 9a). Run it
after every edit to `compose.html`; it costs nothing and a caught error saves a 12-minute
render.

## Gotchas

- It does **not** run `compose.html` — a scene that draws garbage but parses fine passes.
  Review one `contact_sheet.sh` image after the render as before.
- Check C matches the reference's `[['name',fn], …].forEach` dispatch shape. If you
  restructure that block, check C prints a warning that it was skipped rather than a false
  pass.
- The `SCENES` parse expects the hand-authored `{s:…, e:…, m:…}` entry shape. The
  runtime-rebuilt form (`config/scenes.json` → `d.schedule`) is a different path and is
  skipped (check B only runs when `config/scenes.json` is absent).
