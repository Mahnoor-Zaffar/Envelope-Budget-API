/**
 * Shared controller utilities for parsing, formatting, and error responses.
 */

const { STATUS, ERRORS } = require('../config/constants');

/**
 * Round a number to two decimal places.
 * @param {number|string} n
 * @returns {number}
 */
function roundMoney(n) {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Parse a route parameter as a positive integer ID.
 * @param {string} raw
 * @returns {number|null}
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

/**
 * Map Sequelize validation / constraint errors to HTTP responses.
 * @param {import('express').Response} res
 * @param {Error} err
 * @returns {import('express').Response|void}
 */
function handleSequelizeError(res, err) {
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const message = err.errors?.[0]?.message || err.message;
    return sendError(res, STATUS.BAD_REQUEST, message);
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.ENVELOPE_NOT_FOUND);
  }

  console.error('[Database Error]', err);
  return sendError(res, STATUS.INTERNAL_ERROR, 'Internal server error.');
}

/**
 * Serialize an envelope instance for JSON responses.
 * @param {import('./envelope')} envelope
 * @returns {Object}
 */
function formatEnvelope(envelope) {
  const plain = envelope.toJSON();
  return {
    ...plain,
    budget: roundMoney(plain.budget),
    balance: roundMoney(plain.balance),
  };
}

/**
 * Serialize a transaction instance for JSON responses.
 * @param {import('./transaction')} transaction
 * @returns {Object}
 */
function formatTransaction(transaction) {
  const plain = transaction.toJSON();
  return {
    ...plain,
    amount: roundMoney(plain.amount),
  };
}

/**
 * Parse `page` and `limit` query params with sane defaults and caps.
 * @param {import('express').Request['query']} query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Build pagination metadata for list responses.
 */
function buildPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

module.exports = {
  roundMoney,
  parseId,
  parsePagination,
  buildPaginationMeta,
  sendError,
  handleSequelizeError,
  formatEnvelope,
  formatTransaction,
};
