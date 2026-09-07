"use strict";
/* Shared harness for the headless suite. Cross-platform (Linux CI + the maintainer's
   Windows). Every *.test.js requires this, calls one of the runners, and exits 0/1.

   T.web(name, async A => …)         — web.py server + a Puppeteer page (A.base/page/J/check…)
   T.withBrowser(name, async A => …) — a Puppeteer page only (A.page/check…)
   T.node(name, async A => …)        — no browser, no server (A.check…)                       */
const path = require("path"), fs = require("fs"), os = require("os"), net = require("net");
const { execFileSync, spawn } = require("child_process");

const SKILL = path.resolve(__dirname, "..");
const SCRIPTS = path.join(SKILL, "scripts");
process.chdir(SKILL);   // lib/platform's Puppeteer resolves its bundled Chromium via ./.puppeteerrc.cjs

const platform = require(path.join(SCRIPTS, "lib", "platform"));
const FFMPEG = platform.ffmpegPath();

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* wait until `fn()` is truthy (a UI action fetches, then writes a file / mutates state) */
async function poll(fn, ms = 4000, step = 100) {
  for (let waited = 0; waited < ms; waited += step) {
    try { if (await fn()) return; } catch { /* not ready */ }
    await sleep(step);
  }
  throw new Error("poll timed out after " + ms + " ms");
}
const waitFile = (p, ms = 4000) => poll(() => fs.existsSync(p), ms).then(() => sleep(80));

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

function freePort() {
  return new Promise(r => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
}

function killTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { stdio: "ignore" });
    else process.kill(-proc.pid, "SIGKILL");
  } catch { /* already gone */ }
  try { proc.kill("SIGKILL"); } catch { /* ditto */ }
}

/* a fresh temp dir, wiped */
function tmp(name) {
  const d = path.join(os.tmpdir(), "ve-test-" + name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/* a tiny lavfi test clip (video + tone); cached across tests in one run */
function mkVideo(dest, { size = "320x240", dur = 3, freq = 220 } = {}) {
  if (!fs.existsSync(dest)) {
    execFileSync(FFMPEG, ["-v", "error", "-f", "lavfi", "-i", `testsrc=size=${size}:rate=30:d=${dur}`,
      "-f", "lavfi", "-i", `sine=frequency=${freq}:d=${dur}`, "-shortest", "-y", dest]);
  }
  return dest;
}

/* a mono 16 kHz tone .wav — the shape transcribe-input.wav has */
function mkAudio(dest, { dur = 4, freq = 300 } = {}) {
  if (!fs.existsSync(dest)) {
    execFileSync(FFMPEG, ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:d=${dur}`,
      "-ac", "1", "-ar", "16000", "-y", dest]);
  }
  return dest;
}

/* write files into a work dir: writeFiles(W, { "build/captions.json": {…}, "compose.html": "<…>" }) */
function writeFiles(W, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(W, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content), "utf8");
  }
}

/* touch every file under `dir` into the future so run.py's make-logic marks stages SKIP */
function touchFuture(dir, skip = /rush/) {
  const at = new Date(Date.now() + 3600e3);
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (skip.test(f)) continue;
    if (e.isDirectory()) walk(f); else fs.utimesSync(f, at, at);
  } };
  walk(dir);
}

function spawnWeb(port, projDir) {
  const [cmd, ...pre] = PY;
  return spawn(cmd, [...pre, path.join("scripts", "web.py"), String(port)], {
    cwd: SKILL,
    env: { ...process.env, VEVO_PROJECTS_DIR: projDir },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitHealthy(base, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(base + "/health")).ok) return; } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("web.py never became healthy at " + base);
}

function mkChecker() {
  const A = { ok: true };
  A.check = (label, cond, ctx) => {
    console.log((cond ? "  ok  " : " FAIL ") + label + (cond || !ctx ? "" : "   « " + String(ctx).replace(/\s+/g, " ").slice(0, 240)));
    A.ok = A.ok && !!cond;
  };
  return A;
}

function finish(A) {
  console.log(A.ok ? "\nPASS" : "\nFAIL");
  process.exit(A.ok ? 0 : 1);
}

/* ---- runners ---- */

async function nodeTest(name, body) {
  harden();
  const A = mkChecker();
  A.name = name;
  await body(A);
  finish(A);
}

async function withBrowser(name, body) {
  harden();
  const A = mkChecker();
  A.name = name;
  A.errs = [];
  let browser;
  try {
    browser = await platform.resolvePuppeteer().launch(platform.launchOptions());
    A.browser = browser;
    A.newPage = async () => {
      const page = await browser.newPage();
      page.on("pageerror", e => A.errs.push("pageerror: " + e.message));
      page.on("console", m => { if (m.type() === "error" && !/favicon|status of 40\d|status of 50\d/.test(m.text())) A.errs.push(m.text()); });
      return page;
    };
    await body(A);
  } finally {
    if (browser) { try { await browser.close(); } catch { /* */ } }
  }
  finish(A);
}

async function web(name, body) {
  harden();
  const A = mkChecker();
  A.name = name;
  A.errs = [];
  A.proj = tmp(name + "-projects");
  A.vid = mkVideo(path.join(os.tmpdir(), "ve-test-src.mp4"));
  const port = await freePort();
  A.base = "http://127.0.0.1:" + port;
  A.J = (m, p, b) => fetch(A.base + p, {
    method: m, headers: b ? { "Content-Type": "application/json" } : {}, body: b && JSON.stringify(b),
  }).then(r => r.json());
  A.work = id => path.join(A.proj, id);
  const srv = spawnWeb(port, A.proj);
  let browser;
  try {
    await waitHealthy(A.base);
    browser = await platform.resolvePuppeteer().launch(platform.launchOptions());
    A.browser = browser;
    A.page = await browser.newPage();
    A.page.on("pageerror", e => A.errs.push("pageerror: " + e.message));
    A.page.on("console", m => { if (m.type() === "error" && !/favicon|status of 40\d|status of 50\d/.test(m.text())) A.errs.push(m.text()); });
    await body(A);
    A.check("no unexpected page errors (" + (A.errs.join(" | ") || "none") + ")", A.errs.length === 0);
  } finally {
    if (browser) { try { await browser.close(); } catch { /* */ } }
    killTree(srv);
  }
  finish(A);
}

module.exports = {
  SKILL, SCRIPTS, PY, FFMPEG, platform,
  sleep, poll, waitFile, harden, freePort, killTree, tmp, mkVideo, mkAudio, writeFiles, touchFuture, waitHealthy,
  node: nodeTest, withBrowser, web,
};
