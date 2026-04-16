import { state } from './state.js';
import { $, escHtml, mdToHtml } from './utils.js';
import { fetchPosts, deletePost, updatePostTitle } from './api-client.js';
import { renderSummaryBlock, clearSummaryPolling } from './summary.js';
import { renderShowcaseColumn } from './showcase.js';
import { renderPostsSettings } from './settings.js';
import { renderGalleryView } from './gallery.js';
import { renderSearchBar, initSearchListeners } from './search.js';

const PRIORITY_TAGS = new Set(['must', 'skim', 'dump']);

function renderTagChips(tags, extraClass = '') {
  if (!tags || !tags.length) return '';
  const sorted = [...tags].sort((a, b) => {
    const aP = PRIORITY_TAGS.has(a) ? 0 : 1;
    const bP = PRIORITY_TAGS.has(b) ? 0 : 1;
    return aP - bP;
  });
  const chips = sorted.map(t => {
    const cls = PRIORITY_TAGS.has(t) ? `tag-chip priority-${t}` : 'tag-chip';
    return `<span class="${cls}" data-tag="${escHtml(t)}">${escHtml(t)}</span>`;
  }).join('');
  return `<div class="tag-row ${extraClass}">${chips}</div>`;
}

function attachTagClickHandlers(rootEl) {
  if (!rootEl) return;
  rootEl.querySelectorAll('.tag-chip[data-tag]').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = chip.dataset.tag;
      // TODO: wire to semantic search later
      console.log('[tag clicked]', tag);
    });
  });
}

// --- Image URL extraction helpers ---

// Extract the actual image URL from a markdown image construct (plain or linked)
function extractImageUrl(mdImage) {
  // Plain: ![alt](url)
  const plain = mdImage.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (plain) return plain[1];
  return '';
}

// Find the first image in markdown content (handles linked images that may span lines)
// Returns the match with the lowest index in the content
function findFirstImage(content) {
  const candidates = [];
  // Multi-line linked image: [ \n ![alt](url) \n ](link)
  let m = content.match(/(\[\s*!\[[^\]]*\]\([^)]+\)\s*\]\([^)]+\))/);
  if (m) candidates.push({ fullMatch: m[0], imageUrl: extractImageUrl(m[0]), index: m.index });
  // Single-line linked image: [![alt](url1)](url2)
  m = content.match(/(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\))/);
  if (m) candidates.push({ fullMatch: m[0], imageUrl: extractImageUrl(m[0]), index: m.index });
  // Single-line plain image: ![alt](url)
  m = content.match(/(!\[[^\]]*\]\([^)]+\))/);
  if (m) candidates.push({ fullMatch: m[0], imageUrl: extractImageUrl(m[0]), index: m.index });
  if (candidates.length === 0) return { fullMatch: '', imageUrl: '' };
  // Pick the one that appears earliest in the content
  candidates.sort((a, b) => a.index - b.index);
  return { fullMatch: candidates[0].fullMatch, imageUrl: candidates[0].imageUrl };
}

export function renderPostsSidebar() {
  const list = $('posts-sidebar-list');
  list.innerHTML = '';
  state.posts.forEach(post => {
    const li = document.createElement('li');
    li.className = 'api-item post-sidebar-item' + (state.currentPost?.id === post.id ? ' active' : '');

    const displayTitle = post.title || (post.content_markdown || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/@\w+/g, '').replace(/^#+\s*/gm, '').slice(0, 60).trim() || 'No content';

    li.innerHTML = `
      <div class="post-sidebar-title" title="${escHtml(displayTitle)}">${escHtml(displayTitle)}</div>
      ${renderTagChips(post.tags, 'post-sidebar-tags')}
      <button class="post-sidebar-delete" title="Delete post">&#x2716;</button>
    `;
    attachTagClickHandlers(li);

    // Double-click to rename title
    const titleEl = li.querySelector('.post-sidebar-title');
    titleEl.ondblclick = (e) => {
      e.stopPropagation();
      startRenameTitle(post, titleEl);
    };

    li.onclick = (e) => {
      if (e.target.classList.contains('post-sidebar-delete')) {
        e.stopPropagation();
        confirmDeletePost(post, li);
      } else if (!e.target.classList.contains('post-sidebar-rename-input')) {
        openPostReader(post);
      }
    };

    list.appendChild(li);
  });
}

function startRenameTitle(post, titleEl) {
  const currentTitle = post.title || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'post-sidebar-rename-input';
  input.value = currentTitle;
  titleEl.innerHTML = '';
  titleEl.appendChild(input);
  input.focus();
  input.select();

  const save = async () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      post.title = newTitle;
      await updatePostTitle(post.id, newTitle);
    }
    renderPostsSidebar();
  };

  input.onblur = save;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = currentTitle; input.blur(); }
  };
}

