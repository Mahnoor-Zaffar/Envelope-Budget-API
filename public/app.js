/**
 * Envelope Budget — Frontend Application
 *
 * Handles all client-side logic: fetching envelopes from the REST API,
 * rendering HIG-styled cards, managing modals (edit, spend, confirm),
 * processing forms, displaying toast notifications, drawing the
 * doughnut chart, toggling themes, and showing spending history.
 *
 * Zero external dependencies — pure vanilla JavaScript.
 */

'use strict';

// ─── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = '/envelopes';
const TRANSACTIONS_BASE = '/transactions';

const CHART_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#AF52DE',
  '#FF2D55', '#5AC8FA', '#FFCC00', '#5856D6',
];

// ─── DOM References ────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Header stats
  statTotalBudget:   $('#stat-total-budget'),
  statEnvelopeCount: $('#stat-envelope-count'),
  statTotalBalance:  $('#stat-total-balance'),

  // Theme toggle
  themeToggle: $('#theme-toggle'),

  // Create form
  createForm:   $('#create-form'),
  createTitle:  $('#create-title'),
  createBudget: $('#create-budget'),

  // Transfer form
  transferForm:   $('#transfer-form'),
  transferFrom:   $('#transfer-from'),
  transferTo:     $('#transfer-to'),
  transferAmount: $('#transfer-amount'),

  // Envelope grid
  envelopesGrid: $('#envelopes-grid'),
  emptyState:    $('#empty-state'),

  // Edit modal
  editModal:  $('#edit-modal'),
  editForm:   $('#edit-form'),
  editId:     $('#edit-id'),
  editTitle:  $('#edit-title'),
  editBudget: $('#edit-budget'),
  modalClose: $('#modal-close'),
  modalCancel: $('#modal-cancel'),

  // Spend modal
  spendModal:      $('#spend-modal'),
  spendForm:       $('#spend-form'),
  spendId:         $('#spend-id'),
  spendInfo:       $('#spend-info'),
  spendAmount:     $('#spend-amount'),
  spendNote:       $('#spend-note'),
  spendModalClose: $('#spend-modal-close'),
  spendCancel:     $('#spend-cancel'),

  // Confirm modal
  confirmModal:      $('#confirm-modal'),
  confirmModalMsg:   $('#confirm-modal-msg'),
  confirmModalClose: $('#confirm-modal-close'),
  confirmCancel:     $('#confirm-cancel'),
  confirmOk:         $('#confirm-ok'),

  // Chart
  chartCanvas: $('#budget-chart'),
  chartLegend: $('#chart-legend'),
  chartEmpty:  $('#chart-empty'),

  // Toast
  toastContainer: $('#toast-container'),
};

// ─── State ─────────────────────────────────────────────────────────────────────

let envelopes = [];
let totalBudget = 0;
/** @type {Record<number, Object[]>} Transactions grouped by envelopeId */
let transactionsByEnvelope = {};
let confirmResolve = null; // For the custom confirm modal promise

// ─── API Layer ─────────────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper that returns parsed JSON.
 * Throws with the server's error message on non-ok responses.
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // 204 No Content
  if (res.status === 204) return null;

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  return json.data;
}

const api = {
  /** Fetch all envelopes and the global total budget. */
  getAll: () => apiFetch(API_BASE),

  /** Create a new envelope. */
  create: (title, budget) =>
    apiFetch(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ title, budget }),
    }),

  /** Update an envelope by ID. */
  update: (id, updates) =>
    apiFetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  /** Delete an envelope by ID. */
  delete: (id) =>
    apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' }),

  /** Transfer funds between two envelopes. */
  transfer: (fromId, toId, amount) =>
    apiFetch(`${API_BASE}/transfer/${fromId}/${toId}`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  /** Record a transaction against an envelope (deducts balance). */
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

  /** Fetch all transactions from the API. */
  getAllTransactions: () => apiFetch(TRANSACTIONS_BASE),

  /** Get spending history for an envelope. */
  getHistory: async (envelopeId) => {
    const cached = transactionsByEnvelope[envelopeId];
    if (cached) return cached;

    const all = await api.getAllTransactions();
    return all.filter((t) => t.envelopeId === envelopeId);
  },
};

// ─── Formatters ────────────────────────────────────────────────────────────────

/**
 * Format a number as a USD currency string.
 * @param {number} n
 * @returns {string}
 */
function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Format an ISO-8601 date string for display.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// ─── Toast Notifications ───────────────────────────────────────────────────────

