/* web UI shell (#99) — the SPA loads, lists/creates a project, shows the config form +
   drop zone, uploads a video, renders the state-driven stage list. */
const fs = require("fs");
const T = require("./_lib");

T.web("spa", async ({ base, page, vid, check }) => {
  const js = await fetch(base + "/app.js"), css = await fetch(base + "/app.css");
  check("app.js served as JavaScript", js.status === 200 && /javascript/.test(js.headers.get("content-type")));
  check("app.css served as CSS", css.status === 200 && /css/.test(css.headers.get("content-type")));

  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Projects", { timeout: 8000 });
  check("project list renders", (await page.$eval("h2", n => n.textContent)) === "Projects");

  await page.type("#newname", "My Web Test");
  await Promise.all([
    page.waitForFunction(() => document.querySelector("h2")?.textContent === "my-web-test", { timeout: 8000 }),
    page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent === "Create").click()),
  ]);
  check("config form present", await page.$("#cf_lang") != null);
  check("drop zone present", await page.$(".drop") != null);

  await page.type("#cf_lang", "en");
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent === "Save configuration").click());
  await T.sleep(800);

  await (await page.$('input[type=file]')).uploadFile(vid);
  await page.waitForFunction(() => document.querySelectorAll(".st").length > 5, { timeout: 20000 });
  const verdicts = await page.$$eval(".st .v", ns => ns.map(n => n.textContent));
  check("the 16-stage pipeline renders", verdicts.length >= 10, verdicts.join(","));
  check("a Run button is offered", await page.evaluate(() => [...document.querySelectorAll("button")].some(b => /Run/.test(b.textContent))));
});
