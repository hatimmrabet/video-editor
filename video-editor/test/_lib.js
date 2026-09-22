"use strict";
/* Shared harness for the headless suite. Cross-platform (Linux CI + the maintainer's
   Windows). Every *.test.js requires this, calls T.node, and exits 0/1.

   T.node(name, async A => …) — no browser, no server (A.check…)

   There used to be a browser-driven harness here too (T.web spawned scripts/web.py and
   drove it with Puppeteer; T.withBrowser was a lighter version of the same). Both went
   with scripts/web/ — that local web UI was never referenced by SKILL.md, had drifted from
   the pipeline it fronted, and nobody used it. What is left tests real scripts directly:
   no server, no page, no fixtures for either. */
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");

const SKILL = path.resolve(__dirname, "..");
const SCRIPTS = path.join(SKILL, "scripts");

/* the skill's isolated Python — venv binary if synced, else `uv run`, else system */
function pythonArgv() {
  const venv = path.join(SKILL, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (fs.existsSync(venv)) return [venv];
  try { execFileSync("uv", ["--version"], { stdio: "ignore" }); return ["uv", "run", "--project", SKILL, "python"]; }
  catch { return ["python3"]; }
}
const PY = pythonArgv();

/* undici (Node's global fetch) asserts when a keep-alive socket is force-killed on teardown */
function harden() {
  const benign = e => /ERR_ASSERTION|assert\(!this\.paused\)|\bpaused\b/.test(String(e && (e.stack || e)));
  process.on("unhandledRejection", e => { if (!benign(e)) { console.error("unhandledRejection:", e); process.exitCode = 1; } });
  process.on("uncaughtException", e => { if (!benign(e)) { console.error(e); process.exit(1); } });
}

/* a fresh temp dir, wiped */
function tmp(name) {
  const d = path.join(os.tmpdir(), "ve-test-" + name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function mkChecker() {
  const A = { ok: true };
  A.check = (label, cond, ctx) => {
    console.log((cond ? "  ok  " : " FAIL ") + label + (cond || !ctx ? "" : "   « " + String(ctx).replace(/\s+/g, " ").slice(0, 240)));
    A.ok = A.ok && !!cond;
    return !!cond;              // chainable: `if (!check(...)) continue;`
  };
  return A;
}

function finish(A) {
  console.log(A.ok ? "\nPASS" : "\nFAIL");
  process.exit(A.ok ? 0 : 1);
}

async function nodeTest(name, body) {
  harden();
  const A = mkChecker();
  A.name = name;
  await body(A);
  finish(A);
}

module.exports = { SKILL, SCRIPTS, PY, tmp, node: nodeTest };
