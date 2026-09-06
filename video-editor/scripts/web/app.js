"use strict";
const app = document.getElementById("app");
const crumb = document.getElementById("crumb");
const S = { pid: null, state: null, cfg: null, passed: new Set() };

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) n.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return n;
};

const pfile = rel => `/projects/${S.pid}/file/${rel}`;
async function getFile(rel) {
  const r = await fetch(pfile(rel));
  if (!r.ok) return null;
  try { return JSON.parse(await r.text()); } catch { return null; }
}

async function api(method, path, body, opts = {}) {
  const r = await fetch(path, {
    method,
    headers: body && !opts.raw ? { "Content-Type": "application/json" } : opts.headers || {},
    body: body == null ? undefined : opts.raw ? body : JSON.stringify(body),
  });
  const txt = await r.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error((data && data.error) || r.statusText);
  return data;
}

/* POST /run — parse the SSE stream manually (EventSource is GET-only). */
async function runStream(qs, onLine, onDone) {
  const r = await fetch(`/projects/${S.pid}/run${qs}`, { method: "POST" });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", ev = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const ln = buf.slice(0, i); buf = buf.slice(i + 1);
      if (ln.startsWith("event: ")) ev = ln.slice(7);
      else if (ln.startsWith("data: ")) {
        const p = JSON.parse(ln.slice(6));
        if (ev === "line") onLine(p.text);
        else if (ev === "done") onDone(p.exit);
      }
    }
  }
}

/* ---------- project list ---------- */
async function showList() {
  S.pid = null; crumb.textContent = "";
  const projects = await api("GET", "/projects");
  app.replaceChildren(
    el("h2", {}, "Projects"),
    el("div", { class: "row" },
      el("input", { class: "grow", id: "newname", placeholder: "New project name" }),
      el("button", { onclick: create }, "Create")),
    ...(projects.length ? [] : [el("p", { class: "muted" }, "No projects yet.")]),
    ...projects.map(p => el("div", { class: "card click", onclick: () => open(p.id) },
      el("div", { class: "row" },
        el("b", { class: "grow" }, p.id),
        el("span", { class: "pill" }, p.format),
        p.hasDeliverable ? el("span", { class: "pill", style: "color:var(--ok)" }, "done")
          : p.hasVideo ? el("span", { class: "pill" }, "in progress")
            : el("span", { class: "pill" }, "empty")))),
  );
}
async function create() {
  const name = document.getElementById("newname").value.trim();
  if (!name) return;
  const { id } = await api("POST", "/projects", { name });
  open(id);
}

/* ---------- one project ---------- */
async function open(id) {
  S.pid = id; S.passed = new Set(); crumb.textContent = "› " + id;
  await refresh();
}
/* the screen to show now: first stage that isn't done and hasn't been ticked past.
   RUN / HALT always count; an advisory checkpoint only until the user continues past it. */
function currentStep(stages) {
  for (const s of stages) {
    if (s.verdict === "SKIP") continue;
    if (s.verdict === "RUN" || s.verdict === "HALT" || !S.passed.has(s.id)) return s;
  }
  return null;
}
async function refresh() {
  try {
    S.cfg = await api("GET", `/projects/${S.pid}/config`);
    S.state = await api("GET", `/projects/${S.pid}/state`);
  } catch (e) { S.state = { error: String(e) }; }
  render();
}

function render() {
  const parts = [
    el("div", { class: "row" },
      el("span", { class: "link grow", onclick: showList }, "‹ all projects"),
      el("button", { class: "ghost", onclick: refresh }, "Refresh")),
    el("h2", {}, S.pid),
  ];

  parts.push(configPanel());
  parts.push(dropZone());

  const stages = (S.state && S.state.stages) || [];
  if (!stages.length) {
    // no pipeline yet — usually just means no video uploaded
    const msg = S.state && (S.state.error || S.state.blocked) || "";
    if (msg && !/rush\/ is empty|no rush/.test(msg))
      parts.push(el("p", { class: "muted" }, msg));
    return app.replaceChildren(...parts);
  }

  parts.push(stageList(stages));
  const step = currentStep(stages);
  if (!step) {
    parts.push(resultPanel());
  } else if (step.checkpoint) {
    const holder = el("div", {}, el("p", { class: "muted" }, "loading…"));
    parts.push(holder);
    Promise.resolve(checkpointPanel(step)).then(n => holder.replaceWith(n))
      .catch(e => holder.replaceWith(el("p", { class: "err" }, String(e))));
  } else {
    parts.push(runPanel(step.id, "Run the pipeline"));
  }
  app.replaceChildren(...parts);
}