/**
 * Show a temporary toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration – ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = `toastOut 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ─── Theme Toggle ──────────────────────────────────────────────────────────────

const THEME_KEY = 'envelope-budget-theme';
const THEME_ICONS = { auto: '🌗', light: '☀️', dark: '🌙' };
const THEME_CYCLE = ['auto', 'light', 'dark'];

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  DOM.themeToggle.textContent = THEME_ICONS[theme] || '🌗';
  DOM.themeToggle.title = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
  localStorage.setItem(THEME_KEY, theme);
}

function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'auto';
  const nextIdx = (THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length;
  applyTheme(THEME_CYCLE[nextIdx]);
}

// ─── Custom Confirm Modal ──────────────────────────────────────────────────────

/**
 * Show a custom confirmation dialog. Returns a Promise<boolean>.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
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

// ─── Focus Trap ────────────────────────────────────────────────────────────────

/**
 * Trap Tab focus within a container element.
 * @param {HTMLElement} container
 * @param {KeyboardEvent} e
 */
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
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Determine the health status of an envelope based on spending ratio.
 * @param {number} balance
 * @param {number} budget
 * @returns {'healthy'|'warning'|'danger'}
 */
function getHealth(balance, budget) {
  if (budget === 0) return 'healthy';
  const ratio = balance / budget;
  if (ratio > 0.5) return 'healthy';
  if (ratio > 0.2) return 'warning';
  return 'danger';
}

/**
 * Build the HTML for a single envelope card.
 * @param {Object} env
 * @returns {string}
 */
function renderEnvelopeCard(env) {
  const pct = env.budget > 0
    ? Math.min((env.balance / env.budget) * 100, 100)
    : 100;
  const health = getHealth(env.balance, env.budget);
  const historyCount = (transactionsByEnvelope[env.id] || []).length;

  return `
    <article class="envelope-card" data-id="${env.id}">
      <div class="envelope-card__header">
        <h3 class="envelope-card__title">${escapeHtml(env.title)}</h3>
        <div class="envelope-card__actions">
          <button class="icon-btn" data-action="edit" data-id="${env.id}" title="Edit" aria-label="Edit ${escapeHtml(env.title)}">✏️</button>
          <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${env.id}" title="Delete" aria-label="Delete ${escapeHtml(env.title)}">🗑️</button>
        </div>
      </div>

      <div class="envelope-card__meter">
        <div class="meter__bar">
          <div class="meter__fill meter__fill--${health}" style="width: ${pct}%"></div>
        </div>
        <div class="meter__labels">
          <span class="meter__balance meter__balance--${health}">${formatCurrency(env.balance)}</span>
          <span class="meter__budget">of ${formatCurrency(env.budget)}</span>
        </div>
      </div>

      <div class="envelope-card__btn-row">
        <button class="envelope-card__spend-btn" data-action="spend" data-id="${env.id}">
          💸 Spend
        </button>
        <button class="envelope-card__history-btn" data-action="history" data-id="${env.id}">
          📋 History${historyCount > 0 ? ` (${historyCount})` : ''}
        </button>
      </div>

      <div class="history-panel" id="history-panel-${env.id}">
        <div class="history-panel__inner" id="history-inner-${env.id}">
          <!-- Filled by toggleHistory -->
        </div>
      </div>

      <span class="envelope-card__meta">Updated ${formatDate(env.updatedAt)}</span>
    </article>
  `;
}

/**
 * Minimal HTML entity escaping for XSS prevention.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Re-render the entire envelopes grid from the current state.
 */
function renderEnvelopes() {
  if (envelopes.length === 0) {
    DOM.envelopesGrid.innerHTML = '';
    DOM.emptyState.classList.add('empty-state--visible');
  } else {
    DOM.emptyState.classList.remove('empty-state--visible');
    DOM.envelopesGrid.innerHTML = envelopes.map(renderEnvelopeCard).join('');
  }
}

/**
 * Update the translucent header stats with animation.
 */
function renderStats() {
  animateStat(DOM.statTotalBudget, formatCurrency(totalBudget));
  animateStat(DOM.statEnvelopeCount, String(envelopes.length));

  const totalBalance = envelopes.reduce((sum, e) => sum + e.balance, 0);
  animateStat(DOM.statTotalBalance, formatCurrency(totalBalance));

  // Colour-code total balance
  const ratio = totalBudget > 0 ? totalBalance / totalBudget : 1;
  DOM.statTotalBalance.className = 'stat__value';
  if (ratio > 0.5) DOM.statTotalBalance.classList.add('stat__value--positive');
  else if (ratio > 0.2) DOM.statTotalBalance.classList.add('stat__value--warning');
  else DOM.statTotalBalance.classList.add('stat__value--danger');
}

