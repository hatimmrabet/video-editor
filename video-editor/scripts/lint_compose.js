/* ═══ Static pre-render check for <work>/compose.html ═══
   node scripts/lint_compose.js <work>

   A full `render_frames.js all` pass is ~12 minutes. Today the only validation of a
   hand-edited compose.html happens at render time, inside safe() (invariants #1/#2): a
   scene calling a deleted function or an out-of-range sentence index is silently skipped
   and logged once — found only after watching the render. This catches the common
   mistakes in well under a second, before that time is spent.

   Pure Node, no dependencies (same spirit as docs/check-script-coverage.mjs). It reads —
   never executes — compose.html. safe() stays the runtime backstop regardless; this is
   advisory tooling, not a new invariant.

   Checks (hand-authored path — skipped when config/scenes.json drives the render):
     A  wordsOf(N)     every literal index is a real caption card in build/captions.json
     B  SCENES         sorted, gap-free, non-overlapping, starts at 0, covers caps.total,
                       every `m:` names a rect defined in the file
     C  draw() dispatch every ['name', fn] pair names a function defined in the file
                       (an undefined one is a ReferenceError that kills the whole render)
     D  behind moments  every build/person-cutout.json range sits in a full-screen SCENE
                       (behindText() bails when !isFull — the effect just doesn't show)

   Exit: 2 if any error-level finding, 0 otherwise (warnings don't fail the run). */
"use strict";
const fs = require("fs"), path = require("path");

const work = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(work)) {
  console.error("usage: node scripts/lint_compose.js <work>");
  process.exit(2);
}
const P = rel => path.join(work, rel);
const readJSON = rel => { try { return JSON.parse(fs.readFileSync(P(rel), "utf8")); } catch (e) { return null; } };

const composePath = P("compose.html");
if (!fs.existsSync(composePath)) {
  console.error("✗ no " + composePath + " — design the scenes first (copy compose.reference.html).");
  process.exit(2);
}
const src = fs.readFileSync(composePath, "utf8");
const caps = readJSON("build/captions.json");
if (!caps || !Array.isArray(caps.cards)) {
  console.error("✗ no readable build/captions.json — run the captions stage first.");
  process.exit(2);
}
const nCards = caps.cards.length;
const total = typeof caps.total === "number" ? caps.total : null;
const behind = readJSON("build/person-cutout.json");
const dataDriven = fs.existsSync(P("config/scenes.json"));

const findings = [];
const err = msg => findings.push({ sev: "error", msg });
const warn = msg => findings.push({ sev: "warn", msg });

/* strip /* *​/ and // comments so a commented-out line never trips a check (crude but safe:
   compose.html has no regex literals or strings that look like comment openers) */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const defined = name =>
  new RegExp("(?:function|const|let|var)\\s+" + name + "\\b").test(code) ||
  new RegExp("\\b" + name + "\\s*=\\s*(?:function|\\()").test(code) ||
  new RegExp("\\b" + name + "\\s*=>\\s*").test(code) ||
  new RegExp("\\b" + name + "\\s*:\\s*(?:function|\\()").test(code);   // object-literal method (rare)

/* ── A. wordsOf(N) in range ───────────────────────────────────────────── */
const seenIdx = new Set();
for (const m of code.matchAll(/\bwordsOf\(\s*(\d+)\s*\)/g)) {
  const i = +m[1];
  if (seenIdx.has(i)) continue;
  seenIdx.add(i);
  if (i >= nCards)
    err(`wordsOf(${i}) — build/captions.json has ${nCards} sentence(s) (0..${nCards - 1}); this scene renders empty`);
}

/* ── B / D need the inline SCENES array ───────────────────────────────── */
if (dataDriven) {
  console.log("· config/scenes.json present — the render is data-driven, compose.html's scene");
  console.log("  wiring is bypassed. Checks B (SCENES) and D (behind) skipped; A and C still apply.");
}

