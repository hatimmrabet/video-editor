/* web UI checkpoint screen: sound + the Result view (#102).
   sound: an end-card field + a <canvas> waveform, click to drop a cue -> build/sound-cues.json.
   result: shows once the deliverable stages are SKIP (a `safe`-style gate may stay RUN). */
const fs = require("fs"), os = require("os"), path = require("path");
const T = require("./_lib");

T.web("sound-result", async ({ base, page, vid, J, work, check }) => {
  const wav = T.mkAudio(path.join(os.tmpdir(), "ve-test-tone.wav"));

  const { id } = await J("POST", "/projects", { name: "snd" });
  const W = work(id);
  await fetch(base + `/projects/${id}/rush`, { method: "POST", headers: { "X-Filename": "v.mp4" }, body: fs.readFileSync(vid) });
  await J("PUT", `/projects/${id}/config`, { format: "short", language: "en", engine: "light" });

  T.writeFiles(W, {
    "build/cut-plan.json": { keep: [[0, 3]], total: 3, src_dur: 3 }, "build/.settled": "x",
    "build/transcript-raw.json": "{}", "build/transcript-fixes.json": "{}", "build/sound-effects.wav": "{}",
    "build/frames-source/00001.jpg": "x", "build/frames-composited/00001.jpg": "x", "build/video-reframed.mp4": "x",
    "build/captions.json": { total: 3, cards: [
      { s: 0.2, e: 1.5, w: [{ t: "a", s: .2, e: .8 }] }, { s: 1.6, e: 3.0, w: [{ t: "b", s: 1.6, e: 3 }] },
    ] },
  });
  fs.copyFileSync(wav, path.join(W, "build", "transcribe-input.wav"));
  T.touchFuture(path.join(W, "build"));

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects", { timeout: 8000 });
  await page.evaluate(x => open(x), id);
  await page.evaluate(() => { S.passed.add("retakes"); S.passed.add("script-review"); S.passed.add("scenes"); render(); });
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => h.textContent === "sound"), { timeout: 8000 });
  check("sound panel renders a <canvas>", await page.$("canvas") != null);
  await T.sleep(400);   // let the waveform decode

  await page.evaluate(() => { [...document.querySelectorAll("input[type=number]")][0].value = "4.5"; });
  const bb = await (await page.$("canvas")).boundingBox();
  // cue chips carry the ✕ glyph; the stage-list "world" pill does not
  const cueChips = () => page.evaluate(() => [...document.querySelectorAll(".pill")].filter(x => /✕/.test(x.textContent)).length);
  await page.mouse.click(Math.round(bb.x + bb.width * 0.3), Math.round(bb.y + bb.height / 2));
  await T.sleep(200);
  let marks = await cueChips();
  if (!marks) {
    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const ev = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(ev, "offsetX", { value: c.clientWidth * 0.3 });
      c.dispatchEvent(ev);
    });
    await T.sleep(150);
    marks = await cueChips();
  }
  check("clicking the waveform drops a cue", marks >= 1, marks);

  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Save & continue/.test(x.textContent)).click());
  await T.waitFile(path.join(W, "build", "sound-cues.json"));
  const cues = JSON.parse(fs.readFileSync(path.join(W, "build", "sound-cues.json")));
  check("sound-cues.json: outro + one whoosh_up at ~30% of the timeline",
    cues.outro === 4.5 && Array.isArray(cues.whoosh_up) && cues.whoosh_up.length === 1
      && cues.whoosh_up[0] > 0.5 && cues.whoosh_up[0] < 1.3, JSON.stringify(cues));

  // stage the deliverables -> the Result panel
  T.writeFiles(W, {
    "build/sound-effects.wav": "x", "build/video-raw.mp4": "x", "build/frames-composited/00001.jpg": "x",
    "video-final.srt": "1\n", "post-caption.txt": "hi",
  });
  fs.writeFileSync(path.join(W, "video-final.mp4"), Buffer.alloc(1_500_000));
  T.touchFuture(W);
  await page.evaluate(async () => { await refresh(); });
  await T.poll(() => page.evaluate(() =>
    [...document.querySelectorAll("h3")].some(h => h.textContent === "result") && document.querySelector("video") != null), 4000)
    .catch(() => {});
  const isResult = await page.evaluate(() =>
    [...document.querySelectorAll("h3")].some(h => h.textContent === "result") && document.querySelector("video") != null);
  check("Result panel shows once the deliverable is ready", isResult,
    await page.evaluate(() => JSON.stringify(S.state.stages.map(s => s.id + ":" + s.verdict))));
});
