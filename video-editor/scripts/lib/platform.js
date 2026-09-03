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

/* Chemin de l'exécutable Chrome/Chromium **du système** (repli seulement).
   Le chemin normal : `puppeteer` (complet) télécharge son propre Chromium via .puppeteerrc.cjs.
   1) $CHROME_PATH  2) candidats par OS  3) null → l'appelant tente { channel: 'chrome' }. */
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

/* Le paquet `puppeteer` complet est-il installé ? (il embarque un Chromium apparié) */
function hasFullPuppeteer() {
  for (const p of ['puppeteer',
                   path.join(process.cwd(), 'node_modules', 'puppeteer'),
                   path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')]) {
    try { require.resolve(p); return true; } catch (_) {}
  }
  return false;
}

/* Options de lancement puppeteer prêtes à l'emploi.
   - $CHROME_PATH fixé            → on l'utilise (override explicite)
   - `puppeteer` complet présent  → on ne fixe rien : il trouve son Chromium embarqué
   - `puppeteer-core` seul        → Chrome système (chemin) ou { channel: 'chrome' } */
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

/* Trouve puppeteer (complet, préféré) ou puppeteer-core, où qu'il soit installé. */
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
  throw new Error('puppeteer introuvable — lance : bash scripts/setup.sh --install  (ou : npm ci)');
}

module.exports = { fileUrl, chromePath, launchOptions, resolvePuppeteer, hasFullPuppeteer };
