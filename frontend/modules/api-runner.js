import { state, saveSelected } from './state.js';
import { $, escHtml } from './utils.js';
import {
  fetchAPIs, createAPI, updateAPI, deleteAPI,
  runAPI, fetchRuns, importCurl
} from './api-client.js';

// --- Prompt/input extraction ---
const PROMPT_KEYS = ['prompt', 'input'];

function getPromptKey(body) {
  if (!body || typeof body !== 'object') return null;
  // OpenAI messages array — extract last user message
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const last = body.messages[body.messages.length - 1];
    if (last.role === 'user' && typeof last.content === 'string') return '__messages__';
  }
  return PROMPT_KEYS.find(k => k in body) || null;
}

// --- URL query params helpers ---
function parseUrlParams(url) {
  try {
    const u = new URL(url);
    return [...u.searchParams.entries()].map(([k, v]) => ({ k, v }));
  } catch {
    const qi = url.indexOf('?');
    if (qi === -1) return [];
    const qs = url.slice(qi + 1);
    return qs.split('&').filter(Boolean).map(pair => {
      const [k, ...rest] = pair.split('=');
      return { k: decodeURIComponent(k), v: decodeURIComponent(rest.join('=')) };
    });
  }
}

function serializeParams() {
  const rows = $('params-list').querySelectorAll('.params-row');
  const params = [];
  rows.forEach(row => {
    const k = row.querySelector('.param-key').value.trim();
    const v = row.querySelector('.param-val').value;
    if (k) params.push([k, v]);
  });
  return params;
}

