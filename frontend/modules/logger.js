import { $, escHtml, showToast, mdToHtml, formatDate } from './utils.js';
import {
  fetchLoggerSummary, fetchLoggerRegenerate, fetchLoggerStatus,
  fetchLoggerLogs, fetchLoggerLog,
  fetchLoggerMemory, fetchLoggerMemoryTopic, fetchLoggerMemoryRefresh,
  fetchLoggerEntities, fetchLoggerEntity, fetchLoggerConsolidate,
  fetchLoggerComments, createLoggerComment, deleteLoggerComment,
  fetchLoggerPreferences, deleteLoggerPreference,
} from './api-client.js';

const CATEGORY_EMOJI = {
  development: '🔧',
  research: '🔍',
  debugging: '🐛',
  config: '⚙️',
  learning: '📚',
  devops: '🚀',
  infrastructure: '🏗️',
};

function logNameToId(name) {
  return name.replace(/[%.]/g, '_');
}

function renderStatusBar(status) {
  const segments = [];
  if (status.pane_count != null) {
    segments.push(`<span class="logger-status-segment">📟 ${status.pane_count} pane${status.pane_count !== 1 ? 's' : ''}</span>`);
  }
  if (status.total_entries != null) {
    segments.push(`<span class="logger-status-segment">${status.total_entries} entries</span>`);
  }
  if (status.last_capture_at) {
    const ts = formatDate(status.last_capture_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    segments.push(`<span class="logger-status-segment">last capture ${ts}</span>`);
  } else {
    segments.push(`<span class="logger-status-segment">no captures yet</span>`);
  }
  return segments.join('');
}

function paneDisplayName(log) {
  if (log.pane_name) return log.pane_name;
  // Fallback: pane_%0.log → Pane 0
  const m = log.name.match(/^pane_%(\w+)\.log$/);
  return m ? `Pane ${m[1]}` : log.name;
}

function categoryEmoji(category) {
  return CATEGORY_EMOJI[category] || '📄';
}

/** Priority order for h2 sections in briefs — higher priority = shown first */
const SECTION_PRIORITY = ['Suggestions', 'Insights', 'Summary'];

/**
 * Reorder h2 sections in rendered HTML by priority.
 * Sections in SECTION_PRIORITY appear first (in that order), then the rest in original order.
 * The leading content before the first h2 (title/meta line) stays at the top.
 */
function reorderSections(html) {
  // Split into: preamble (before first h2) + sections (h2 + content until next h2)
  const parts = html.split(/(?=<h2>)/);
  const preamble = parts[0] && !parts[0].startsWith('<h2>') ? parts.shift() : '';
  if (parts.length <= 1) return html;

  const sectionMap = new Map(); // heading text -> html chunk
  const headings = []; // preserve original order
  for (const part of parts) {
    const m = part.match(/^<h2>(.*?)<\/h2>/);
    const name = m ? m[1] : '';
    sectionMap.set(name, part);
    headings.push(name);
  }

  const ordered = [];
  for (const pri of SECTION_PRIORITY) {
    if (sectionMap.has(pri)) {
      ordered.push(sectionMap.get(pri));
      sectionMap.delete(pri);
    }
  }
  // Append remaining in original order
  for (const h of headings) {
    if (sectionMap.has(h)) {
      ordered.push(sectionMap.get(h));
    }
  }

  return preamble + ordered.join('');
}

/** Current active view type for button logic */
let currentView = 'overview'; // 'overview' | 'session' | 'topic' | 'entity' | 'pane'
let currentContextType = 'overview';
let currentContextId = null;
let pendingQuote = null; // selected text waiting to be attached to a comment

function setCommentContext(type, id) {
  currentContextType = type;
  currentContextId = id;
  pendingQuote = null;
  hideCompose();
  hideFloatingBtn();
  loadComments();
}

function getCommentContext() {
  return { type: currentContextType, id: currentContextId };
}

// --- Floating comment button on text selection ---

function setupFloatingBtn() {
  const contentEl = $('logger-content');
  if (!contentEl) return;

  contentEl.addEventListener('mouseup', (e) => {
    // Small delay so the selection finalizes
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length < 2) { hideFloatingBtn(); return; }

      // Position the floating button near the end of the selection
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const btn = $('comment-floating-btn');
      if (!btn) return;

      btn.style.top = `${rect.top + window.scrollY - 36}px`;
      btn.style.left = `${rect.right + window.scrollX + 4}px`;
      btn.style.display = '';
      btn._selectedText = text;
    }, 10);
  });

  // Hide floating button on click outside or scroll
  document.addEventListener('mousedown', (e) => {
    const btn = $('comment-floating-btn');
    if (btn && !btn.contains(e.target)) {
      // Don't hide immediately — let mouseup on content fire first
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || !sel.toString().trim()) hideFloatingBtn();
      }, 50);
    }
  });
}

