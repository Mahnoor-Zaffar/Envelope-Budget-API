/**
 * EnvelopeController – Async request / response handlers backed by Sequelize.
 *
 * Every handler performs schema verification before delegating to the database.
 * Responses follow a uniform JSON envelope:
 *   { data: <payload> }          on success
 *   { error: "<message>" }         on failure
 */

const { Envelope, sequelize } = require('../models');
const {
  STATUS,
  ERRORS,
  MAX_TITLE_LENGTH,
  MAX_BUDGET_VALUE,
} = require('../config/constants');
const {
  roundMoney,
  parseId,
  parsePagination,
  buildPaginationMeta,
  sendError,
  handleSequelizeError,
  formatEnvelope,
} = require('../utils/controllerHelpers');

// ─── POST /envelopes ───────────────────────────────────────────────────────────

async function createEnvelope(req, res) {
  try {
    const { title, budget } = req.body;

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

    const roundedBudget = roundMoney(budget);
    const envelope = await Envelope.create({
      title: title.trim(),
      budget: roundedBudget,
      balance: roundedBudget,
    });

    return res.status(STATUS.CREATED).json({ data: formatEnvelope(envelope) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.DUPLICATE_TITLE);
    }
    return handleSequelizeError(res, err);
  }
}

// ─── GET /envelopes ────────────────────────────────────────────────────────────

async function getAllEnvelopes(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { count, rows } = await Envelope.findAndCountAll({
      order: [['id', 'ASC']],
      limit,
      offset,
    });

    const totalBudget = rows.reduce(
      (sum, envelope) => roundMoney(sum + parseFloat(envelope.budget)),
      0,
    );

    return res.status(STATUS.OK).json({
      data: {
        totalBudget,
        envelopes: rows.map(formatEnvelope),
        pagination: buildPaginationMeta(page, limit, count),
      },
    });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

// ─── GET /envelopes/:id ────────────────────────────────────────────────────────

async function getEnvelopeById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
    }

    const envelope = await Envelope.findByPk(id);
    if (!envelope) {
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    return res.status(STATUS.OK).json({ data: formatEnvelope(envelope) });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

// ─── PUT /envelopes/:id ────────────────────────────────────────────────────────

async function updateEnvelope(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
    }

    const envelope = await Envelope.findByPk(id);
    if (!envelope) {
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    const { title, budget, balance } = req.body;
    const updates = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_TITLE);
      }
      if (title.trim().length > MAX_TITLE_LENGTH) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.TITLE_TOO_LONG);
      }
      updates.title = title.trim();
    }

    if (budget !== undefined) {
      if (typeof budget !== 'number' || budget < 0 || Number.isNaN(budget)) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_BUDGET);
      }
      if (budget > MAX_BUDGET_VALUE) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
      }

      const newBudget = roundMoney(budget);
      const delta = roundMoney(newBudget - parseFloat(envelope.budget));
      const newBalance = roundMoney(parseFloat(envelope.balance) + delta);

      if (newBalance < 0) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.OVERDRAFT);
      }

      updates.budget = newBudget;
      updates.balance = newBalance;
    }

    if (balance !== undefined && budget === undefined) {
      if (typeof balance !== 'number' || Number.isNaN(balance)) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_BUDGET);
      }

      const newBalance = roundMoney(balance);
      if (newBalance < 0) {
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.OVERDRAFT);
      }

      updates.balance = newBalance;
    }

    if (Object.keys(updates).length === 0) {
      return sendError(
        res,
        STATUS.BAD_REQUEST,
        'At least one of "title", "budget", or "balance" must be provided.',
      );
    }

    await envelope.update(updates);
    return res.status(STATUS.OK).json({ data: formatEnvelope(envelope) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.DUPLICATE_TITLE);
    }
    return handleSequelizeError(res, err);
  }
}

// ─── DELETE /envelopes/:id ─────────────────────────────────────────────────────