/**
 * Animate a stat value change with a pulse effect.
 */
function animateStat(el, newValue) {
  if (el.textContent !== newValue) {
    el.textContent = newValue;
    el.classList.remove('stat__value--animating');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('stat__value--animating');
    el.addEventListener('animationend', () => {
      el.classList.remove('stat__value--animating');
    }, { once: true });
  }
}

/**
 * Populate the transfer form's <select> dropdowns.
 */
function renderTransferOptions() {
  const buildOptions = (selectedId) => {
    let html = '<option value="">Select envelope…</option>';
    for (const env of envelopes) {
      const selected = env.id === selectedId ? ' selected' : '';
      html += `<option value="${env.id}"${selected}>${escapeHtml(env.title)} (${formatCurrency(env.balance)})</option>`;
    }
    return html;
  };

  DOM.transferFrom.innerHTML = buildOptions(null);
  DOM.transferTo.innerHTML = buildOptions(null);
}

/**
 * Full UI refresh — called after every state-changing operation.
 */
function refreshUI() {
  renderEnvelopes();
  renderStats();
  renderTransferOptions();
  renderChart();
}

// ─── Doughnut Chart ────────────────────────────────────────────────────────────

/**
 * Render an animated doughnut chart on the canvas.
 */
function renderChart() {
  const canvas = DOM.chartCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 200;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, size, size);

  const legendItems = DOM.chartLegend.querySelectorAll('.legend-item');
  legendItems.forEach((item) => item.remove());

  if (envelopes.length === 0) {
    DOM.chartEmpty.style.display = 'block';
    drawEmptyDoughnut(ctx, size);
    return;
  }

  DOM.chartEmpty.style.display = 'none';

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.62;
  const totalBalance = envelopes.reduce((s, e) => s + e.balance, 0);

  if (totalBalance === 0) {
    drawEmptyDoughnut(ctx, size);
    renderLegendItems(envelopes, totalBalance);
    return;
  }

  let startAngle = -Math.PI / 2; // Start from top

  envelopes.forEach((env, i) => {
    const sliceAngle = (env.balance / totalBalance) * Math.PI * 2;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(
      cx + innerR * Math.cos(startAngle),
      cy + innerR * Math.sin(startAngle)
    );
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Centre label
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#000';
  ctx.font = `bold 18px Inter, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrency(totalBalance), cx, cy - 8);
  ctx.font = `500 11px Inter, -apple-system, sans-serif`;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() || '#666';
  ctx.fillText('TOTAL BALANCE', cx, cy + 10);

  renderLegendItems(envelopes, totalBalance);
}

function drawEmptyDoughnut(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.62;

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
  ctx.closePath();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-separator').trim() || 'rgba(60,60,67,0.12)';
  ctx.fill();
}

function renderLegendItems(envs, totalBalance) {
  const titleEl = DOM.chartLegend.querySelector('.chart-card__legend-title');
  const emptyEl = DOM.chartEmpty;

  // Remove old legends
  const oldItems = DOM.chartLegend.querySelectorAll('.legend-item');
  oldItems.forEach((item) => item.remove());

  envs.forEach((env, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const pct = totalBalance > 0 ? ((env.balance / totalBalance) * 100).toFixed(1) : '0.0';
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span class="legend-label">${escapeHtml(env.title)}</span>
      <span class="legend-value">${formatCurrency(env.balance)} (${pct}%)</span>
    `;
    DOM.chartLegend.appendChild(item);
  });
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch all transactions and group them by envelopeId for history counts.
 */
async function loadTransactions() {
  try {
    const all = await api.getAllTransactions();
    transactionsByEnvelope = {};
    for (const transaction of all) {
      if (!transactionsByEnvelope[transaction.envelopeId]) {
        transactionsByEnvelope[transaction.envelopeId] = [];
      }
      transactionsByEnvelope[transaction.envelopeId].push(transaction);
    }
  } catch (err) {
    transactionsByEnvelope = {};
    showToast(err.message, 'error');
  }
}

/**
 * Fetch all envelopes from the API and refresh the UI.
 */
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

// ─── Event Handlers ────────────────────────────────────────────────────────────

