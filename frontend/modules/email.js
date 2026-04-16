import { $, escHtml, showToast, mdToHtml, formatDate } from './utils.js';

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function feedback(kind, target, note = null) {
  return api('/api/email/feedback', {
    method: 'POST',
    body: JSON.stringify({ kind, target, note }),
  });
}

function statCard(label, value) {
  return `<div class="email-stat"><div class="email-stat-v">${value}</div><div class="email-stat-k">${label}</div></div>`;
}

function usefulItem(it, idx) {
  const action = it.action ? `<div class="email-action">${escHtml(it.action)}</div>` : '';
  const fromAttr = escHtml(it.from || '');
  const when = it.at ? formatDate(it.at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `
    <li class="email-useful" data-idx="${idx}" data-from="${fromAttr}">
      <div class="email-useful-head">
        <span class="email-from">${escHtml(it.from || '?')}</span>
        <span class="email-dot">·</span>
        <span class="email-subj">${escHtml(it.subject || '')}</span>
        <span class="email-when">${escHtml(when)}</span>
      </div>
      <div class="email-oneliner">${escHtml(it.one_liner || '')}</div>
      ${action}
      <div class="email-btns">
        <button class="email-btn email-btn-signal" data-kind="mark_signal">✓ Always signal</button>
        <button class="email-btn email-btn-noise"  data-kind="mark_noise">✗ Actually noise</button>
      </div>
      <div class="email-status"></div>
    </li>`;
}

function senderChip(name, kind) {
  return `<span class="email-chip email-chip-${kind}" data-chip-name="${escHtml(name)}" data-chip-kind="${kind}">
    <span>${escHtml(name)}</span>
    <button data-remove title="remove">×</button>
  </span>`;
}

function renderSenders(container, signalList, noiseList) {
  container.innerHTML = `
    <div class="email-sender-col">
      <h3>Always signal <span class="email-count">${signalList.length}</span></h3>
      <div class="email-chip-row">${signalList.length ? signalList.map(n => senderChip(n, 'signal')).join('') : '<span class="email-empty-inline">none yet</span>'}</div>
    </div>
    <div class="email-sender-col">
      <h3>Always noise <span class="email-count">${noiseList.length}</span></h3>
      <div class="email-chip-row">${noiseList.length ? noiseList.map(n => senderChip(n, 'noise')).join('') : '<span class="email-empty-inline">none yet</span>'}</div>
    </div>
  `;
}

async function handleUsefulBtn(liEl, kind, from, refs) {
  const status = liEl.querySelector('.email-status');
  liEl.classList.add('email-useful-busy');
  status.textContent = kind === 'mark_signal' ? 'saving as signal…' : 'saving as noise…';
  try {
    await feedback(kind, from);
    status.textContent = '';
    liEl.classList.remove('email-useful-busy');
    liEl.classList.add(kind === 'mark_signal' ? 'email-useful-ok' : 'email-useful-dismiss');
    // Fade out + collapse (CSS handles transitions)
    setTimeout(() => {
      liEl.style.height = liEl.offsetHeight + 'px';
      requestAnimationFrame(() => {
        liEl.style.height = '0';
        liEl.style.paddingTop = '0';
        liEl.style.paddingBottom = '0';
        liEl.style.marginBottom = '0';
        liEl.style.opacity = '0';
      });
      setTimeout(() => liEl.remove(), 260);
    }, 220);
    // Refresh learned-sender section in place (no full re-render)
    await refreshSenders(refs);
    showToast(kind === 'mark_signal' ? `Marked "${from}" as signal` : `Marked "${from}" as noise`);
  } catch (e) {
    liEl.classList.remove('email-useful-busy');
    status.textContent = 'Error: ' + e.message;
  }
}

async function refreshSenders(refs) {
  try {
    const ov = await api('/api/email/overview');
    renderSenders(refs.sendersEl, ov.signal_senders || [], ov.noise_senders || []);
    wireSenderRemoval(refs);
  } catch {}
}

function wireSenderRemoval(refs) {
  refs.sendersEl.querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = async () => {
      const chip = b.closest('[data-chip-name]');
      const name = chip.dataset.chipName;
      const kind = chip.dataset.chipKind;
      chip.classList.add('email-chip-busy');
      try {
        await feedback(kind === 'signal' ? 'mark_noise' : 'mark_signal', name);
        await refreshSenders(refs);
      } catch (e) {
        showToast('Error: ' + e.message);
        chip.classList.remove('email-chip-busy');
      }
    };
  });
}