function hideFloatingBtn() {
  const btn = $('comment-floating-btn');
  if (btn) btn.style.display = 'none';
}

function onFloatingBtnClick() {
  const btn = $('comment-floating-btn');
  pendingQuote = btn ? btn._selectedText : null;
  window.getSelection().removeAllRanges();
  hideFloatingBtn();
  showCompose();
}

// --- Right-panel compose area ---

function showCompose() {
  const compose = $('comments-compose');
  if (!compose) return;

  const quoteEl = $('compose-quote');
  if (quoteEl) {
    if (pendingQuote) {
      const truncated = pendingQuote.length > 200 ? pendingQuote.slice(0, 200) + '…' : pendingQuote;
      quoteEl.textContent = truncated;
      quoteEl.style.display = '';
    } else {
      quoteEl.textContent = '';
      quoteEl.style.display = 'none';
    }
  }

  compose.style.display = '';
  // Ensure panel is visible
  const layout = document.querySelector('.logger-layout');
  if (layout) layout.classList.add('has-comments');

  const input = $('comment-input');
  if (input) { input.value = ''; input.focus(); }
}

function hideCompose() {
  const compose = $('comments-compose');
  if (compose) compose.style.display = 'none';
  pendingQuote = null;
  updatePanelVisibility();
}

function updatePanelVisibility() {
  const layout = document.querySelector('.logger-layout');
  if (!layout) return;
  const list = $('comment-list');
  const compose = $('comments-compose');
  const prefsList = $('prefs-list');
  const hasItems = list && list.querySelector('.comment-item');
  const hasPrefs = prefsList && prefsList.querySelector('.pref-item');
  const isComposing = compose && compose.style.display !== 'none';
  layout.classList.toggle('has-comments', !!(hasItems || isComposing || hasPrefs));
}