/**
 * Handle creating a new envelope.
 */
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
    showToast(`"${title}" envelope created!`, 'success');
    DOM.createForm.reset();
    await loadEnvelopes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Handle transferring funds between envelopes.
 */
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
    showToast(`Transferred ${formatCurrency(amount)} successfully!`, 'success');
    DOM.transferForm.reset();
    await loadEnvelopes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Handle clicks within the envelopes grid (edit, delete, spend, history).
 */
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
      await handleDelete(id, envelope.title, btn.closest('.envelope-card'));
      break;

    case 'spend':
      openSpendModal(envelope);
      break;

    case 'history':
      await toggleHistory(id);
      break;
  }
}

/**
 * Delete an envelope with animation — uses custom confirm modal.
 */
async function handleDelete(id, title, cardEl) {
  const confirmed = await showConfirm(`Delete "${title}"? All spending history will be lost.`);
  if (!confirmed) return;

  try {
    // Play exit animation
    if (cardEl) {
      cardEl.classList.add('envelope-card--removing');
      await new Promise((r) => setTimeout(r, 280));
    }

    await api.delete(id);
    showToast(`"${title}" deleted.`, 'info');
    await loadEnvelopes();
  } catch (err) {
    if (cardEl) cardEl.classList.remove('envelope-card--removing');
    showToast(err.message, 'error');
  }
}

// ─── Spending History ──────────────────────────────────────────────────────────

/**
 * Toggle the spending history panel for an envelope.
 */
async function toggleHistory(id) {
  const panel = $(`#history-panel-${id}`);
  if (!panel) return;

  if (panel.classList.contains('history-panel--open')) {
    panel.classList.remove('history-panel--open');
    return;
  }

  // Fetch history
  try {
    const history = await api.getHistory(id);
    const inner = $(`#history-inner-${id}`);

    if (!history || history.length === 0) {
      inner.innerHTML = '<p class="history-panel__empty">No spending recorded yet.</p>';
    } else {
      inner.innerHTML = history
        .slice()
        .reverse()
        .map((event) => `
          <div class="history-item">
            <div class="history-item__info">
              <span class="history-item__note">${escapeHtml(event.recipient || 'Expense')}</span>
              <span class="history-item__time">${formatDate(event.date)}</span>
            </div>
            <span class="history-item__amount">-${formatCurrency(event.amount)}</span>
          </div>
        `)
        .join('');
    }

    panel.classList.add('history-panel--open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

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
    showToast('Envelope updated!', 'success');
    closeEditModal();
    await loadEnvelopes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Spend Modal ───────────────────────────────────────────────────────────────

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
    showToast('Insufficient funds! Cannot overdraft.', 'error');
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

// ─── Event Binding ─────────────────────────────────────────────────────────────

function bindEvents() {
  // Forms
  DOM.createForm.addEventListener('submit', handleCreate);
  DOM.transferForm.addEventListener('submit', handleTransfer);
  DOM.editForm.addEventListener('submit', handleEditSubmit);
  DOM.spendForm.addEventListener('submit', handleSpendSubmit);

  // Grid delegation
  DOM.envelopesGrid.addEventListener('click', handleGridClick);

  // Edit modal close
  DOM.modalClose.addEventListener('click', closeEditModal);
  DOM.modalCancel.addEventListener('click', closeEditModal);
  DOM.editModal.addEventListener('click', (e) => {
    if (e.target === DOM.editModal) closeEditModal();
  });

  // Spend modal close
  DOM.spendModalClose.addEventListener('click', closeSpendModal);
  DOM.spendCancel.addEventListener('click', closeSpendModal);
  DOM.spendModal.addEventListener('click', (e) => {
    if (e.target === DOM.spendModal) closeSpendModal();
  });

  // Confirm modal
  DOM.confirmOk.addEventListener('click', () => closeConfirmModal(true));
  DOM.confirmCancel.addEventListener('click', () => closeConfirmModal(false));
  DOM.confirmModalClose.addEventListener('click', () => closeConfirmModal(false));
  DOM.confirmModal.addEventListener('click', (e) => {
    if (e.target === DOM.confirmModal) closeConfirmModal(false);
  });

  // Theme toggle
  DOM.themeToggle.addEventListener('click', cycleTheme);

  // Keyboard: Escape closes modals, Tab is trapped within open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.confirmModal.classList.contains('modal-overlay--visible')) {
        closeConfirmModal(false);
      } else if (DOM.editModal.classList.contains('modal-overlay--visible')) {
        closeEditModal();
      } else if (DOM.spendModal.classList.contains('modal-overlay--visible')) {
        closeSpendModal();
      }
    }

    // Focus trap for open modals
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

// ─── Initialization ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindEvents();
  loadEnvelopes();
});
