import { state } from './state.js';
import { $, showToast } from './utils.js';
import { savePostsSettings, summarizePost } from './api-client.js';
import { renderSummaryBlock } from './summary.js';

const PALETTES = {
  default: {
    label: 'Default',
    vars: { '--bg': '#0f1117', '--surface': '#1a1d27', '--surface2': '#222536', '--border': '#2d3148', '--accent': '#6c8cff', '--accent-hover': '#8aa3ff', '--text': '#e2e4f0', '--muted': '#7a7f9d' }
  },
  midnight: {
    label: 'Midnight Blue',
    vars: { '--bg': '#0a0e1a', '--surface': '#111827', '--surface2': '#1e2a3a', '--border': '#253348', '--accent': '#4facfe', '--accent-hover': '#7ac0ff', '--text': '#dce4f0', '--muted': '#6b7fa0' }
  },
  emerald: {
    label: 'Emerald',
    vars: { '--bg': '#0d1117', '--surface': '#161b22', '--surface2': '#1c2630', '--border': '#2a3540', '--accent': '#4ade80', '--accent-hover': '#6ee7a0', '--text': '#e0e8f0', '--muted': '#7a8a9d' }
  },
  rose: {
    label: 'Rose',
    vars: { '--bg': '#12101a', '--surface': '#1a1724', '--surface2': '#242030', '--border': '#332d42', '--accent': '#f472b6', '--accent-hover': '#f9a0ce', '--text': '#e8e2f0', '--muted': '#8a7f9d' }
  },
  amber: {
    label: 'Amber',
    vars: { '--bg': '#141210', '--surface': '#1c1a16', '--surface2': '#262320', '--border': '#3a3530', '--accent': '#f59e0b', '--accent-hover': '#fbbf24', '--text': '#f0ebe0', '--muted': '#9d937a' }
  },
  mono: {
    label: 'Mono',
    vars: { '--bg': '#111111', '--surface': '#1a1a1a', '--surface2': '#222222', '--border': '#333333', '--accent': '#999999', '--accent-hover': '#bbbbbb', '--text': '#e0e0e0', '--muted': '#777777' }
  }
};

function lightenColor(hex, amount = 30) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getBasePalette() {
  const current = state.postsSettings.color_palette || 'default';
  // If it's a preset, use it; if custom, fall back to default
  if (current.startsWith('custom:')) {
    return PALETTES['default'];
  }
  return PALETTES[current] || PALETTES['default'];
}

function applyCustomAccent(hex) {
  const base = getBasePalette();
  const root = document.documentElement;
  Object.entries(base.vars).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-hover', lightenColor(hex));
}

export function applyPalette(name) {
  if (name && name.startsWith('custom:')) {
    const hex = name.slice(7);
    applyCustomAccent(hex);
    return;
  }
  const palette = PALETTES[name] || PALETTES['default'];
  const root = document.documentElement;
  Object.entries(palette.vars).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });
}

