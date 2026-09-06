"use strict";
const app = document.getElementById("app");
const crumb = document.getElementById("crumb");
const S = { pid: null, state: null, cfg: null };

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
  S.pid = id; crumb.textContent = "› " + id;
  await refresh();
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
  const nextId = S.state.next;
  const next = stages.find(s => s.id === nextId);
  if (!nextId) parts.push(resultPanel());
  else if (next && next.checkpoint) parts.push(checkpointPanel(next));
  else parts.push(runPanel(nextId, "Run the pipeline"));
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
  return el("div", {}, el("h3", {}, "pipeline"),
    el("div", { class: "stages" }, ...stages.map(s => {
      const rows = [el("div", { class: "st " + s.verdict + (s.id === S.state.next ? " next" : "") },
        el("span", { class: "v" }, s.verdict), el("span", {}, s.title))];
      if (s.id === S.state.next && s.note) rows.push(el("div", { class: "note" }, s.note));
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

function checkpointPanel(cp) {
  const done = {
    "transcript-fix": "screen coming in #100 — for now, correct build/transcript-raw.json → build/transcript-fixes.json in the terminal",
    "script-review": "screen coming in #100 — run `edit_script.py show` / `drop` in the terminal, or skip",
    "scenes": "screen coming in #101 — author config/scenes.json in the terminal, or skip for a captions-only reel",
    "sound-cues": "screen coming in #102 — write build/sound-cues.json ({\"outro\": <seconds>}) in the terminal",
    "tighten": "run `tighten.py <work>` then `tighten.py <work> apply` in the terminal",
    "chapters": "optional — write config/chapters.json in the terminal, or skip",
    "broll": "optional — put clips in rush/broll/ + write config/broll.json, or skip",
  }[cp.id] || "do this step, then Run again";
  const log = el("pre", { class: "log", style: "display:none" });
  const runBtn = el("button", { onclick: async () => {
    runBtn.disabled = true; log.style.display = "block"; log.textContent = "";
    await runStream("", t => { log.textContent += t + "\n"; log.scrollTop = log.scrollHeight; },
      () => { runBtn.disabled = false; setTimeout(refresh, 300); });
  } }, "Run up to here");
  return el("div", {},
    el("h3", {}, "next: " + cp.title),
    el("div", { class: "card" },
      el("p", {}, cp.note || ""),
      el("p", { class: "muted" }, done),
      el("div", { class: "row" },
        runBtn,
        el("button", { class: "ghost", onclick: refresh }, "I did it — re-check"))),
    log);
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
