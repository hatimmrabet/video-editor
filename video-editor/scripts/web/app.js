"use strict";
const app = document.getElementById("app");
const crumb = document.getElementById("crumb");
const S = { pid: null, state: null, cfg: null, passed: new Set(), kind: null };

/* the project-type picker's choice, remembered per project so the drop zone shows the
   right affordance before any file exists (once files land, S.state.world is authoritative).
   long-form also writes config.format="long"; montage is inferred from rush/ at 2+ clips. */
const KINDS = { reel: "talking-to-camera reel (9:16)", montage: "montage of clips (9:16)", "long-form": "long-form talk (16:9)" };
const kindOf = pid => { try { return localStorage.getItem("ve-kind-" + pid); } catch { return null; } };
const setKind = (pid, k) => { try { localStorage.setItem("ve-kind-" + pid, k); } catch { /* private mode */ } };
/* the world the UI should assume: run.py's verdict once it can plan, else the picker hint */
const worldNow = () => (S.state && S.state.world) || {
  reel: "reel-speech", montage: "broll-montage", "long-form": "long-form",
}[S.kind] || null;

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
      select("newkind", Object.keys(KINDS), "reel", KINDS),
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
  const kind = document.getElementById("newkind").value;
  const { id } = await api("POST", "/projects", { name, ...(kind === "long-form" ? { format: "long" } : {}) });
  setKind(id, kind);
  await open(id);
}

/* ---------- one project ---------- */
async function open(id) {
  S.pid = id; S.passed = new Set(); S.kind = kindOf(id); crumb.textContent = "› " + id;
  await refresh();
}
/* the screen to show now: first stage that isn't done and hasn't been ticked past.
   HALT always counts; a producing RUN stage counts; an advisory checkpoint counts
   until the user continues past it. A runnable stage that writes no file (`safe` —
   a verification gate) is always RUN in run.py's eyes, so it never wedges the flow:
   the full-run button and the Result panel's "re-run" both execute it, and a real
   failure there keeps `master`/`subs` RUN so the Result screen stays hidden anyway. */
function currentStep(stages) {
  for (const s of stages) {
    if (s.verdict === "SKIP") continue;
    if (s.verdict === "HALT") return s;
    if (s.verdict === "RUN") { if (!s.checkpoint && !s.makes) continue; return s; }
    if (!S.passed.has(s.id)) return s;
  }
  return null;
}
/* how far a "Run the pipeline" click should go: run.py stops itself at a blocking
   checkpoint, but an advisory one (montage `pick`, long-form `chapters`/`broll`) it just
   prints and runs past — so cap the run at the stage before the next un-passed advisory
   checkpoint, letting its panel open first. "" = run to the end. */
function runTarget(stages) {
  let last = "";
  for (const s of stages) {
    if (s.checkpoint && !s.block && !S.passed.has(s.id)) return last;
    if (s.verdict !== "SKIP" && !s.checkpoint) last = s.id;
  }
  return "";
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
    parts.push(runPanel(runTarget(stages), "Run the pipeline"));
  }
  app.replaceChildren(...parts);
}

