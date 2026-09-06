#!/usr/bin/env node
/* Doc-coverage check: every pipeline script has a reference page under docs/scripts/.
 *
 *   node docs/check-script-coverage.mjs
 *
 * Fails (exit 1) when a script under video-editor/scripts/ is not claimed by a
 * docs/scripts/ page, when a claimed page or script path is missing, or when a
 * docs/scripts/*.md page is an orphan (no script). Run it after adding a script
 * or renaming a page. No dependencies — pure Node.
 *
 * The rule this enforces is in CLAUDE.md: "a new script gets a docs/scripts/ page".
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'video-editor', 'scripts');
const PAGES = join(ROOT, 'docs', 'scripts');

/* Which docs/scripts/<page>.md covers which script path(s), relative to
 * video-editor/scripts/. A trailing "/" means "this whole subtree". Keep this
 * table in sync when you add a script or a page. */
const COVERAGE = [
  ['captions',            ['captions.py']],
  ['plan_cuts',           ['plan_cuts.py']],
  ['transcribe',          ['transcribe.py']],
  ['edit_script',         ['edit_script.py']],
  ['reframe',             ['reframe.py']],
  ['sound_fx',            ['sound_fx.py']],
  ['subtitles',           ['subtitles.py']],
  ['montage_mode',        ['montage_mode.py']],
  ['run',                 ['run.py']],
  ['join_takes',          ['join_takes.py']],
  ['tighten',             ['tighten.py']],
  ['assemble_longform',   ['assemble_longform.py']],
  ['lib-timeline',        ['lib/timeline.py']],
  ['render_frames',       ['render_frames.js']],
  ['safe_check',          ['safe_check.js']],
  ['encode',              ['encode.sh']],
  ['master_audio',        ['master_audio.sh']],
  ['contact_sheet',       ['contact_sheet.sh']],
  ['setup',               ['setup.sh']],
  ['lib-platform',        ['lib/platform.sh', 'lib/platform.js']],
  ['lib-config',          ['lib/config.py', 'lib/config.js']],
  ['lib-transitions',     ['lib/transitions.py', 'lib/transitions.js']],
  ['lib-scenes',          ['lib/scenes.py', 'lib/scenes.js']],
  ['lib-rush',            ['lib/rush.py']],
  ['motifs',              ['motifs/']],
  ['compose_html',        ['compose.reference.html']],
  ['studio_html',         ['studio.html']],
  ['fx-behind_text',      ['fx/behind_text.js']],
  ['fx-personmask',       ['fx/personmask.swift']],
  ['remotion-remotion_sh', ['remotion/remotion.sh']],
  ['remotion-template',   ['remotion/template/']],
];

/* Script files that are not stages and need no page of their own. */
const EXEMPT = new Set([
  'PIPELINE.md',          // thin pointer to docs/pipeline.md
]);

const SCRIPT_EXT = /\.(py|js|mjs|cjs|sh|html|swift|ts|tsx)$/;
const SKIP_DIR = new Set(['__pycache__', 'node_modules', '.venv', 'dist', 'build']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const errors = [];
const found = walk(SCRIPTS)
  .map((p) => relative(SCRIPTS, p).split('\\').join('/'))
  .filter((p) => SCRIPT_EXT.test(p) && !EXEMPT.has(p));

/* 1) every claimed page + script path exists; build the claim set */
const claimed = [];
for (const [page, targets] of COVERAGE) {
  if (!existsSync(join(PAGES, `${page}.md`)))
    errors.push(`page missing: docs/scripts/${page}.md (referenced by the coverage table)`);
  for (const t of targets) {
    if (!existsSync(join(SCRIPTS, t)))
      errors.push(`script path missing: video-editor/scripts/${t} (claimed by ${page}.md)`);
    claimed.push(t);
  }
}

/* 2) every script file on disk is claimed by exactly one entry */
for (const f of found) {
  const hits = claimed.filter((t) => (t.endsWith('/') ? f.startsWith(t) : f === t));
  if (hits.length === 0)
    errors.push(`undocumented script: video-editor/scripts/${f} — add a docs/scripts/ page and register it in the coverage table`);
  else if (hits.length > 1)
    errors.push(`script claimed by ${hits.length} entries: video-editor/scripts/${f}`);
}

/* 3) orphan pages: a docs/scripts/*.md with no entry in the table */
const NOT_A_SCRIPT_PAGE = new Set(['README.md', '_template.md']);
const pages = readdirSync(PAGES).filter((n) => n.endsWith('.md') && !NOT_A_SCRIPT_PAGE.has(n));
const tablePages = new Set(COVERAGE.map(([p]) => `${p}.md`));
for (const p of pages) {
  if (!tablePages.has(p))
    errors.push(`orphan page: docs/scripts/${p} — no script in the coverage table points to it`);
}

if (errors.length) {
  console.error('✗ doc coverage: ' + errors.length + ' problem(s)\n');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ doc coverage: ${found.length} script files → ${COVERAGE.length} reference pages, all accounted for`);