let scenes = null;
const blockM = code.match(/\bSCENES\s*=\s*\[([\s\S]*?)\]\s*;/);
if (!dataDriven && !blockM) {
  err("no `SCENES = [ … ];` array found in compose.html");
} else if (!dataDriven && blockM) {
  scenes = [];
  for (const e of blockM[1].matchAll(/\{\s*s\s*:\s*([\d.]+)\s*,\s*e\s*:\s*([\d.]+)\s*,\s*m\s*:\s*([A-Za-z_$][\w$]*)/g))
    scenes.push({ s: +e[1], e: +e[2], m: e[3] });
  if (!scenes.length) {
    err("the SCENES array has no `{s:…, e:…, m:…}` entries");
    scenes = null;
  }
}

if (scenes) {
  const EPS = 0.05;
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (sc.e <= sc.s) err(`SCENES[${i}] is empty or reversed (s:${sc.s} e:${sc.e})`);
    if (!/^R_[A-Z]+$/.test(sc.m) && !defined(sc.m))
      err(`SCENES[${i}] mode "${sc.m}" is not a rect defined in compose.html`);
    if (i > 0) {
      const prev = scenes[i - 1];
      if (sc.s < prev.s) err(`SCENES is not sorted — entry ${i} (s:${sc.s}) starts before entry ${i - 1} (s:${prev.s})`);
      else if (sc.s - prev.e > EPS) err(`gap in SCENES between ${prev.e}s and ${sc.s}s — vtarget() silently falls back to the last entry there`);
      else if (prev.e - sc.s > EPS) err(`SCENES ${i - 1} and ${i} overlap (${sc.s}s < ${prev.e}s)`);
    }
  }
  if (scenes[0].s > EPS) err(`SCENES starts at ${scenes[0].s}s, not 0 — the opening is uncovered`);
  if (total != null && scenes[scenes.length - 1].e < total - EPS)
    err(`SCENES ends at ${scenes[scenes.length - 1].e}s but speech runs to ${total}s (caps.total) — the tail is uncovered`);
}

/* ── C. draw() dispatch — every ['name', ident] is defined ─────────────── */
const dispM = code.match(/\[\s*(?:\[\s*['"][\w$]+['"]\s*,\s*[\w$]+\s*\]\s*,?\s*)+\]\s*\.forEach/);
if (!dataDriven) {
  if (!dispM) {
    warn("couldn't find draw()'s `[['name',fn], …].forEach` scene dispatch — if you renamed it, check C is skipped");
  } else {
    for (const m of dispM[0].matchAll(/\[\s*['"]([\w$]+)['"]\s*,\s*([\w$]+)\s*\]/g)) {
      const [, name, ident] = m;
      if (!defined(ident))
        err(`draw() dispatch lists scene "${name}" → \`${ident}\`, which is not defined in compose.html (ReferenceError stops the whole render)`);
    }
  }
}

/* ── D. behind-text moments land on a full-screen scene ───────────────── */
if (behind && scenes) {
  const spans = [
    ...(behind.lines || []).map(l => ["line", l.s, l.e]),
    ...(behind.cutouts || []).map(r => ["cutout", r[0], r[1]]),
    ...(behind.headouts || []).map(r => ["headout", r[0], r[1]]),
  ].filter(x => typeof x[1] === "number" && typeof x[2] === "number");
  for (const [kind, a, b] of spans) {
    const clash = scenes.filter(sc => sc.s < b && sc.e > a && !/^R_FULL$/.test(sc.m));
    for (const sc of clash)
      warn(`${kind} behind-text moment ${a}–${b}s overlaps a non-full-screen scene (${sc.m} at ${sc.s}–${sc.e}s) — behindText() bails when !isFull, so it won't render there`);
  }
} else if (behind && !behind.lines && !behind.cutouts && !behind.headouts) {
  warn("build/person-cutout.json has no lines / cutouts / headouts");
}

/* ── report ──────────────────────────────────────────────────────────── */
const errs = findings.filter(f => f.sev === "error");
const warns = findings.filter(f => f.sev === "warn");
if (!findings.length) {
  console.log(`✓ compose.html: ${seenIdx.size} wordsOf ref(s)` +
    (scenes ? `, ${scenes.length} scene(s)` : "") + " — no problems");
  process.exit(0);
}
for (const f of errs) console.log("  ✗ " + f.msg);
for (const f of warns) console.log("  ⚠ " + f.msg);
console.log(`\n${errs.length} error(s), ${warns.length} warning(s)` +
  (errs.length ? " — fix the errors before `render_frames.js all`" : ""));
process.exit(errs.length ? 2 : 0);
