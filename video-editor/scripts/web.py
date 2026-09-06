# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""The local web UI server — a thin front end over run.py.

    uv run scripts/web.py [port]        # default 8800; opens http://127.0.0.1:<port>

Binds 127.0.0.1 only. No auth, no cloud, no publishing (design/web.md). It shells out to
run.py and the same scripts the CLI uses — it does NOT re-implement any pipeline logic.

Projects are normal work dirs under  ~/.video-editor/projects/<slug>/  (override with
VEVO_PROJECTS_DIR), so a project made here is fully usable from the CLI and vice-versa.

Endpoints (issues #97 / #98; the SPA is #99):
  GET  /                              the SPA (scripts/web/index.html) or a placeholder
  GET  /health
  GET  /projects                      list
  POST /projects            {name}    create -> {id}
  POST /projects/<id>/rush            raw body + X-Filename header -> rush/<filename>
  GET  /projects/<id>/config          merged config (lib.config.load)
  PUT  /projects/<id>/config {...}    write config/project.config.json
  PUT  /projects/<id>/decision/<name> write a decision file (allow-listed)
  POST /projects/<id>/edit  {op, sentences}   -> shells edit_script.py
  GET  /projects/<id>/state           parsed `run.py --json`
  POST /projects/<id>/run   ?from=&to=&only=&force=   run run.py, stream output as SSE
                                     (`event: line` per line, `event: done` {exit})
  GET  /projects/<id>/file/<path>     serve a build/ or root artifact, path-jailed
"""
import json
import os
import re
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(SCRIPTS)
_sys.path.insert(0, SCRIPTS)
from lib import config as _config  # noqa: E402

ROOT = os.path.abspath(os.environ.get(
    "VEVO_PROJECTS_DIR", os.path.join(os.path.expanduser("~"), ".video-editor", "projects")))
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
DECISIONS = {
    "transcript-fixes": "build/transcript-fixes.json",
    "sound-cues":        "build/sound-cues.json",
    "scenes":            "config/scenes.json",
    "chapters":          "config/chapters.json",
    "broll":             "config/broll.json",
}
MIME = {".html": "text/html", ".js": "text/javascript", ".css": "text/css",
        ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".mp4": "video/mp4", ".wav": "audio/wav",
        ".srt": "text/plain", ".txt": "text/plain"}


def _slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:64] or "project"


def _work(pid):
    """The work dir for a project id, or None if the id is bad / escapes ROOT."""
    if not SLUG.match(pid or ""):
        return None
    w = os.path.realpath(os.path.join(ROOT, pid))
    return w if (w + os.sep).startswith(os.path.realpath(ROOT) + os.sep) else None


def _jailed(work, rel):
    """A path under `work` for `rel`, or None if it escapes."""
    p = os.path.realpath(os.path.join(work, rel))
    return p if (p == work or (p + os.sep).startswith(work + os.sep)) else None


def _run_py(work, *args):
    return subprocess.run(["uv", "run", "scripts/run.py", work, *args],
                          cwd=SKILL, capture_output=True, text=True, encoding="utf-8")


class H(BaseHTTPRequestHandler):
    server_version = "video-editor-web"

    def _send(self, code, body=b"", ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _err(self, code, msg):
        self._send(code, {"error": msg})

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _json_body(self):
        try:
            return json.loads(self._body() or b"{}")
        except ValueError:
            return None

    def log_message(self, *a):
        pass  # quiet

    def _stream_run(self, work, args):
        """POST /run — spawn run.py and stream its output as Server-Sent Events.
        `data:` events carry one output line each; a final `event: done` carries the
        exit code. Killing the browser kills the run."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        def emit(ev, obj):
            self.wfile.write(("event: %s\ndata: %s\n\n" % (ev, json.dumps(obj))).encode("utf-8"))
            self.wfile.flush()

        proc = subprocess.Popen(
            ["uv", "run", "scripts/run.py", work, *args],
            cwd=SKILL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
            env=dict(os.environ, PYTHONUNBUFFERED="1"))
        try:
            for line in proc.stdout:
                emit("line", {"text": line.rstrip("\n")})
            proc.wait()
            emit("done", {"exit": proc.returncode})
        except (BrokenPipeError, ConnectionResetError):
            proc.terminate()  # the client went away

    # ---- routing ----
    def do_GET(self):    self._route("GET")
    def do_POST(self):   self._route("POST")
    def do_PUT(self):    self._route("PUT")
    def do_HEAD(self):   self._route("GET")

    def _route(self, method):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        q = {}
        if "?" in self.path:
            for kv in self.path.split("?", 1)[1].split("&"):
                k, _, v = kv.partition("=")
                q[k] = v
        try:
            self._dispatch(method, path, q)
        except BrokenPipeError:
            pass
        except Exception as e:  # never crash the server on one bad request
            self._err(500, "%s: %s" % (type(e).__name__, e))

    def _dispatch(self, method, path, q):
        if method == "GET" and (path == "/" or re.match(r"^/app\.(js|css)$", path)):
            fp = os.path.join(SCRIPTS, "web", "index.html" if path == "/" else path.lstrip("/"))
            if os.path.exists(fp):
                return self._send(200, open(fp, "rb").read(),
                                  MIME.get(os.path.splitext(fp)[1], "text/plain"))
            if path == "/":
                return self._send(200, "<h1>video-editor</h1><p>The UI is not built yet. "
                                  "The API is live — see scripts/web.py.</p>", "text/html")
            return self._err(404, path)
        if path == "/health" and method == "GET":
            return self._send(200, {"ok": True, "projects_dir": ROOT})

        if path == "/projects":
            if method == "GET":
                os.makedirs(ROOT, exist_ok=True)
                out = []
                for d in sorted(os.listdir(ROOT)):
                    w = _work(d)
                    if w and os.path.isdir(w):
                        cfg = _config.load(w)
                        rush = os.path.join(w, "rush")
                        out.append({"id": d,
                                    "format": cfg.get("format", "short"),
                                    "language": cfg.get("language"),
                                    "hasVideo": os.path.isdir(rush) and bool(os.listdir(rush)),
                                    "hasDeliverable": os.path.exists(os.path.join(w, "video-final.mp4"))})
                return self._send(200, out)
            if method == "POST":
                b = self._json_body()
                if b is None:
                    return self._err(400, "bad JSON")
                base = _slugify(b.get("name", ""))
                pid, n = base, 1
                while _work(pid) and os.path.isdir(_work(pid)):
                    n += 1; pid = "%s-%d" % (base, n)
                w = _work(pid)
                for sub in ("rush", "config", "build"):
                    os.makedirs(os.path.join(w, sub), exist_ok=True)
                for f in ("compose.reference.html", "studio.html"):
                    dst = os.path.join(w, "compose.html" if f.startswith("compose") else f)
                    shutil.copyfile(os.path.join(SCRIPTS, f), dst)
                return self._send(201, {"id": pid})
            return self._err(405, method)

        m = re.match(r"^/projects/([^/]+)(/.*)?$", path)
        if not m:
            return self._err(404, path)
        work = _work(m.group(1))
        if not work or not os.path.isdir(work):
            return self._err(404, "no such project")
        sub = m.group(2) or ""

        if sub == "/rush" and method == "POST":
            fn = os.path.basename(self.headers.get("X-Filename") or "")
            if not fn:
                return self._err(400, "X-Filename header required")
            dst = _jailed(os.path.join(work, "rush"), fn)
            if not dst:
                return self._err(400, "bad filename")
            with open(dst, "wb") as f:
                remaining = int(self.headers.get("Content-Length") or 0)
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        break
                    f.write(chunk); remaining -= len(chunk)
            return self._send(201, {"saved": "rush/" + fn})

        if sub == "/config":
            cp = os.path.join(work, "config", "project.config.json")
            if method == "GET":
                return self._send(200, _config.load(work))
            if method == "PUT":
                b = self._json_body()
                if not isinstance(b, dict):
                    return self._err(400, "config must be a JSON object")
                os.makedirs(os.path.dirname(cp), exist_ok=True)
                with open(cp, "w", encoding="utf-8") as f:
                    json.dump(b, f, ensure_ascii=False, indent=1)
                return self._send(200, {"saved": "config/project.config.json"})
            return self._err(405, method)

        dm = re.match(r"^/decision/([a-z-]+)$", sub)
        if dm and method == "PUT":
            name = dm.group(1)
            if name not in DECISIONS:
                return self._err(404, "unknown decision '%s' (%s)" % (name, ", ".join(DECISIONS)))
            b = self._json_body()
            if b is None:
                return self._err(400, "bad JSON")
            rel = DECISIONS[name]
            dst = _jailed(work, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "w", encoding="utf-8") as f:
                json.dump(b, f, ensure_ascii=False, indent=1)
            return self._send(200, {"saved": rel})

        if sub == "/edit" and method == "POST":
            b = self._json_body() or {}
            op = b.get("op", "drop")
            if op not in ("drop", "keep", "undo"):
                return self._err(400, "op must be drop / keep / undo")
            nums = [str(int(x)) for x in b.get("sentences", [])]
            r = subprocess.run(["uv", "run", "scripts/edit_script.py", work, op, *nums],
                               cwd=SKILL, capture_output=True, text=True, encoding="utf-8")
            return self._send(200 if r.returncode == 0 else 400,
                              {"exit": r.returncode, "output": (r.stdout or "") + (r.stderr or "")})

        if sub == "/state" and method == "GET":
            r = _run_py(work, "--json")
            try:
                return self._send(200, json.loads(r.stdout))
            except ValueError:
                # run.py can't plan yet (usually: no video in rush/) — not an error for the UI
                return self._send(200, {"stages": [], "next": None,
                                        "blocked": (r.stdout or r.stderr or "").strip()[:300]})

        if sub == "/run" and method == "POST":
            args = []
            for k in ("from", "to", "only"):
                if q.get(k):
                    args += ["--" + k, q[k]]
            if q.get("force"):
                args.append("--force")
            return self._stream_run(work, args)

        fm = re.match(r"^/file/(.+)$", sub)
        if fm and method == "GET":
            p = _jailed(work, fm.group(1))
            if not p or not os.path.isfile(p):
                return self._err(404, "no such file")
            ctype = MIME.get(os.path.splitext(p)[1].lower(), "application/octet-stream")
            return self._send(200, open(p, "rb").read(), ctype)

        return self._err(404, method + " " + path)


def main():
    port = int(_sys.argv[1]) if len(_sys.argv) > 1 else 8800
    os.makedirs(ROOT, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print("video-editor UI  →  http://127.0.0.1:%d   (projects: %s)" % (port, ROOT))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()
