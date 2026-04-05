export const $ = id => document.getElementById(id);

export function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function showToast(msg, duration = 2000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function sanitizeUrl(url) {
  const decoded = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  if (/^(https?:\/\/|\/[^\/])/i.test(decoded)) return url;
  return '';
}

export function mdToHtml(md) {
  if (!md) return '';

  // Extract fenced code blocks BEFORE escaping, to preserve their contents verbatim
  const codeBlocks = [];
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `\x00CODEBLOCK${idx}\x00`;
  });

  let html = escHtml(md);

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images: ![alt](url) — with protocol validation
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const safe = sanitizeUrl(url);
    return safe ? `<img src="${safe}" alt="${alt}" class="post-inline-img" loading="lazy" />` : '';
  });

  // Links: [text](url) — with protocol validation
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const safe = sanitizeUrl(url);
    return safe ? `<a href="${safe}" target="_blank" rel="noopener">${text}</a>` : text;
  });

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

  // Blockquotes: lines starting with > (including bare > lines)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^&gt;\s*$/gm, '<blockquote></blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Unordered lists: sequences of lines starting with - or *
  html = html.replace(/(?:^[-*] .+$\n?)+/gm, match => {
    const lines = match.trim().split('\n');
    return '<ul>' + lines.map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('') + '</ul>\n\n';
  });

  // Ordered lists: sequences of lines starting with N.
  html = html.replace(/(?:^\d+\. .+$\n?)+/gm, match => {
    const lines = match.trim().split('\n');
    return '<ol>' + lines.map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('') + '</ol>\n\n';
  });

  // GFM checkboxes: - [ ] / - [x] inside <li> tags
  html = html.replace(/<li>\[x\] /gi, '<li><input type="checkbox" checked disabled> ');
  html = html.replace(/<li>\[ \] /g, '<li><input type="checkbox" disabled> ');

  // Paragraphs: split by double newlines
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    // Don't wrap if already a block element
    if (/^<(blockquote|h[1-6]|img |div|ul|ol|li|pre|table)/i.test(block) || /^\x00CODEBLOCK\d+\x00$/.test(block)) return block;
    // Convert single newlines to <br>
    block = block.replace(/\n/g, '<br>');
    return `<p>${block}</p>`;
  }).join('\n');

  // Restore fenced code blocks as <pre><code> (contents already need escaping)
  // Done last so placeholders survive all markdown regex transforms above
  html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => {
    const { lang, code } = codeBlocks[Number(idx)];
    const escaped = escHtml(code.replace(/\n$/, ''));
    const cls = lang ? ` class="language-${escHtml(lang)}"` : '';
    return `<pre><code${cls}>${escaped}</code></pre>`;
  });

  return html;
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', opts);
}
