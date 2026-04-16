import { state } from './state.js';
import { $, escHtml, mdToHtml } from './utils.js';
import { openPostReader } from './posts-reader.js';

const DEBOUNCE_MS = 300;
const THRESHOLD = 0.35;
const CHUNK_PREVIEW_LEN = 360;
const SEARCH_BUILD = 'ov-find-v2';

console.log(`[search] module loaded (${SEARCH_BUILD})`);

let debounceTimer = null;
let findAbortController = null;

export function renderSearchBar() {
  return `
    <div class="search-bar-wrapper">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="M21 21l-4.35-4.35"></path>
        </svg>
        <input type="text" class="search-input" id="search-input" placeholder="Search your knowledge..." autocomplete="off" />
        <div class="search-spinner hidden" id="search-spinner"></div>
      </div>
    </div>
    <div class="search-results hidden" id="search-results"></div>
  `;
}

export function initSearchListeners() {
  const input = $('search-input');
  if (!input) {
    console.warn('[search] #search-input not found when binding listeners');
    return;
  }
  if (input.dataset.ovBound === '1') return; // idempotent
  input.dataset.ovBound = '1';
  console.log('[search] listeners bound to input');
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q) {
      hideResults();
      return;
    }
    debounceTimer = setTimeout(() => runFind(q), DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      hideResults();
    }
  });
}

function hideResults() {
  const resultsDiv = $('search-results');
  const spinner = $('search-spinner');
  if (spinner) spinner.classList.add('hidden');
  if (resultsDiv) {
    resultsDiv.innerHTML = '';
    resultsDiv.classList.add('hidden');
  }
  document.querySelector('.posts-empty')?.classList.remove('searching');
  if (findAbortController) {
    findAbortController.abort();
    findAbortController = null;
  }
}

async function runFind(query) {
  console.log('[search] runFind:', query);
  const spinner = $('search-spinner');
  const resultsDiv = $('search-results');
  if (!resultsDiv) {
    console.warn('[search] #search-results not found; is the DOM torn down?');
    return;
  }

  if (findAbortController) findAbortController.abort();
  findAbortController = new AbortController();

  if (spinner) spinner.classList.remove('hidden');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = `<div class="search-empty-card">Searching…</div>`;
  document.querySelector('.posts-empty')?.classList.add('searching');

  try {
    const resp = await fetch(
      `/api/posts/find?q=${encodeURIComponent(query)}&threshold=${THRESHOLD}`,
      { signal: findAbortController.signal },
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    console.log('[search] items:', (data.items || []).length);
    renderCards(data.items || []);
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('[search] error:', e);
    resultsDiv.innerHTML = `<div class="search-empty-card">Search failed: ${escHtml(e.message)}</div>`;
  } finally {
    if (spinner) spinner.classList.add('hidden');
  }
}

function truncate(text, n) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '…' : clean;
}

function renderCards(items) {
  const resultsDiv = $('search-results');
  if (!resultsDiv) return;

  if (!items.length) {
    resultsDiv.innerHTML = `<div class="search-empty-card">No matches above threshold ${THRESHOLD}.</div>`;
    return;
  }

  resultsDiv.innerHTML = `<div class="glass-grid">${items.map(renderCard).join('')}</div>`;

  resultsDiv.querySelectorAll('.glass-card[data-post-id]').forEach(card => {
    card.addEventListener('click', () => {
      const postId = parseInt(card.dataset.postId, 10);
      const post = state.posts.find(p => p.id === postId);
      if (post) {
        location.hash = `#posts/${postId}`;
        openPostReader(post);
      }
    });
  });
}

function renderCard(item) {
  const scoreBadge = `<span class="glass-score">${(item.score * 100).toFixed(0)}%</span>`;
  if (item.type === 'post') {
    const cover = item.cover_url
      ? `<div class="glass-cover"><img src="${escHtml(item.cover_url)}" alt="" loading="lazy" /></div>`
      : '';
    const chunk = truncate(item.chunk, CHUNK_PREVIEW_LEN);
    return `
      <div class="glass-card glass-card-post" data-post-id="${item.id}">
        ${cover}
        <div class="glass-body">
          <div class="glass-header">
            <span class="glass-badge glass-badge-post">Post</span>
            ${scoreBadge}
          </div>
          <h3 class="glass-title">${escHtml(item.title)}</h3>
          <div class="glass-meta">${escHtml(item.author_name || '')}</div>
          ${chunk ? `<div class="glass-chunk">${escHtml(chunk)}</div>` : ''}
          <a class="glass-link" href="#posts/${item.id}" onclick="event.stopPropagation()">Open post →</a>
        </div>
      </div>
    `;
  }
  // memory
  const content = truncate(item.content, CHUNK_PREVIEW_LEN + 200);
  return `
    <div class="glass-card glass-card-memory">
      <div class="glass-body">
        <div class="glass-header">
          <span class="glass-badge glass-badge-memory">Memory</span>
          ${scoreBadge}
        </div>
        <div class="glass-memory-body">${mdToHtml(content) || escHtml(content)}</div>
      </div>
    </div>
  `;
}
