import { state } from './state.js';
import { $, escHtml, mdToHtml } from './utils.js';
import { openPostReader } from './posts-reader.js';

let searchAbortController = null;

export function renderSearchBar() {
  return `
    <div class="search-bar-wrapper">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="M21 21l-4.35-4.35"></path>
        </svg>
        <input type="text" class="search-input" id="search-input" placeholder="Search your knowledge..." />
        <div class="search-spinner hidden" id="search-spinner"></div>
      </div>
      <div class="search-results hidden" id="search-results"></div>
    </div>
  `;
}

export function initSearchListeners() {
  const input = $('search-input');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = input.value.trim();
      if (query) handleSearch(query);
    }
  });
}

async function handleSearch(query) {
  const spinner = $('search-spinner');
  const resultsDiv = $('search-results');
  if (!spinner || !resultsDiv) return;

  // Cancel previous search
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();

  spinner.classList.remove('hidden');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = `
    <div class="search-answer-card">
      <div class="search-answer-header">Answer</div>
      <div class="search-answer-body" id="search-answer-body"></div>
    </div>
    <div class="search-sources hidden" id="search-sources">
      <div class="search-sources-header">Relevant Posts</div>
      <div class="search-sources-grid" id="search-sources-grid"></div>
    </div>
  `;

  let answerText = '';
  const answerBody = $('search-answer-body');
  answerBody.innerHTML = '<span class="search-cursor"></span>';

  try {
    const resp = await fetch(`/api/posts/search?q=${encodeURIComponent(query)}`, {
      signal: searchAbortController.signal,
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'sources') {
              renderSources(data);
            } else if (currentEvent === 'token') {
              answerText += data;
              answerBody.innerHTML = mdToHtml(answerText) + '<span class="search-cursor"></span>';
            } else if (currentEvent === 'error') {
              answerText += `\n\nError: ${data.error || 'Unknown error'}`;
              answerBody.innerHTML = mdToHtml(answerText);
            } else if (currentEvent === 'done') {
              // stream complete
            }
          } catch {
            // ignore
          }
          currentEvent = '';
          continue;
        }
      }
    }

    // Final render without cursor
    answerBody.innerHTML = mdToHtml(answerText) || '<span class="search-empty">No answer generated.</span>';
  } catch (e) {
    if (e.name !== 'AbortError') {
      answerBody.innerHTML = `<span class="search-empty">Search failed: ${escHtml(e.message)}</span>`;
    }
  } finally {
    spinner.classList.add('hidden');
  }
}

function renderSources(sources) {
  if (!sources || sources.length === 0) return;
  const container = $('search-sources');
  const grid = $('search-sources-grid');
  if (!container || !grid) return;

  container.classList.remove('hidden');

  grid.innerHTML = sources.map(src => {
    const coverHtml = src.cover_url
      ? `<div class="search-card-cover"><img src="${escHtml(src.cover_url)}" alt="" loading="lazy" /></div>`
      : `<div class="search-card-cover search-card-cover-ph"></div>`;

    return `<div class="search-card" data-search-post-id="${src.id}">
      ${coverHtml}
      <div class="search-card-body">
        <div class="search-card-title">${escHtml(src.title)}</div>
        <div class="search-card-author">${escHtml(src.author_name)}</div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.search-card').forEach(card => {
    card.addEventListener('click', () => {
      const postId = parseInt(card.dataset.searchPostId, 10);
      const post = state.posts.find(p => p.id === postId);
      if (post) openPostReader(post);
    });
  });
}
