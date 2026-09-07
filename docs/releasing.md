# Branching & releasing

Two long-lived branches, and a push to `main` publishes a release. No manual packaging.

## Branches

| Branch | Role |
|---|---|
| `develop` | **integration.** Every feature / fix / docs / chore branch is cut from here and merged back here (squash). This is where work lands day to day. |
| `main` | **the release line.** Only ever receives a `develop → main` PR. Every push to it is a release. |

Feature branch names are unchanged: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`,
`chore/<topic>` — off `develop`, PR into `develop`.

Historical note: before this doc, everything went straight to `main`. `main` still carries
the fork's line (reset to upstream v2.4 as the base for the rename + Passes 0–7); upstream
v2.5 stays on `majed-v2.5`.

## Cutting a release

1. Open a **`develop → main`** PR. Its diff is everything since the last release.
2. In that PR, bump [`/VERSION`](../VERSION) (semver, no `v` prefix — e.g. `0.2.0`).
3. Merge it (squash). The push to `main` triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml):
   - builds `video-editor.skill` — `git archive` of the tracked contents of `video-editor/`
     (so `SKILL.md` sits at the archive root; no `.venv`, no `node_modules`);
   - creates a GitHub Release **`v<VERSION>`** with the `.skill` attached and
     auto-generated notes.
4. **Idempotent.** If `v<VERSION>` already exists the job is a no-op — a `main` push that
   didn't bump `VERSION` (a hotfix straight to `main`, say) republishes nothing. To cut a
   release you *must* bump `VERSION`.

`workflow_dispatch` is enabled so a failed release run can be retried from the Actions tab.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every PR to `develop`
or `main` (and on pushes to both). It's the **lightweight gate** — no ffmpeg, no whisper,
no browser:

- `docs/check-script-coverage.mjs` — every script has a `docs/scripts/` page;
- `node --check` on every `.js` / `.cjs` / `.mjs`;
- `python -m compileall` on every `.py`;
- `bash -n` on every `.sh`;
- every `.json` parses;
- `npm ci` (no scripts) on `scripts/remotion/template/` — the `#45` lockfile stays valid.

**Not yet in CI:** the headless Puppeteer suite (`spatest` / `sndtest` / `lctest` / …).
Those tests currently live outside the repo; committing them as `video-editor/test/` with
a runner is the follow-up that unlocks a real end-to-end CI job.

## Versioning

Started at `0.1.0` — first packaged release under the renamed repo. Pre-1.0 while the big
in-flight items settle (scenes-as-data end to end, one real long-form run, a real Remotion
render). Bump the **minor** for a pass / feature set, the **patch** for fixes.