function dropZone() {
  const d = el("div", { class: "drop" },
    el("div", {}, "Drop a video here, or"),
    el("input", { type: "file", accept: "video/*", onchange: e => upload(e.target.files[0]) }));
  d.addEventListener("dragover", e => { e.preventDefault(); d.classList.add("over"); });
  d.addEventListener("dragleave", () => d.classList.remove("over"));
  d.addEventListener("drop", e => { e.preventDefault(); d.classList.remove("over");
    if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
  return el("div", {}, el("h3", {}, "source video"), d);
}
async function upload(file) {
  if (!file) return;
  app.append(el("p", { class: "muted" }, `uploading ${file.name}…`));
  await fetch(`/projects/${S.pid}/rush`, { method: "POST", headers: { "X-Filename": file.name }, body: file });
  refresh();
}

function configPanel() {
  const c = S.cfg || {};
  const t = c.theme || {};
  const f = (label, val, id) => el("div", {}, el("label", {}, label), el("input", { id, value: val ?? "" }));
  return el("div", {},
    el("h3", {}, "configuration"),
    el("div", { class: "card" },
      el("div", { class: "row" },
        el("div", { class: "grow" }, f("Language (ar / fr / en / ar-MA …)", c.language, "cf_lang")),
        el("div", {}, el("label", {}, "Format"),
          select("cf_format", ["short", "long"], c.format || "short"))),
      el("div", { class: "row" },
        el("div", { class: "grow" }, f("Background color", t.bg, "cf_bg")),
        el("div", { class: "grow" }, f("Accent color", t.acc, "cf_acc")),
        el("div", { class: "grow" }, f("@handle", t.handle, "cf_handle"))),
      el("button", { style: "margin-top:12px", onclick: saveConfig }, "Save configuration")));
}
function select(id, opts, cur) {
  const s = el("select", { id });
  for (const o of opts) s.append(el("option", { value: o, ...(o === cur ? { selected: "" } : {}) }, o));
  return s;
}
async function saveConfig() {
  const g = id => document.getElementById(id).value.trim();
  const cfg = Object.assign({}, S.cfg, {
    format: g("cf_format"), engine: "light", language: g("cf_lang") || undefined,
    theme: Object.assign({}, S.cfg.theme, {
      bg: g("cf_bg") || undefined, acc: g("cf_acc") || undefined, handle: g("cf_handle") || undefined }),
  });
  await api("PUT", `/projects/${S.pid}/config`, cfg);
  refresh();
}

function stageList(stages) {
  const cur = (currentStep(stages) || {}).id;
  return el("div", {}, el("h3", {}, "pipeline"),
    el("div", { class: "stages" }, ...stages.map(s => {
      const rows = [el("div", { class: "st " + s.verdict + (s.id === cur ? " next" : "") },
        el("span", { class: "v" }, s.verdict), el("span", {}, s.title))];
      if (s.id === cur && s.note) rows.push(el("div", { class: "note" }, s.note));
      return rows;
    }).flat()));
}

function runPanel(toId, label) {
  const log = el("pre", { class: "log", style: "display:none" });
  const btn = el("button", { onclick: go }, label);
  async function go() {
    btn.disabled = true; log.style.display = "block"; log.textContent = "";
    await runStream("", t => { log.textContent += t + "\n"; log.scrollTop = log.scrollHeight; },
      exit => { log.textContent += `\n[exit ${exit}]`; btn.disabled = false; setTimeout(refresh, 300); });
  }
  return el("div", {}, log, btn);
}

/* a Run-up-to-here button + live log, shared by the checkpoint panels.
   `cpId` (if given) is ticked off when the user continues, so an advisory
   checkpoint doesn't re-open next refresh. */
function runHere(label = "Continue", cpId) {
  const log = el("pre", { class: "log", style: "display:none" });
  const btn = el("button", { onclick: async () => {
    btn.disabled = true; log.style.display = "block"; log.textContent = "";
    await runStream("", t => { log.textContent += t + "\n"; log.scrollTop = log.scrollHeight; },
      () => { btn.disabled = false; if (cpId) S.passed.add(cpId); setTimeout(refresh, 300); });
  } }, label);
  return { log, btn, node: el("div", {}, el("div", { class: "row" }, btn,
    el("button", { class: "ghost", onclick: refresh }, "re-check")), log) };
}

function checkpointPanel(cp) {
  if (cp.id === "transcript-fix") return transcriptPanel(cp);
  if (cp.id === "script-review") return trimPanel(cp);
  if (cp.id === "scenes") return scenesPanel(cp);
  const hint = {
    "sound-cues": "write build/sound-cues.json — at least {\"outro\": <seconds>} (screen #102)",
    tighten: "run `tighten.py <work>` then `tighten.py <work> apply` in the terminal",
    chapters: "optional — write config/chapters.json in the terminal, or Continue",
    broll: "optional — put clips in rush/broll/ + config/broll.json, or Continue",
  }[cp.id] || "do this step, then Continue";
  const r = runHere("Continue", cp.id);
  return el("div", {}, el("h3", {}, "next: " + cp.title),
    el("div", { class: "card" }, el("p", {}, cp.note || ""),
      el("p", { class: "muted" }, hint), r.node));
}

/* --- transcript correction (HALT transcript-fix) --- */
async function transcriptPanel(cp) {
  const box = el("div", {}, el("h3", {}, "correct the transcript"));
  const raw = await getFile("build/transcript-raw.json");
  if (!raw || !raw.segments) {
    box.append(el("p", { class: "muted" }, "waiting for build/transcript-raw.json — run to here first."));
    box.append(runHere("Transcribe").node);
    return box;
  }
  const rows = raw.segments.map(seg => {
    const want = (seg.words || []).length;
    const inp = el("input", { value: (seg.words || []).map(w => w.word).join(" ").trim() || (seg.text || "").trim() });
    const cnt = el("span", { class: "pill" });
    const upd = () => {
      const got = inp.value.trim().split(/\s+/).filter(Boolean).length;
      cnt.textContent = got + " / " + want;
      cnt.style.color = got === want ? "var(--mut)" : "var(--err)";
      save.disabled = rows.some(x => x.bad());
    };
    inp.addEventListener("input", upd);
    const row = { inp, want, bad: () => inp.value.trim().split(/\s+/).filter(Boolean).length !== want, upd };
    box.append(el("div", { class: "row", style: "margin:4px 0" }, el("span", { class: "grow" }, inp), cnt));
    return row;
  });
  const hot = el("input", { placeholder: "hot words (comma-separated, get the accent pill)" });
  const save = el("button", { onclick: async () => {
    save.disabled = true;
    await api("PUT", `/projects/${S.pid}/decision/transcript-fixes`, {
      fix: rows.map(r => r.inp.value.trim().split(/\s+/).filter(Boolean)),
      hot: hot.value.split(",").map(s => s.trim()).filter(Boolean),
    });
    refresh();
  } }, "Save & continue");
  box.append(el("label", {}, "hot words"), hot, el("div", { style: "margin-top:12px" }, save));
  rows.forEach(r => r.upd());
  return box;
}

/* --- drop sentences (CHECKPOINT script-review) --- */
const norm = w => w.toLowerCase().replace(/[ً-ْـ]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
function similar(a, b) {
  const sa = new Set(a.map(norm)), sb = new Set(b.map(norm));
  let shared = 0; for (const w of sa) if (sb.has(w)) shared++;
  return shared / Math.min(sa.size, sb.size || 1);
}
async function trimPanel(cp) {
  const box = el("div", {}, el("h3", {}, "review the script — drop repeated or unwanted sentences"));
  const caps = await getFile("build/captions.json");
  if (!caps || !caps.cards) {
    box.append(el("p", { class: "muted" }, "waiting for build/captions.json."));
    box.append(runHere("Build captions").node);
    return box;
  }
  const words = caps.cards.map(c => c.w.map(w => w.t));
  const dupes = new Set();
  for (let i = 0; i < words.length - 1; i++)
    for (let j = i + 1; j <= Math.min(i + 2, words.length - 1); j++)
      if (similar(words[i], words[j]) >= 0.6) { dupes.add(i); break; }
  const boxes = caps.cards.map((c, i) => {
    const cb = el("input", { type: "checkbox", checked: "" });
    box.append(el("label", { class: "row", style: "margin:3px 0; cursor:pointer" },
      cb, el("span", { class: "grow" }, `${i + 1}. ${c.w.map(w => w.t).join(" ")}`),
      dupes.has(i) ? el("span", { class: "pill", style: "color:var(--warn)" }, "looks repeated") : ""));
    return cb;
  });
  if (dupes.size) box.querySelector("h3").after(
    el("p", { class: "muted" }, "Highlighted rows look like a restatement of a nearby sentence — usually the first one is the mistake."));
  const apply = el("button", { onclick: async () => {
    const drop = boxes.map((cb, i) => cb.checked ? 0 : i + 1).filter(Boolean);  // edit_script.py is 1-indexed
    apply.disabled = true;
    if (drop.length) await api("POST", `/projects/${S.pid}/edit`, { op: "drop", sentences: drop });
    S.passed.add("script-review"); refresh();
  } }, "Apply & continue");
  const r = runHere("Continue (nothing to drop)", "script-review");
  box.append(el("div", { class: "row", style: "margin-top:12px" }, apply), r.node);
  return box;
}

/* --- scene design (CHECKPOINT scenes) --- */
async function scenesPanel(cp) {
  const box = el("div", {}, el("h3", {}, "design the scenes"),
    el("p", { class: "muted" }, "One row per sentence. Pick a motif (a visual metaphor for what's said) "
      + "or leave it blank for a plain caption. Params are JSON — edit the template."));
  const caps = await getFile("build/captions.json");
  if (!caps || !caps.cards) {
    box.append(el("p", { class: "muted" }, "waiting for build/captions.json."), runHere("Build captions").node);
    return box;
  }
  const motifs = (await (await fetch("/motifs")).json().catch(() => ({}))).motifs || {};
  const impl = Object.entries(motifs).filter(([, m]) => m.status === "implemented");
  const existing = (await getFile("config/scenes.json")) || [];
  const bySent = {};
  for (const s of existing) if (s.ref && typeof s.ref.sentence === "number") bySent[s.ref.sentence] = s;

  const tmpl = name => {
    const m = motifs[name]; if (!m || !m.params) return "{}";
    const o = {};
    for (const [k, t] of Object.entries(m.params))
      o[k] = t === "number" ? 0 : t === "boolean" ? false : /\[\]$/.test(t) ? [] : "";
    return JSON.stringify(o);
  };
  const rows = caps.cards.map((c, i) => {
    const pre = bySent[i] || {};
    const lay = select("", ["FULL", "DOWN", "LOWER"], (typeof pre.layout === "string" ? pre.layout : pre.layout?.mode) || "FULL");
    const mot = el("select", {});
    mot.append(el("option", { value: "" }, "— none —"));
    for (const [n] of impl) mot.append(el("option", { value: n, ...(pre.motif === n ? { selected: "" } : {}) }, n));
    const par = el("input", { value: JSON.stringify(pre.params || {}) === "{}" ? "" : JSON.stringify(pre.params) });
    mot.addEventListener("change", () => { if (mot.value && !par.value) par.value = tmpl(mot.value); });
    box.append(el("div", { class: "card", style: "padding:10px" },
      el("div", { class: "muted", style: "margin-bottom:6px" }, `${i + 1}. ${c.w.map(w => w.t).join(" ")}`),
      el("div", { class: "row" },
        el("div", {}, el("label", {}, "layout"), lay),
        el("div", {}, el("label", {}, "motif"), mot),
        el("div", { class: "grow" }, el("label", {}, "params (JSON)"), par))));
    return { i, lay, mot, par, s: c.s, e: c.e };
  });

  const build = () => rows.filter(r => r.mot.value || r.lay.value !== "FULL").map(r => {
    let params = {};
    try { params = r.par.value ? JSON.parse(r.par.value) : {}; } catch { throw new Error(`row ${r.i + 1}: params is not valid JSON`); }
    return { ref: { sentence: r.i }, layout: r.lay.value, motif: r.mot.value || null, params };
  });
  const err = el("p", { class: "err" });
  const preview = el("div", { class: "row", style: "flex-wrap:wrap;gap:8px;margin-top:10px" });
  const save = async () => { err.textContent = "";
    try { await api("PUT", `/projects/${S.pid}/decision/scenes`, build()); return true; }
    catch (e) { err.textContent = String(e.message || e); return false; } };
  const saveBtn = el("button", { onclick: async () => { if (await save()) { S.passed.add("scenes"); refresh(); } } }, "Save & continue");
  const prevBtn = el("button", { class: "ghost", onclick: async () => {
    if (!(await save())) return;
    prevBtn.disabled = true; preview.replaceChildren(el("span", { class: "muted" }, "rendering…"));
    const times = rows.map(r => +((r.s + r.e) / 2).toFixed(2));
    const res = await api("POST", `/projects/${S.pid}/preview`, { times }).catch(e => ({ files: [], output: String(e) }));
    preview.replaceChildren(...(res.files || []).map(f =>
      el("img", { src: `/projects/${S.pid}/file/${f}`, style: "width:150px;border-radius:6px;border:1px solid var(--line)" })));
    if (!res.files?.length) preview.append(el("span", { class: "muted" }, "no preview — " + (res.output || "").slice(-200)));
    prevBtn.disabled = false;
  } }, "Save + preview");
  const r = runHere("Continue (captions only)", "scenes");
  box.append(el("div", { class: "row", style: "margin-top:14px" }, saveBtn, prevBtn), err, preview, r.node);
  return box;
}

function resultPanel() {
  const f = p => `/projects/${S.pid}/file/${p}`;
  return el("div", {},
    el("h3", {}, "result"),
    el("video", { src: f("video-final.mp4"), controls: "" }),
    el("div", { class: "row", style: "margin-top:10px" },
      el("a", { href: f("video-final.mp4"), download: "" }, "video-final.mp4"),
      el("a", { href: f("video-final.srt"), download: "" }, ".srt"),
      el("a", { href: f("post-caption.txt"), download: "" }, "post caption")),
    runPanel(null, "Re-run (after an edit)"));
}

showList().catch(e => app.replaceChildren(el("p", { class: "err" }, String(e))));
