# API Runner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a localhost web app (port 9701) that stores curl-style API configs in SQLite and lets you run them from a clean sidebar UI without typing curl commands.

**Architecture:** FastAPI backend serves both static frontend files and proxy endpoints. Env vars are substituted server-side so secrets never reach the browser. SQLite stores API definitions and run history via aiosqlite.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, aiosqlite, httpx (async HTTP client), vanilla HTML/CSS/JS frontend

---

### Task 1: Project Scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `main.py`
- Create: `db.py`
- Create: `frontend/index.html`
- Create: `frontend/style.css`
- Create: `frontend/app.js`

**Step 1: Initialize uv project**

```bash
cd /Users/bytedance/code/localweb
uv init --no-readme
uv add fastapi uvicorn aiosqlite httpx python-multipart
```

Expected: `pyproject.toml` updated with dependencies.

**Step 2: Write pyproject.toml**

Replace generated one with:

```toml
[project]
name = "localweb"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "aiosqlite>=0.20",
    "httpx>=0.27",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Step 3: Create db.py**

```python
import aiosqlite
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "data.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS apis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'POST',
                url TEXT NOT NULL,
                headers TEXT NOT NULL DEFAULT '{}',
                body TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_id INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
                request_snapshot TEXT NOT NULL,
                response_body TEXT,
                status_code INTEGER,
                duration_ms INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.commit()

async def get_all_apis():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM apis ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

async def get_api(api_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM apis WHERE id=?", (api_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

async def create_api(name, method, url, headers, body):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO apis (name, method, url, headers, body) VALUES (?,?,?,?,?)",
            (name, method, url, json.dumps(headers), json.dumps(body))
        )
        await db.commit()
        return cur.lastrowid

async def update_api(api_id, name, method, url, headers, body):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE apis SET name=?, method=?, url=?, headers=?, body=? WHERE id=?",
            (name, method, url, json.dumps(headers), json.dumps(body), api_id)
        )
        await db.commit()

async def delete_api(api_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM apis WHERE id=?", (api_id,))
        await db.commit()

async def save_run(api_id, request_snapshot, response_body, status_code, duration_ms):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO runs (api_id, request_snapshot, response_body, status_code, duration_ms) VALUES (?,?,?,?,?)",
            (api_id, json.dumps(request_snapshot), response_body, status_code, duration_ms)
        )
        await db.commit()
        return cur.lastrowid

async def get_runs(api_id: int, limit: int = 20):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM runs WHERE api_id=? ORDER BY created_at DESC LIMIT ?",
            (api_id, limit)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]
```

**Step 4: Commit scaffold**

```bash
git init
git add pyproject.toml db.py
git commit -m "feat: project scaffold with db layer"
```

---

### Task 2: FastAPI Backend

**Files:**
- Create: `main.py`

**Step 1: Write main.py**

```python
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db

FRONTEND_DIR = Path(__file__).parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield


app = FastAPI(lifespan=lifespan)


def substitute_env_vars(text: str) -> str:
    """Replace $VAR_NAME or ${VAR_NAME} with env var values."""
    def replacer(match):
        var = match.group(1) or match.group(2)
        return os.environ.get(var, match.group(0))
    return re.sub(r'\$\{(\w+)\}|\$(\w+)', replacer, text)