async function submitComment() {
  const input = $('comment-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  const ctx = getCommentContext();
  const submitBtn = $('compose-submit');
  if (submitBtn) submitBtn.disabled = true;
  input.disabled = true;

  try {
    const result = await createLoggerComment(content, ctx.type, ctx.id, pendingQuote);
    hideCompose();
    await loadComments();
    // Poll for learned preferences (background ingestion takes 2-4s)
    if (result.id) pollForLearned(result.id);
  } catch (e) {
    showToast('Failed to save comment');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    input.disabled = false;
  }
}

function pollForLearned(commentId, attempts = 0) {
  if (attempts > 3) return;
  setTimeout(async () => {
    try {
      const data = await fetchLoggerPreferences(null, commentId);
      const prefs = data.preferences || [];
      if (prefs.length > 0) {
        const labels = prefs.map(p => p.content).join('；');
        showToast(`💡 learned: ${labels}`);
        // Refresh preferences panel if visible
        loadPreferencesPanel();
        // Show learned badge on the comment card
        showLearnedOnCard(commentId, prefs);
      } else if (attempts < 3) {
        pollForLearned(commentId, attempts + 1);
      }
    } catch { /* ignore */ }
  }, attempts === 0 ? 3000 : 2000);
}

function showLearnedOnCard(commentId, prefs) {
  const card = document.querySelector(`.comment-item[data-id="${commentId}"]`);
  if (!card || card.querySelector('.comment-learned')) return;
  const badge = document.createElement('div');
  badge.className = 'comment-learned';
  badge.textContent = `💡 ${prefs.map(p => p.content).join('；')}`;
  card.appendChild(badge);
}

const PREF_CATEGORY_LABEL = {
  tool_preference: '🔧 工具',
  workflow_pattern: '🔄 工作流',
  interest_area: '🎯 兴趣',
  opinion: '💬 观点',
  communication_style: '✍️ 风格',
};

async function loadPreferencesPanel() {
  const container = $('prefs-list');
  const countEl = $('prefs-panel-count');
  if (!container) return;
  try {
    const data = await fetchLoggerPreferences();
    const prefs = data.preferences || [];
    if (countEl) countEl.textContent = prefs.length || '';
    if (!prefs.length) {
      container.innerHTML = '<div class="prefs-empty">暂无偏好记录</div>';
      return;
    }
    container.innerHTML = prefs.map(p => {
      const label = PREF_CATEGORY_LABEL[p.category] || p.category;
      const conf = Math.round(p.confidence * 100);
      return `
        <div class="pref-item" data-id="${p.id}">
          <div class="pref-category">${label} <span class="pref-conf">${conf}%</span></div>
          <div class="pref-content">${escHtml(p.content)}</div>
          <button class="pref-delete-btn" data-id="${p.id}" title="Delete">×</button>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.pref-delete-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await deleteLoggerPreference(parseInt(btn.dataset.id));
        await loadPreferencesPanel();
      };
    });
    // Make panel visible if prefs exist
    updatePanelVisibility();
  } catch {
    container.innerHTML = '';
  }
}

// --- Comments list in right panel ---

async function loadComments() {
  const container = $('comment-list');
  if (!container) return;
  const ctx = getCommentContext();
  try {
    const data = await fetchLoggerComments(ctx.type, ctx.id);
    const comments = data.comments || [];
    renderCommentList(container, comments);
    // Update count badge
    const countEl = $('comments-panel-count');
    if (countEl) countEl.textContent = comments.length || '';
    updatePanelVisibility();
    applyHighlights(comments);
  } catch {
    container.innerHTML = '';
    updatePanelVisibility();
  }
}

async function renderCommentList(container, comments) {
  if (!comments.length) {
    container.innerHTML = '';
    return;
  }
  // Oldest first (top-to-bottom reading order)
  const sorted = [...comments].reverse();
  container.innerHTML = sorted.map(c => {
    const date = formatDate(c.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const quote = c.selected_text
      ? `<div class="comment-quote">${escHtml(c.selected_text.length > 150 ? c.selected_text.slice(0, 150) + '…' : c.selected_text)}</div>`
      : '';
    return `
      <div class="comment-item" data-id="${c.id}" data-quote="${escHtml(c.selected_text || '')}">
        ${quote}
        <div class="comment-body">${escHtml(c.content)}</div>
        <div class="comment-meta">
          <span class="comment-date">${date}</span>
          <button class="comment-delete-btn" data-id="${c.id}" title="Delete">×</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire delete buttons
  container.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await deleteLoggerComment(parseInt(btn.dataset.id));
      await loadComments();
    };
  });

  // Wire hover highlights
  container.querySelectorAll('.comment-item').forEach(card => {
    card.addEventListener('mouseenter', () => highlightQuoteInContent(card.dataset.quote, true));
    card.addEventListener('mouseleave', () => highlightQuoteInContent(card.dataset.quote, false));
  });

  // Load learned badges for existing comments
  for (const c of sorted) {
    try {
      const data = await fetchLoggerPreferences(null, c.id);
      if (data.preferences && data.preferences.length > 0) {
        showLearnedOnCard(c.id, data.preferences);
      }
    } catch { /* ignore */ }
  }
}

// --- Content text highlights ---

function applyHighlights(comments) {
  const content = $('logger-content');
  if (!content) return;
  // Remove old highlight marks
  content.querySelectorAll('mark.comment-highlight').forEach(m => {
    const parent = m.parentNode;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
  // Apply persistent subtle highlights for all comments with quotes
  const quotedComments = comments.filter(c => c.selected_text);
  for (const c of quotedComments) {
    highlightTextInDom(content, c.selected_text, c.id);
  }
}

function highlightTextInDom(root, text, commentId) {
  if (!text || text.length < 3) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodesToWrap = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const idx = node.textContent.indexOf(text);
    if (idx !== -1) {
      nodesToWrap.push({ node, idx, len: text.length, commentId });
    }
  }
  // Wrap matches (process in reverse to avoid offset issues)
  for (const { node, idx, len, commentId: cid } of nodesToWrap.reverse()) {
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + len);
    const mark = document.createElement('mark');
    mark.className = 'comment-highlight';
    mark.dataset.commentId = cid;
    range.surroundContents(mark);
  }
}

function highlightQuoteInContent(quote, on) {
  if (!quote) return;
  const content = $('logger-content');
  if (!content) return;
  content.querySelectorAll('mark.comment-highlight').forEach(m => {
    // Check if this mark's text matches the hovered quote
    if (quote && m.textContent.includes(quote.slice(0, 50))) {
      m.classList.toggle('comment-highlight-active', on);
    }
  });
}

export async function renderLoggerView() {
  const container = $('logger-view');
  const sidebarList = $('logger-sidebar-list');
  if (!container) return;

  // Main content + right comment panel
  container.innerHTML = `
    <div class="logger-layout">
      <div class="logger-main" id="logger-main">
        <div class="logger-header">
          <div class="logger-status-bar" id="logger-status-bar">Loading status…</div>
          <button class="btn logger-regen-btn" id="btn-logger-regen">Refresh Memory</button>
        </div>
        <div class="logger-content" id="logger-content">
          <div class="logger-loading">Loading overview…</div>
        </div>
      </div>
      <div class="logger-comments-panel" id="logger-comments-panel">
        <div class="comments-panel-header">
          <span class="comments-panel-title">Comments</span>
          <span class="comments-panel-count" id="comments-panel-count"></span>
        </div>
        <div class="comments-panel-list" id="comment-list"></div>
        <div class="comments-compose" id="comments-compose" style="display:none">
          <div class="compose-quote" id="compose-quote" style="display:none"></div>
          <textarea id="comment-input" placeholder="Add a comment…" rows="3"></textarea>
          <div class="compose-actions">
            <button class="btn compose-cancel" id="compose-cancel">Cancel</button>
            <button class="btn compose-submit" id="compose-submit">Comment</button>
          </div>
        </div>
        <div class="prefs-panel-section" id="prefs-panel-section">
          <div class="comments-panel-header prefs-header" id="prefs-toggle">
            <span class="comments-panel-title">Preferences</span>
            <span class="comments-panel-count" id="prefs-panel-count"></span>
          </div>
          <div class="prefs-panel-list" id="prefs-list"></div>
        </div>
      </div>
      <div class="comment-floating-btn" id="comment-floating-btn" style="display:none" title="Comment on selection">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v9H5l-3 3V2z"/></svg>
      </div>
    </div>
  `;

  // Populate the global sidebar with logger nav items
  if (sidebarList) {
    sidebarList.innerHTML = `
      <div class="logger-sidebar-item active" data-key="overview" id="logger-nav-overview">
        <span class="logger-sidebar-label">Overview</span>
      </div>
      <div class="logger-sidebar-item" data-key="session" id="logger-nav-session">
        <span class="logger-sidebar-label">Session</span>
      </div>
      <div id="logger-sidebar-entities-section" style="display:none">
        <div class="logger-sidebar-section-title">Entities</div>
        <div id="logger-sidebar-entities"><div class="logger-sidebar-loading">Loading…</div></div>
      </div>
      <div id="logger-sidebar-topics-section">
        <div class="logger-sidebar-section-title">Topics</div>
        <div id="logger-sidebar-topics"><div class="logger-sidebar-loading">Loading…</div></div>
      </div>
      <div class="logger-sidebar-section-title">Pane Logs</div>
      <div id="logger-sidebar-logs"><div class="logger-sidebar-loading">Loading…</div></div>
    `;
  }

  // Wire up regenerate button
  const regenBtn = $('btn-logger-regen');
  regenBtn.onclick = async () => {
    if (currentView === 'session') {
      // Session view: regenerate summary (existing behavior)
      regenBtn.disabled = true;
      regenBtn.classList.add('loading');
      regenBtn.textContent = 'Regenerating…';
      $('logger-content').innerHTML = '<div class="logger-loading">Regenerating summary (this may take up to 2 minutes)…</div>';
      try {
        const data = await fetchLoggerRegenerate();
        renderSummaryContent(data);
      } catch (e) {
        showToast('Failed to regenerate summary');
        $('logger-content').innerHTML = '<div class="logger-empty">Failed to regenerate. Try again.</div>';
      } finally {
        regenBtn.disabled = false;
        regenBtn.classList.remove('loading');
        regenBtn.textContent = 'Regenerate';
      }
    } else {
      // Overview, Topic, or Entity view: refresh memory
      regenBtn.disabled = true;
      regenBtn.classList.add('loading');
      regenBtn.textContent = 'Refreshing…';
      $('logger-content').innerHTML = '<div class="logger-loading">Refreshing memory (this may take a few minutes)…</div>';
      try {
        await fetchLoggerMemoryRefresh();
        // Reload sidebar topics and entities
        await loadSidebarTopics();
        await loadSidebarEntities();
        // Reload current view
        if (currentView === 'overview') {
          await loadOverview();
        } else if (currentView === 'entity') {
          const activeItem = document.querySelector('.logger-sidebar-item.active');
          const key = activeItem ? activeItem.dataset.key : null;
          if (key && key.startsWith('entity-')) {
            await loadEntity(key.replace('entity-', ''));
          } else {
            await loadOverview();
          }
        } else if (currentView === 'topic') {
          // Re-select the same topic — find the currently active item
          const activeItem = document.querySelector('.logger-sidebar-item.active');
          const slug = activeItem ? activeItem.dataset.key : null;
          if (slug && slug !== 'overview' && slug !== 'session') {
            await loadTopic(slug);
          } else {
            await loadOverview();
          }
        }
        showToast('Memory refreshed');
      } catch (e) {
        showToast('Failed to refresh memory');
        $('logger-content').innerHTML = '<div class="logger-empty">Failed to refresh memory. Try again.</div>';
      } finally {
        regenBtn.disabled = false;
        regenBtn.classList.remove('loading');
        regenBtn.textContent = 'Refresh Memory';
      }
    }
  };

  // Wire up comment panel
  $('comment-floating-btn').onclick = onFloatingBtnClick;
  $('compose-submit').onclick = submitComment;
  $('compose-cancel').onclick = () => hideCompose();
  $('comment-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
    if (e.key === 'Escape') hideCompose();
  });
  setupFloatingBtn();

  // Overview nav item click (default)
  $('logger-nav-overview').onclick = () => {
    setActiveSidebarItem('overview');
    updateRegenButton('overview');
    setCommentContext('overview', null);
    $('logger-content').innerHTML = '<div class="logger-loading">Loading overview…</div>';
    loadOverview();
  };

  // Session nav item click
  $('logger-nav-session').onclick = () => {
    setActiveSidebarItem('session');
    updateRegenButton('session');
    setCommentContext('session', null);
    $('logger-content').innerHTML = '<div class="logger-loading">Loading summary…</div>';
    fetchLoggerSummary().then(renderSummaryContent).catch(() => {
      $('logger-content').innerHTML = '<div class="logger-empty">Failed to load summary.</div>';
    });
  };

  // Fetch status, memory overview, logs, and entities in parallel
  const [statusResult, memoryResult, logsResult, entitiesResult] = await Promise.allSettled([
    fetchLoggerStatus(),
    fetchLoggerMemory(),
    fetchLoggerLogs(),
    fetchLoggerEntities(),
  ]);

  // Render status bar
  const statusBar = $('logger-status-bar');
  if (statusResult.status === 'fulfilled') {
    statusBar.innerHTML = renderStatusBar(statusResult.value);
  } else {
    statusBar.innerHTML = '<span class="logger-status-segment">Status unavailable</span>';
  }

  // Render overview (default view)
  currentView = 'overview';
  currentContextType = 'overview';
  currentContextId = null;
  if (memoryResult.status === 'fulfilled') {
    renderOverviewContent(memoryResult.value);
    // Also render topic sidebar items from the same response
    renderTopicSidebar(memoryResult.value.topics || []);
  } else {
    renderOverviewContent({ overview: null, topics: [] });
    renderTopicSidebar([]);
  }

  // Render entity sidebar if entities exist — show entities section and hide topics
  const hasEntities = entitiesResult.status === 'fulfilled'
    && entitiesResult.value.entities
    && entitiesResult.value.entities.length > 0;
  if (hasEntities) {
    const entSection = $('logger-sidebar-entities-section');
    const topSection = $('logger-sidebar-topics-section');
    if (entSection) entSection.style.display = '';
    if (topSection) topSection.style.display = 'none';
    renderEntitySidebar(entitiesResult.value.entities);
  }

  // Render pane log sidebar items
  const logsContainer = $('logger-sidebar-logs');
  if (logsResult.status === 'fulfilled' && logsResult.value.logs.length > 0) {
    const logs = logsResult.value.logs;
    logsContainer.innerHTML = logs.map(log => `
      <div class="logger-sidebar-item" data-key="${escHtml(log.name)}" id="logger-nav-${logNameToId(log.name)}">
        <span class="logger-sidebar-label">
          <span class="logger-pane-icon" aria-hidden="true">▸</span> ${escHtml(paneDisplayName(log))}
        </span>
        <span class="logger-sidebar-meta">${log.line_count} lines</span>
      </div>
    `).join('');

    // Wire up pane log clicks
    logs.forEach(log => {
      const el = document.getElementById(`logger-nav-${logNameToId(log.name)}`);
      if (!el) return;
      el.onclick = () => loadPaneLog(log.name);
    });
  } else {
    logsContainer.innerHTML = '<div class="logger-sidebar-empty">No pane logs</div>';
  }

  // Load initial comments and preferences
  loadComments();
  loadPreferencesPanel();
}

