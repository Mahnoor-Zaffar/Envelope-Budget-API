/**
 * Envelope Budget — Frontend Application
 *
 * Linear.app-inspired dark UI. Handles API orchestration for /envelopes
 * and /transactions, view navigation, modals, chart, and toasts.
 */

'use strict';

const API_BASE = '/envelopes';
const TRANSACTIONS_BASE = '/transactions';

const CHART_COLORS = [
  '#5e6ad2', '#7a7fad', '#828fff', '#62666d',
  '#8a8f98', '#5e69d1', '#34343a', '#3e3e44',
];

const VIEW_TITLES = {
  overview: 'Overview',
  envelopes: 'Envelopes',
  transactions: 'Activity',
  actions: 'New & Transfer',
};

const ICONS = {
  edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>',
  delete: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>',
  spend: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10"/></svg>',
};

const $ = (sel) => document.querySelector(sel);

const DOM = {
  statTotalBudget:      $('#stat-total-budget'),
  statEnvelopeCount:    $('#stat-envelope-count'),
  statTotalBalance:     $('#stat-total-balance'),
  sidebarTotalBudget:   $('#sidebar-total-budget'),
  sidebarTotalBalance:  $('#sidebar-total-balance'),
  topbarHeading:        $('#topbar-heading'),
  sidebar:              $('#sidebar'),
  sidebarToggle:        $('#sidebar-toggle'),
  navItems:             document.querySelectorAll('.nav-item'),
  views:                document.querySelectorAll('.view'),
  gotoCreateBtn:        $('#goto-create-btn'),
  createForm:           $('#create-form'),
  createTitle:          $('#create-title'),
  createBudget:         $('#create-budget'),
  transferForm:         $('#transfer-form'),
  transferFrom:         $('#transfer-from'),
  transferTo:           $('#transfer-to'),
  transferAmount:       $('#transfer-amount'),
  envelopesGrid:        $('#envelopes-grid'),
  envelopesTable:       $('#envelopes-table'),
  envelopesCountLabel:  $('#envelopes-count-label'),
  emptyState:           $('#empty-state'),
  transactionsBody:     $('#transactions-body'),
  transactionsCountLabel: $('#transactions-count-label'),
  recentTransactionsBody: $('#recent-transactions-body'),
  editModal:            $('#edit-modal'),
  editForm:             $('#edit-form'),
  editId:               $('#edit-id'),
  editTitle:            $('#edit-title'),
  editBudget:           $('#edit-budget'),
  modalClose:           $('#modal-close'),
  modalCancel:          $('#modal-cancel'),
  spendModal:           $('#spend-modal'),
  spendForm:            $('#spend-form'),
  spendId:              $('#spend-id'),
  spendInfo:            $('#spend-info'),
  spendAmount:          $('#spend-amount'),
  spendNote:            $('#spend-note'),
  spendModalClose:      $('#spend-modal-close'),
  spendCancel:          $('#spend-cancel'),
  confirmModal:         $('#confirm-modal'),
  confirmModalMsg:      $('#confirm-modal-msg'),
  confirmModalClose:    $('#confirm-modal-close'),
  confirmCancel:        $('#confirm-cancel'),
  confirmOk:            $('#confirm-ok'),
  chartCanvas:          $('#budget-chart'),
  chartLegend:          $('#chart-legend'),
  chartEmpty:           $('#chart-empty'),
  toastContainer:       $('#toast-container'),
};

let envelopes = [];
let totalBudget = 0;
let allTransactions = [];
/** @type {Record<number, Object[]>} */
let transactionsByEnvelope = {};
let confirmResolve = null;
let activeView = 'overview';

// ─── API Layer ───────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) return null;

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  return json.data;
}