function dropZone() {
  const w = worldNow();
  const many = w === "broll-montage" || w === "long-form";
  const label = w === "broll-montage" ? "Drop your clips here (two or more), or"
    : w === "long-form" ? "Drop the recording here (one file, or several takes to join), or"
      : "Drop the recording here, or";
  const inp = el("input", { type: "file", accept: "video/*", onchange: e => uploadMany(e.target.files) });
  if (many) inp.setAttribute("multiple", "");
  const d = el("div", { class: "drop" }, el("div", {}, label), inp);
  d.addEventListener("dragover", e => { e.preventDefault(); d.classList.add("over"); });
  d.addEventListener("dragleave", () => d.classList.remove("over"));
  d.addEventListener("drop", e => { e.preventDefault(); d.classList.remove("over"); uploadMany(e.dataTransfer.files); });
  const kids = [el("h3", {}, w === "broll-montage" ? "source clips" : "source video"), d];
  if (w === "broll-montage") {   // the montage needs a background track — master_audio.sh reads rush/bg-audio.mp3
    kids.push(el("label", { style: "margin-top:10px" }, "background track (saved as rush/bg-audio.mp3)"),
      el("input", { type: "file", accept: "audio/*",
        onchange: e => e.target.files[0] && fetch(`/projects/${S.pid}/rush`,
          { method: "POST", headers: { "X-Filename": "bg-audio.mp3" }, body: e.target.files[0] }).then(refresh) }));
  }
  return el("div", {}, ...kids);
}
async function uploadMany(files) {
  files = [...(files || [])];
  if (!files.length) return;
  const note = el("p", { class: "muted" }, `uploading ${files.length} file(s)…`);
  app.append(note);
  for (const file of files)
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
function select(id, opts, cur, labels) {
  const s = el("select", { id });
  for (const o of opts) s.append(el("option", { value: o, ...(o === cur ? { selected: "" } : {}) }, (labels && labels[o]) || o));
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
  const w = S.state && S.state.world;
  return el("div", {},
    el("h3", {}, "pipeline", w ? el("span", { class: "pill", style: "margin-left:8px;text-transform:none" }, w) : ""),
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
    await runStream(toId ? "?to=" + toId : "", t => { log.textContent += t + "\n"; log.scrollTop = log.scrollHeight; },
      exit => { log.textContent += `\n[exit ${exit}]`; btn.disabled = false; setTimeout(refresh, 300); });
  }
  return el("div", {}, log, btn);
}

/* a Run-up-to-here button + live log, shared by the checkpoint panels.
   `cpId` (if given) is ticked off when the user continues, so an advisory
   checkpoint doesn't re-open next refresh. `to` caps the run at a stage id. */
function runHere(label = "Continue", cpId, to) {
  const log = el("pre", { class: "log", style: "display:none" });
  const btn = el("button", { onclick: async () => {
    btn.disabled = true; log.style.display = "block"; log.textContent = "";
    await runStream(to ? "?to=" + to : "", t => { log.textContent += t + "\n"; log.scrollTop = log.scrollHeight; },
      () => { btn.disabled = false; if (cpId) S.passed.add(cpId); setTimeout(refresh, 300); });
  } }, label);
  return { log, btn, node: el("div", {}, el("div", { class: "row" }, btn,
    el("button", { class: "ghost", onclick: refresh }, "re-check")), log) };
}

function checkpointPanel(cp) {
  if (cp.id === "transcript-fix") return transcriptPanel(cp);
  if (cp.id === "script-review") return trimPanel(cp);
  if (cp.id === "scenes") return scenesPanel(cp);
  if (cp.id === "sound-cues") return soundPanel(cp);
  if (cp.id === "pick") return montagePickPanel(cp);
  if (cp.id === "tighten") return tightenPanel(cp);
  if (cp.id === "chapters") return chaptersPanel(cp);
  if (cp.id === "broll") return brollPanel(cp);
  const r = runHere("Continue", cp.id);
  return el("div", {}, el("h3", {}, "next: " + cp.title),
    el("div", { class: "card" }, el("p", {}, cp.note || ""),
      el("p", { class: "muted" }, "do this step, then Continue"), r.node));
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

/* --- sound cues (HALT sound-cues) --- */
const CUES = ["whoosh_up", "whoosh_down", "thud", "tap"];
async function soundPanel(cp) {
  const box = el("div", {}, el("h3", {}, "sound"),
    el("p", { class: "muted" }, "Set the end-card length, then click the waveform to drop a cue. "
      + "A cue marks a meaningful beat — a number landing, something breaking, a scene change. Keep it sparse."));
  const caps = await getFile("build/captions.json");
  const cur = (await getFile("build/sound-cues.json")) || {};
  const dur = (caps && caps.total) || 30;
  const cues = {};
  for (const k of CUES) cues[k] = Array.isArray(cur[k]) ? cur[k].slice() : [];

  const outro = el("input", { type: "number", step: "0.1", value: cur.outro ?? 5, style: "width:90px" });
  const kind = select("", CUES, "whoosh_up");
  const cv = el("canvas", { width: 900, height: 90, style: "width:100%;background:#0c0e12;border:1px solid var(--line);border-radius:8px;cursor:crosshair" });
  const list = el("div", { class: "muted", style: "font-size:12px;margin-top:6px" });

  const draw = peaks => {
    const x = cv.getContext("2d"), W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    x.fillStyle = "#3a4150";
    if (peaks) for (let i = 0; i < W; i++) { const h = peaks[i] * H; x.fillRect(i, (H - h) / 2, 1, h || 1); }
    else { x.fillStyle = "#232833"; x.fillRect(0, H / 2 - 1, W, 2); }
    // sentence boundaries
    if (caps) { x.strokeStyle = "#2c313a"; caps.cards.forEach(c => { const px = c.s / dur * W; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); }); }
    const col = { whoosh_up: "#5b9dff", whoosh_down: "#8a6dff", thud: "#e0574d", tap: "#4caf7d" };
    for (const k of CUES) for (const t of cues[k]) {
      const px = t / dur * W; x.fillStyle = col[k]; x.fillRect(px - 1, 0, 3, H);
    }
  };
  const relist = () => {
    list.replaceChildren(...CUES.flatMap(k => cues[k].map(t =>
      el("span", { class: "pill", style: "margin:2px 4px 0 0;cursor:pointer",
        onclick: () => { cues[k] = cues[k].filter(x => x !== t); draw(peaks); relist(); } }, `${k} ${t.toFixed(2)}s ✕`))));
  };
  cv.addEventListener("click", e => {
    const t = +((e.offsetX / cv.clientWidth) * dur).toFixed(2);
    const k = kind.value;
    if (!cues[k].includes(t)) cues[k].push(t), cues[k].sort((a, b) => a - b);
    draw(peaks); relist();
  });

  let peaks = null;
  draw(null); relist();
  fetch(pfile("build/transcribe-input.wav")).then(r => r.ok ? r.arrayBuffer() : null).then(async buf => {
    if (!buf) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ac.decodeAudioData(buf);
    const ch = audio.getChannelData(0), W = cv.width, step = Math.floor(ch.length / W);
    peaks = new Array(W);
    for (let i = 0; i < W; i++) { let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(ch[i * step + j] || 0)); peaks[i] = m; }
    draw(peaks);
  }).catch(() => {});

  const save = el("button", { onclick: async () => {
    save.disabled = true;
    const out = { outro: +outro.value || 5 };
    for (const k of CUES) if (cues[k].length) out[k] = cues[k];
    await api("PUT", `/projects/${S.pid}/decision/sound-cues`, out);
    refresh();   // sound-cues.json now exists → the checkpoint clears, the run button appears
  } }, "Save & continue");
  box.append(
    el("div", { class: "row" }, el("label", { style: "margin:0" }, "end card (s)"), outro,
      el("label", { style: "margin:0 0 0 16px" }, "cue type"), kind),
    el("div", { style: "margin-top:10px" }, cv), list,
    el("div", { class: "row", style: "margin-top:12px" }, save));
  return box;
}

