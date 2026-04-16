import { state } from './state.js';

// --- APIs ---
export async function fetchAPIs() {
  const r = await fetch('/api/apis');
  state.apis = await r.json();
}

export async function createAPI(payload) {
  const r = await fetch('/api/apis', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  return r.json();
}

export async function updateAPI(id, payload) {
  await fetch(`/api/apis/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
}

export async function deleteAPI(id) {
  await fetch(`/api/apis/${id}`, { method: 'DELETE' });
}

export async function runAPI(id) {
  const r = await fetch(`/api/apis/${id}/run`, { method: 'POST' });
  return r.json();
}

export async function fetchRuns(id) {
  const r = await fetch(`/api/apis/${id}/runs`);
  return r.json();
}

export async function importCurl(curlCommand) {
  const r = await fetch('/api/import-curl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ curl_command: curlCommand }),
  });
  return { ok: r.ok, data: await r.json() };
}

// --- Posts ---
export async function fetchPosts() {
  const r = await fetch('/api/posts');
  state.posts = await r.json();
}

export async function fetchPost(id) {
  const r = await fetch(`/api/posts/${id}`);
  return r.json();
}

export async function deletePost(id) {
  await fetch(`/api/posts/${id}`, { method: 'DELETE' });
}

export async function updatePostTitle(id, title) {
  await fetch(`/api/posts/${id}/title`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
}

// --- Settings ---
export async function fetchPostsSettings() {
  const r = await fetch('/api/settings/posts');
  state.postsSettings = await r.json();
}

export async function savePostsSettings(payload) {
  await fetch('/api/settings/posts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// --- Summary ---
export async function summarizePost(postId) {
  const r = await fetch(`/api/posts/${postId}/summarize`, { method: 'POST' });
  return r.json();
}

// --- Showcase ---
export async function fetchShowcase() {
  const r = await fetch('/api/showcase');
  const data = await r.json();
  state.showcaseUrl = data.url;
  return data.url;
}

export async function generateShowcase() {
  const r = await fetch('/api/showcase/generate', { method: 'POST' });
  const data = await r.json();
  if (!r.ok) return { ok: false, error: data.detail || 'Failed to generate image' };
  state.showcaseUrl = data.url;
  state.showcasePromptUsed = data.prompt || null;
  return { ok: true, url: data.url, prompt: data.prompt };
}

export async function likeShowcase() {
  const r = await fetch('/api/showcase/like', { method: 'POST' });
  return r.json();
}

export async function fetchGallery() {
  const r = await fetch('/api/gallery');
  return r.json();
}

export async function activateGalleryImage(imageId) {
  const r = await fetch(`/api/gallery/${imageId}/activate`, { method: 'POST' });
  const data = await r.json();
  state.showcaseUrl = data.url;
  return data.url;
}

export async function deleteGalleryImage(imageId) {
  await fetch(`/api/gallery/${imageId}`, { method: 'DELETE' });
}

// --- Summary Chat ---
export function streamSummaryChat(postId, messages, onToken, onError, onDone) {
  fetch(`/api/posts/${postId}/summary-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  }).then(resp => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = null;

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) { onDone(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'token') onToken(data);
            else if (currentEvent === 'error') onError(data);
            else if (currentEvent === 'done') { onDone(); return; }
            else if (currentEvent === 'sources') onToken(data, 'sources');
            currentEvent = null;
          }
        }
        pump();
      });
    }
    pump();
  }).catch(onError);
}

// --- Search ---
export function streamSearch(query, onToken, onError, onDone, onSources) {
  fetch(`/api/posts/search?q=${encodeURIComponent(query)}`)
    .then(resp => {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = null;

      function pump() {
        reader.read().then(({ done, value }) => {
          if (done) { onDone(); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'token') onToken(data);
              else if (currentEvent === 'error') onError(data);
              else if (currentEvent === 'done') { onDone(); return; }
              else if (currentEvent === 'sources' && onSources) onSources(data);
              currentEvent = null;
            }
          }
          pump();
        });
      }
      pump();
    }).catch(onError);
}

export async function saveSummaryFromChat(postId, summaryText) {
  const r = await fetch(`/api/posts/${postId}/save-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary_text: summaryText }),
  });
  return r.json();
}

export async function saveDefaultPrompt(prompt) {
  await fetch('/api/settings/posts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts_prompt: prompt }),
  });
}

// --- Logger ---
export async function fetchLoggerSummary() {
  const r = await fetch('/api/logger/summary');
  return r.json();
}

export async function fetchLoggerRegenerate() {
  const r = await fetch('/api/logger/regenerate', { method: 'POST' });
  return r.json();
}

export async function fetchLoggerStatus() {
  const r = await fetch('/api/logger/status');
  return r.json();
}

export async function fetchLoggerLogs() {
  const r = await fetch('/api/logger/logs');
  return r.json();
}

export async function fetchLoggerLog(name) {
  const r = await fetch(`/api/logger/logs/${encodeURIComponent(name)}`);
  return r.json();
}

// --- Logger Memory ---
export async function fetchLoggerMemory() {
  const r = await fetch('/api/logger/memory');
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to load memory');
  return r.json();
}

export async function fetchLoggerMemoryTopic(slug) {
  const r = await fetch(`/api/logger/memory/${encodeURIComponent(slug)}`);
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to load topic');
  return r.json();
}

export async function fetchLoggerMemoryRefresh() {
  const r = await fetch('/api/logger/memory/refresh', { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to refresh memory');
  return r.json();
}

// --- Logger Entities ---
export async function fetchLoggerEntities() {
  const r = await fetch('/api/logger/entities');
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to load entities');
  return r.json();
}

export async function fetchLoggerEntity(slug) {
  const r = await fetch(`/api/logger/entities/${encodeURIComponent(slug)}`);
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to load entity');
  return r.json();
}

export async function fetchLoggerConsolidate() {
  const r = await fetch('/api/logger/consolidate', { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to consolidate');
  return r.json();
}

// --- Logger Comments ---
export async function fetchLoggerComments(contextType, contextId) {
  const params = new URLSearchParams();
  if (contextType) params.set('context_type', contextType);
  if (contextId) params.set('context_id', contextId);
  const r = await fetch(`/api/logger/comments?${params}`);
  return r.json();
}

export async function createLoggerComment(content, contextType, contextId, selectedText) {
  const body = { content, context_type: contextType || 'general' };
  if (contextId) body.context_id = contextId;
  if (selectedText) body.selected_text = selectedText;
  const r = await fetch('/api/logger/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function deleteLoggerComment(commentId) {
  const r = await fetch(`/api/logger/comments/${commentId}`, { method: 'DELETE' });
  return r.json();
}

// --- Logger Preferences ---
export async function fetchLoggerPreferences(category, commentId) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (commentId) params.set('comment_id', commentId);
  const r = await fetch(`/api/logger/preferences?${params}`);
  return r.json();
}

export async function deleteLoggerPreference(prefId) {
  const r = await fetch(`/api/logger/preferences/${prefId}`, { method: 'DELETE' });
  return r.json();
}
