/* Helpers multiplateforme (macOS · Windows · Linux) partagés par les scripts Node.
   Aucun comportement macOS n'est modifié : les chemins et le lancement de Chrome
   restent identiques sur mac, on ajoute juste les branches Windows/Linux. */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

/* URL file:// correcte sur tous les OS (gère la lettre de lecteur Windows, les espaces…). */
function fileUrl(p) {
  return pathToFileURL(path.resolve(p)).href;
}

/* Chemin de l'exécutable Chrome/Chromium.
   1) $CHROME_PATH  2) candidats par OS  3) sinon on laisse puppeteer décider (channel: 'chrome'). */
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
  return null;   // null => l'appelant passe { channel: 'chrome' } à puppeteer
}

/* Options de lancement puppeteer prêtes à l'emploi (executablePath ou channel). */
function launchOptions(extra) {
  const exe = chromePath();
  const base = {
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--font-render-hinting=none', '--force-color-profile=srgb'],
  };
  if (exe) base.executablePath = exe; else base.channel = 'chrome';
  return Object.assign(base, extra || {});
}

/* Trouve puppeteer-core où qu'il soit installé. */
function resolvePuppeteer() {
  const tries = [process.env.PUPPETEER_PATH, 'puppeteer-core', 'puppeteer',
                 path.join(process.cwd(), 'node_modules', 'puppeteer-core'),
                 path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-core')];
  for (const p of tries) {
    if (!p) continue;
    try { return require(p); } catch (_) {}
  }
  throw new Error('puppeteer-core introuvable — installe-le : npm i puppeteer-core');
}

module.exports = { fileUrl, chromePath, launchOptions, resolvePuppeteer };