/* --- montage: drop shots (CHECKPOINT pick) --- */
async function montagePickPanel(cp) {
  const box = el("div", {}, el("h3", {}, "pick the shots"),
    el("p", { class: "muted" }, "Uncheck a shot to drop it from the montage. The scorer already picked "
      + "each clip's sharpest, liveliest moment — this is just for the ones you don't want at all."));
  const plan = await getFile("build/montage-plan.json");
  if (!plan || !plan.clips) {
    box.append(el("p", { class: "muted" }, "waiting for the scan + contact sheet."), runHere("Scan + sheet", null, "sheet").node);
    return box;
  }
  box.append(el("img", { src: pfile("build/montage-contact-sheet.jpg?" + Date.now()),
    style: "width:100%;border-radius:8px;border:1px solid var(--line);margin-bottom:10px" }));
  const boxes = plan.clips.map(c => {
    const cb = el("input", { type: "checkbox", ...(c.skip ? {} : { checked: "" }) });
    box.append(el("label", { class: "row", style: "margin:3px 0;cursor:pointer" },
      cb, el("span", { class: "grow" }, `${c.i}. ${c.name}`),
      el("span", { class: "pill" }, `score ${(c.score ?? 0).toFixed(2)}`)));
    return { cb, i: c.i };
  });
  const apply = el("button", { onclick: async () => {
    apply.disabled = true;
    const keep = boxes.filter(b => b.cb.checked).map(b => b.i);
    const r = await api("POST", `/projects/${S.pid}/montage`, { op: "keep", clips: keep });
    if (r.exit) { apply.disabled = false; return box.append(el("pre", { class: "log" }, r.output)); }
    S.passed.add("pick"); refresh();
  } }, "Apply & continue");
  const cont = el("button", { class: "ghost", onclick: () => { S.passed.add("pick"); refresh(); } }, "Keep all");
  box.append(el("div", { class: "row", style: "margin-top:12px" }, apply, cont));
  return box;
}

