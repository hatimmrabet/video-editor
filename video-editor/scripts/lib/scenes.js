/* config/scenes.json — JS side. Shells out to lib/scenes.py (same as lib/config.js /
   lib/transitions.js — one resolver to maintain). Returns { scenes, schedule }. */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { pythonCmd } = require('./platform');

function load(work) {
  const cmd = pythonCmd();
  const script = path.join(__dirname, 'scenes.py');
  const out = execFileSync(cmd[0], [...cmd.slice(1), script, path.resolve(work)], { encoding: 'utf-8' });
  return JSON.parse(out);
}

module.exports = { load };
