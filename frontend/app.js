import { state, loadSelected } from './modules/state.js';
import { $ } from './modules/utils.js';
import { fetchAPIs, fetchPosts, fetchPostsSettings, fetchShowcase } from './modules/api-client.js';
import {
  renderSidebar, renderPanel, selectAPI, newAPI,
  saveCurrentAPI, runCurrent, deleteCurrent,
  openImportDialog, closeImportDialog, importFromCurl,
  addParamRow, updateParamsBodyVisibility,
} from './modules/api-runner.js';
import {
  renderPostsSidebar, renderPostsView,
  openPostReader, closePostReader,
  openPostsSettings, openGallery,
} from './modules/posts-reader.js';
import { generateSummary } from './modules/summary.js';
import { likeShowcaseImage, regenerateShowcase } from './modules/showcase.js';
import { saveCurrentSettings, regenSummary, applyPalette } from './modules/settings.js';
import { renderLoggerView } from './modules/logger.js';

// --- Navigation / View switching ---
function switchView(view) {
  state.activeView = view;

  // Update tabs
  $('tab-apis').classList.toggle('active', view === 'apis');
  $('tab-posts').classList.toggle('active', view === 'posts');
  $('tab-logger').classList.toggle('active', view === 'logger');

  // Update sidebar content
  $('api-list').classList.toggle('hidden', view !== 'apis');
  $('posts-sidebar-list').classList.toggle('hidden', view !== 'posts');
  $('logger-sidebar-list').classList.toggle('hidden', view !== 'logger');
  $('sidebar-btns-apis').classList.toggle('hidden', view !== 'apis');
  $('sidebar-btns-posts').classList.toggle('hidden', view !== 'posts');

  // Update main content
  $('apis-view').classList.toggle('hidden', view !== 'apis');
  $('posts-view').classList.toggle('hidden', view !== 'posts');
  $('logger-view').classList.toggle('hidden', view !== 'logger');

  // Toggle view-specific classes on main and sidebar
  $('main').classList.toggle('posts-active', view === 'posts');
  $('main').classList.toggle('logger-active', view === 'logger');

  // Reset subview when switching to posts (only if not already in posts)
  if (view === 'posts' && state.activeView !== 'posts') {
    state.postsSubView = 'list';
  }

  // Render logger view on switch
  if (view === 'logger') {
    renderLoggerView();
  }

  // Update hash without triggering hashchange
  if (view === 'posts') {
    if (!location.hash.startsWith('#posts')) {
      history.replaceState(null, '', '#posts');
    }
  } else if (view === 'logger') {
    if (location.hash !== '#logger') {
      history.replaceState(null, '', '#logger');
    }
  } else {
    if (location.hash !== '#apis') {
      history.replaceState(null, '', '#apis');
    }
  }
}

// --- Event listeners ---
$('btn-new').onclick = newAPI;
$('btn-import').onclick = openImportDialog;
$('btn-import-confirm').onclick = importFromCurl;
$('btn-import-cancel').onclick = closeImportDialog;
$('btn-save').onclick = saveCurrentAPI;
$('btn-run').onclick = runCurrent;
$('btn-delete').onclick = deleteCurrent;
$('btn-add-param').onclick = () => addParamRow();

// Posts settings
$('btn-posts-settings').onclick = openPostsSettings;
$('btn-gallery').onclick = openGallery;
$('btn-save-settings').onclick = saveCurrentSettings;
$('btn-generate-summary').onclick = generateSummary;
$('btn-regen-summary').onclick = regenSummary;
$('btn-like-showcase').onclick = likeShowcaseImage;
$('btn-regen-showcase').onclick = regenerateShowcase;

// Language toggle
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

// Nav tabs
$('tab-apis').onclick = () => switchView('apis');
$('tab-posts').onclick = () => switchView('posts');
$('tab-logger').onclick = () => switchView('logger');

$('field-method').addEventListener('change', e => {
  updateParamsBodyVisibility(e.target.value);
  if (e.target.value === 'GET' && state.current) {
    // Re-render param rows from current URL
    const url = $('field-url').value;
    const params = (() => {
      try {
        const u = new URL(url);
        return [...u.searchParams.entries()].map(([k, v]) => ({ k, v }));
      } catch {
        const qi = url.indexOf('?');
        if (qi === -1) return [];
        const qs = url.slice(qi + 1);
        return qs.split('&').filter(Boolean).map(pair => {
          const [k, ...rest] = pair.split('=');
          return { k: decodeURIComponent(k), v: decodeURIComponent(rest.join('=')) };
        });
      }
    })();
    $('params-list').innerHTML = '';
    params.forEach(({ k, v }) => addParamRow(k, v));
    if (!params.length) addParamRow();
  }
});

// Keyboard shortcut: Cmd/Ctrl+Enter to run
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if ($('import-dialog').open) {
      importFromCurl();
    } else {
      runCurrent();
    }
  }
  if (e.key === 'Escape' && $('import-dialog').open) {
    closeImportDialog();
  }
});

// Hash change
window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '') || 'apis';
  if (hash.startsWith('posts')) {
    switchView('posts');
    const postIdMatch = hash.match(/^posts\/(\d+)$/);
    if (postIdMatch) {
      const postId = parseInt(postIdMatch[1]);
      const post = state.posts.find(p => p.id === postId);
      if (post) openPostReader(post);
    }
  } else if (hash === 'logger') {
    switchView('logger');
  } else {
    switchView('apis');
  }
});

// --- Init ---
(async () => {
  await Promise.all([fetchAPIs(), fetchPosts(), fetchPostsSettings(), fetchShowcase()]);
  applyPalette(state.postsSettings.color_palette || 'default');
  renderSidebar();
  renderPostsSidebar();

  // Determine initial view from hash
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('posts')) {
    switchView('posts');
    const postIdMatch = hash.match(/^posts\/(\d+)$/);
    if (postIdMatch) {
      const postId = parseInt(postIdMatch[1]);
      const post = state.posts.find(p => p.id === postId);
      if (post) {
        openPostReader(post);
        return;
      }
    }
    renderPostsView();
  } else if (hash === 'logger') {
    switchView('logger');
  } else {
    switchView('apis');
    const savedId = loadSelected();
    if (savedId) {
      const api = state.apis.find(a => a.id == savedId);
      if (api) { await selectAPI(api); return; }
    }
    renderPanel();
  }
})();
