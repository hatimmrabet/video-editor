/* $VEVO_FFMPEG / $VEVO_FFPROBE resolver (#44) — lib/platform.{py,js,sh} + run.py {ffmpeg}. */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const T = require("./_lib");

// pyeval / jseval run fixed, in-repo snippets (below) through the real interpreters to
// exercise lib/platform from each runtime — no external input, test-only.
const pyeval = (code, env) =>
  execFileSync(T.PY[0], [...T.PY.slice(1), "-c", code], { cwd: T.SCRIPTS, encoding: "utf8", env: { ...process.env, ...env } }).trim();
const jseval = (code, env) =>
  execFileSync("node", ["-e", code], { cwd: T.SCRIPTS, encoding: "utf8", env: { ...process.env, ...env } }).trim();
const bash = (script, env) => {
  try { return { ok: true, out: execFileSync("bash", ["-c", script], { cwd: T.SKILL, encoding: "utf8", env: { ...process.env, ...env } }).trim() }; }
  catch (e) { return { ok: false, out: (e.stdout || "") + (e.stderr || "") }; }
};

T.node("ffmpeg-resolver", async ({ check }) => {
  // ---- lib/platform.py ----
  let [ffm, ffp] = pyeval("from lib import platform as p; print(p.FFMPEG); print(p.FFPROBE)").split(/\r?\n/).map(s => s.trim());
  check("py: FFMPEG resolves to ffmpeg", /ffmpeg(\.exe)?$/i.test(ffm), ffm);
  check("py: FFPROBE resolves to ffprobe", /ffprobe(\.exe)?$/i.test(ffp), ffp);
  check("py: $VEVO_FFMPEG passes through verbatim when it isn't on PATH",
    pyeval("from lib import platform as p; print(p.ffmpeg())", { VEVO_FFMPEG: "/opt/custom/ffmpeg" }) === "/opt/custom/ffmpeg");
  const nodeAbs = pyeval("from lib import platform as p; print(p.ffmpeg())", { VEVO_FFMPEG: "node" });
  check("py: $VEVO_FFMPEG=<name on PATH> resolves to an absolute path", /node(\.exe)?$/i.test(nodeAbs) && path.isAbsolute(nodeAbs), nodeAbs);

  // ---- lib/platform.js ----
  check("js: defaults are 'ffmpeg' / 'ffprobe'",
    jseval("const p=require('./lib/platform'); console.log(p.ffmpegPath()+'|'+p.ffprobePath())") === "ffmpeg|ffprobe");
  check("js: honours $VEVO_FFMPEG",
    jseval("console.log(require('./lib/platform').ffmpegPath())", { VEVO_FFMPEG: "/x/ff" }) === "/x/ff");

  // ---- lib/platform.sh (skip if this bash can't source it — WSL vs the pipeline's Git-Bash) ----
  const probe = bash('. scripts/lib/platform.sh; printf %s "$VEVO_OS"');
  if (probe.ok && /^(mac|windows|linux)$/.test(probe.out)) {
    const d = bash('. scripts/lib/platform.sh; printf "%s|%s" "$VEVO_FFMPEG" "$VEVO_FFPROBE"');
    check("sh: exports VEVO_FFMPEG / VEVO_FFPROBE", /ffmpeg.*\|.*ffprobe/i.test(d.out), d.out);
    check("sh: a pre-set VEVO_FFMPEG wins",
      bash('. scripts/lib/platform.sh; printf %s "$VEVO_FFMPEG"', { VEVO_FFMPEG: "/my/ff" }).out === "/my/ff");
  } else {
    console.log("  --   sh: skipped (this shell can't source platform.sh: " + probe.out.slice(0, 60) + ")");
  }

  // ---- run.py substitutes {ffmpeg} in a stage argv ----
  const W = T.tmp("ff-work");
  fs.mkdirSync(path.join(W, "rush"), { recursive: true });
  fs.mkdirSync(path.join(W, "build"), { recursive: true });
  fs.mkdirSync(path.join(W, "config"), { recursive: true });
  fs.writeFileSync(path.join(W, "rush", "v.mp4"), "x");
  fs.writeFileSync(path.join(W, "config", "project.config.json"), JSON.stringify({ language: "en" }));
  const dry = execFileSync(T.PY[0], [...T.PY.slice(1), "scripts/run.py", W, "--dry", "--only", "audio"],
    { cwd: T.SKILL, encoding: "utf8", env: { ...process.env, VEVO_FFMPEG: "/sentinel/ffmpeg" } });
  check("run.py: {ffmpeg} in the audio stage resolves to $VEVO_FFMPEG", /\/sentinel\/ffmpeg -v error/.test(dry), dry);
  check("run.py: no literal {ffmpeg} left in the command", !/\{ffmpeg\}/.test(dry), dry);
});