function setActiveSidebarItem(key) {
  document.querySelectorAll('.logger-sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.key === key);
  });
}

function updateRegenButton(view) {
  const btn = $('btn-logger-regen');
  if (!btn) return;
  currentView = view;
  if (view === 'pane') {
    btn.style.display = 'none';
  } else if (view === 'session') {
    btn.style.display = '';
    btn.textContent = 'Regenerate';
  } else {
    // overview, topic, or entity
    btn.style.display = '';
    btn.textContent = 'Refresh Memory';
  }
}

function renderTopicSidebar(topics) {
  const container = $('logger-sidebar-topics');
  if (!container) return;

  if (!topics || topics.length === 0) {
    container.innerHTML = '<div class="logger-sidebar-empty">No topics yet</div>';
    return;
  }

  // Sort by updated_at descending (most recent first)
  topics.sort((a, b) => {
    const ta = a.updated_at || '';
    const tb = b.updated_at || '';
    return tb.localeCompare(ta);
  });

  container.innerHTML = topics.map(t => `
    <div class="logger-sidebar-item" data-key="${escHtml(t.slug)}" id="logger-nav-topic-${escHtml(t.slug)}">
      <span class="logger-sidebar-label">
        <span class="logger-topic-badge" title="${escHtml(t.category)}">${categoryEmoji(t.category)}</span> ${escHtml(t.name)}
      </span>
      <span class="logger-sidebar-meta">${t.entry_count} entr${t.entry_count === 1 ? 'y' : 'ies'}</span>
    </div>
  `).join('');

  // Wire up topic clicks
  topics.forEach(t => {
    const el = document.getElementById(`logger-nav-topic-${t.slug}`);
    if (!el) return;
    el.onclick = () => loadTopic(t.slug);
  });
}

