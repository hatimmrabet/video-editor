/* web UI checkpoint screen: scenes (#101) — motif dropdown + params, writes config/scenes.json. */
const fs = require("fs"), path = require("path");
const T = require("./_lib");

T.web("scenes", async ({ base, page, vid, J, work, check }) => {
  const mot = await J("GET", "/motifs");
  check("/motifs lists the implemented motifs", !!(mot.motifs && mot.motifs.stamp), Object.keys(mot.motifs || {}).length + " motifs");

  const { id } = await J("POST", "/projects", { name: "scn" });
  const W = work(id);
  await fetch(base + `/projects/${id}/rush`, { method: "POST", headers: { "X-Filename": "v.mp4" }, body: fs.readFileSync(vid) });
  await J("PUT", `/projects/${id}/config`, { format: "short", language: "en", engine: "light" });

  T.writeFiles(W, {
    "build/cut-plan.json": { keep: [[0, 3]], total: 3, src_dur: 3 }, "build/.settled": "x",
    "build/transcribe-input.wav": "{}", "build/transcript-raw.json": "{}",
    "build/transcript-fixes.json": "{}", "build/sound-effects.wav": "{}",
    "build/frames-source/00001.jpg": "x", "build/video-reframed.mp4": "x",
    "build/captions.json": { total: 3, cards: [
      { s: 0.2, e: 1.5, w: [{ t: "count", s: .2, e: .8 }, { t: "them", s: .8, e: 1.5 }] },
      { s: 1.6, e: 3.0, w: [{ t: "one", s: 1.6, e: 2.2 }, { t: "file", s: 2.2, e: 3.0 }] },
    ] },
  });
  T.touchFuture(path.join(W, "build"));

  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects");
  await page.evaluate(x => open(x), id);
  await page.evaluate(() => { S.passed.add("script-review"); render(); });   // tick past the advisory checkpoint
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => /design the scenes/.test(h.textContent)), { timeout: 8000 });

  const nMot = await page.$$eval("select", ss => ss.filter(s => [...s.options].some(o => o.value === "stamp")).length);
  check("one motif dropdown per sentence", nMot >= 2, nMot);

  await page.evaluate(() => {
    const boxEl = [...document.querySelectorAll("h3")].find(h => /design the scenes/.test(h.textContent)).parentElement;
    const card = boxEl.querySelectorAll(".card")[0];
    const m = [...card.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "counter"));
    m.value = "counter"; m.dispatchEvent(new Event("change"));
    card.querySelector("input").value = '{"to": 42, "suffix": "%"}';
    [...document.querySelectorAll("button")].find(x => /Save & continue/.test(x.textContent)).click();
  });
  await T.waitFile(path.join(W, "config", "scenes.json"));
  const scenes = JSON.parse(fs.readFileSync(path.join(W, "config", "scenes.json")));
  check("config/scenes.json: motif + params + sentence ref",
    scenes.length === 1 && scenes[0].motif === "counter" && scenes[0].params.to === 42 && scenes[0].ref.sentence === 0,
    JSON.stringify(scenes));
});
