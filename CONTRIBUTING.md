# Contributing

Origin and history: [`FORK.md`](FORK.md).

## Where things are

- **Code:** `video-editor/scripts/` — see [`docs/scripts/`](docs/scripts/) for a page per script.
- **How it fits together:** [`docs/architecture.md`](docs/architecture.md),
  [`docs/pipeline.md`](docs/pipeline.md), [`docs/engines.md`](docs/engines.md).
- **JSON schemas:** [`docs/data-contracts.md`](docs/data-contracts.md).
- **Rules you must not break:** [`docs/invariants.md`](docs/invariants.md) — read this
  before touching either rendering engine.
- **Where the project is going:** [`docs/design/`](docs/design/).
- **The skill itself:** `video-editor/SKILL.md` — the operational source of truth.

## Picking up work

Work is tracked in **GitHub Issues + Projects** — see
[`docs/project-tracking.md`](docs/project-tracking.md). Each roadmap pass is a milestone.
Comment on an issue before starting it.

## Branches

- Branch off `main` (or off the current feature branch if the work stacks on unmerged work).
- Naming: `docs/<topic>`, `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- One PR per issue or per coherent group. Keep the PR description pointing at the issue.

## Ground rules

- **Don't break macOS.** The cross-platform layer adds Windows/Linux branches without
  changing macOS behavior — keep it that way.
- **Cross-platform hygiene:** shell scripts source `lib/platform.sh` and resolve the work
  dir through `vevo_abspath`; Node scripts use `lib/platform.js` for paths and Chrome;
  Python scripts keep the UTF-8 reconfigure header. See [`docs/windows.md`](docs/windows.md).
- **No `drawtext`** in any new script (invariant #9) — burn labels with PIL.
- **No hardcoded colors** in scene code — everything derives from the theme (invariant #3).
- **Docs live with the change.** If you add a script, add its `docs/scripts/` page. If you
  change a JSON shape, update `docs/data-contracts.md`.

## Commit messages

- Conventional prefixes (`docs:`, `feat:`, `fix:`, `chore:`, `refactor:`).
- English or French for new commits.
