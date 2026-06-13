/**
 * EnvelopeController – Request / Response lifecycle handlers.
 *
 * Every handler performs rigid schema verification before delegating to the
 * BudgetStore.  Responses follow a uniform JSON envelope:
 *   { data: <payload> }          on success
 *   { error: "<message>" }       on failure
 */

const store = require('../models/budgetStore');
const {
  STATUS,
  ERRORS,
  MAX_TITLE_LENGTH,
  MAX_BUDGET_VALUE,
} = require('../config/constants');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a route parameter as a positive integer ID.
 * @param {string} raw – The raw parameter string.
 * @returns {number|null} The parsed integer or null if invalid.
 */
function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Send a standardised JSON error response.
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} message
 */
function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

// ─── POST /envelopes ───────────────────────────────────────────────────────────

/**
 * Create a new budget envelope.
 *
 * Required body: { title: string, budget: number (≥ 0) }
 * Sets initial balance equal to budget and increments globalBudget.
 */
function createEnvelope(req, res) {
  const { title, budget } = req.body;

  // ── Schema verification ────────────────────────────────────────────────
  if (title === undefined || typeof title !== 'string' || title.trim().length === 0) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_TITLE);
  }

  if (title.trim().length > MAX_TITLE_LENGTH) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.TITLE_TOO_LONG);
  }

  if (budget === undefined || typeof budget !== 'number' || budget < 0 || Number.isNaN(budget)) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_BUDGET);
  }

  if (budget > MAX_BUDGET_VALUE) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
  }

  const envelope = store.createEnvelope(title, budget);
  return res.status(STATUS.CREATED).json({ data: envelope });
}

// ─── GET /envelopes ────────────────────────────────────────────────────────────

/**
 * Retrieve all envelopes alongside the current global budget.
 */
function getAllEnvelopes(_req, res) {
  const envelopes = store.getAllEnvelopes();
  return res.status(STATUS.OK).json({
    data: {
      totalBudget: store.getTotalBudget(),
      envelopes,
    },
  });
}

// ─── GET /envelopes/:id ────────────────────────────────────────────────────────

/**
 * Retrieve a single envelope by its integer ID.
 * Returns 404 with a clean JSON error if the asset is missing.
 */
function getEnvelopeById(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
  }

  const envelope = store.getEnvelopeById(id);
  if (!envelope) {
    return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
  }

  return res.status(STATUS.OK).json({ data: envelope });
}

// ─── PUT /envelopes/:id ────────────────────────────────────────────────────────

/**
 * Update an existing envelope's title, budget, or balance.
 *
 * - When budget changes the total budget is adjusted by the delta.
 * - A withdrawal that would cause balance < 0 returns 400 BAD_REQUEST.
 */
function updateEnvelope(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
  }

  const updates = {};
  const { title, budget, balance } = req.body;

  // Validate optional title
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_TITLE);
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.TITLE_TOO_LONG);
    }
    updates.title = title;
  }

  // Validate optional budget
  if (budget !== undefined) {
    if (typeof budget !== 'number' || budget < 0 || Number.isNaN(budget)) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_BUDGET);
    }
    if (budget > MAX_BUDGET_VALUE) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
    }
    updates.budget = budget;
  }

  // Validate optional balance (spending/withdrawal)
  if (balance !== undefined) {
    if (typeof balance !== 'number' || Number.isNaN(balance)) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_BUDGET);
    }
    updates.balance = balance;
  }

  // At least one field must be present
  if (Object.keys(updates).length === 0) {
    return sendError(
      res,
      STATUS.BAD_REQUEST,
      'At least one of "title", "budget", or "balance" must be provided.',
    );
  }

  const result = store.updateEnvelope(id, updates);

  if (!result.success) {
    const status = result.error === ERRORS.ENVELOPE_NOT_FOUND
      ? STATUS.NOT_FOUND
      : STATUS.BAD_REQUEST;
    return sendError(res, status, result.error);
  }

  return res.status(STATUS.OK).json({ data: result.data });
}

// ─── DELETE /envelopes/:id ─────────────────────────────────────────────────────

/**
 * Remove an envelope from memory and decrement its remaining balance from
 * the global total.  Returns 404 if the ID is invalid.
 */
function deleteEnvelope(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
  }

  const result = store.deleteEnvelope(id);
  if (!result.success) {
    return sendError(res, STATUS.NOT_FOUND, result.error);
  }

  return res.status(STATUS.NO_CONTENT).send();
}

// ─── POST /envelopes/transfer/:fromId/:toId ────────────────────────────────────

/**
 * Transfer funds between two envelopes atomically.
 *
 * Required body: { amount: number (> 0) }
 * Fails fast if funds are insufficient or either ID is unknown.
 */
function transferFunds(req, res) {
  const fromId = parseId(req.params.fromId);
  const toId = parseId(req.params.toId);

  if (!fromId || !toId) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
  }

  if (fromId === toId) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.TRANSFER_SAME);
  }

  const { amount } = req.body;

  if (amount === undefined || typeof amount !== 'number' || amount <= 0 || Number.isNaN(amount)) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_AMOUNT);
  }

  if (amount > MAX_BUDGET_VALUE) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
  }

  const result = store.transferFunds(fromId, toId, amount);

  if (!result.success) {
    const status = result.error === ERRORS.ENVELOPE_NOT_FOUND
      ? STATUS.NOT_FOUND
      : STATUS.BAD_REQUEST;
    return sendError(res, status, result.error);
  }

  return res.status(STATUS.OK).json({ data: result.data });
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  createEnvelope,
  getAllEnvelopes,
  getEnvelopeById,
  updateEnvelope,
  deleteEnvelope,
  transferFunds,
};