export async function renderEmailView() {
  const root = $('email-view');
  root.innerHTML = `<div class="email-loading">Loading…</div>`;
  let ov, ins;
  try {
    [ov, ins] = await Promise.all([
      api('/api/email/overview'),
      api('/api/email/insights'),
    ]);
  } catch (e) {
    root.innerHTML = `<div class="email-loading">Failed: ${escHtml(String(e))}</div>`;
    return;
  }

  const s = ov.stats || {};
  const totals = s.totals || {};
  const useful = ov.useful_recent || [];
  const signalList = ov.signal_senders || [];
  const noiseList = ov.noise_senders || [];
  const insightsHtml = ins.markdown ? mdToHtml(ins.markdown) : '<i class="email-empty-inline">No runs yet.</i>';
  const lastRun = s.last_run ? formatDate(s.last_run) : 'never';

  root.innerHTML = `
    <div class="email-wrap">
      <div class="email-header">
        <div>
          <h1>Email triage</h1>
          <div class="email-sub">runs: ${s.runs ?? 0} · last: ${escHtml(lastRun)}</div>
        </div>
        <button class="email-runbtn" id="email-run-btn">↻ Run now</button>
      </div>

      <div class="email-stats-row">
        ${statCard('processed', totals.processed ?? 0)}
        ${statCard('useful', totals.useful ?? 0)}
        ${statCard('digest', totals.digest ?? 0)}
        ${statCard('noise', totals.noise ?? 0)}
        ${statCard('marked read', totals.marked_read ?? 0)}
      </div>

      <section class="email-section">
        <div class="email-section-head">
          <h2>Useful (recent)</h2>
          <span class="email-section-sub">${useful.length} item${useful.length === 1 ? '' : 's'}</span>
        </div>
        <ul class="email-useful-list" id="email-useful-list">
          ${useful.length === 0
            ? '<li class="email-empty">Nothing surfaced yet.</li>'
            : useful.slice(0, 50).map((it, i) => usefulItem(it, i)).join('')}
        </ul>
      </section>

      <section class="email-section">
        <div class="email-section-head">
          <h2>Learned senders</h2>
          <span class="email-section-sub">feeds the next run's prompt</span>
        </div>
        <div class="email-senders" id="email-senders"></div>
        <div class="email-add-sender">
          <input id="email-sender-input" placeholder="Add sender (e.g. Mobbin)…" />
          <button id="email-add-signal" class="email-btn email-btn-signal">+ signal</button>
          <button id="email-add-noise" class="email-btn email-btn-noise">+ noise</button>
        </div>
      </section>

      <section class="email-section">
        <div class="email-section-head">
          <h2>Insights (accumulated)</h2>
        </div>
        <div class="email-insights">${insightsHtml}</div>
      </section>
    </div>
  `;

  const refs = {
    sendersEl: $('email-senders'),
    usefulEl:  $('email-useful-list'),
  };
  renderSenders(refs.sendersEl, signalList, noiseList);
  wireSenderRemoval(refs);

  // Per-item signal/noise buttons — patch only that card, no full re-render
  refs.usefulEl.querySelectorAll('.email-useful').forEach(li => {
    const from = li.dataset.from;
    li.querySelectorAll('.email-btns button').forEach(b => {
      b.onclick = () => handleUsefulBtn(li, b.dataset.kind, from, refs);
    });
  });

  const addSender = async (kind) => {
    const input = $('email-sender-input');
    const v = input.value.trim();
    if (!v) return;
    try {
      await feedback(kind, v);
      input.value = '';
      await refreshSenders(refs);
      showToast(`Added "${v}" to ${kind === 'mark_signal' ? 'signal' : 'noise'}`);
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  };
  $('email-add-signal').onclick = () => addSender('mark_signal');
  $('email-add-noise').onclick  = () => addSender('mark_noise');
  $('email-sender-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addSender('mark_signal'); }
  });

  $('email-run-btn').onclick = async () => {
    const btn = $('email-run-btn');
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Running…';
    try {
      const r = await api('/api/email/run', { method: 'POST' });
      showToast(r.ok ? 'Run complete' : `Run failed (${r.exit_code})`);
      await renderEmailView();
    } catch (e) {
      showToast('Run error: ' + e.message);
      btn.disabled = false; btn.textContent = orig;
    }
  };
}
