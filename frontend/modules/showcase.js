import { state } from './state.js';
import { $, escHtml, showToast } from './utils.js';
import { fetchShowcase, generateShowcase, likeShowcase } from './api-client.js';

function updatePromptDisplay(prompt) {
  const el = $('showcase-prompt-display');
  if (!el) return;
  if (prompt) {
    el.innerHTML = `<div class="showcase-prompt-label">AI Prompt</div><div class="showcase-prompt-text">${escHtml(prompt)}</div>`;
    el.classList.add('visible');
  } else {
    el.innerHTML = '';
    el.classList.remove('visible');
  }
}

export async function renderShowcaseColumn() {
  const img = $('showcase-image');

  // Load showcase image
  if (!state.showcaseUrl) {
    await fetchShowcase();
  }

  if (state.showcaseUrl) {
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = state.showcaseUrl;
      img.style.opacity = '1';
    };
    tempImg.src = state.showcaseUrl;
  } else {
    img.src = '';
    img.style.opacity = '0';
  }

  if (state.showcasePromptUsed) {
    updatePromptDisplay(state.showcasePromptUsed);
  }
}

export async function regenerateShowcase() {
  const img = $('showcase-image');
  const regenBtn = $('btn-regen-showcase');

  regenBtn.classList.add('spinning');

  try {
    const result = await generateShowcase();
    if (result.ok) {
      img.style.opacity = '0';
      updatePromptDisplay(result.prompt || null);
      const tempImg = new Image();
      tempImg.onload = () => {
        img.src = result.url;
        img.style.opacity = '1';
      };
      tempImg.onerror = () => {
        img.src = result.url;
        img.style.opacity = '1';
      };
      tempImg.src = result.url;
    } else {
      showToast(result.error || 'Failed to generate image');
    }
  } catch (e) {
    showToast('Failed to generate image');
  } finally {
    regenBtn.classList.remove('spinning');
  }
}

export async function likeShowcaseImage() {
  const likeBtn = $('btn-like-showcase');

  try {
    await likeShowcase();
    state.showcaseLiked = true;
    likeBtn.querySelector('svg').setAttribute('fill', 'currentColor');
    likeBtn.classList.add('liked');
  } catch (e) {
    alert('Failed to like image: ' + e.message);
  }
}
