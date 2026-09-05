/* Cross-platform helpers (macOS · Windows · Linux) shared by the Node scripts.
   No macOS behaviour changes: the paths and the Chrome launch stay identical on mac,
   the Windows/Linux branches are just added alongside. */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

/* A correct file:// URL on every OS (handles the Windows drive letter, spaces, ...). */
function fileUrl(p) {
  return pathToFileURL(path.resolve(p)).href;
}

/* Path to the **system** Chrome/Chromium executable (fallback only).
   The normal path: full `puppeteer` downloads its own Chromium via .puppeteerrc.cjs.
   1) $CHROME_PATH  2) per-OS candidates  3) null → the caller tries { channel: 'chrome' }. */
function chromeCandidates() {
  if (process.platform === 'darwin') return [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  if (process.platform === 'win32') {
    const pf = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'],
                process.env['LOCALAPPDATA']].filter(Boolean);
    return pf.map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
}

function chromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const c of chromeCandidates()) { try { if (fs.existsSync(c)) return c; } catch (_) {} }
  return null;   // null => the caller passes { channel: 'chrome' } to puppeteer
}

/* Is the full `puppeteer` package installed? (it bundles a matched Chromium) */
function hasFullPuppeteer() {
  for (const p of ['puppeteer',
                   path.join(process.cwd(), 'node_modules', 'puppeteer'),
                   path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')]) {
    try { require.resolve(p); return true; } catch (_) {}
  }
  return false;
}

/* Ready-to-use puppeteer launch options.
   - $CHROME_PATH set            → use it (explicit override)
   - full `puppeteer` present    → set nothing: it finds its bundled Chromium
   - `puppeteer-core` only        → system Chrome (path) or { channel: 'chrome' } */
function launchOptions(extra) {
  const base = {
    headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--font-render-hinting=none', '--force-color-profile=srgb'],
  };
  const envExe = process.env.CHROME_PATH;
  if (envExe && fs.existsSync(envExe)) {
    base.executablePath = envExe;
  } else if (!hasFullPuppeteer()) {
    const exe = chromePath();
    if (exe) base.executablePath = exe; else base.channel = 'chrome';
  }
  return Object.assign(base, extra || {});
}

/* The skill root — same arithmetic as VEVO_SKILL_DIR in platform.sh:
   scripts/lib/platform.js -> scripts/lib -> scripts -> root. */
function skillDir() {
  return path.join(__dirname, '..', '..');
}

function commandExists(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
    return true;
  } catch (_) { return false; }
}

/* Isolated Python interpreter — same logic as VEVO_PY in platform.sh:
   uv (skill project) > skill .venv > system python3 as a last resort.
   Returns [cmd, ...leadingArgs] to prefix to the real arguments:
     const c = pythonCmd(); execFileSync(c[0], [...c.slice(1), 'script.py', arg]) */
function pythonCmd() {
  const skill = skillDir();
  if (commandExists('uv')) return ['uv', 'run', '--project', skill, 'python'];
  const venvPy = process.platform === 'win32'
    ? path.join(skill, '.venv', 'Scripts', 'python.exe')
    : path.join(skill, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPy)) return [venvPy];
  return ['python3'];
}

/* Finds puppeteer (full, preferred) or puppeteer-core, wherever it's installed. */
function resolvePuppeteer() {
  const tries = [process.env.PUPPETEER_PATH,
                 'puppeteer', 'puppeteer-core',
                 path.join(process.cwd(), 'node_modules', 'puppeteer'),
                 path.join(process.cwd(), 'node_modules', 'puppeteer-core'),
                 path.join(__dirname, '..', '..', 'node_modules', 'puppeteer'),
                 path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-core')];
  for (const p of tries) {
    if (!p) continue;
    try { return require(p); } catch (_) {}
  }
  throw new Error('puppeteer not found — run: bash scripts/setup.sh --install  (or: npm ci)');
}

module.exports = { fileUrl, chromePath, launchOptions, resolvePuppeteer, hasFullPuppeteer, pythonCmd, skillDir };
