/**
 * Envelope Budget — Frontend Application
 *
 * Handles all client-side logic: fetching envelopes from the REST API,
 * rendering HIG-styled cards, managing modals, processing forms, and
 * displaying toast notifications.
 *
 * Zero external dependencies — pure vanilla JavaScript.
 */

'use strict';

// ─── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = '/envelopes';

// ─── DOM References ────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Header stats
  statTotalBudget:   $('#stat-total-budget'),
  statEnvelopeCount: $('#stat-envelope-count'),
  statTotalBalance:  $('#stat-total-balance'),

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
  spendModalClose: $('#spend-modal-close'),
  spendCancel:     $('#spend-cancel'),

  // Toast
  toastContainer: $('#toast-container'),
};

// ─── State ─────────────────────────────────────────────────────────────────────

let envelopes = [];
let totalBudget = 0;

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

      <button class="envelope-card__spend-btn" data-action="spend" data-id="${env.id}">
        💸 Record Spending
      </button>

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
 * Update the translucent header stats.
 */
function renderStats() {
  DOM.statTotalBudget.textContent = formatCurrency(totalBudget);
  DOM.statEnvelopeCount.textContent = envelopes.length;

  const totalBalance = envelopes.reduce((sum, e) => sum + e.balance, 0);
  DOM.statTotalBalance.textContent = formatCurrency(totalBalance);

  // Colour-code total balance
  const ratio = totalBudget > 0 ? totalBalance / totalBudget : 1;
  DOM.statTotalBalance.className = 'stat__value';
  if (ratio > 0.5) DOM.statTotalBalance.classList.add('stat__value--positive');
  else if (ratio > 0.2) DOM.statTotalBalance.classList.add('stat__value--warning');
  else DOM.statTotalBalance.classList.add('stat__value--danger');
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
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch all envelopes from the API and refresh the UI.
 */
async function loadEnvelopes() {
  try {
    const data = await api.getAll();
    envelopes = data.envelopes;
    totalBudget = data.totalBudget;
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
 * Handle clicks within the envelopes grid (edit, delete, spend).
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
  }
}

/**
 * Delete an envelope with animation.
 */
async function handleDelete(id, title, cardEl) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

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
  const envelope = envelopes.find((env) => env.id === id);

  if (!envelope) {
    showToast('Envelope not found.', 'error');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showToast('Spend amount must be a positive number.', 'error');
    return;
  }

  const newBalance = Math.round((envelope.balance - amount) * 100) / 100;

  if (newBalance < 0) {
    showToast('Insufficient funds! Cannot overdraft.', 'error');
    return;
  }

  try {
    await api.update(id, { balance: newBalance });
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

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.editModal.classList.contains('modal-overlay--visible')) {
        closeEditModal();
      }
      if (DOM.spendModal.classList.contains('modal-overlay--visible')) {
        closeSpendModal();
      }
    }
  });
}

// ─── Initialization ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadEnvelopes();
});
