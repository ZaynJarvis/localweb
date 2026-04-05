import { state } from './state.js';
import { $, showToast, mdToHtml } from './utils.js';
import { streamSummaryChat, saveSummaryFromChat, saveDefaultPrompt } from './api-client.js';
import { renderSummaryBlock } from './summary.js';

let chatMessages = []; // {role, content}
let isStreaming = false;
let lastAssistantText = '';

export function openSummaryChat() {
  const post = state.currentPost;
  if (!post) return;

  chatMessages = [];
  lastAssistantText = '';
  isStreaming = false;

  const col = $('post-showcase-column');
  col.classList.add('summary-chat-active');

  col.innerHTML = `
    <div class="summary-chat-panel">
      <div class="summary-chat-header">
        <span class="summary-chat-title">Edit Summary</span>
        <button class="summary-chat-close" id="btn-close-summary-chat" title="Close">&times;</button>
      </div>
      <div class="summary-chat-messages" id="summary-chat-messages">
        <div class="summary-chat-hint">Tell the AI how you'd like the summary changed. The original article and current summary are included as context.</div>
      </div>
      <div class="summary-chat-actions" id="summary-chat-actions">
        <button class="btn summary-chat-action-btn" id="btn-save-default-prompt" title="Save your last message as the default summary prompt">Save as Default Prompt</button>
        <button class="btn summary-chat-action-btn primary" id="btn-save-chat-summary" title="Save the latest AI response as this post's summary">Save Summary</button>
      </div>
      <div class="summary-chat-input-row">
        <textarea class="summary-chat-input" id="summary-chat-input" rows="2" placeholder="e.g. Make it shorter, focus on key takeaways..."></textarea>
        <button class="summary-chat-send" id="btn-send-summary-chat" title="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;

  // Event listeners
  $('btn-close-summary-chat').onclick = closeSummaryChat;
  $('btn-send-summary-chat').onclick = sendMessage;
  $('btn-save-default-prompt').onclick = handleSaveDefaultPrompt;
  $('btn-save-chat-summary').onclick = handleSaveSummary;

  const input = $('summary-chat-input');
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Hide action buttons initially
  $('summary-chat-actions').classList.add('hidden');

  input.focus();
}

export function closeSummaryChat() {
  const col = $('post-showcase-column');
  col.classList.remove('summary-chat-active');

  // Restore showcase HTML
  col.innerHTML = `
    <div class="showcase-image-wrapper">
      <img class="showcase-image" id="showcase-image" src="" alt="Showcase" />
      <div class="showcase-fade-overlay"></div>
      <div class="showcase-actions">
        <button class="showcase-btn" id="btn-like-showcase" title="Like">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <button class="showcase-btn" id="btn-regen-showcase" title="Regenerate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
      </div>
    </div>
  `;

  // Re-bind showcase events — import dynamically to avoid circular deps
  import('./showcase.js').then(({ renderShowcaseColumn, regenerateShowcase, likeShowcaseImage }) => {
    renderShowcaseColumn();
    $('btn-regen-showcase').onclick = regenerateShowcase;
    $('btn-like-showcase').onclick = likeShowcaseImage;
  });
}

function sendMessage() {
  if (isStreaming) return;
  const input = $('summary-chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  chatMessages.push({ role: 'user', content: text });
  appendMessageBubble('user', text);
  streamResponse();
}

function appendMessageBubble(role, content, isHtml = false) {
  const container = $('summary-chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `summary-chat-bubble ${role}`;
  if (isHtml) {
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function streamResponse() {
  isStreaming = true;
  lastAssistantText = '';
  const bubble = appendMessageBubble('assistant', '');
  bubble.innerHTML = '<span class="summary-chat-typing"></span>';

  const sendBtn = $('btn-send-summary-chat');
  sendBtn.disabled = true;

  streamSummaryChat(
    state.currentPost.id,
    chatMessages,
    // onToken
    (token) => {
      lastAssistantText += token;
      bubble.innerHTML = mdToHtml(lastAssistantText);
      const container = $('summary-chat-messages');
      container.scrollTop = container.scrollHeight;
    },
    // onError
    (err) => {
      bubble.innerHTML = `<span style="color: var(--error);">Error: ${err}</span>`;
      isStreaming = false;
      sendBtn.disabled = false;
    },
    // onDone
    () => {
      isStreaming = false;
      sendBtn.disabled = false;
      chatMessages.push({ role: 'assistant', content: lastAssistantText });
      // Show action buttons after first response
      $('summary-chat-actions').classList.remove('hidden');
      $('summary-chat-input').focus();
    }
  );
}

async function handleSaveDefaultPrompt() {
  // Find the last user message to use as prompt
  const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) {
    showToast('No message to save as prompt');
    return;
  }

  try {
    await saveDefaultPrompt(lastUserMsg.content);
    showToast('Saved as default summary prompt');
  } catch (e) {
    showToast('Failed to save prompt');
  }
}

async function handleSaveSummary() {
  if (!lastAssistantText) {
    showToast('No summary to save');
    return;
  }

  try {
    const summary = await saveSummaryFromChat(state.currentPost.id, lastAssistantText);
    state.currentPost.summary_json = summary;
    renderSummaryBlock(state.currentPost);
    showToast('Summary saved');
    closeSummaryChat();
  } catch (e) {
    showToast('Failed to save summary');
  }
}