def resolve(obj):
    """Recursively substitute env vars in strings within dicts/lists."""
    if isinstance(obj, str):
        return substitute_env_vars(obj)
    if isinstance(obj, dict):
        return {k: resolve(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [resolve(v) for v in obj]
    return obj


# --- API CRUD ---

class ApiPayload(BaseModel):
    name: str
    method: str = "POST"
    url: str
    headers: dict = {}
    body: dict = {}


@app.get("/api/apis")
async def list_apis():
    return await db.get_all_apis()


@app.post("/api/apis")
async def create_api(payload: ApiPayload):
    api_id = await db.create_api(
        payload.name, payload.method, payload.url, payload.headers, payload.body
    )
    return {"id": api_id}


@app.put("/api/apis/{api_id}")
async def update_api(api_id: int, payload: ApiPayload):
    api = await db.get_api(api_id)
    if not api:
        raise HTTPException(404, "API not found")
    await db.update_api(api_id, payload.name, payload.method, payload.url, payload.headers, payload.body)
    return {"ok": True}


@app.delete("/api/apis/{api_id}")
async def delete_api(api_id: int):
    await db.delete_api(api_id)
    return {"ok": True}


# --- Run ---

@app.post("/api/apis/{api_id}/run")
async def run_api(api_id: int):
    api = await db.get_api(api_id)
    if not api:
        raise HTTPException(404, "API not found")

    headers = resolve(json.loads(api["headers"]))
    body = resolve(json.loads(api["body"]))
    url = resolve(api["url"])
    method = api["method"].upper()

    snapshot = {"method": method, "url": url, "headers": headers, "body": body}
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.request(method, url, headers=headers, json=body)
        duration_ms = int((time.monotonic() - start) * 1000)
        response_text = resp.text
        status_code = resp.status_code
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        response_text = str(e)
        status_code = 0

    await db.save_run(api_id, snapshot, response_text, status_code, duration_ms)
    return {
        "status_code": status_code,
        "duration_ms": duration_ms,
        "body": response_text,
    }


# --- Run history ---

@app.get("/api/apis/{api_id}/runs")
async def get_runs(api_id: int):
    return await db.get_runs(api_id)


# --- Serve frontend ---

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse(FRONTEND_DIR / "index.html")
```

**Step 2: Commit**

```bash
git add main.py
git commit -m "feat: fastapi backend with proxy runner and env var substitution"
```

---

### Task 3: Frontend HTML

**Files:**
- Create: `frontend/index.html`

**Step 1: Write frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Runner</title>
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body>
  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <span class="logo">API Runner</span>
        <button class="btn-icon" id="btn-new" title="New API">+</button>
      </div>
      <ul class="api-list" id="api-list"></ul>
    </aside>

    <!-- Main -->
    <main class="main" id="main">
      <div class="empty-state" id="empty-state">
        <p>Select an API from the sidebar or click <strong>+</strong> to add one.</p>
      </div>

      <!-- API Detail Panel -->
      <div class="panel hidden" id="panel">
        <div class="panel-header">
          <input class="panel-title" id="field-name" type="text" placeholder="API Name" />
          <div class="panel-actions">
            <button class="btn btn-run" id="btn-run">▶ Run</button>
            <button class="btn btn-save" id="btn-save">Save</button>
            <button class="btn btn-delete" id="btn-delete">Delete</button>
          </div>
        </div>

        <div class="form-row">
          <select id="field-method">
            <option>POST</option><option>GET</option><option>PUT</option>
            <option>PATCH</option><option>DELETE</option>
          </select>
          <input class="flex1" id="field-url" type="text" placeholder="https://..." />
        </div>

        <div class="editors">
          <div class="editor-block">
            <label>Headers <span class="hint">(JSON)</span></label>
            <textarea id="field-headers" rows="6" spellcheck="false"></textarea>
          </div>
          <div class="editor-block">
            <label>Body <span class="hint">(JSON)</span></label>
            <textarea id="field-body" rows="6" spellcheck="false"></textarea>
          </div>
        </div>

        <!-- Response -->
        <div class="response-block" id="response-block">
          <div class="response-meta" id="response-meta"></div>
          <pre class="response-body" id="response-body"></pre>
        </div>

        <!-- History -->
        <div class="history-block">
          <h3>History</h3>
          <ul class="history-list" id="history-list"></ul>
        </div>
      </div>
    </main>
  </div>

  <script src="/static/app.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat: frontend HTML structure"
```

---

### Task 4: Frontend CSS

**Files:**
- Create: `frontend/style.css`

**Step 1: Write frontend/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --surface2: #222536;
  --border: #2d3148;
  --accent: #6c8cff;
  --accent-hover: #8aa3ff;
  --text: #e2e4f0;
  --muted: #7a7f9d;
  --success: #4ade80;
  --error: #f87171;
  --run: #22c55e;
  --sidebar-w: 240px;
  --radius: 8px;
  --font: 'Inter', system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Fira Code', monospace;
}

body { font-family: var(--font); background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; }

.layout { display: flex; height: 100vh; }

/* Sidebar */
.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.logo { font-weight: 700; font-size: 15px; color: var(--accent); letter-spacing: 0.02em; }

.btn-icon {
  background: var(--accent);
  color: #fff;
  border: none;
  width: 28px; height: 28px;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s;
}
.btn-icon:hover { background: var(--accent-hover); }

.api-list { list-style: none; overflow-y: auto; flex: 1; padding: 8px; }

.api-item {
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s, color 0.1s;
}
.api-item:hover { background: var(--surface2); color: var(--text); }
.api-item.active { background: var(--surface2); color: var(--accent); font-weight: 600; }

/* Main */
.main { flex: 1; overflow-y: auto; padding: 32px; display: flex; flex-direction: column; }

.empty-state {
  margin: auto;
  text-align: center;
  color: var(--muted);
  font-size: 15px;
}

.hidden { display: none !important; }

/* Panel */
.panel { display: flex; flex-direction: column; gap: 20px; max-width: 900px; width: 100%; }

.panel-header { display: flex; align-items: center; gap: 12px; }

.panel-title {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--border);
  color: var(--text);
  font-size: 22px;
  font-weight: 700;
  padding: 4px 0;
  outline: none;
  transition: border-color 0.15s;
}
.panel-title:focus { border-color: var(--accent); }