async function confirmDeletePost(post, liElement) {
  const btn = liElement.querySelector('.post-sidebar-delete');
  if (btn.dataset.confirming) {
    clearTimeout(btn._confirmTimer);
    delete btn.dataset.confirming;
    await deletePost(post.id);
    if (state.currentPost?.id === post.id) {
      clearSummaryPolling();
      state.currentPost = null;
    }
    await fetchPosts();
    renderPostsSidebar();
    renderPostsView();
  } else {
    btn.dataset.confirming = '1';
    btn.style.opacity = '1';
    btn._confirmTimer = setTimeout(() => {
      delete btn.dataset.confirming;
      btn.style.opacity = '';
    }, 5000);
  }
}

export function renderPostsView() {
  const empty = $('posts-empty');
  const reader = $('post-reader');
  const settings = $('posts-settings');
  const gallery = $('gallery-view');

  // Hide all first
  empty.classList.add('hidden');
  reader.classList.add('hidden');
  settings.classList.add('hidden');
  gallery.classList.add('hidden');

  if (state.postsSubView === 'settings') {
    settings.classList.remove('hidden');
    renderPostsSettings();
  } else if (state.postsSubView === 'gallery') {
    gallery.classList.remove('hidden');
    renderGalleryView();
  } else if (state.currentPost) {
    reader.classList.remove('hidden');
    renderPostReader(state.currentPost);
  } else if (state.posts.length === 0) {
    empty.classList.remove('hidden');
    empty.innerHTML = renderSearchBar() + '<p>No saved posts yet. Use the browser extension to save X posts.</p>';
    initSearchListeners();
  } else {
    empty.classList.remove('hidden');
    empty.innerHTML = renderSearchBar() + renderPostCards();
    initSearchListeners();
  }
}