async function deleteEnvelope(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
    }

    const envelope = await Envelope.findByPk(id);
    if (!envelope) {
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    await envelope.destroy();
    return res.status(STATUS.NO_CONTENT).send();
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

// ─── POST /envelopes/transfer/:fromId/:toId ────────────────────────────────────

async function transferFunds(req, res) {
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

  const transferAmount = roundMoney(amount);
  const dbTransaction = await sequelize.transaction();

  try {
    const fromEnvelope = await Envelope.findByPk(fromId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });
    const toEnvelope = await Envelope.findByPk(toId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!fromEnvelope || !toEnvelope) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    const fromBalance = parseFloat(fromEnvelope.balance);
    if (fromBalance < transferAmount) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INSUFFICIENT_FUNDS);
    }

    fromEnvelope.balance = roundMoney(fromBalance - transferAmount);
    toEnvelope.balance = roundMoney(parseFloat(toEnvelope.balance) + transferAmount);

    await fromEnvelope.save({ transaction: dbTransaction });
    await toEnvelope.save({ transaction: dbTransaction });
    await dbTransaction.commit();

    return res.status(STATUS.OK).json({
      data: {
        from: formatEnvelope(fromEnvelope),
        to: formatEnvelope(toEnvelope),
      },
    });
  } catch (err) {
    await dbTransaction.rollback();
    return handleSequelizeError(res, err);
  }
}

// ─── POST /envelopes/distribute ───────────────────────────────────────────────

/**
 * Distribute income proportionally across all envelopes by budget allocation.
 * Each envelope's balance increases by its proportional share of totalIncome.
 */
async function distributeIncome(req, res) {
  const { totalIncome } = req.body;

  if (totalIncome === undefined || typeof totalIncome !== 'number' || totalIncome <= 0 || Number.isNaN(totalIncome)) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_INCOME);
  }

  if (totalIncome > MAX_BUDGET_VALUE) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
  }

  const income = roundMoney(totalIncome);
  const dbTransaction = await sequelize.transaction();

  try {
    const envelopeList = await Envelope.findAll({
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
      order: [['id', 'ASC']],
    });

    if (envelopeList.length === 0) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.NO_ENVELOPES);
    }

    const budgetSum = envelopeList.reduce(
      (sum, envelope) => sum + parseFloat(envelope.budget),
      0,
    );

    const weights = budgetSum > 0
      ? envelopeList.map((envelope) => parseFloat(envelope.budget))
      : envelopeList.map(() => 1);

    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    let allocated = 0;

    for (let i = 0; i < envelopeList.length; i++) {
      const envelope = envelopeList[i];
      let share;

      if (i === envelopeList.length - 1) {
        share = roundMoney(income - allocated);
      } else {
        share = roundMoney(income * (weights[i] / weightTotal));
        allocated = roundMoney(allocated + share);
      }

      envelope.balance = roundMoney(parseFloat(envelope.balance) + share);
      await envelope.save({ transaction: dbTransaction });
    }

    await dbTransaction.commit();

    return res.status(STATUS.OK).json({
      data: {
        totalIncome: income,
        envelopes: envelopeList.map(formatEnvelope),
      },
    });
  } catch (err) {
    await dbTransaction.rollback();
    return handleSequelizeError(res, err);
  }
}

// ─── POST /envelopes/:id/fund ──────────────────────────────────────────────────

/**
 * Add funds directly to a single envelope's balance.
 */
async function addFunds(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
    }

    const { amount } = req.body;

    if (amount === undefined || typeof amount !== 'number' || amount <= 0 || Number.isNaN(amount)) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_AMOUNT);
    }

    if (amount > MAX_BUDGET_VALUE) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
    }

    const envelope = await Envelope.findByPk(id);
    if (!envelope) {
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    const fundAmount = roundMoney(amount);
    envelope.balance = roundMoney(parseFloat(envelope.balance) + fundAmount);
    await envelope.save();

    return res.status(STATUS.OK).json({ data: formatEnvelope(envelope) });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

module.exports = {
  createEnvelope,
  getAllEnvelopes,
  getEnvelopeById,
  updateEnvelope,
  deleteEnvelope,
  transferFunds,
  distributeIncome,
  addFunds,
};
