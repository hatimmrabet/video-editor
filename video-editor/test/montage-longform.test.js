/* web UI: montage + long-form flows (#103) — the project-type picker, montage `pick` panel
   (+ /montage endpoint), long-form tighten / chapters / broll panels, runTarget capping. */
const fs = require("fs"), os = require("os"), path = require("path");
const T = require("./_lib");

T.web("montage-longform", async ({ base, page, J, work, check }) => {
  const clip = n => T.mkVideo(path.join(os.tmpdir(), `ve-test-clip${n}.mp4`), { dur: 2, freq: 200 });
  const jpg = path.join(os.tmpdir(), "ve-test-sheet.jpg");
  if (!fs.existsSync(jpg)) require("child_process").execFileSync(T.FFMPEG,
    ["-v", "error", "-f", "lavfi", "-i", "color=c=gray:s=200x120:d=1", "-frames:v", "1", "-y", jpg]);
  [1, 2, 3].forEach(clip);

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects", { timeout: 8000 });

  // ---- long-form: the picker writes config.format:"long" ----
  const lfId = await page.evaluate(async () => {
    document.getElementById("newname").value = "talk";
    document.getElementById("newkind").value = "long-form";
    await create();
    return S.pid;
  });
  check("picker set config.format = long", (await J("GET", `/projects/${lfId}/config`)).format === "long");
  check("kind remembered in localStorage", await page.evaluate(() => localStorage.getItem("ve-kind-" + S.pid) === "long-form"));

  const LW = work(lfId);
  T.writeFiles(LW, {
    // this fixture's speech is English, so the project declares it: tighten.py picks its
    // filler list per language, and the skill default is ar-MA (defaults.config.json)
    "config/project.config.json": { format: "long", language: "en" },
    "build/source-joined.mp4": "x", "build/cut-plan.json": { keep: [[0, 6]], total: 6, src_dur: 6 },
    "build/transcribe-input.wav": "{}", "build/transcript-raw.json": "{}", "build/transcript-fixes.json": "{}",
    "build/captions.json": { total: 6, cards: [
      { s: 0.2, e: 2, w: [{ t: "one", s: .2, e: 1 }, { t: "um", s: 1, e: 1.3 }, { t: "two", s: 1.3, e: 2 }] },
      { s: 2.2, e: 5, w: [{ t: "three", s: 2.2, e: 3 }, { t: "four", s: 3, e: 5 }] },
    ] },
  });
  fs.mkdirSync(path.join(LW, "rush", "broll"), { recursive: true });
  T.touchFuture(LW);

  await page.evaluate(x => open(x), lfId);
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => h.textContent === "tighten the talk"), { timeout: 8000 });
  check("long-form world", await page.evaluate(() => S.state.world === "long-form"));
  check("broll stage is before reframe", await page.evaluate(() => {
    const ids = S.state.stages.map(s => s.id); return ids.indexOf("broll") < ids.indexOf("reframe");
  }));

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

  // broll
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => h.textContent === "b-roll cutaways"), { timeout: 8000 });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll(".row")].find(r => r.querySelector('input[placeholder*="12.5"]'));
    row.querySelector('input[placeholder*="12.5"]').value = "s1";
    row.querySelector('input[placeholder*="clip"]').value = "screen.mp4";
    [...document.querySelectorAll("button")].find(x => /Save & continue/.test(x.textContent)).click();
  });
  await T.waitFile(path.join(LW, "config", "broll.json"));
  const broll = JSON.parse(fs.readFileSync(path.join(LW, "config", "broll.json")));
  check("broll.json: [{ref:{sentence}, clip, at}]",
    broll.length === 1 && broll[0].ref.sentence === 1 && broll[0].clip === "screen.mp4" && broll[0].at === 0.4, JSON.stringify(broll));

  // ---- montage: picker, multi-file drop zone, pick panel + /montage ----
  await page.evaluate(() => showList());
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects", { timeout: 8000 });
  const mId = await page.evaluate(async () => {
    document.getElementById("newname").value = "clips";
    document.getElementById("newkind").value = "montage";
    await create();
    return S.pid;
  });
  await page.evaluate(x => open(x), mId);
  await page.waitForFunction(() => document.querySelector(".drop") != null, { timeout: 8000 });
  check("montage kind remembered", await page.evaluate(() => localStorage.getItem("ve-kind-" + S.pid) === "montage"));
  check("drop zone is multi-file + montage-labelled + audio input", await page.evaluate(() =>
    !!document.querySelector('input[type=file][multiple]')
    && /clips here \(two or more\)/.test(document.body.textContent)
    && !!document.querySelector('input[type=file][accept="audio/*"]')));

  const MW = work(mId);
  [1, 2, 3].forEach(i => fs.copyFileSync(clip(i), path.join(MW, "rush", `clip${i}.mp4`)));
  fs.copyFileSync(jpg, path.join(MW, "build", "montage-contact-sheet.jpg"));
  T.writeFiles(MW, { "build/montage-plan.json": { src: path.join(MW, "rush"), shot: 1.5, clips: [1, 2, 3].map(i => ({
    i, file: path.join(MW, "rush", `clip${i}.mp4`), name: `clip${i}.mp4`, dur: 2, w: 320, h: 240, fps: 30,
    audio: true, skip: false, pick: [0.3, 1.8], score: 0.6 + i / 100, mot: 5,
  })) } });
  T.touchFuture(MW);

  await page.evaluate(x => open(x), mId);
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => h.textContent === "pick the shots"), { timeout: 8000 });
  check("montage world inferred", await page.evaluate(() => S.state.world === "broll-montage"));
  check("currentStep = pick", await page.evaluate(() => (currentStep(S.state.stages) || {}).id === "pick"));
  check("contact sheet shown", await page.evaluate(() => !!document.querySelector('img[src*="montage-contact-sheet"]')));
  check("a checkbox per clip", await page.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')].length === 3));
  await page.evaluate(() => {
    document.querySelectorAll('input[type=checkbox]')[1].checked = false;
    [...document.querySelectorAll("button")].find(x => /Apply & continue/.test(x.textContent)).click();
  });
  const planPath = path.join(MW, "build", "montage-plan.json");
  await T.poll(() => JSON.parse(fs.readFileSync(planPath)).clips.find(c => c.i === 2).skip === true, 6000);
  const mplan = JSON.parse(fs.readFileSync(planPath));
  check("dropping clip 2 wrote skip via montage_mode.py keep",
    mplan.clips.find(c => c.i === 2).skip === true && mplan.clips.find(c => c.i === 1).skip === false,
    mplan.clips.map(c => `${c.i}:${c.skip}`).join(" "));

  // runTarget caps a run at the stage before the next un-passed advisory checkpoint
  const rt = await page.evaluate(() => { S.passed = new Set(); return runTarget([
    { id: "scan", verdict: "RUN", checkpoint: false, makes: ["x"] },
    { id: "sheet", verdict: "RUN", checkpoint: false, makes: ["x"] },
    { id: "pick", verdict: "CHECKPOINT", checkpoint: true },
    { id: "build", verdict: "RUN", checkpoint: false, makes: ["x"] }]); });
  check("runTarget stops the run before advisory 'pick'", rt === "sheet", rt);
  const rt2 = await page.evaluate(() => runTarget([
    { id: "reframe", verdict: "RUN", checkpoint: false, makes: ["x"] },
    { id: "assemble", verdict: "RUN", checkpoint: false, makes: ["x"] }]));
  check("runTarget runs to the end when no advisory checkpoint remains", rt2 === "", rt2);
});