const api = {
  getAll: () => apiFetch(API_BASE),

  create: (title, budget) =>
    apiFetch(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ title, budget }),
    }),

  update: (id, updates) =>
    apiFetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  delete: (id) =>
    apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' }),

  transfer: (fromId, toId, amount) =>
    apiFetch(`${API_BASE}/transfer/${fromId}/${toId}`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  spend: (envelopeId, amount, recipient) =>
    apiFetch(TRANSACTIONS_BASE, {
      method: 'POST',
      body: JSON.stringify({
        date: new Date().toISOString(),
        amount,
        recipient: recipient || 'Expense',
        envelopeId,
      }),
    }),

  getAllTransactions: () => apiFetch(TRANSACTIONS_BASE),

  getHistory: async (envelopeId) => {
    const cached = transactionsByEnvelope[envelopeId];
    if (cached) return cached;
    const all = await api.getAllTransactions();
    return all.filter((t) => t.envelopeId === envelopeId);
  },
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDateShort(iso) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function getEnvelopeTitle(envelopeId) {
  const env = envelopes.find((e) => e.id === envelopeId);
  return env ? env.title : 'Unknown';
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function switchView(viewId) {
  activeView = viewId;

  DOM.navItems.forEach((item) => {
    item.classList.toggle('nav-item--active', item.dataset.view === viewId);
  });

  DOM.views.forEach((view) => {
    view.classList.toggle('view--active', view.dataset.view === viewId);
  });

  DOM.topbarHeading.textContent = VIEW_TITLES[viewId] || 'Overview';
  DOM.sidebar.classList.remove('sidebar--open');
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

function showConfirm(message) {
  DOM.confirmModalMsg.textContent = message;
  DOM.confirmModal.classList.add('modal-overlay--visible');
  DOM.confirmModal.setAttribute('aria-hidden', 'false');
  DOM.confirmOk.focus();

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function closeConfirmModal(result) {
  DOM.confirmModal.classList.remove('modal-overlay--visible');
  DOM.confirmModal.setAttribute('aria-hidden', 'true');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

function trapFocus(container, e) {
  if (e.key !== 'Tab') return;

  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ─── Health & Rendering ──────────────────────────────────────────────────────

function getHealth(balance, budget) {
  if (budget === 0) return 'healthy';
  const ratio = balance / budget;
  if (ratio > 0.5) return 'healthy';
  if (ratio > 0.2) return 'warning';
  return 'danger';
}

function renderEnvelopeRow(env) {
  const pct = env.budget > 0
    ? Math.min((env.balance / env.budget) * 100, 100)
    : 100;
  const health = getHealth(env.balance, env.budget);

  return `
    <tr class="envelope-row" data-id="${env.id}">
      <td>
        <div class="data-table__category">${escapeHtml(env.title)}</div>
        <div class="data-table__meta">Updated ${formatDate(env.updatedAt)}</div>
      </td>
      <td>
        <span class="data-table__mono data-table__mono--${health}">${formatCurrency(env.balance)}</span>
      </td>
      <td>
        <span class="data-table__mono">${formatCurrency(env.budget)}</span>
      </td>
      <td>
        <div class="progress">
          <div class="progress__track">
            <div class="progress__fill progress__fill--${health}" style="width:${pct}%"></div>
          </div>
          <span class="progress__pct">${pct.toFixed(0)}%</span>
        </div>
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn icon-btn--primary" data-action="spend" data-id="${env.id}" title="Record spending" aria-label="Spend from ${escapeHtml(env.title)}">${ICONS.spend}</button>
          <button class="icon-btn" data-action="edit" data-id="${env.id}" title="Edit" aria-label="Edit ${escapeHtml(env.title)}">${ICONS.edit}</button>
          <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${env.id}" title="Delete" aria-label="Delete ${escapeHtml(env.title)}">${ICONS.delete}</button>
        </div>
      </td>
    </tr>
  `;
}

function renderTransactionRow(tx, showBadge = true) {
  const category = getEnvelopeTitle(tx.envelopeId);
  return `
    <tr>
      <td>
        <div class="data-table__category">${escapeHtml(tx.recipient || 'Expense')}</div>
      </td>
      <td>
        ${showBadge ? `<span class="badge badge--category">${escapeHtml(category)}</span>` : escapeHtml(category)}
      </td>
      <td>
        <span class="data-table__meta">${formatDateShort(tx.date)}</span>
      </td>
      <td>
        <span class="data-table__mono data-table__mono--danger">-${formatCurrency(tx.amount)}</span>
      </td>
    </tr>
  `;
}

function renderEnvelopes() {
  const hasEnvelopes = envelopes.length > 0;

  DOM.envelopesCountLabel.textContent = `${envelopes.length} categor${envelopes.length === 1 ? 'y' : 'ies'}`;
  DOM.envelopesTable.style.display = hasEnvelopes ? '' : 'none';
  DOM.emptyState.classList.toggle('empty-state--visible', !hasEnvelopes);

  if (hasEnvelopes) {
    DOM.envelopesGrid.innerHTML = envelopes.map(renderEnvelopeRow).join('');
  } else {
    DOM.envelopesGrid.innerHTML = '';
  }
}

function renderTransactions() {
  const sorted = allTransactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  DOM.transactionsCountLabel.textContent = `${sorted.length} entr${sorted.length === 1 ? 'y' : 'ies'}`;

  if (sorted.length === 0) {
    DOM.transactionsBody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;color:var(--color-ink-tertiary);padding:24px;">No transactions yet</td></tr>';
  } else {
    DOM.transactionsBody.innerHTML = sorted.map((tx) => renderTransactionRow(tx)).join('');
  }

  const recent = sorted.slice(0, 5);
  if (recent.length === 0) {
    DOM.recentTransactionsBody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;color:var(--color-ink-tertiary);padding:24px;">No transactions yet</td></tr>';
  } else {
    DOM.recentTransactionsBody.innerHTML = recent.map((tx) => renderTransactionRow(tx)).join('');
  }
}

function animateStat(el, newValue, className = 'stat-card__value') {
  if (el.textContent !== newValue) {
    el.textContent = newValue;
    el.classList.remove(`${className}--animating`);
    void el.offsetWidth;
    el.classList.add(`${className}--animating`);
    el.addEventListener('animationend', () => {
      el.classList.remove(`${className}--animating`);
    }, { once: true });
  }
}

function renderStats() {
  const totalBalance = envelopes.reduce((sum, e) => sum + e.balance, 0);
  const budgetStr = formatCurrency(totalBudget);
  const balanceStr = formatCurrency(totalBalance);
  const countStr = String(envelopes.length);

  animateStat(DOM.statTotalBudget, budgetStr);
  animateStat(DOM.statEnvelopeCount, countStr);
  animateStat(DOM.statTotalBalance, balanceStr);
  animateStat(DOM.sidebarTotalBudget, budgetStr);
  animateStat(DOM.sidebarTotalBalance, balanceStr);

  const ratio = totalBudget > 0 ? totalBalance / totalBudget : 1;
  const healthClass = ratio > 0.5 ? 'positive' : ratio > 0.2 ? 'warning' : 'danger';

  DOM.statTotalBalance.className = `stat-card__value stat-card__value--${healthClass}`;
  DOM.sidebarTotalBalance.className = `sidebar-stat__value sidebar-stat__value--${healthClass}`;
}

function renderTransferOptions() {
  const buildOptions = () => {
    let html = '<option value="">Select envelope…</option>';
    for (const env of envelopes) {
      html += `<option value="${env.id}">${escapeHtml(env.title)} (${formatCurrency(env.balance)})</option>`;
    }
    return html;
  };

  DOM.transferFrom.innerHTML = buildOptions();
  DOM.transferTo.innerHTML = buildOptions();
}

function refreshUI() {
  renderEnvelopes();
  renderStats();
  renderTransferOptions();
  renderTransactions();
  renderChart();
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function renderChart() {
  const canvas = DOM.chartCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 180;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  DOM.chartLegend.querySelectorAll('.legend-item').forEach((item) => item.remove());

  if (envelopes.length === 0) {
    DOM.chartEmpty.style.display = 'block';
    drawEmptyDoughnut(ctx, size);
    return;
  }

  DOM.chartEmpty.style.display = 'none';

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.62;
  const totalBalance = envelopes.reduce((s, e) => s + e.balance, 0);

  if (totalBalance === 0) {
    drawEmptyDoughnut(ctx, size);
    renderLegendItems(envelopes, totalBalance);
    return;
  }

  let startAngle = -Math.PI / 2;

  envelopes.forEach((env, i) => {
    const sliceAngle = (env.balance / totalBalance) * Math.PI * 2;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += sliceAngle;
  });

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#f7f8f8';
  ctx.font = '500 15px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrency(totalBalance), cx, cy - 6);

  ctx.font = '500 10px Inter, sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-ink-subtle').trim() || '#8a8f98';
  ctx.fillText('TOTAL', cx, cy + 10);

  renderLegendItems(envelopes, totalBalance);
}

function drawEmptyDoughnut(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.62;

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
  ctx.closePath();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-hairline').trim() || '#23252a';
  ctx.fill();
}

function renderLegendItems(envs, totalBalance) {
  DOM.chartLegend.querySelectorAll('.legend-item').forEach((item) => item.remove());

  envs.forEach((env, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const pct = totalBalance > 0 ? ((env.balance / totalBalance) * 100).toFixed(1) : '0.0';
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span class="legend-label">${escapeHtml(env.title)}</span>
      <span class="legend-value">${formatCurrency(env.balance)} · ${pct}%</span>
    `;
    DOM.chartLegend.appendChild(item);
  });
}

// ─── Data Loading ────────────────────────────────────────────────────────────

async function loadTransactions() {
  try {
    allTransactions = await api.getAllTransactions();
    transactionsByEnvelope = {};
    for (const tx of allTransactions) {
      if (!transactionsByEnvelope[tx.envelopeId]) {
        transactionsByEnvelope[tx.envelopeId] = [];
      }
      transactionsByEnvelope[tx.envelopeId].push(tx);
    }
  } catch (err) {
    allTransactions = [];
    transactionsByEnvelope = {};
    showToast(err.message, 'error');
  }
}

async function loadEnvelopes() {
  try {
    const data = await api.getAll();
    envelopes = data.envelopes;
    totalBudget = data.totalBudget;
    await loadTransactions();
    refreshUI();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleCreate(e) {
  e.preventDefault();

  const title = DOM.createTitle.value.trim();
  const budget = parseFloat(DOM.createBudget.value);

  if (!title) {
    showToast('Please enter a category name.', 'error');
    return;
  }

  if (isNaN(budget) || budget < 0) {
    showToast('Budget must be a non-negative number.', 'error');
    return;
  }

  try {
    await api.create(title, budget);
    showToast(`"${title}" envelope created`, 'success');
    DOM.createForm.reset();
    await loadEnvelopes();
    switchView('envelopes');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleTransfer(e) {
  e.preventDefault();

  const fromId = parseInt(DOM.transferFrom.value, 10);
  const toId = parseInt(DOM.transferTo.value, 10);
  const amount = parseFloat(DOM.transferAmount.value);

  if (!fromId || !toId) {
    showToast('Please select both source and destination envelopes.', 'error');
    return;
  }

  if (fromId === toId) {
    showToast('Source and destination must be different.', 'error');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showToast('Transfer amount must be a positive number.', 'error');
    return;
  }

  try {
    await api.transfer(fromId, toId, amount);
    showToast(`Transferred ${formatCurrency(amount)}`, 'success');
    DOM.transferForm.reset();
    await loadEnvelopes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleGridClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = parseInt(btn.dataset.id, 10);
  const envelope = envelopes.find((env) => env.id === id);
  if (!envelope) return;

  switch (action) {
    case 'edit':
      openEditModal(envelope);
      break;
    case 'delete':
      await handleDelete(id, envelope.title, btn.closest('.envelope-row'));
      break;
    case 'spend':
      openSpendModal(envelope);
      break;
  }
}

async function handleDelete(id, title, rowEl) {
  const confirmed = await showConfirm(`Delete "${title}"? All spending history will be lost.`);
  if (!confirmed) return;

  try {
    if (rowEl) {
      rowEl.classList.add('envelope-row--removing');
      await new Promise((r) => setTimeout(r, 180));
    }

    await api.delete(id);
    showToast(`"${title}" deleted`, 'info');
    await loadEnvelopes();
  } catch (err) {
    if (rowEl) rowEl.classList.remove('envelope-row--removing');
    showToast(err.message, 'error');
  }
}

function openEditModal(envelope) {
  DOM.editId.value = envelope.id;
  DOM.editTitle.value = envelope.title;
  DOM.editBudget.value = envelope.budget;
  DOM.editModal.classList.add('modal-overlay--visible');
  DOM.editModal.setAttribute('aria-hidden', 'false');
  DOM.editTitle.focus();
}

function closeEditModal() {
  DOM.editModal.classList.remove('modal-overlay--visible');
  DOM.editModal.setAttribute('aria-hidden', 'true');
  DOM.editForm.reset();
}

async function handleEditSubmit(e) {
  e.preventDefault();

  const id = parseInt(DOM.editId.value, 10);
  const title = DOM.editTitle.value.trim();
  const budget = parseFloat(DOM.editBudget.value);

  if (!title) {
    showToast('Title is required.', 'error');
    return;
  }

  if (isNaN(budget) || budget < 0) {
    showToast('Budget must be a non-negative number.', 'error');
    return;
  }

  try {
    await api.update(id, { title, budget });
    showToast('Envelope updated', 'success');
    closeEditModal();
    await loadEnvelopes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openSpendModal(envelope) {
  DOM.spendId.value = envelope.id;
  DOM.spendInfo.innerHTML = `
    <span class="spend-info__title">${escapeHtml(envelope.title)}</span>
    <span class="spend-info__balance">${formatCurrency(envelope.balance)} available</span>
  `;
  DOM.spendAmount.value = '';
  DOM.spendAmount.max = envelope.balance;
  DOM.spendNote.value = '';
  DOM.spendModal.classList.add('modal-overlay--visible');
  DOM.spendModal.setAttribute('aria-hidden', 'false');
  DOM.spendAmount.focus();
}

function closeSpendModal() {
  DOM.spendModal.classList.remove('modal-overlay--visible');
  DOM.spendModal.setAttribute('aria-hidden', 'true');
  DOM.spendForm.reset();
}

async function handleSpendSubmit(e) {
  e.preventDefault();

  const id = parseInt(DOM.spendId.value, 10);
  const amount = parseFloat(DOM.spendAmount.value);
  const recipient = DOM.spendNote.value.trim();
  const envelope = envelopes.find((env) => env.id === id);

  if (!envelope) {
    showToast('Envelope not found.', 'error');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showToast('Spend amount must be a positive number.', 'error');
    return;
  }

  if (amount > parseFloat(envelope.balance)) {
    showToast('Insufficient funds — cannot overdraft.', 'error');
    return;
  }

  try {
    await api.spend(id, amount, recipient);
    showToast(`Spent ${formatCurrency(amount)} from "${envelope.title}"`, 'success');
    closeSpendModal();
    await loadEnvelopes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindEvents() {
  DOM.createForm.addEventListener('submit', handleCreate);
  DOM.transferForm.addEventListener('submit', handleTransfer);
  DOM.editForm.addEventListener('submit', handleEditSubmit);
  DOM.spendForm.addEventListener('submit', handleSpendSubmit);
  DOM.envelopesGrid.addEventListener('click', handleGridClick);

  DOM.modalClose.addEventListener('click', closeEditModal);
  DOM.modalCancel.addEventListener('click', closeEditModal);
  DOM.editModal.addEventListener('click', (e) => {
    if (e.target === DOM.editModal) closeEditModal();
  });

  DOM.spendModalClose.addEventListener('click', closeSpendModal);
  DOM.spendCancel.addEventListener('click', closeSpendModal);
  DOM.spendModal.addEventListener('click', (e) => {
    if (e.target === DOM.spendModal) closeSpendModal();
  });

  DOM.confirmOk.addEventListener('click', () => closeConfirmModal(true));
  DOM.confirmCancel.addEventListener('click', () => closeConfirmModal(false));
  DOM.confirmModalClose.addEventListener('click', () => closeConfirmModal(false));
  DOM.confirmModal.addEventListener('click', (e) => {
    if (e.target === DOM.confirmModal) closeConfirmModal(false);
  });

  DOM.navItems.forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  DOM.gotoCreateBtn.addEventListener('click', () => switchView('actions'));

  DOM.sidebarToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('sidebar--open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.confirmModal.classList.contains('modal-overlay--visible')) {
        closeConfirmModal(false);
      } else if (DOM.editModal.classList.contains('modal-overlay--visible')) {
        closeEditModal();
      } else if (DOM.spendModal.classList.contains('modal-overlay--visible')) {
        closeSpendModal();
      } else {
        DOM.sidebar.classList.remove('sidebar--open');
      }
    }

    if (e.key === 'Tab') {
      if (DOM.confirmModal.classList.contains('modal-overlay--visible')) {
        trapFocus(DOM.confirmModal, e);
      } else if (DOM.editModal.classList.contains('modal-overlay--visible')) {
        trapFocus(DOM.editModal, e);
      } else if (DOM.spendModal.classList.contains('modal-overlay--visible')) {
        trapFocus(DOM.spendModal, e);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadEnvelopes();
});
