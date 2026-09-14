/* Cross-platform helpers (Windows · Linux) shared by the Node scripts. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* The skill root — same arithmetic as VEVO_SKILL_DIR in platform.sh:
   scripts/lib/platform.js -> scripts/lib -> scripts -> root. */
function skillDir() {
  return path.join(__dirname, '..', '..');
}

/* ffmpeg / ffprobe — honour $VEVO_FFMPEG / $VEVO_FFPROBE (same names platform.sh exports),
   else the bare name (PATH resolves it). Issue #44. */
function ffmpegPath()  { return process.env.VEVO_FFMPEG  || 'ffmpeg'; }
function ffprobePath() { return process.env.VEVO_FFPROBE || 'ffprobe'; }

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

module.exports = { pythonCmd, skillDir, ffmpegPath, ffprobePath };