function rebuildUrlWithParams(baseUrl, params) {
  try {
    const qi = baseUrl.indexOf('?');
    const base = qi >= 0 ? baseUrl.slice(0, qi) : baseUrl;
    if (!params.length) return base;
    const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${base}?${qs}`;
  } catch {
    return baseUrl;
  }
}

export function addParamRow(key = '', value = '') {
  const list = $('params-list');
  const row = document.createElement('div');
  row.className = 'params-row';
  row.innerHTML = `
    <input class="param-key" type="text" placeholder="key" value="${escHtml(key)}" />
    <input class="param-val" type="text" placeholder="value" value="${escHtml(value)}" />
    <button class="btn-param-del" title="Remove">×</button>
  `;
  row.querySelector('.btn-param-del').onclick = () => row.remove();
  list.appendChild(row);
}

function renderParamRows(params) {
  $('params-list').innerHTML = '';
  params.forEach(({ k, v }) => addParamRow(k, v));
  if (!params.length) addParamRow();
}

export function updateParamsBodyVisibility(method) {
  if (method === 'GET') {
    $('body-editor-block').classList.add('hidden');
    $('params-block').classList.remove('hidden');
  } else {
    $('body-editor-block').classList.remove('hidden');
    $('params-block').classList.add('hidden');
  }
}

// --- Multi-region URLs helpers ---
function parseUrlsText(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf('|');
    if (i < 0) return { label: l, url: l };
    return { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
  });
}

function urlsToText(urls) {
  return (urls || []).map(e => `${e.label}|${e.url}`).join('\n');
}

// --- Render ---
export function renderSidebar() {
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

export function renderPanel() {
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
  $('field-parallel').value = a.parallel ?? 1;

  try { $('field-headers').value = JSON.stringify(typeof a.headers === 'string' ? JSON.parse(a.headers) : a.headers, null, 2); }
  catch { $('field-headers').value = a.headers; }

  // Method-specific: GET shows params, others show body
  updateParamsBodyVisibility(a.method);
  if (a.method === 'GET') {
    renderParamRows(parseUrlParams(a.url));
  }

  // Prompt/input/messages extraction
  const body = typeof a.body === 'string' ? JSON.parse(a.body) : (a.body || {});
  const promptKey = getPromptKey(body);
  const promptBlock = $('prompt-block');

  if (promptKey === '__messages__') {
    promptBlock.classList.remove('hidden');
    promptBlock.dataset.key = '__messages__';
    $('prompt-label').textContent = 'Message';
    const lastUser = [...body.messages].reverse().find(m => m.role === 'user');
    $('field-prompt').value = lastUser ? lastUser.content : '';
    const template = {
      ...body,
      messages: body.messages.map((m, idx) =>
        idx === body.messages.length - 1 && m.role === 'user' ? { ...m, content: '{{message}}' } : m
      ),
    };
    $('field-body').value = JSON.stringify(template, null, 2);
  } else if (promptKey) {
    promptBlock.classList.remove('hidden');
    promptBlock.dataset.key = promptKey;
    $('prompt-label').textContent = promptKey.charAt(0).toUpperCase() + promptKey.slice(1);
    $('field-prompt').value = body[promptKey] || '';
    const template = { ...body, [promptKey]: `{{${promptKey}}}` };
    $('field-body').value = JSON.stringify(template, null, 2);
  } else {
    promptBlock.classList.add('hidden');
    promptBlock.dataset.key = '';
    try { $('field-body').value = JSON.stringify(body, null, 2); }
    catch { $('field-body').value = a.body; }
  }

  // Multi-region URLs
  if (a.urls && a.urls.length > 0) {
    $('urls-block').classList.remove('hidden');
    $('field-urls').value = urlsToText(a.urls);
  } else {
    $('urls-block').classList.add('hidden');
    $('field-urls').value = '';
  }

  $('response-block').classList.add('hidden');
  renderHistory();
}

export function renderHistory() {
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
      renderSmartBody(run.response_body || '', detail);
      li.after(detail);
    };
    ul.appendChild(li);
  });
}

// --- Smart response rendering ---
export function renderSmartBody(bodyStr, container) {
  let data = null;
  try { data = JSON.parse(bodyStr); } catch {}

  if (data?.url && data?.prompt) {
    // Creative showcase response: show expanded prompt + image
    const promptEl = document.createElement('div');
    promptEl.className = 'response-creative-prompt';
    promptEl.innerHTML = `<span class="response-creative-prompt-label">AI Prompt</span><span class="response-creative-prompt-text">${escHtml(data.prompt)}</span>`;
    container.appendChild(promptEl);
    const img = document.createElement('img');
    img.className = 'response-image';
    img.src = data.url;
    img.alt = 'Generated image';
    container.appendChild(img);
  } else if (data?.data?.[0]?.url) {
    const img = document.createElement('img');
    img.className = 'response-image';
    img.src = data.data[0].url;
    img.alt = 'Generated image';
    container.appendChild(img);
    const details = document.createElement('details');
    details.className = 'response-details';
    details.innerHTML = `<summary>Full response</summary><pre>${JSON.stringify(data, null, 2)}</pre>`;
    container.appendChild(details);
  } else if (data?.choices?.[0]?.message?.content) {
    const textOut = document.createElement('div');
    textOut.className = 'response-text-output';
    textOut.textContent = data.choices[0].message.content;
    container.appendChild(textOut);
    const details = document.createElement('details');
    details.className = 'response-details';
    details.innerHTML = `<summary>Full response</summary><pre>${JSON.stringify(data, null, 2)}</pre>`;
    container.appendChild(details);
  } else if (data?.output?.[0]?.content?.[0]?.text) {
    const textOut = document.createElement('div');
    textOut.className = 'response-text-output';
    textOut.textContent = data.output[0].content[0].text;
    container.appendChild(textOut);
    const details = document.createElement('details');
    details.className = 'response-details';
    details.innerHTML = `<summary>Full response</summary><pre>${JSON.stringify(data, null, 2)}</pre>`;
    container.appendChild(details);
  } else {
    const pre = document.createElement('pre');
    pre.className = 'response-body';
    pre.textContent = data ? JSON.stringify(data, null, 2) : bodyStr;
    container.appendChild(pre);
  }
}

function showResult(result) {
  const ok = result.status_code >= 200 && result.status_code < 300;
  const cls = ok ? 'ok' : 'err';
  $('response-meta').innerHTML = `
    <span class="${cls}">${result.status_code || 'ERR'}</span>
    <span>${result.duration_ms}ms</span>
  `;

  const smart = $('response-smart');
  const rawPre = $('response-body');
  smart.innerHTML = '';
  rawPre.textContent = '';

  renderSmartBody(result.body, smart);
  $('response-block').classList.remove('hidden');
}

// --- Actions ---
export async function selectAPI(api) {
  state.current = api;
  saveSelected(api.id);
  state.runs = await fetchRuns(api.id);
  renderSidebar();
  renderPanel();
}

export async function newAPI() {
  const payload = { name: 'New API', method: 'POST', url: '', headers: {}, body: {}, parallel: 1, urls: null };
  const { id } = await createAPI(payload);
  await fetchAPIs();
  const api = state.apis.find(a => a.id === id);
  await selectAPI(api);
}

export async function saveCurrentAPI() {
  if (!state.current) return;
  let headers = {}, body = {};
  try { headers = JSON.parse($('field-headers').value || '{}'); } catch {}
  try { body = JSON.parse($('field-body').value || '{}'); } catch {}

  // Merge prompt/input/messages from dedicated textarea
  const promptBlock = $('prompt-block');
  const promptKey = promptBlock.dataset.key;
  if (promptKey && !promptBlock.classList.contains('hidden')) {
    if (promptKey === '__messages__') {
      const msgs = body.messages || [];
      const lastUserIdx = [...msgs].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'user')?.i;
      const content = $('field-prompt').value;
      if (lastUserIdx !== undefined) {
        body.messages = msgs.map((m, i) => i === lastUserIdx ? { ...m, content } : m);
      } else {
        body.messages = [...msgs, { role: 'user', content }];
      }
    } else {
      body[promptKey] = $('field-prompt').value;
    }
  }

  // GET: rebuild URL from params editor
  let url = $('field-url').value;
  const method = $('field-method').value;
  if (method === 'GET' && !$('params-block').classList.contains('hidden')) {
    url = rebuildUrlWithParams(url, serializeParams());
  }

  // Multi-region URLs
  const urlsText = $('field-urls').value.trim();
  const urls = urlsText ? parseUrlsText(urlsText) : null;

  const payload = {
    name: $('field-name').value,
    method,
    url,
    headers, body,
    parallel: parseInt($('field-parallel').value) || 1,
    urls,
  };
  await updateAPI(state.current.id, payload);
  state.current = { ...state.current, ...payload };
  await fetchAPIs();
  renderSidebar();
}

export async function runCurrent() {
  if (!state.current) return;
  await saveCurrentAPI();

  const refreshed = state.apis.find(a => a.id === state.current.id);
  if (refreshed) state.current = refreshed;

  if (state.current.urls && state.current.urls.length > 0) {
    await runRegions();
  } else {
    const n = state.current.parallel ?? 1;
    if (n > 1) {
      await runParallel(n);
    } else {
      await runSingle();
    }
  }
}

async function runSingle() {
  $('btn-run').innerHTML = '&#x23F3; Running...';
  $('btn-run').disabled = true;
  try {
    const result = await runAPI(state.current.id);
    showResult(result);
    state.runs = await fetchRuns(state.current.id);
    renderHistory();
  } finally {
    $('btn-run').innerHTML = '&#9654; Run';
    $('btn-run').disabled = false;
  }
}

async function runParallel(n) {
  $('btn-run').innerHTML = '&#x23F3; Running...';
  $('btn-run').disabled = true;

  const smart = $('response-smart');
  const rawPre = $('response-body');
  smart.innerHTML = '';
  rawPre.textContent = '';
  $('response-meta').innerHTML = `<span class="muted">0 / ${n} done</span>`;
  $('response-block').classList.remove('hidden');

  const grid = document.createElement('div');
  grid.className = 'image-grid';
  smart.appendChild(grid);

  const cards = Array.from({ length: n }, () => {
    const card = document.createElement('div');
    card.className = 'image-card loading';
    card.innerHTML = '<div class="image-placeholder"></div>';
    grid.appendChild(card);
    return card;
  });

  let completed = 0;

  try {
    const resp = await fetch(`/api/apis/${state.current.id}/run_stream?n=${n}`);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.slice(6));
        if (data.done) continue;
        const card = cards[data.index];
        card.classList.remove('loading');
        card.innerHTML = '';
        let parsed = null;
        try { parsed = JSON.parse(data.body); } catch {}
        const imgUrl = parsed?.url || parsed?.data?.[0]?.url || parsed?.output?.[0];
        if (imgUrl) {
          if (parsed?.prompt) {
            const promptEl = document.createElement('div');
            promptEl.className = 'card-prompt';
            promptEl.textContent = parsed.prompt;
            card.appendChild(promptEl);
          }
          const img = document.createElement('img');
          img.src = typeof imgUrl === 'string' ? imgUrl : imgUrl?.url || '';
          img.alt = 'Generated image';
          card.appendChild(img);
        } else {
          const pre = document.createElement('pre');
          pre.className = 'card-error';
          pre.textContent = data.body;
          card.appendChild(pre);
        }
        completed++;
        $('response-meta').innerHTML = `<span class="muted">${completed} / ${n} done</span>`;
      }
    }

    $('response-meta').innerHTML = `<span class="ok">${n} images generated</span>`;
    state.runs = await fetchRuns(state.current.id);
    renderHistory();
  } catch (e) {
    $('response-meta').innerHTML = `<span class="err">Stream error: ${e.message}</span>`;
  } finally {
    $('btn-run').innerHTML = '&#9654; Run';
    $('btn-run').disabled = false;
  }
}

async function runRegions() {
  $('btn-run').innerHTML = '&#x23F3; Running...';
  $('btn-run').disabled = true;

  const urls = state.current.urls;
  const smart = $('response-smart');
  const rawPre = $('response-body');
  smart.innerHTML = '';
  rawPre.textContent = '';
  $('response-meta').innerHTML = `<span class="muted">0 / ${urls.length} done</span>`;
  $('response-block').classList.remove('hidden');

  const container = document.createElement('div');
  container.className = 'region-results';
  smart.appendChild(container);

  const rowMap = {};
  urls.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'region-row';
    row.innerHTML = `
      <span class="region-label">${escHtml(entry.label)}</span>
      <span class="region-status pending">…</span>
      <span class="region-dur">—</span>
      <span class="region-url" title="${escHtml(entry.url)}">${escHtml(entry.url)}</span>
    `;
    let detail = null;
    row.onclick = () => {
      if (!row._body) return;
      if (detail) { detail.remove(); detail = null; return; }
      detail = document.createElement('div');
      detail.className = 'region-detail';
      renderSmartBody(row._body, detail);
      row.after(detail);
    };
    container.appendChild(row);
    rowMap[entry.label] = row;
  });

  let completed = 0;
  try {
    const resp = await fetch(`/api/apis/${state.current.id}/run_regions`);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.slice(6));
        if (data.done) continue;
        const row = rowMap[data.label];
        if (!row) continue;
        const ok = data.status_code >= 200 && data.status_code < 300;
        row.querySelector('.region-status').className = `region-status ${ok ? 'ok' : 'err'}`;
        row.querySelector('.region-status').textContent = data.status_code || 'ERR';
        row.querySelector('.region-dur').textContent = `${data.duration_ms}ms`;
        row._body = data.body;
        completed++;
        $('response-meta').innerHTML = `<span class="muted">${completed} / ${urls.length} done</span>`;
      }
    }

    $('response-meta').innerHTML = `<span class="ok">${urls.length} regions done</span>`;
    state.runs = await fetchRuns(state.current.id);
    renderHistory();
  } catch (e) {
    $('response-meta').innerHTML = `<span class="err">Stream error: ${e.message}</span>`;
  } finally {
    $('btn-run').innerHTML = '&#9654; Run';
    $('btn-run').disabled = false;
  }
}

export async function deleteCurrent() {
  if (!state.current) return;
  const btn = $('btn-delete');
  if (btn.dataset.confirming) {
    clearTimeout(btn._confirmTimer);
    delete btn.dataset.confirming;
    btn.textContent = 'Delete';
    await deleteAPI(state.current.id);
    state.current = null;
    await fetchAPIs();
    renderSidebar();
    renderPanel();
  } else {
    btn.dataset.confirming = '1';
    btn.textContent = 'Sure?';
    btn._confirmTimer = setTimeout(() => {
      delete btn.dataset.confirming;
      btn.textContent = 'Delete';
    }, 5000);
  }
}

// --- Import from curl ---
export function openImportDialog() {
  $('import-curl-input').value = '';
  $('import-dialog').showModal();
  setTimeout(() => $('import-curl-input').focus(), 50);
}

export function closeImportDialog() {
  $('import-dialog').close();
}

export async function importFromCurl() {
  const cmd = $('import-curl-input').value.trim();
  if (!cmd) return;
  const { ok, data } = await importCurl(cmd);
  if (!ok) {
    alert('Parse error: ' + (data.detail || 'unknown'));
    return;
  }
  closeImportDialog();
  const { id } = await createAPI(data);
  await fetchAPIs();
  const api = state.apis.find(a => a.id === id);
  await selectAPI(api);
}