async function loadSidebarTopics() {
  try {
    const data = await fetchLoggerMemory();
    renderTopicSidebar(data.topics || []);
  } catch (e) {
    const container = $('logger-sidebar-topics');
    if (container) container.innerHTML = '<div class="logger-sidebar-empty">Failed to load topics</div>';
  }
}

async function loadOverview() {
  setActiveSidebarItem('overview');
  updateRegenButton('overview');
  try {
    const data = await fetchLoggerMemory();
    renderOverviewContent(data);
  } catch (e) {
    $('logger-content').innerHTML = '<div class="logger-empty">Failed to load overview.</div>';
  }
}

function renderOverviewContent(data) {
  const content = $('logger-content');
  if (!content) return;

  if (!data.overview) {
    content.innerHTML = `
      <div class="logger-empty">
        No memory yet. Click <strong>Refresh Memory</strong> to build from your session history.
      </div>
    `;
    return;
  }

  const generatedAt = data.overview_generated_at
    ? `<div class="logger-generated-at">Generated ${formatDate(data.overview_generated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`
    : '';

  content.innerHTML = `${generatedAt}<div class="logger-body">${mdToHtml(data.overview)}</div>`;
}

async function loadTopic(slug) {
  setActiveSidebarItem(slug);
  updateRegenButton('topic');
  setCommentContext('topic', slug);
  $('logger-content').innerHTML = '<div class="logger-loading">Loading topic…</div>';
  try {
    const data = await fetchLoggerMemoryTopic(slug);
    renderTopicContent(data);
  } catch (e) {
    $('logger-content').innerHTML = '<div class="logger-empty">Failed to load topic.</div>';
  }
}

