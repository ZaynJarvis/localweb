import { $, escHtml, showToast, mdToHtml, formatDate } from './utils.js';
import {
  fetchLoggerSummary, fetchLoggerRegenerate, fetchLoggerStatus,
  fetchLoggerLogs, fetchLoggerLog,
  fetchLoggerMemory, fetchLoggerMemoryTopic, fetchLoggerMemoryRefresh,
  fetchLoggerEntities, fetchLoggerEntity, fetchLoggerConsolidate,
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

/** Current active view type for button logic */
let currentView = 'overview'; // 'overview' | 'session' | 'topic' | 'entity' | 'pane'

export async function renderLoggerView() {
  const container = $('logger-view');
  const sidebarList = $('logger-sidebar-list');
  if (!container) return;

  // Main content — no sidebar column here, it lives in the global sidebar
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

  // Overview nav item click (default)
  $('logger-nav-overview').onclick = () => {
    setActiveSidebarItem('overview');
    updateRegenButton('overview');
    $('logger-content').innerHTML = '<div class="logger-loading">Loading overview…</div>';
    loadOverview();
  };

  // Session nav item click
  $('logger-nav-session').onclick = () => {
    setActiveSidebarItem('session');
    updateRegenButton('session');
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
    ? `<div class="logger-body">${mdToHtml(data.content)}</div>`
    : '<div class="logger-empty">No content for this topic yet.</div>';

  content.innerHTML = `${metaBar}${body}`;
}

async function loadPaneLog(name) {
  setActiveSidebarItem(name);
  updateRegenButton('pane');
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

  // Render the full markdown, but wrap Insights and Suggestions sections with special classes
  let bodyHtml = data.content ? mdToHtml(data.content) : '<div class="logger-empty">No content yet.</div>';

  // Post-process: wrap h2 sections "Insights" and "Suggestions" with special div wrappers
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