.panel-actions { display: flex; gap: 8px; }

.btn {
  padding: 8px 16px;
  border-radius: var(--radius);
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn-run { background: var(--run); color: #000; }
.btn-save { background: var(--accent); color: #fff; }
.btn-delete { background: var(--surface2); color: var(--error); border: 1px solid var(--border); }

.form-row { display: flex; gap: 10px; align-items: center; }

.form-row select {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  outline: none;
}

.form-row input {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.form-row input:focus { border-color: var(--accent); }
.flex1 { flex: 1; }

.editors { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.editor-block { display: flex; flex-direction: column; gap: 6px; }

.editor-block label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

.hint { font-weight: 400; text-transform: none; letter-spacing: 0; }

.editor-block textarea {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  padding: 10px;
  border-radius: var(--radius);
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  line-height: 1.6;
}
.editor-block textarea:focus { border-color: var(--accent); }

/* Response */
.response-block {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.response-meta {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  display: flex;
  gap: 16px;
}
.response-meta .ok { color: var(--success); }
.response-meta .err { color: var(--error); }

.response-body {
  font-family: var(--mono);
  font-size: 12px;
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
}

/* History */
.history-block h3 { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

.history-list { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }

.history-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
  transition: background 0.1s;
}
.history-item:hover { background: var(--surface); }
.history-item .status { font-weight: 700; min-width: 36px; }
.history-item .status.ok { color: var(--success); }
.history-item .status.err { color: var(--error); }
.history-item .dur { margin-left: auto; }

.history-detail {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-family: var(--mono);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  margin-top: -4px;
  color: var(--text);
}

/* Scrollbars */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
```

**Step 2: Commit**

```bash
git add frontend/style.css
git commit -m "feat: dark theme CSS for API runner UI"
```

---

### Task 5: Frontend JavaScript

**Files:**
- Create: `frontend/app.js`

**Step 1: Write frontend/app.js**

```javascript
const $ = id => document.getElementById(id);

const state = {
  apis: [],
  current: null,   // api object
  runs: [],
};

// --- Persistence ---
function saveSelected(id) { localStorage.setItem('selected_api', id); }
function loadSelected() { return localStorage.getItem('selected_api'); }

// --- API calls ---
async function fetchAPIs() {
  const r = await fetch('/api/apis');
  state.apis = await r.json();
}

async function createAPI(payload) {
  const r = await fetch('/api/apis', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  return r.json();
}

async function updateAPI(id, payload) {
  await fetch(`/api/apis/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
}

async function deleteAPI(id) {
  await fetch(`/api/apis/${id}`, { method: 'DELETE' });
}

async function runAPI(id) {
  const r = await fetch(`/api/apis/${id}/run`, { method: 'POST' });
  return r.json();
}

async function fetchRuns(id) {
  const r = await fetch(`/api/apis/${id}/runs`);
  return r.json();
}

// --- Render ---
function renderSidebar() {
  const list = $('api-list');
  list.innerHTML = '';
  state.apis.forEach(api => {
    const li = document.createElement('li');
    li.className = 'api-item' + (state.current?.id === api.id ? ' active' : '');
    li.textContent = api.name;
    li.onclick = () => selectAPI(api);
    list.appendChild(li);
  });
}

function renderPanel() {
  if (!state.current) {
    $('panel').classList.add('hidden');
    $('empty-state').classList.remove('hidden');
    return;
  }
  $('empty-state').classList.add('hidden');
  $('panel').classList.remove('hidden');

  const a = state.current;
  $('field-name').value = a.name;
  $('field-method').value = a.method;
  $('field-url').value = a.url;
  try { $('field-headers').value = JSON.stringify(JSON.parse(a.headers), null, 2); } catch { $('field-headers').value = a.headers; }
  try { $('field-body').value = JSON.stringify(JSON.parse(a.body), null, 2); } catch { $('field-body').value = a.body; }

  $('response-meta').innerHTML = '';
  $('response-body').textContent = '';
  renderHistory();
}

function renderHistory() {
  const ul = $('history-list');
  ul.innerHTML = '';
  state.runs.forEach(run => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const ok = run.status_code >= 200 && run.status_code < 300;
    li.innerHTML = `
      <span class="status ${ok ? 'ok' : 'err'}">${run.status_code || 'ERR'}</span>
      <span>${run.created_at}</span>
      <span class="dur">${run.duration_ms}ms</span>
    `;
    let detail = null;
    li.onclick = () => {
      if (detail) { detail.remove(); detail = null; return; }
      detail = document.createElement('div');
      detail.className = 'history-detail';
      try { detail.textContent = JSON.stringify(JSON.parse(run.response_body), null, 2); }
      catch { detail.textContent = run.response_body; }
      li.after(detail);
    };
    ul.appendChild(li);
  });
}

function showResult(result) {
  const ok = result.status_code >= 200 && result.status_code < 300;
  const cls = ok ? 'ok' : 'err';
  $('response-meta').innerHTML = `
    <span class="${cls}">${result.status_code || 'ERR'}</span>
    <span>${result.duration_ms}ms</span>
  `;
  try { $('response-body').textContent = JSON.stringify(JSON.parse(result.body), null, 2); }
  catch { $('response-body').textContent = result.body; }
}

// --- Actions ---
async function selectAPI(api) {
  state.current = api;
  saveSelected(api.id);
  state.runs = await fetchRuns(api.id);
  renderSidebar();
  renderPanel();
}

async function newAPI() {
  const payload = { name: 'New API', method: 'POST', url: '', headers: {}, body: {} };
  const { id } = await createAPI(payload);
  await fetchAPIs();
  const api = state.apis.find(a => a.id === id);
  await selectAPI(api);
}

async function saveCurrentAPI() {
  if (!state.current) return;
  let headers = {}, body = {};
  try { headers = JSON.parse($('field-headers').value || '{}'); } catch {}
  try { body = JSON.parse($('field-body').value || '{}'); } catch {}
  const payload = {
    name: $('field-name').value,
    method: $('field-method').value,
    url: $('field-url').value,
    headers, body,
  };
  await updateAPI(state.current.id, payload);
  state.current = { ...state.current, ...payload, headers: JSON.stringify(headers), body: JSON.stringify(body) };
  await fetchAPIs();
  renderSidebar();
}

async function runCurrent() {
  if (!state.current) return;
  await saveCurrentAPI();
  $('btn-run').textContent = '...';
  $('btn-run').disabled = true;
  try {
    const result = await runAPI(state.current.id);
    showResult(result);
    state.runs = await fetchRuns(state.current.id);
    renderHistory();
  } finally {
    $('btn-run').textContent = '▶ Run';
    $('btn-run').disabled = false;
  }
}

async function deleteCurrent() {
  if (!state.current) return;
  if (!confirm(`Delete "${state.current.name}"?`)) return;
  await deleteAPI(state.current.id);
  state.current = null;
  await fetchAPIs();
  renderSidebar();
  renderPanel();
}

// --- Init ---
$('btn-new').onclick = newAPI;
$('btn-save').onclick = saveCurrentAPI;
$('btn-run').onclick = runCurrent;
$('btn-delete').onclick = deleteCurrent;

(async () => {
  await fetchAPIs();
  renderSidebar();
  const savedId = loadSelected();
  if (savedId) {
    const api = state.apis.find(a => a.id == savedId);
    if (api) { await selectAPI(api); return; }
  }
  renderPanel();
})();
```

**Step 2: Commit**

```bash
git add frontend/app.js
git commit -m "feat: frontend JS with sidebar, panel, run, history"
```

---

### Task 6: Pre-seed the two example APIs

**Files:**
- Create: `seed.py`

**Step 1: Write seed.py**

```python
"""Run once to seed the two example APIs from the brief."""
import asyncio
import db

APIS = [
    {
        "name": "Doubao Image Gen",
        "method": "POST",
        "url": "https://ark.cn-beijing.volces.com/api/v3/images/generations",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer $ARK_API_KEY",
        },
        "body": {
            "model": "doubao-seedream-5-0-260128",
            "prompt": "A futuristic city at night",
            "sequential_image_generation": "disabled",
            "response_format": "url",
            "size": "2K",
            "stream": False,
            "watermark": True,
        },
    },
    {
        "name": "OpenClaw Text Gen",
        "method": "POST",
        "url": "http://127.0.0.1:18789/v1/responses",
        "headers": {
            "Authorization": "Bearer xxx",
            "Content-Type": "application/json",
            "x-openclaw-session-key": "claw-1",
        },
        "body": {
            "model": "openclaw",
            "input": "hello",
        },
    },
]

async def main():
    await db.init_db()
    for api in APIS:
        await db.create_api(api["name"], api["method"], api["url"], api["headers"], api["body"])
    print("Seeded", len(APIS), "APIs")

asyncio.run(main())
```

**Step 2: Run seed**

```bash
uv run python seed.py
```

Expected: `Seeded 2 APIs`

**Step 3: Commit**

```bash
git add seed.py
git commit -m "feat: seed script for example APIs"
```

---

### Task 7: Smoke test & run

**Step 1: Start the server**

```bash
uv run uvicorn main:app --port 9701 --reload
```

**Step 2: Verify health**

```bash
curl http://localhost:9701/api/apis
```

Expected: JSON array with 2 APIs.

**Step 3: Open browser**

Navigate to `http://localhost:9701` — sidebar should show "Doubao Image Gen" and "OpenClaw Text Gen".

**Step 4: Verify env var substitution**

```bash
ARK_API_KEY=test123 uv run uvicorn main:app --port 9701
```

Click "Run" on Doubao — the proxied request should use `Bearer test123` not `Bearer $ARK_API_KEY`.

---