function renderTopicContent(data) {
  const content = $('logger-content');
  if (!content) return;

  const emoji = categoryEmoji(data.category);
  const updatedAt = data.updated_at
    ? formatDate(data.updated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const metaSegments = [];
  if (data.category) metaSegments.push(`${emoji} ${escHtml(data.category)}`);
  if (data.status) metaSegments.push(`Status: ${escHtml(data.status)}`);
  if (data.entry_count != null) metaSegments.push(`${data.entry_count} entr${data.entry_count === 1 ? 'y' : 'ies'}`);
  if (updatedAt) metaSegments.push(`Last updated: ${updatedAt}`);

  const metaBar = metaSegments.length
    ? `<div class="logger-topic-meta">${metaSegments.join('<span class="logger-topic-meta-sep">·</span>')}</div>`
    : '';

  const body = data.content
    ? `<div class="logger-body">${reorderSections(mdToHtml(data.content))}</div>`
    : '<div class="logger-empty">No content for this topic yet.</div>';

  content.innerHTML = `${metaBar}${body}`;
}

async function loadPaneLog(name) {
  setActiveSidebarItem(name);
  updateRegenButton('pane');
  setCommentContext('pane', name);
  $('logger-content').innerHTML = '<div class="logger-loading">Loading…</div>';
  try {
    const data = await fetchLoggerLog(name);
    renderPaneLogContent(data);
  } catch (e) {
    $('logger-content').innerHTML = '<div class="logger-empty">Failed to load log.</div>';
  }
}

function renderSummaryContent(data) {
  const content = $('logger-content');
  if (!content) return;

  if (!data.exists || !data.content) {
    content.innerHTML = '<div class="logger-empty">No summary yet. Click <strong>Regenerate</strong> to generate one.</div>';
    return;
  }

  const generatedAt = data.generated_at
    ? `<div class="logger-generated-at">Generated ${formatDate(data.generated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`
    : '';

  content.innerHTML = `${generatedAt}<div class="logger-body">${mdToHtml(data.content)}</div>`;
}

function renderPaneLogContent(data) {
  const content = $('logger-content');
  if (!content) return;

  const modifiedAt = data.modified_at
    ? `<div class="logger-generated-at">Last modified ${formatDate(data.modified_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`
    : '';

  content.innerHTML = `${modifiedAt}<pre class="logger-raw-log">${escHtml(data.content)}</pre>`;
}


// --- Entity functions ---

function renderEntitySidebar(entities) {
  const container = $('logger-sidebar-entities');
  if (!container) return;
  if (!entities || entities.length === 0) {
    container.innerHTML = '<div class="logger-sidebar-empty">No entities yet. Click Consolidate to group topics.</div>';
    return;
  }
  container.innerHTML = entities.map(e => `
    <div class="logger-sidebar-item" data-key="entity-${escHtml(e.slug)}" id="logger-nav-entity-${escHtml(e.slug)}">
      <span class="logger-sidebar-label">
        <span class="logger-topic-badge" title="${escHtml(e.category)}">${categoryEmoji(e.category)}</span> ${escHtml(e.name)}
      </span>
      <span class="logger-sidebar-meta">${e.topic_count} topics</span>
    </div>
  `).join('');

  entities.forEach(e => {
    const el = document.getElementById(`logger-nav-entity-${e.slug}`);
    if (!el) return;
    el.onclick = () => loadEntity(e.slug);
  });
}

async function loadSidebarEntities() {
  try {
    const data = await fetchLoggerEntities();
    const hasEntities = data.entities && data.entities.length > 0;
    const entSection = $('logger-sidebar-entities-section');
    const topSection = $('logger-sidebar-topics-section');
    if (hasEntities) {
      if (entSection) entSection.style.display = '';
      if (topSection) topSection.style.display = 'none';
      renderEntitySidebar(data.entities);
    } else {
      if (entSection) entSection.style.display = 'none';
      if (topSection) topSection.style.display = '';
    }
  } catch (e) {
    const container = $('logger-sidebar-entities');
    if (container) container.innerHTML = '<div class="logger-sidebar-empty">Failed to load entities</div>';
  }
}

async function loadEntity(slug) {
  setActiveSidebarItem(`entity-${slug}`);
  updateRegenButton('entity');
  setCommentContext('entity', slug);
  $('logger-content').innerHTML = '<div class="logger-loading">Loading entity…</div>';
  try {
    const data = await fetchLoggerEntity(slug);
    renderEntityContent(data);
  } catch (e) {
    $('logger-content').innerHTML = '<div class="logger-empty">Failed to load entity.</div>';
  }
}

function renderEntityContent(data) {
  const content = $('logger-content');
  if (!content) return;

  const emoji = categoryEmoji(data.category);
  const updatedAt = data.updated_at
    ? formatDate(data.updated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const metaSegments = [];
  if (data.category) metaSegments.push(`${emoji} ${escHtml(data.category)}`);
  if (data.topic_count) metaSegments.push(`${data.topic_count} topics merged`);
  if (data.event_count) metaSegments.push(`${data.event_count} events`);
  if (updatedAt) metaSegments.push(`Last updated: ${updatedAt}`);

  const metaBar = metaSegments.length
    ? `<div class="logger-topic-meta">${metaSegments.join('<span class="logger-topic-meta-sep">·</span>')}</div>`
    : '';

  // Reorder sections (Suggestions → Insights → Summary → rest), then wrap with special classes
  let bodyHtml = data.content ? reorderSections(mdToHtml(data.content)) : '<div class="logger-empty">No content yet.</div>';

  // Post-process: wrap Insights and Suggestions with special div classes for styling
  bodyHtml = bodyHtml.replace(
    /<h2>Insights<\/h2>([\s\S]*?)(?=<h2>|$)/,
    '<div class="entity-insights-section"><h2>Insights</h2>$1</div>'
  );
  bodyHtml = bodyHtml.replace(
    /<h2>Suggestions<\/h2>([\s\S]*?)(?=<h2>|$)/,
    '<div class="entity-suggestions-section"><h2>Suggestions</h2>$1</div>'
  );

  content.innerHTML = `${metaBar}<div class="logger-body">${bodyHtml}</div>`;
}
