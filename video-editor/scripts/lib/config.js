/* project.config.json — on the JS side this is not a mirror reimplementation of
   lib/config.py: it calls Python (once per run, negligible next to the rest of the
   pipeline) and parses the JSON it prints. One merge logic to maintain, not two. Python is
   a hard dependency of the pipeline anyway (transcribe.py, plan_cuts.py, ...), so this
   adds nothing new. Full schema: docs/design/project-config.md. */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { pythonCmd } = require('./platform');

/* The merged config: defaults.config.json (skill) <- project.config.json (project) —
   computed by lib/config.py, not recomputed here. */
function load(work) {
  const cmd = pythonCmd();
  const script = path.join(__dirname, 'config.py');
  const out = execFileSync(cmd[0], [...cmd.slice(1), script, path.resolve(work)], { encoding: 'utf-8' });
  return JSON.parse(out);
}

module.exports = { load };