/* --- long-form: tighten the pauses + fillers (HALT tighten) --- */
async function tightenPanel(cp) {
  const box = el("div", {}, el("h3", {}, "tighten the talk"));
  if (!(await getFile("build/captions.json"))) {
    box.append(el("p", { class: "muted" }, "waiting for build/captions.json."), runHere("Build captions").node);
    return box;
  }
  const body = el("div");
  box.append(body);
  const paint = plan => {
    body.replaceChildren();
    if (!plan) {
      body.append(
        el("p", { class: "muted" }, "Trims every inter-word pause over the threshold to a hard jump cut, "
          + "and removes filler words. Nothing is changed until you apply."),
        el("button", { onclick: async () => { await api("POST", `/projects/${S.pid}/tighten`, {}); paint(await getFile("build/tighten-plan.json")); } }, "Propose the cuts"));
      return;
    }
    const fill = plan.fillers || [], gaps = plan.gaps || [];
    body.append(el("p", {}, `${plan.before?.toFixed(1)}s → ${plan.after?.toFixed(1)}s  `,
      el("b", {}, `(−${plan.saved?.toFixed(1)}s)`), `  ·  ${gaps.length} pause(s) trimmed  ·  ${fill.length} filler(s)`));
    if (fill.length) {
      body.append(el("p", { class: "muted", style: "margin-bottom:2px" }, "fillers to remove (review the context):"));
      const ul = el("div", { style: "font-size:13px;max-height:200px;overflow:auto" });
      for (const x of fill) ul.append(el("div", {}, el("b", {}, `"${x.text}"`), el("span", { class: "muted" }, `  … ${x.ctx} …`)));
      body.append(ul);
    }
    body.append(el("div", { class: "row", style: "margin-top:12px" },
      el("button", { onclick: async () => { const r = await api("POST", `/projects/${S.pid}/tighten`, { apply: true });
        if (r.exit) return body.append(el("pre", { class: "log" }, r.output)); refresh(); } }, "Apply the cuts"),
      el("button", { class: "ghost", onclick: () => refresh() }, "Continue without applying"),
      el("button", { class: "ghost", onclick: async () => { await api("POST", `/projects/${S.pid}/tighten`, {}); paint(await getFile("build/tighten-plan.json")); } }, "Re-propose")));
  };
  paint(await getFile("build/tighten-plan.json"));
  return box;
}

/* --- long-form: chapter markers (CHECKPOINT chapters, optional) --- */
async function chaptersPanel(cp) {
  const box = el("div", {}, el("h3", {}, "chapter markers"),
    el("p", { class: "muted" }, "Optional. Mark 3–8 topic shifts by sentence number — the first is forced to 00:00. "
      + "No chapters is fine."));
  const caps = await getFile("build/captions.json");
  const n = caps && caps.cards ? caps.cards.length : 0;
  const rows = el("div");
  const existing = (await getFile("config/chapters.json")) || [{ ref: { sentence: 0 }, title: "" }];
  const addRow = (sent, title) => {
    const s = el("input", { type: "number", min: "0", ...(n ? { max: String(n - 1) } : {}), value: sent ?? 0, style: "width:90px" });
    const t = el("input", { value: title || "", placeholder: "chapter title" });
    const row = el("div", { class: "row", style: "margin:4px 0" }, s, el("div", { class: "grow" }, t),
      el("button", { class: "ghost", onclick: () => row.remove() }, "✕"));
    row._get = () => ({ ref: { sentence: +s.value }, title: t.value.trim() });
    rows.append(row);
  };
  for (const c of existing) addRow(c.ref && c.ref.sentence, c.title);
  box.append(rows, el("button", { class: "ghost", style: "margin-top:6px", onclick: () => addRow(0, "") }, "+ chapter"));
  const save = el("button", { onclick: async () => {
    const list = [...rows.children].map(r => r._get()).filter(c => c.title);
    if (list.length) await api("PUT", `/projects/${S.pid}/decision/chapters`, list);
    S.passed.add("chapters"); refresh();
  } }, "Save & continue");
  box.append(el("div", { class: "row", style: "margin-top:12px" }, save,
    el("button", { class: "ghost", onclick: () => { S.passed.add("chapters"); refresh(); } }, "Skip — no chapters")));
  return box;
}