function renderPostReader(post) {
  const content = post.content_markdown || '';

  // Title & Cover section
  const titleCoverHtml = renderTitleCover(post);
  $('post-title-cover').innerHTML = titleCoverHtml;
  attachTagClickHandlers($('post-title-cover'));

  // Summary section
  renderSummaryBlock(post);

  // Content — strip title and cover image used in the header to avoid duplication
  let contentMd = content;
  const headingMatch = contentMd.match(/^#\s+.+$/m);
  if (headingMatch) {
    // Article: strip the heading line
    contentMd = contentMd.replace(/^#\s+.+\n*/m, '');
  } else {
    // Tweet: strip first non-image line used as title
    const lines = contentMd.split('\n');
    if (lines[0] && !lines[0].startsWith('![') && !lines[0].startsWith('[')) {
      lines.shift();
      contentMd = lines.join('\n');
    }
  }

  // Strip the cover image from content if it was shown in the header
  const firstImg = findFirstImage(content);
  if (firstImg.fullMatch && firstImg.imageUrl) {
    // Escape special regex chars in the matched string for safe replacement
    const escaped = firstImg.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    contentMd = contentMd.replace(escaped, '');
  }

  $('post-reader-content').innerHTML = mdToHtml(contentMd.trim());

  // Showcase column
  renderShowcaseColumn();
}

function renderTitleCover(post) {
  let title = '';
  const content = post.content_markdown || '';

  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    title = headingMatch[1];
  } else {
    const firstLine = content.split('\n')[0];
    if (firstLine && !firstLine.startsWith('![') && !firstLine.startsWith('[')) {
      title = firstLine.slice(0, 100);
    }
  }

  let html = '';
  if (title) {
    html += `<h1 class="post-title">${escHtml(title)}</h1>`;
  }

  // Cover image — use helper that handles linked images (single/multi-line)
  const firstImg = findFirstImage(content);
  if (firstImg.imageUrl) {
    html += `<img class="post-cover-img" src="${escHtml(firstImg.imageUrl)}" alt="" />`;
  }

  const avatarUrl = post.author_avatar_url || '';
  const avatarHtml = avatarUrl
    ? `<img class="post-avatar-lg" src="${escHtml(avatarUrl)}" alt="" />`
    : `<div class="post-avatar-lg post-avatar-placeholder">${escHtml((post.author_name || '?')[0])}</div>`;

  const postedDate = post.posted_at ? new Date(post.posted_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : '';
  const savedDate = post.created_at ? new Date(post.created_at + 'Z').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

  html += `
    <div class="post-reader-header">
      <div class="post-author-row">
        ${avatarHtml}
        <div class="post-author-info">
          <span class="post-author-name">${escHtml(post.author_name)}</span>
          <span class="post-author-handle">@${escHtml(post.author_handle)}</span>
        </div>
        <a class="post-source-link" href="${escHtml(post.source_url)}" target="_blank" rel="noopener">View original</a>
      </div>
      <div class="post-dates">
        ${postedDate ? `<span>Posted ${postedDate}</span>` : ''}
        ${savedDate ? `<span class="post-saved-date">Saved ${savedDate}</span>` : ''}
      </div>
      ${renderTagChips(post.tags, 'post-reader-tags')}
    </div>
  `;

  return html;
}

function renderPostCards() {
  const compact = state.postsCardMode === 'compact';
  const cards = state.posts.map((post, idx) => {
    const content = post.content_markdown || '';
    const displayTitle = post.title || content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/@\w+/g, '').slice(0, 60).trim() || 'No content';

    // Handle both plain images and linked images (single-line and multi-line)
    const firstImg = findFirstImage(content);
    const coverUrl = firstImg.imageUrl;

    const coverHtml = coverUrl
      ? `<div class="post-card-cover${compact ? ' compact' : ''}"><img src="${escHtml(coverUrl)}" alt="" loading="lazy" /></div>`
      : `<div class="post-card-cover post-card-cover-placeholder${compact ? ' compact' : ''}"></div>`;

    const bodyHtml = compact ? '' : (() => {
      const avatarUrl = post.author_avatar_url || '';
      const avatarHtml = avatarUrl
        ? `<img class="post-card-avatar" src="${escHtml(avatarUrl)}" alt="" />`
        : `<div class="post-card-avatar post-card-avatar-ph">${escHtml((post.author_name || '?')[0])}</div>`;
      const postedDate = post.posted_at
        ? new Date(post.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      return `<div class="post-card-body">
        <div class="post-card-title">${escHtml(displayTitle)}</div>
        <div class="post-card-meta">
          ${avatarHtml}
          <span class="post-card-author">${escHtml(post.author_name || '')}</span>
          ${postedDate ? `<span class="post-card-date">${postedDate}</span>` : ''}
        </div>
        ${renderTagChips(post.tags, 'post-card-tags')}
      </div>`;
    })();

    return `<div class="post-card${compact ? ' compact' : ''}" data-card-idx="${idx}">
      ${coverHtml}
      ${bodyHtml}
    </div>`;
  }).join('');

  // Use setTimeout to attach click handlers after DOM insertion
  setTimeout(() => {
    document.querySelectorAll('.post-card[data-card-idx]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-chip')) return;
        const idx = parseInt(card.dataset.cardIdx, 10);
        if (state.posts[idx]) openPostReader(state.posts[idx]);
      });
    });
    attachTagClickHandlers(document.querySelector('.post-cards-grid'));
  }, 0);

  return `<div class="post-cards-grid${compact ? ' compact' : ''}">${cards}</div>`;
}

export function openPostReader(post) {
  clearSummaryPolling();
  state.currentPost = post;
  state.postsSubView = 'list';
  history.replaceState(null, '', `#posts/${post.id}`);
  renderPostsSidebar();
  renderPostsView();
}

export function closePostReader() {
  clearSummaryPolling();
  state.currentPost = null;
  state.postsSubView = 'list';
  history.replaceState(null, '', '#posts');
  renderPostsSidebar();
  renderPostsView();
}

export function openPostsSettings() {
  state.postsSubView = 'settings';
  state.currentPost = null;
  renderPostsSidebar();
  renderPostsView();
}

export function openGallery() {
  state.postsSubView = 'gallery';
  state.currentPost = null;
  renderPostsSidebar();
  renderPostsView();
}
