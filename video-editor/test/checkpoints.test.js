/* web UI checkpoint screens: transcript + trim (#100) — render, edit, write the right files. */
const fs = require("fs"), path = require("path");
const T = require("./_lib");

const seg = (id, s, e, ws) => ({
  id, start: s, end: e, text: " " + ws.map(w => w[0]).join(" ") + " ",
  words: ws.map(([word, a, b]) => ({ word, start: a, end: b })),
});

T.web("checkpoints", async ({ base, page, vid, J, work, check }) => {
  const { id } = await J("POST", "/projects", { name: "ck" });
  const W = work(id);
  await fetch(base + `/projects/${id}/rush`, { method: "POST", headers: { "X-Filename": "v.mp4" }, body: fs.readFileSync(vid) });
  await J("PUT", `/projects/${id}/config`, { format: "short", language: "en", engine: "light" });

  T.writeFiles(W, {
    "build/cut-plan.json": { keep: [[0, 3]], total: 3, src_dur: 3 },
    "build/transcribe-input.wav": "x",
    "build/transcript-raw.json": { text: "", language: "en", segments: [
      seg(0, 0.0, 1.5, [["hello", 0, .5], ["wrold", .5, 1.0], ["today", 1.0, 1.5]]),
      seg(1, 1.6, 3.0, [["one", 1.6, 2.0], ["file", 2.0, 3.0]]),
    ] },
  });

  check("run.py stops at transcript-fix", (await J("GET", `/projects/${id}/state`)).next === "transcript-fix");

  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects");
  await page.evaluate(x => open(x), id);
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => /correct the transcript/.test(h.textContent)), { timeout: 8000 });

  const rows = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h3")].find(x => /correct the transcript/.test(x.textContent));
    return [...h.parentElement.querySelectorAll(".row input")].map(n => n.value);
  });
  check("Whisper sentences are prefilled (incl. the typo)", rows.some(v => v.includes("wrold")), rows);

  await page.evaluate(() => {
    const r = [...document.querySelectorAll("h3")].find(h => /correct the transcript/.test(h.textContent))
      .parentElement.querySelectorAll(".row input");
    r[0].value = "hello world today"; r[0].dispatchEvent(new Event("input"));
  });
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Save & continue/.test(x.textContent)).click());
  await T.sleep(1200);
  const fx = JSON.parse(fs.readFileSync(path.join(W, "build", "transcript-fixes.json")));
  check("transcript-fixes.json: typo fixed, word count kept",
    fx.fix.length === 2 && fx.fix[0].join(" ") === "hello world today" && fx.fix[1].length === 2, JSON.stringify(fx));

  T.writeFiles(W, { "build/captions.json": { total: 3, cards: [
    { s: 0.1, e: 1.4, w: [{ t: "we", s: .1, e: .3 }, { t: "solve", s: .3, e: .8 }, { t: "the", s: .8, e: 1.0 }, { t: "cause", s: 1.0, e: 1.4 }] },
    { s: 1.5, e: 2.9, w: [{ t: "we", s: 1.5, e: 1.7 }, { t: "identify", s: 1.7, e: 2.3 }, { t: "the", s: 2.3, e: 2.5 }, { t: "cause", s: 2.5, e: 2.9 }] },
    { s: 3.0, e: 4.0, w: [{ t: "final", s: 3.0, e: 4.0 }] },
  ] } });
  await page.evaluate(() => refresh());
  await page.waitForFunction(() => [...document.querySelectorAll("h3")].some(h => /review the script/.test(h.textContent)), { timeout: 8000 });
  check("restatement pair flagged", await page.evaluate(() => document.body.textContent.includes("looks repeated")));

  await page.evaluate(() => document.querySelectorAll("label.row input[type=checkbox]")[0].click());
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Apply & continue/.test(x.textContent)).click());
  await T.sleep(1500);
  const caps2 = JSON.parse(fs.readFileSync(path.join(W, "build", "captions.json")));
  check("dropping sentence 1 rewrote captions.json",
    caps2.cards.length === 2 && !caps2.cards[0].w.map(w => w.t).includes("solve"),
    caps2.cards.map(c => c.w.map(w => w.t).join(" ")).join(" / "));
});