/* --- long-form: B-roll cutaways (CHECKPOINT broll, optional) --- */
async function brollPanel(cp) {
  const box = el("div", {}, el("h3", {}, "b-roll cutaways"),
    el("p", { class: "muted" }, "Optional. Put the cutaway clips in the project's rush/broll/ folder, then point "
      + "each span at one. \"when\" is a time range (12.5-18) or a sentence (s34)."));
  const rows = el("div");
  const parseWhen = v => {
    v = v.trim();
    if (/^s\d+$/i.test(v)) return { sentence: +v.slice(1) };
    if (/^[\d.]+\s*-\s*[\d.]+$/.test(v)) return { range: v.split("-").map(Number) };
    return null;
  };
  const addRow = (when, clip, at) => {
    const w = el("input", { value: when || "", placeholder: "12.5-18  or  s34", style: "width:130px" });
    const c = el("input", { value: clip || "", placeholder: "clip.mp4 (in rush/broll/)" });
    const a = el("input", { type: "number", step: "0.1", value: at ?? 0.4, style: "width:80px" });
    const row = el("div", { class: "row", style: "margin:4px 0" }, w, el("div", { class: "grow" }, c), a,
      el("button", { class: "ghost", onclick: () => row.remove() }, "✕"));
    row._empty = () => !w.value.trim() && !c.value.trim();
    row._get = () => {
      const ref = parseWhen(w.value);
      return ref && c.value.trim() ? { ref, clip: c.value.trim(), at: +a.value || 0.4 } : null;
    };
    rows.append(row);
  };
  for (const b of (await getFile("config/broll.json")) || [])
    addRow(b.ref && b.ref.sentence != null ? "s" + b.ref.sentence
      : b.ref && b.ref.range ? b.ref.range.join("-") : "", b.clip, b.at);
  if (!rows.children.length) addRow("", "", 0.4);
  const added = el("span", { class: "muted", style: "font-size:12px" });
  const up = el("input", { type: "file", accept: "video/*", multiple: "", style: "margin-top:8px", onchange: async e => {
    for (const file of e.target.files)
      await fetch(`/projects/${S.pid}/rush`, { method: "POST", headers: { "X-Filename": "broll/" + file.name }, body: file });
    added.textContent = "added to rush/broll/: " + [...e.target.files].map(f => f.name).join(", ");
  } });
  box.append(rows, el("button", { class: "ghost", style: "margin-top:6px", onclick: () => addRow("", "", 0.4) }, "+ cutaway"),
    el("label", { style: "margin-top:10px" }, "upload cutaway clips (→ rush/broll/)"), up, added);
  const err = el("p", { class: "err" });
  const save = el("button", { onclick: async () => {
    err.textContent = "";
    const use = [...rows.children].filter(r => !r._empty());
    const got = use.map(r => r._get());
    if (got.some(x => !x)) { err.textContent = "each filled row needs a valid \"when\" (12.5-18 or s34) and a clip name"; return; }
    if (got.length) await api("PUT", `/projects/${S.pid}/decision/broll`, got);
    S.passed.add("broll"); refresh();
  } }, "Save & continue");
  box.append(err, el("div", { class: "row", style: "margin-top:12px" }, save,
    el("button", { class: "ghost", onclick: () => { S.passed.add("broll"); refresh(); } }, "Skip — no b-roll")));
  return box;
}

function resultPanel() {
  const f = p => `/projects/${S.pid}/file/${p}`;
  const size = el("span", { class: "muted" });
  fetch(f("video-final.mp4"), { method: "HEAD" }).then(r => {
    const n = +r.headers.get("Content-Length");
    if (n) size.textContent = `  ·  ${(n / 1e6).toFixed(1)} MB` + (n > 30e6 ? " ⚠️ over 30 MB" : "");
  }).catch(() => {});
  const world = (S.state && S.state.world) || "reel-speech";
  const links = [el("a", { href: f("video-final.mp4"), download: "" }, "video-final.mp4")];
  if (world !== "broll-montage") {   // montage has no transcript → no .srt / post caption
    links.push(el("a", { href: f("video-final.srt"), download: "" }, ".srt"));
    links.push(el("a", { href: f("post-caption.txt"), download: "" }, "post caption"));
  }
  if (world === "long-form") links.push(el("a", { href: f("video-final.chapters.txt"), download: "" }, "chapters"));
  return el("div", {},
    el("h3", {}, "result"), size,
    el("video", { src: f("video-final.mp4"), controls: "" }),
    el("div", { class: "row", style: "margin-top:10px" }, ...links),
    el("div", { style: "margin-top:14px" }, runPanel(null, "Re-run (after an edit)")));
}

showList().catch(e => app.replaceChildren(el("p", { class: "err" }, String(e))));
