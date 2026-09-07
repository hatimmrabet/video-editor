/* fx/behind_text.js `plan` (#52) — proximity flags vs build/person-cutout.json.
   `plan` / `off` don't need swiftc, so they run on any OS. */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const T = require("./_lib");

const BT = path.join(T.SCRIPTS, "fx", "behind_text.js");
const W = T.tmp("bt-work");
fs.mkdirSync(path.join(W, "build"), { recursive: true });

const caps = { total: 34, cards: [
  { s: 0.2, e: 2.0, w: [{ t: "ابدأ", s: 0.3, e: 1.0 }, { t: "هنا", s: 1.0, e: 1.8 }] },
  { s: 2.5, e: 8.0, w: [{ t: "جملة", s: 2.6, e: 3.4 }, { t: "طويلة", s: 3.4, e: 4.2 }, { t: "جدا", s: 4.2, e: 5 }, { t: "هنا", s: 5, e: 6 }, { t: "الآن", s: 6, e: 8 }] },
  { s: 10.0, e: 11.6, w: [{ t: "نقطة", s: 10.1, e: 10.8 }, { t: "مهمة", s: 10.8, e: 11.5 }] },
  { s: 13.5, e: 15.2, w: [{ t: "أخرى", s: 13.6, e: 14.3 }, { t: "قريبة", s: 14.3, e: 15.1 }] },
  { s: 16.0, e: 24.0, w: [{ t: "و", s: 16.1, e: 17 }, { t: "هذه", s: 17, e: 18 }, { t: "جملة", s: 18, e: 20 }, { t: "طويلة", s: 20, e: 22 }, { t: "أيضا", s: 22, e: 24 }] },
  { s: 30.0, e: 31.7, w: [{ t: "النهاية", s: 30.1, e: 30.9 }, { t: "هنا", s: 30.9, e: 31.6 }] },
] };
fs.writeFileSync(path.join(W, "build", "captions.json"), JSON.stringify(caps), "utf8");
const setPC = obj => fs.writeFileSync(path.join(W, "build", "person-cutout.json"), JSON.stringify(obj), "utf8");
const rmPC = () => fs.rmSync(path.join(W, "build", "person-cutout.json"), { force: true });
const plan = () => execFileSync("node", [BT, W, "plan"], { encoding: "utf8" });
const flagged = (out, n) => new RegExp(`^\\s+${n}\\s.*from a moment already built`, "m").test(out);

T.node("behind-text", async ({ check }) => {
  rmPC();
  let out = plan();
  check("lists the 4 short sentences", [1, 3, 4, 6].every(n => new RegExp(`^\\s+${n}\\s`, "m").test(out)), out);
  check("sentence 2 (long) not listed", !/^\s+2\s/m.test(out), out);
  check("hook label on #1", /1 .*the hook/.test(out), out);
  check("no proximity warning with nothing built", !/from a moment already built/.test(out), out);

  setPC({ lines: [{ card: 2, s: 11.0, e: 13.0, words: [] }], ranges: [[331, 391]], faces: {} });
  out = plan();
  check("#3 flagged (overlaps the built moment)", flagged(out, 3), out);
  check("#4 flagged (1.3 s away)", flagged(out, 4), out);
  check("#1 not flagged (far)", !flagged(out, 1), out);
  check("#6 not flagged (far)", !flagged(out, 6), out);

  setPC({ lines: [{ card: 2, s: 9.9, e: 12.05, words: [] }], cutouts: [[24.0, 26.6]], ranges: [], faces: {} });
  check("budget-spent banner at 2 moments", /whole budget \(invariant #8/.test(plan()), plan());
});
