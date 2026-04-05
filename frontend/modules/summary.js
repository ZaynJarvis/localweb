import { state } from './state.js';
import { $, mdToHtml, showToast } from './utils.js';
import { summarizePost, fetchPost } from './api-client.js';
import { openSummaryChat } from './summary-chat.js';

let summaryPollInterval = null;

export function clearSummaryPolling() {
  if (summaryPollInterval) {
    clearInterval(summaryPollInterval);
    summaryPollInterval = null;
  }
}

export function renderSummaryBlock(post) {
  clearSummaryPolling(); // Always clear first

  const loading = $('summary-loading');
  const content = $('summary-content');
  const btn = $('btn-generate-summary');

  if (post.summary_json && (post.summary_json.en || post.summary_json.zh)) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    btn.classList.add('hidden');

    const lang = state.postsSettings.posts_language || 'en';
    let summaryHtml = '';

    if (lang === 'both') {
      if (post.summary_json.en) {
        summaryHtml += `<div>${mdToHtml(post.summary_json.en)}</div>`;
      }
      if (post.summary_json.zh) {
        summaryHtml += `<div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px;">${mdToHtml(post.summary_json.zh)}</div>`;
      }
    } else if (lang === 'zh' && post.summary_json.zh) {
      summaryHtml = `<div>${mdToHtml(post.summary_json.zh)}</div>`;
    } else if (post.summary_json.en) {
      summaryHtml = `<div>${mdToHtml(post.summary_json.en)}</div>`;
    } else if (post.summary_json.zh) {
      summaryHtml = `<div>${mdToHtml(post.summary_json.zh)}</div>`;
    }

    content.innerHTML = `
      <div class="summary-header-row">
        <h4>Summary</h4>
        <button class="btn-summary-edit" id="btn-edit-summary" title="Edit summary with AI chat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
      <div class="summary-text">${summaryHtml}</div>
    `;
    // Bind edit button
    const editBtn = $('btn-edit-summary');
    if (editBtn) editBtn.onclick = openSummaryChat;
  } else {
    // Summary being auto-generated in background — show spinner and start polling
    loading.classList.remove('hidden');
    content.classList.add('hidden');
    btn.classList.add('hidden');

    // Start polling every 3 seconds, timeout after 30 seconds
    let elapsed = 0;
    summaryPollInterval = setInterval(async () => {
      elapsed += 3000;
      try {
        const updated = await fetchPost(post.id);
        if (updated.summary_json && (updated.summary_json.en || updated.summary_json.zh)) {
          clearSummaryPolling();
          // Update state and local post object
          Object.assign(post, updated);
          if (state.currentPost && state.currentPost.id === post.id) {
            Object.assign(state.currentPost, updated);
          }
          renderSummaryBlock(post);
          return;
        }
      } catch (e) {
        // Ignore fetch errors during polling, keep trying
      }
      if (elapsed >= 60000) {
        clearSummaryPolling();
        // Show "Generate Summary" button after timeout
        loading.classList.add('hidden');
        btn.classList.remove('hidden');
      }
    }, 3000);
  }
}

export async function generateSummary() {
  if (!state.currentPost) return;

  const loading = $('summary-loading');
  const content = $('summary-content');
  const btn = $('btn-generate-summary');

  btn.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const summary = await summarizePost(state.currentPost.id);
    state.currentPost.summary_json = summary;
    renderSummaryBlock(state.currentPost);
  } catch (e) {
    loading.classList.add('hidden');
    btn.classList.remove('hidden');
    showToast('Failed to generate summary');
  }
}
