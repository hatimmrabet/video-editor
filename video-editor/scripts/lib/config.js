/* project.config.json — côté JS, ce n'est plus une réimplémentation miroir de lib/config.py :
   ça appelle Python (une seule fois par run, coût négligeable face au reste du pipeline) et
   parse sa sortie JSON. Une seule logique de fusion à maintenir, pas deux. Python est de
   toute façon déjà requis par le reste du pipeline (transcribe.py, plan_cuts.py, …) — ça
   n'ajoute pas une dépendance qui n'existait pas.
   Schéma complet : docs/design/project-config.md. */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { pythonCmd } = require('./platform');

/* Renvoie la config fusionnée : defaults.config.json (skill) <- project.config.json
   (projet) — calculé par lib/config.py, pas recopié ici. */
function load(work) {
  const cmd = pythonCmd();
  const script = path.join(__dirname, 'config.py');
  const out = execFileSync(cmd[0], [...cmd.slice(1), script, path.resolve(work)], { encoding: 'utf-8' });
  return JSON.parse(out);
}

module.exports = { load };
