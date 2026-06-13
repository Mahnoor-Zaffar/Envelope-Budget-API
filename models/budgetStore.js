/**
 * BudgetStore – In-memory storage singleton for Envelope Budgeting.
 *
 * Provides transactional CRUD operations and atomic envelope-to-envelope
 * transfers.  All monetary values are stored as plain numbers (floats);
 * rounding to two decimal places is applied on every mutation to avoid
 * floating-point drift.
 *
 * Auto-incrementing integer IDs guarantee uniqueness across the runtime
 * lifetime of the process.
 */

const { DEFAULT_TOTAL_BUDGET, ERRORS } = require('../config/constants');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Round a number to two decimal places to prevent floating-point artifacts.
 * @param {number} n
 * @returns {number}
 */
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Singleton State ───────────────────────────────────────────────────────────

/** @type {number} Auto-incrementing envelope ID counter. */
let nextId = 1;

/** @type {number} Global budget aggregated from all envelopes. */
let totalBudget = DEFAULT_TOTAL_BUDGET;

/**
 * @typedef {Object} Envelope
 * @property {number}  id       – Unique auto-incremented integer.
 * @property {string}  title    – Human-readable category name.
 * @property {number}  budget   – Allocated budget for this envelope.
 * @property {number}  balance  – Remaining spendable funds.
 * @property {string}  createdAt – ISO-8601 creation timestamp.
 * @property {string}  updatedAt – ISO-8601 last-modification timestamp.
 */

/** @type {Envelope[]} */
const envelopes = [];

// ─── CRUD Methods ──────────────────────────────────────────────────────────────

/**
 * Create a new envelope and add its budget to the global total.
 *
 * @param {string} title  – Category name (must be non-empty).
 * @param {number} budget – Initial budget (≥ 0). Balance starts equal to budget.
 * @returns {Envelope} The newly created envelope.
 */
function createEnvelope(title, budget) {
  const now = new Date().toISOString();
  const envelope = {
    id: nextId++,
    title: title.trim(),
    budget: round(budget),
    balance: round(budget),
    createdAt: now,
    updatedAt: now,
  };

  envelopes.push(envelope);
  totalBudget = round(totalBudget + envelope.budget);
  return envelope;
}

/**
 * Return a shallow copy of every envelope.
 * @returns {Envelope[]}
 */
function getAllEnvelopes() {
  return envelopes.map((e) => ({ ...e }));
}

/**
 * Look up a single envelope by its integer ID.
 *
 * @param {number} id
 * @returns {Envelope|null} A copy of the envelope, or null if not found.
 */
function getEnvelopeById(id) {
  const envelope = envelopes.find((e) => e.id === id);
  return envelope ? { ...envelope } : null;
}

/**
 * Update an existing envelope's title and/or budget.
 *
 * When the budget changes the global total is adjusted by the delta.
 * When balance would drop below zero the update is rejected.
 *
 * @param {number} id
 * @param {Object}  updates
 * @param {string}  [updates.title]
 * @param {number}  [updates.budget]
 * @param {number}  [updates.balance]
 * @returns {{ success: boolean, data?: Envelope, error?: string }}
 */
function updateEnvelope(id, updates) {
  const idx = envelopes.findIndex((e) => e.id === id);
  if (idx === -1) {
    return { success: false, error: ERRORS.ENVELOPE_NOT_FOUND };
  }

  const envelope = envelopes[idx];

  // Title mutation
  if (updates.title !== undefined) {
    envelope.title = updates.title.trim();
  }

  // Budget scaling – adjust totalBudget by the difference
  if (updates.budget !== undefined) {
    const newBudget = round(updates.budget);
    const delta = round(newBudget - envelope.budget);

    // Adjust balance proportionally: if the budget grew, balance grows by the
    // same delta.  If it shrunk, balance shrinks – but must never go below 0.
    const newBalance = round(envelope.balance + delta);
    if (newBalance < 0) {
      return { success: false, error: ERRORS.OVERDRAFT };
    }

    totalBudget = round(totalBudget + delta);
    envelope.budget = newBudget;
    envelope.balance = newBalance;
  }

  // Direct balance mutation (spending / topping up)
  if (updates.balance !== undefined && updates.budget === undefined) {
    const newBalance = round(updates.balance);
    if (newBalance < 0) {
      return { success: false, error: ERRORS.OVERDRAFT };
    }
    envelope.balance = newBalance;
  }

  envelope.updatedAt = new Date().toISOString();
  return { success: true, data: { ...envelope } };
}

/**
 * Delete an envelope by ID and decrement its remaining balance from totalBudget.
 *
 * @param {number} id
 * @returns {{ success: boolean, error?: string }}
 */
function deleteEnvelope(id) {
  const idx = envelopes.findIndex((e) => e.id === id);
  if (idx === -1) {
    return { success: false, error: ERRORS.ENVELOPE_NOT_FOUND };
  }

  const [removed] = envelopes.splice(idx, 1);
  totalBudget = round(totalBudget - removed.balance);
  return { success: true };
}

// ─── Transfer ──────────────────────────────────────────────────────────────────

/**
 * Atomically transfer funds from one envelope to another.
 *
 * @param {number} fromId – Source envelope ID.
 * @param {number} toId   – Destination envelope ID.
 * @param {number} amount – Amount to transfer (must be > 0).
 * @returns {{ success: boolean, data?: { from: Envelope, to: Envelope }, error?: string }}
 */
function transferFunds(fromId, toId, amount) {
  const fromIdx = envelopes.findIndex((e) => e.id === fromId);
  const toIdx = envelopes.findIndex((e) => e.id === toId);

  if (fromIdx === -1 || toIdx === -1) {
    return { success: false, error: ERRORS.ENVELOPE_NOT_FOUND };
  }

  const from = envelopes[fromIdx];
  const to = envelopes[toIdx];

  const transferAmount = round(amount);

  if (from.balance < transferAmount) {
    return { success: false, error: ERRORS.INSUFFICIENT_FUNDS };
  }

  // Atomic state change – both mutations happen together
  from.balance = round(from.balance - transferAmount);
  to.balance = round(to.balance + transferAmount);

  const now = new Date().toISOString();
  from.updatedAt = now;
  to.updatedAt = now;

  return {
    success: true,
    data: { from: { ...from }, to: { ...to } },
  };
}

// ─── Accessors ─────────────────────────────────────────────────────────────────

/**
 * Return the current global budget total.
 * @returns {number}
 */
function getTotalBudget() {
  return totalBudget;
}

// ─── Public API ────────────────────────────────────────────────────────────────

module.exports = {
  createEnvelope,
  getAllEnvelopes,
  getEnvelopeById,
  updateEnvelope,
  deleteEnvelope,
  transferFunds,
  getTotalBudget,
};
