/* Every implemented motif renders through compose.reference.html's drawScenes on a real
   headless canvas: each must draw (change pixels inside its span), never throw, never warn. */
const fs = require("fs"), path = require("path");
const T = require("./_lib");

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const WORDS = [{ t: "one", s: 1, e: 2.5, hot: false }, { t: "two", s: 2.5, e: 4, hot: false }, { t: "three", s: 4, e: 6, hot: false }];
const CAPS = { total: 20, cards: [{ s: 1.0, e: 6.0, w: WORDS }] };
const SCHED = [{ s: 0, e: 1, m: "FULL" }, { s: 1, e: 6, m: "FULL" }, { s: 6, e: 9999, m: "FULL" }];
const CASES = {
  stamp: { lead: "0%", text: "handmade" },
  counter: { title: "cost", from: 88, to: 0, prefix: "$", decimals: 2 },
  quote: { text: "the problem", accent: true },
  checklist: { title: "the fix", items: ["diagnose", "edit", "test"], tick: "even" },
  "card-stack": { items: ["cut", "caption", "zoom", "motion"], columns: 2 },
  "transcript-panel": { title: "auto transcript" },
  "file-merge": { sources: ["clip A", "clip B", "clip C"], targetLabel: "one file", done: "ready" },
  glitch: { intensity: 1 },
  "comment-box": { word: "video" },
  "sync-viz": { title: "word-level sync" },
  suspense: { rings: 2 },
};

/* draw frame `t` in the page and reduce the canvas to one number (every 12th pixel, weighted) */
const canvasSum = t => { window.draw(t); const d = X.getImageData(0, 0, 1080, 1920).data;
  let s = 0; for (let i = 0; i < d.length; i += 48) s += d[i] * 3 + d[i + 1] * 2 + d[i + 2]; return s; };

const idx = JSON.parse(fs.readFileSync(path.join(T.SCRIPTS, "motifs", "index.json"), "utf8")).motifs;
const compose = T.platform.fileUrl(path.join(T.SCRIPTS, "compose.reference.html"));
const TIMES = [2.0, 3.5, 5.0];   // three frames inside the 1–6 s span

async function renders(browser, name, kind) {
  const page = await browser.newPage();
  const warns = [];
  page.on("pageerror", e => warns.push("throw: " + e.message));
  page.on("console", m => { if (/WARN (motif|scene)|is not a function|Cannot read/.test(m.text())) warns.push(m.text()); });
  await page.setViewport({ width: 1080, height: 1920 });
  await page.setCacheEnabled(false);
  await page.goto(compose, { waitUntil: "load" });   // the pixel-sum check doesn't need the web font

  const src = fs.readFileSync(path.join(T.SCRIPTS, "motifs", "canvas", name + ".js"), "utf8");
  const scene = { s: 1, e: 6, mode: "FULL", transition: null, gb: null, motif: name, kind,
    params: CASES[name] || {}, timing: { in: 0.2, out: 0.2, hold: "full" }, words: WORDS, bottom: 400 };

  const sample = async withMotif => {
    await page.evaluate((c, sc, sch, mo, px, use) => {
      document.getElementById("LOGO").src = px;
      window.init({ cards: c.cards, total: c.total, outro: 5, theme: {}, scenes: [sc], schedule: sch,
        motifs: use ? { [sc.motif]: mo } : {} });
    }, CAPS, scene, SCHED, src, PX, withMotif);
    await page.evaluate(px => window.setFrame(px), PX);
    const out = [];
    for (const t of TIMES) out.push(await page.evaluate(canvasSum, t));
    return out;
  };
  const withM = await sample(true);
  const base = await sample(false);
  await page.close();
  return { draws: TIMES.some((_, i) => withM[i] !== base[i]), warns };
}

T.withBrowser("motifs", async ({ browser, check }) => {
  for (const [name, def] of Object.entries(idx)) {
    if (def.status !== "implemented") continue;
    const r = await renders(browser, name, def.kind);
    check(name.padEnd(18) + (r.draws ? "draws" : "NO DRAW") + (r.warns.length ? "  " + r.warns.join(" | ") : ""),
      r.draws && r.warns.length === 0);
  }
});
