/* Shared transition + easing vocabulary — JS side.

   Not a mirror reimplementation of lib/transitions.py: it calls Python once and parses the
   JSON, same as lib/config.js. One resolver to maintain, not two. Python is already a hard
   dependency of the pipeline, so this adds nothing new.

   The browser engines (compose.html / studio.html) can't shell out — they read the
   injected table and only ever deal with the object form of a spec, so they don't need
   the shorthand parser. Full explanation: docs/design/transitions.md. */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { pythonCmd } = require('./platform');

const _script = path.join(__dirname, 'transitions.py');

function _py(args) {
  const cmd = pythonCmd();
  const out = execFileSync(cmd[0], [...cmd.slice(1), _script, ...args], { encoding: 'utf-8' });
  return JSON.parse(out);
}

/* The whole scripts/transitions.json. */
function load() {
  return _py([]);
}

/* A full { type, duration, easing, params } (+ sfx if set).
   spec: shorthand string, plain object, or null. kind: sceneToScene | sceneEnter |
   sceneExit | outro | montage. */
function resolve(spec, kind) {
  const args = [kind];
  if (spec !== null && spec !== undefined) {
    args.push(typeof spec === 'string' ? spec : JSON.stringify(spec));
  }
  return _py(args);
}

module.exports = { load, resolve };
