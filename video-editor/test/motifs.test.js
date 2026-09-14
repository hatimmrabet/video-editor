/* The motif registry must stay consistent with the Remotion components that implement it.
   The old canvas pixel test ("does it actually draw?") went away with the light engine —
   that depth now lives in `remotion.sh <work> check` (tsc --noEmit), which needs the ~500 MB
   toolchain and so cannot run in this job. What IS checked here is the drift that actually
   bit us: a motif declared in index.json but never imported or dispatched, a component file
   with no registry entry, or a params block that no longer matches the component's type. */
const fs = require("fs"), path = require("path");
const T = require("./_lib");

const M = path.join(T.SCRIPTS, "motifs");
const idx = JSON.parse(fs.readFileSync(path.join(M, "index.json"), "utf8")).motifs;
const list = path.join(T.SCRIPTS, "remotion", "template", "src", "SceneList.tsx");
const src = fs.readFileSync(list, "utf8");

/* `stamp: Stamp, 'card-stack': CardStack, ...` inside the MOTIFS map */
const map = {};
const body = (src.match(/const MOTIFS[^{]*\{([\s\S]*?)\n\};/) || [, ""])[1];
for (const m of body.matchAll(/'?([\w-]+)'?\s*:\s*(\w+)/g)) map[m[1]] = m[2];
const imports = new Set([...src.matchAll(/import\s+(\w+)\s+from\s+'\.\/motifs\/(\w+)'/g)].map(m => m[1] + ":" + m[2]));

T.node("motifs", ({ check }) => {
  const implemented = Object.entries(idx).filter(([, d]) => d.status === "implemented");
  check(`${implemented.length} implemented motif(s) in index.json`, implemented.length > 0);

  for (const [name, def] of implemented) {
    const comp = map[name];
    if (!check(`${name.padEnd(18)} dispatched by SceneList`, !!comp)) continue;
    check(`${name.padEnd(18)} imported as ${comp}`, imports.has(comp + ":" + comp));

    const file = path.join(M, "remotion", comp + ".tsx");
    if (!check(`${name.padEnd(18)} has motifs/remotion/${comp}.tsx`, fs.existsSync(file))) continue;

    /* Every param declared in the registry must appear in the component's type. Two
       conventions are in use across the motifs: a standalone `type Params = {...}` and an
       inline `params: {...}` inside `type Props` — accept either. */
    const tsx = fs.readFileSync(file, "utf8")
      // strip comments first: the doc header also spells out `params: { a, b }`, which is
      // prose, not a type, and would otherwise be picked up instead of the real declaration.
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const at = tsx.search(/type Params\s*=\s*\{|params\??\s*:\s*\{/);
    const block = at < 0 ? "" : (() => {          // balance braces from the opening one
      let i = tsx.indexOf("{", at), d = 0;
      for (let j = i; j < tsx.length; j++) {
        if (tsx[j] === "{") d++;
        else if (tsx[j] === "}" && --d === 0) return tsx.slice(i + 1, j);
      }
      return "";
    })();
    const declared = new Set([...block.matchAll(/([A-Za-z_$][\w$]*)\??\s*:/g)].map(m => m[1]));
    const missing = Object.keys(def.params || {}).filter(k => !declared.has(k));
    check(`${name.padEnd(18)} params match its declared type`, missing.length === 0,
      missing.length ? "not in the params type: " + missing.join(", ") : "");

    check(`${name.padEnd(18)} default-exports its component`, /export default \w+/.test(tsx));
  }

  /* no orphan component: every .tsx on disk is in the registry */
  const onDisk = fs.readdirSync(path.join(M, "remotion")).filter(f => f.endsWith(".tsx"))
    .map(f => f.replace(/\.tsx$/, ""));
  const registered = new Set(Object.values(map));
  const orphans = onDisk.filter(c => !registered.has(c));
  check("no orphan component in motifs/remotion/", orphans.length === 0, orphans.join(", "));
});
