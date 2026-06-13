/**
 * Application-wide constants and configuration.
 *
 * Centralizes all magic numbers, default values, and environment overrides
 * so that every module references a single source of truth.
 */

// ─── Server ────────────────────────────────────────────────────────────────────

/** @type {number} Port the Express server listens on. */
const PORT = process.env.PORT || 3000;

/** @type {string} Base path prefix for the envelopes REST API. */
const API_BASE = '/envelopes';

// ─── Budget Defaults ───────────────────────────────────────────────────────────

/** @type {number} The initial global budget the system starts with. */
const DEFAULT_TOTAL_BUDGET = 0;

// ─── Validation Limits ─────────────────────────────────────────────────────────

/** @type {number} Maximum allowed length for an envelope title. */
const MAX_TITLE_LENGTH = 128;

/** @type {number} Maximum monetary value accepted for a single operation. */
const MAX_BUDGET_VALUE = 1_000_000_000; // 1 billion

// ─── HTTP Status Codes (semantic aliases) ──────────────────────────────────────

const STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
});

// ─── Error Messages ────────────────────────────────────────────────────────────

const ERRORS = Object.freeze({
  MISSING_TITLE: 'Validation failed: "title" is required and must be a non-empty string.',
  INVALID_BUDGET: 'Validation failed: "budget" must be a non-negative number.',
  BUDGET_TOO_LARGE: `Validation failed: "budget" must not exceed ${MAX_BUDGET_VALUE}.`,
  TITLE_TOO_LONG: `Validation failed: "title" must not exceed ${MAX_TITLE_LENGTH} characters.`,
  ENVELOPE_NOT_FOUND: 'The requested envelope does not exist.',
  INSUFFICIENT_FUNDS: 'Transaction denied: insufficient funds in the source envelope.',
  OVERDRAFT: 'Update denied: resulting balance cannot be negative.',
  TRANSFER_SAME: 'Transfer denied: source and destination envelopes must be different.',
  INVALID_AMOUNT: 'Validation failed: "amount" must be a positive number.',
  INVALID_ID: 'Validation failed: envelope ID must be a positive integer.',
});

module.exports = {
  PORT,
  API_BASE,
  DEFAULT_TOTAL_BUDGET,
  MAX_TITLE_LENGTH,
  MAX_BUDGET_VALUE,
  STATUS,
  ERRORS,
};
