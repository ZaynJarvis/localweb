import { state } from './state.js';
import { $, escHtml, mdToHtml } from './utils.js';
import { fetchPosts, deletePost, updatePostTitle } from './api-client.js';
import { renderSummaryBlock, clearSummaryPolling } from './summary.js';
import { renderShowcaseColumn } from './showcase.js';
import { renderPostsSettings } from './settings.js';
import { renderGalleryView } from './gallery.js';
import { renderSearchBar, initSearchListeners } from './search.js';

export function renderPostsSidebar() {
  const list = $('posts-sidebar-list');
  list.innerHTML = '';
  state.posts.forEach(post => {
    const li = document.createElement('li');
    li.className = 'api-item post-sidebar-item' + (state.currentPost?.id === post.id ? ' active' : '');

    const displayTitle = post.title || (post.content_markdown || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/@\w+/g, '').replace(/^#+\s*/gm, '').slice(0, 60).trim() || 'No content';

    li.innerHTML = `
      <div class="post-sidebar-title" title="${escHtml(displayTitle)}">${escHtml(displayTitle)}</div>
      <button class="post-sidebar-delete" title="Delete post">&#x2716;</button>
    `;

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
  // Title & Cover section
  const titleCoverHtml = renderTitleCover(post);
  $('post-title-cover').innerHTML = titleCoverHtml;

  // Summary section
  renderSummaryBlock(post);

  // Content — strip title and cover image used in the header to avoid duplication
  let contentMd = post.content_markdown || '';
  const headingMatch = contentMd.match(/^#\s+.+$/m);
  if (headingMatch) {
    // Article: strip the heading line
    contentMd = contentMd.replace(/^#\s+.+\n*/m, '');
  } else {
    // Tweet: strip first non-image line used as title
    const lines = contentMd.split('\n');
    if (lines[0] && !lines[0].startsWith('![')) {
      lines.shift();
      contentMd = lines.join('\n');
    }
  }
  // Strip first image (linked or not) used as cover
  contentMd = contentMd.replace(/(?:\[?!\[.*?\]\([^)]+\)\]\([^)]+\)|!\[.*?\]\([^)]+\))/, '');
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
    if (firstLine && !firstLine.startsWith('![')) {
      title = firstLine.slice(0, 100);
    }
  }

  let html = '';
  if (title) {
    html += `<h1 class="post-title">${escHtml(title)}</h1>`;
  }

  // Cover image — handle both plain images and linked images
  const imgMatch = content.match(/(?:\[?!\[.*?\]\(([^)]+)\)\]\([^)]+\)|!\[.*?\]\(([^)]+)\))/);
  const coverUrl = imgMatch ? (imgMatch[1] || imgMatch[2]) : '';
  if (coverUrl) {
    html += `<img class="post-cover-img" src="${escHtml(coverUrl)}" alt="" />`;
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
    </div>
  `;

  return html;
}

function renderPostCards() {
  const cards = state.posts.map((post, idx) => {
    const content = post.content_markdown || '';
    const displayTitle = post.title || content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/@\w+/g, '').slice(0, 60).trim() || 'No content';

    // Handle both plain images and linked images
    const imgMatch = content.match(/(?:\[?!\[.*?\]\(([^)]+)\)\]\([^)]+\)|!\[.*?\]\(([^)]+)\))/);
    const coverUrl = imgMatch ? (imgMatch[1] || imgMatch[2]) : '';

    const coverHtml = coverUrl
      ? `<div class="post-card-cover"><img src="${escHtml(coverUrl)}" alt="" loading="lazy" /></div>`
      : `<div class="post-card-cover post-card-cover-placeholder"></div>`;

    const avatarUrl = post.author_avatar_url || '';
    const avatarHtml = avatarUrl
      ? `<img class="post-card-avatar" src="${escHtml(avatarUrl)}" alt="" />`
      : `<div class="post-card-avatar post-card-avatar-ph">${escHtml((post.author_name || '?')[0])}</div>`;

    const postedDate = post.posted_at
      ? new Date(post.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return `<div class="post-card" data-card-idx="${idx}">
      ${coverHtml}
      <div class="post-card-body">
        <div class="post-card-title">${escHtml(displayTitle)}</div>
        <div class="post-card-meta">
          ${avatarHtml}
          <span class="post-card-author">${escHtml(post.author_name || '')}</span>
          ${postedDate ? `<span class="post-card-date">${postedDate}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  // Use setTimeout to attach click handlers after DOM insertion
  setTimeout(() => {
    document.querySelectorAll('.post-card[data-card-idx]').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.cardIdx, 10);
        if (state.posts[idx]) openPostReader(state.posts[idx]);
      });
    });
  }, 0);

  return `<div class="post-cards-grid">${cards}</div>`;
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