function getCustomColors() {
  try {
    const raw = state.postsSettings.custom_colors;
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}

function renderCustomPaletteHistory() {
  const container = $('custom-palette-history');
  if (!container) return;
  container.innerHTML = '';
  const colors = getCustomColors();
  const currentPalette = state.postsSettings.color_palette || 'default';

  colors.forEach(hex => {
    const swatch = document.createElement('div');
    swatch.className = 'custom-history-swatch';
    if (currentPalette === `custom:${hex}`) {
      swatch.classList.add('active');
    }
    swatch.style.background = hex;
    swatch.title = hex;
    swatch.onclick = () => {
      applyCustomAccent(hex);
      state.postsSettings.color_palette = `custom:${hex}`;
      // Deselect preset swatches
      const picker = $('palette-picker');
      if (picker) picker.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
      // Update custom accent picker value
      const input = $('custom-accent-picker');
      if (input) input.value = hex;
      // Update active state on history swatches
      container.querySelectorAll('.custom-history-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    };
    container.appendChild(swatch);
  });
}

function renderPalettePicker() {
  const container = $('palette-picker');
  if (!container) return;
  container.innerHTML = '';
  const current = state.postsSettings.color_palette || 'default';

  Object.entries(PALETTES).forEach(([name, palette]) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch' + (name === current ? ' active' : '');
    swatch.title = palette.label;
    swatch.style.background = `linear-gradient(135deg, ${palette.vars['--bg']} 50%, ${palette.vars['--accent']} 50%)`;
    swatch.onclick = () => {
      container.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      state.postsSettings.color_palette = name;
      applyPalette(name);
      // Deselect custom history swatches
      const histContainer = $('custom-palette-history');
      if (histContainer) histContainer.querySelectorAll('.custom-history-swatch').forEach(s => s.classList.remove('active'));
    };
    container.appendChild(swatch);
  });

  // Set up color picker
  const colorInput = $('custom-accent-picker');
  if (colorInput) {
    // Set initial value
    if (current.startsWith('custom:')) {
      colorInput.value = current.slice(7);
    } else {
      const palette = PALETTES[current] || PALETTES['default'];
      colorInput.value = palette.vars['--accent'];
    }

    colorInput.addEventListener('input', (e) => {
      const hex = e.target.value;
      applyCustomAccent(hex);
      state.postsSettings.color_palette = `custom:${hex}`;
      // Deselect preset swatches
      container.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
      // Deselect custom history swatches
      const histContainer = $('custom-palette-history');
      if (histContainer) histContainer.querySelectorAll('.custom-history-swatch').forEach(s => s.classList.remove('active'));
    });
  }

  // Render custom color history
  renderCustomPaletteHistory();
}

export function renderPostsSettings() {
  $('field-posts-prompt').value = state.postsSettings.posts_prompt || '';
  $('field-showcase-prompt').value = state.postsSettings.showcase_prompt || '';

  // Update language toggle
  const lang = state.postsSettings.posts_language || 'en';
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  renderPalettePicker();
}

export async function saveCurrentSettings() {
  const postsPrompt = $('field-posts-prompt').value;
  const showcasePrompt = $('field-showcase-prompt').value;
  const langBtn = document.querySelector('.lang-btn.active');
  const lang = langBtn ? langBtn.dataset.lang : 'en';
  const colorPalette = state.postsSettings.color_palette || 'default';

  // Update custom color queue if saving a custom palette
  let customColors = getCustomColors();
  if (colorPalette.startsWith('custom:')) {
    const hex = colorPalette.slice(7);
    // Remove if already in queue, then add to front
    customColors = customColors.filter(c => c !== hex);
    customColors.unshift(hex);
    // Cap at 5
    customColors = customColors.slice(0, 5);
  }
  const customColorsStr = JSON.stringify(customColors);

  await savePostsSettings({
    posts_prompt: postsPrompt,
    showcase_prompt: showcasePrompt,
    posts_language: lang,
    color_palette: colorPalette,
    custom_colors: customColorsStr
  });

  state.postsSettings = {
    posts_prompt: postsPrompt,
    showcase_prompt: showcasePrompt,
    posts_language: lang,
    color_palette: colorPalette,
    custom_colors: customColorsStr
  };

  // Re-render history swatches to reflect new queue
  renderCustomPaletteHistory();

  showToast('Settings saved');
}

export async function regenSummary() {
  const posts = state.posts;
  if (!posts || posts.length === 0) {
    showToast('No posts to regenerate');
    return;
  }
  const btn = $('btn-regen-summary');
  btn.disabled = true;
  const total = posts.length;
  let failed = 0;
  for (let i = 0; i < total; i++) {
    btn.textContent = `Regenerating ${i + 1}/${total}...`;
    try {
      const summary = await summarizePost(posts[i].id);
      posts[i].summary_json = summary;
      // Update currentPost if it matches
      if (state.currentPost && state.currentPost.id === posts[i].id) {
        state.currentPost.summary_json = summary;
      }
    } catch (e) {
      failed++;
    }
  }
  btn.disabled = false;
  btn.textContent = 'Regen Summary';
  if (failed > 0) {
    showToast(`Done. ${failed} post(s) failed to regenerate.`);
  } else {
    showToast('All summaries regenerated');
  }
  // Re-render current post summary if viewing
  if (state.postsSubView === 'list' && state.currentPost) {
    renderSummaryBlock(state.currentPost);
  }
}
