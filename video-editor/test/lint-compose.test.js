/* scripts/lint_compose.js (#53) — static checks on a hand-authored compose.html. */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const T = require("./_lib");

const LINT = path.join(T.SCRIPTS, "lint_compose.js");
const REF = fs.readFileSync(path.join(T.SCRIPTS, "compose.reference.html"), "utf8");

const mk = (name, files) => { const W = T.tmp("lc-" + name); T.writeFiles(W, files); return W; };
const run = W => {
  try { return { code: 0, out: execFileSync("node", [LINT, W], { encoding: "utf8" }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || "") + (e.stderr || "") }; }
};

const caps = { total: 42, cards: [
  { s: 0.2, e: 3, w: [{ t: "a", s: .2, e: 1 }] },
  { s: 3.3, e: 8, w: [{ t: "b", s: 3.4, e: 4 }, { t: "c", s: 4, e: 5 }, { t: "d", s: 5, e: 6 }, { t: "e", s: 6, e: 7 }] },
  { s: 8, e: 11, w: [{ t: "f", s: 8.1, e: 9 }] },
  { s: 11.5, e: 15, w: [{ t: "g", s: 11.6, e: 12 }, { t: "h", s: 12, e: 13 }] },
  { s: 15, e: 42, w: [{ t: "i", s: 15.1, e: 20 }] },
] };

T.node("lint-compose", async ({ check }) => {
  let W = mk("clean", { "compose.html": REF, "build/captions.json": caps });
  let r = run(W);
  check("reference lints clean, exit 0", (r.code === 0 || r.code === undefined) && !/✗/.test(r.out), r.out);

  r = run(mk("wordsOf", { "compose.html": REF.replace("wordsOf(3)", "wordsOf(9)"), "build/captions.json": caps }));
  check("wordsOf(9) → error + exit 2", r.code === 2 && /wordsOf\(9\)/.test(r.out), r.out);

  r = run(mk("gap", { "compose.html": REF.replace("{s:8.00,e:11.45,m:R_FULL}", "{s:8.00,e:10.00,m:R_FULL}"), "build/captions.json": caps }));
  check("SCENES gap → error + exit 2", r.code === 2 && /gap in SCENES/.test(r.out), r.out);

  r = run(mk("ghost", { "compose.html": REF.replace("[['stamp',stamp],", "[['stamp',stamp],['ghost',ghost],"), "build/captions.json": caps }));
  check("undefined dispatch fn → error + exit 2", r.code === 2 && /"ghost"|`ghost`/.test(r.out), r.out);

  r = run(mk("behind", { "compose.html": REF, "build/captions.json": caps,
    "build/person-cutout.json": { lines: [{ card: 1, s: 4.0, e: 6.5, words: [] }], ranges: [], faces: {} } }));
  check("behind-text on an R_DOWN scene → warning, exit 0",
    (r.code === 0 || r.code === undefined) && /won't render there|behindText\(\) bails/.test(r.out), r.out);

  r = run(mk("data", { "compose.html": REF, "build/captions.json": caps, "config/scenes.json": [{ ref: { sentence: 0 }, layout: "FULL" }] }));
  check("config/scenes.json present → note, exit 0", (r.code === 0 || r.code === undefined) && /data-driven/.test(r.out), r.out);

  r = run(mk("nocompose", { "build/captions.json": caps }));
  check("missing compose.html → exit 2", r.code === 2 && /no .*compose\.html/.test(r.out), r.out);
});
