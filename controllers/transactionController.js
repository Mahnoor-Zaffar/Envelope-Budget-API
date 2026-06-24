/**
 * TransactionController – CRUD handlers for external expenditure logs.
 *
 * POST deducts funds from the linked envelope atomically.
 * DELETE refunds the deducted amount back to the parent envelope.
 * PUT recalculates envelope balances when amount or envelopeId changes.
 */

const { Envelope, Transaction, sequelize } = require('../models');
const {
  STATUS,
  ERRORS,
  MAX_BUDGET_VALUE,
} = require('../config/constants');
const {
  roundMoney,
  parseId,
  parsePagination,
  buildPaginationMeta,
  sendError,
  handleSequelizeError,
  formatTransaction,
} = require('../utils/controllerHelpers');

// ─── POST /transactions ────────────────────────────────────────────────────────

async function createTransaction(req, res) {
  const { date, amount, recipient, envelopeId } = req.body;

  if (date === undefined || Number.isNaN(Date.parse(date))) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_DATE);
  }

  if (amount === undefined || typeof amount !== 'number' || amount <= 0 || Number.isNaN(amount)) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_AMOUNT);
  }

  if (amount > MAX_BUDGET_VALUE) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
  }

  if (recipient === undefined || typeof recipient !== 'string' || recipient.trim().length === 0) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_RECIPIENT);
  }

  if (recipient.trim().length > 256) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_RECIPIENT);
  }

  const parsedEnvelopeId = parseId(String(envelopeId));
  if (!parsedEnvelopeId) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_ENVELOPE_ID);
  }

  const paymentAmount = roundMoney(amount);
  const dbTransaction = await sequelize.transaction();

  try {
    const envelope = await Envelope.findByPk(parsedEnvelopeId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!envelope) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    const currentBalance = parseFloat(envelope.balance);
    if (currentBalance < paymentAmount) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INSUFFICIENT_FUNDS);
    }

    envelope.balance = roundMoney(currentBalance - paymentAmount);
    await envelope.save({ transaction: dbTransaction });

    const transactionRecord = await Transaction.create(
      {
        date: new Date(date),
        amount: paymentAmount,
        recipient: recipient.trim(),
        envelopeId: parsedEnvelopeId,
      },
      { transaction: dbTransaction },
    );

    await dbTransaction.commit();
    return res.status(STATUS.CREATED).json({ data: formatTransaction(transactionRecord) });
  } catch (err) {
    await dbTransaction.rollback();
    return handleSequelizeError(res, err);
  }
}

// ─── GET /transactions ─────────────────────────────────────────────────────────

async function getAllTransactions(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { count, rows } = await Transaction.findAndCountAll({
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    });

    return res.status(STATUS.OK).json({
      data: rows.map(formatTransaction),
      pagination: buildPaginationMeta(page, limit, count),
    });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

// ─── GET /transactions/:id ─────────────────────────────────────────────────────

async function getTransactionById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
    }

    const transactionRecord = await Transaction.findByPk(id);
    if (!transactionRecord) {
      return sendError(res, STATUS.NOT_FOUND, ERRORS.TRANSACTION_NOT_FOUND);
    }

    return res.status(STATUS.OK).json({ data: formatTransaction(transactionRecord) });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

// ─── PUT /transactions/:id ─────────────────────────────────────────────────────

async function updateTransaction(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
  }

  const { date, amount, recipient, envelopeId } = req.body;
  const dbTransaction = await sequelize.transaction();

  try {
    const transactionRecord = await Transaction.findByPk(id, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!transactionRecord) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.TRANSACTION_NOT_FOUND);
    }

    const oldAmount = roundMoney(transactionRecord.amount);
    const oldEnvelopeId = transactionRecord.envelopeId;

    let newAmount = oldAmount;
    let newEnvelopeId = oldEnvelopeId;

    if (date !== undefined) {
      if (Number.isNaN(Date.parse(date))) {
        await dbTransaction.rollback();
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_DATE);
      }
      transactionRecord.date = new Date(date);
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0 || Number.isNaN(amount)) {
        await dbTransaction.rollback();
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_AMOUNT);
      }
      if (amount > MAX_BUDGET_VALUE) {
        await dbTransaction.rollback();
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.BUDGET_TOO_LARGE);
      }
      newAmount = roundMoney(amount);
    }

    if (recipient !== undefined) {
      if (typeof recipient !== 'string' || recipient.trim().length === 0) {
        await dbTransaction.rollback();
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_RECIPIENT);
      }
      transactionRecord.recipient = recipient.trim();
    }

    if (envelopeId !== undefined) {
      const parsedEnvelopeId = parseId(String(envelopeId));
      if (!parsedEnvelopeId) {
        await dbTransaction.rollback();
        return sendError(res, STATUS.BAD_REQUEST, ERRORS.MISSING_ENVELOPE_ID);
      }
      newEnvelopeId = parsedEnvelopeId;
    }

    const oldEnvelope = await Envelope.findByPk(oldEnvelopeId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!oldEnvelope) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    oldEnvelope.balance = roundMoney(parseFloat(oldEnvelope.balance) + oldAmount);
    await oldEnvelope.save({ transaction: dbTransaction });

    const targetEnvelope = oldEnvelopeId === newEnvelopeId
      ? oldEnvelope
      : await Envelope.findByPk(newEnvelopeId, {
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction,
      });

    if (!targetEnvelope) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    const targetBalance = parseFloat(targetEnvelope.balance);
    if (targetBalance < newAmount) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INSUFFICIENT_FUNDS);
    }

    targetEnvelope.balance = roundMoney(targetBalance - newAmount);
    await targetEnvelope.save({ transaction: dbTransaction });

    transactionRecord.amount = newAmount;
    transactionRecord.envelopeId = newEnvelopeId;
    await transactionRecord.save({ transaction: dbTransaction });

    await dbTransaction.commit();
    return res.status(STATUS.OK).json({ data: formatTransaction(transactionRecord) });
  } catch (err) {
    await dbTransaction.rollback();
    return handleSequelizeError(res, err);
  }
}

// ─── DELETE /transactions/:id ──────────────────────────────────────────────────

async function deleteTransaction(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_ID);
  }

  const dbTransaction = await sequelize.transaction();

  try {
    const transactionRecord = await Transaction.findByPk(id, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!transactionRecord) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.TRANSACTION_NOT_FOUND);
    }

    const envelope = await Envelope.findByPk(transactionRecord.envelopeId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!envelope) {
      await dbTransaction.rollback();
      return sendError(res, STATUS.NOT_FOUND, ERRORS.ENVELOPE_NOT_FOUND);
    }

    envelope.balance = roundMoney(
      parseFloat(envelope.balance) + parseFloat(transactionRecord.amount),
    );
    await envelope.save({ transaction: dbTransaction });
    await transactionRecord.destroy({ transaction: dbTransaction });

    await dbTransaction.commit();
    return res.status(STATUS.NO_CONTENT).send();
  } catch (err) {
    await dbTransaction.rollback();
    return handleSequelizeError(res, err);
  }
}

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
