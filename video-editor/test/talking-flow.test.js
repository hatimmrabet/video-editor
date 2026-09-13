/* web UI: the talking-video flow (#103) — the tighten and chapters panels, and runTarget
   capping. There is one pipeline: no format switch, no project-type picker, no montage
   world, no B-roll. Orientation comes from the source. */
const fs = require("fs"), os = require("os"), path = require("path");
const T = require("./_lib");

T.web("talking-flow", async ({ base, page, J, work, check }) => {
  const clip = n => T.mkVideo(path.join(os.tmpdir(), `ve-test-clip${n}.mp4`), { dur: 2, freq: 200 });

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects", { timeout: 8000 });

  // ---- creating a project asks for a name and nothing else ----
  const lfId = await page.evaluate(async () => {
    document.getElementById("newname").value = "talk";
    await create();
    return S.pid;
  });
  check("no format key is written any more", (await J("GET", `/projects/${lfId}/config`)).format === undefined);
  check("no project-type picker any more", await page.evaluate(() => !document.getElementById("newkind")));

  const LW = work(lfId);
  T.writeFiles(LW, {
    // this fixture's speech is English, so the project declares it: tighten.py picks its
    // filler list per language, and the skill default is ar-MA (defaults.config.json)
    "config/project.config.json": { language: "en" },
    "build/source-joined.mp4": "x", "build/cut-plan.json": { keep: [[0, 6]], total: 6, src_dur: 6 }, "build/.settled": "x",
    "build/transcribe-input.wav": "{}", "build/transcript-raw.json": "{}", "build/transcript-fixes.json": "{}",
    "build/captions.json": { total: 6, cards: [
      { s: 0.2, e: 2, w: [{ t: "one", s: .2, e: 1 }, { t: "um", s: 1, e: 1.3 }, { t: "two", s: 1.3, e: 2 }] },
      { s: 2.2, e: 5, w: [{ t: "three", s: 2.2, e: 3 }, { t: "four", s: 3, e: 5 }] },
    ] },
  });
  // rush/ must hold the take: the world is inferred from the footage now, not from a
  // config.format switch, so an empty rush/ has nothing to infer from.
  fs.copyFileSync(clip(1), path.join(LW, "rush", "take1.mp4"));
  T.touchFuture(LW);

  await page.evaluate(x => open(x), lfId);
  // script-review is advisory and now runs in this world too — tick past it to reach tighten
  await page.waitForFunction(() => S.state && S.state.stages.length > 0, { timeout: 8000 });
  await page.evaluate(() => { S.passed.add("script-review"); render(); });
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => h.textContent === "tighten the talk"), { timeout: 8000 });
  check("the one world is talking-video", await page.evaluate(() => S.state.world === "talking-video"));
  check("tighten runs before reframe", await page.evaluate(() => {
    const ids = S.state.stages.map(s => s.id); return ids.indexOf("tighten") < ids.indexOf("reframe");
  }));
  check("no broll stage left", await page.evaluate(() => !S.state.stages.some(s => s.id === "broll")));
  check("no montage stage left", await page.evaluate(() =>
    !S.state.stages.some(s => ["scan", "sheet", "pick", "plan", "build"].includes(s.id))));

  // tighten: no plan -> Propose runs tighten.py -> review lists the "um" filler
  check("tighten panel offers Propose", await page.evaluate(() => [...document.querySelectorAll("button")].some(x => /Propose the cuts/.test(x.textContent))));
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Propose the cuts/.test(x.textContent)).click());
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(x => /Apply the cuts/.test(x.textContent)), { timeout: 20000 });
  check("tighten review lists the filler", await page.evaluate(() => /"um"/.test(document.body.textContent)));
  check("tighten-plan.json written by Propose", fs.existsSync(path.join(LW, "build", "tighten-plan.json")));
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Continue without applying/.test(x.textContent)).click());

  // chapters
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => h.textContent === "chapter markers"), { timeout: 8000 });
  const fillChapterRow = (i, sent, title) => page.evaluate((i, sent, title) => {
    const rows = [...document.querySelectorAll(".row")].filter(r => r.querySelector('input[type=number]') && r.querySelector('input:not([type=number])'));
    rows[i].querySelector('input[type=number]').value = String(sent);
    rows[i].querySelector('input:not([type=number])').value = title;
  }, i, sent, title);
  await fillChapterRow(0, 0, "Intro");
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent === "+ chapter").click());
  await fillChapterRow(1, 1, "Part two");
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Save & continue/.test(x.textContent)).click());
  await T.waitFile(path.join(LW, "config", "chapters.json"));
  const chapters = JSON.parse(fs.readFileSync(path.join(LW, "config", "chapters.json")));
  check("chapters.json: [{ref:{sentence}, title}]",
    chapters.length === 2 && chapters[0].ref.sentence === 0 && chapters[0].title === "Intro" && chapters[1].ref.sentence === 1,
    JSON.stringify(chapters));

  // runTarget caps a run at the stage before the next un-passed advisory checkpoint
  const rt = await page.evaluate(() => { S.passed = new Set(); return runTarget([
    { id: "captions", verdict: "RUN", checkpoint: false, makes: ["x"] },
    { id: "script-review", verdict: "CHECKPOINT", checkpoint: true },
    { id: "reframe", verdict: "RUN", checkpoint: false, makes: ["x"] }]); });
  check("runTarget stops the run before an advisory checkpoint", rt === "captions", rt);
  const rt2 = await page.evaluate(() => runTarget([
    { id: "reframe", verdict: "RUN", checkpoint: false, makes: ["x"] },
    { id: "render", verdict: "RUN", checkpoint: false, makes: ["x"] }]));
  check("runTarget runs to the end when no advisory checkpoint remains", rt2 === "", rt2);
});
