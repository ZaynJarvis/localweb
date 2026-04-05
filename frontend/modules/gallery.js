import { state } from './state.js';
import { $, escHtml, showToast } from './utils.js';
import { fetchGallery, activateGalleryImage, fetchShowcase } from './api-client.js';

export async function renderGalleryView() {
  const images = await fetchGallery();
  const grid = $('gallery-grid');
  grid.innerHTML = '';

  if (images.length === 0) {
    grid.innerHTML = '<p style="color: var(--muted); grid-column: 1/-1;">No liked images yet. Like a showcase image to add it to your gallery.</p>';
    return;
  }

  images.forEach(img => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${escHtml(img.url)}" alt="Gallery image" />
      <div class="gallery-item-overlay">
        <span class="gallery-item-date">${img.liked_at || ''}</span>
      </div>
    `;
    item.onclick = async () => {
      await activateGalleryImage(img.id);
      await fetchShowcase();
      showToast('Set as current showcase');
    };
    grid.appendChild(item);
  });
}
