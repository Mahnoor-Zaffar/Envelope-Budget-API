/**
 * ReportController — aggregated spending analytics.
 */

const { Op } = require('sequelize');
const { Envelope, Transaction } = require('../models');
const { STATUS, ERRORS } = require('../config/constants');
const {
  roundMoney,
  sendError,
  handleSequelizeError,
} = require('../utils/controllerHelpers');

async function getMonthlyReport(req, res) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_REPORT_PARAMS);
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_REPORT_PARAMS);
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const transactions = await Transaction.findAll({
      where: {
        date: {
          [Op.gte]: start,
          [Op.lt]: end,
        },
      },
      include: [{ model: Envelope, as: 'envelope', attributes: ['id', 'title'] }],
      order: [['date', 'DESC']],
    });

    const byEnvelope = new Map();
    let totalSpent = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      totalSpent = roundMoney(totalSpent + amount);
      const key = tx.envelopeId;
      const existing = byEnvelope.get(key) || {
        envelopeId: key,
        title: tx.envelope?.title || 'Unknown',
        totalSpent: 0,
        transactionCount: 0,
      };
      existing.totalSpent = roundMoney(existing.totalSpent + amount);
      existing.transactionCount += 1;
      byEnvelope.set(key, existing);
    }

    return res.status(STATUS.OK).json({
      data: {
        year,
        month,
        totalSpent,
        transactionCount: transactions.length,
        byEnvelope: Array.from(byEnvelope.values()).sort((a, b) => b.totalSpent - a.totalSpent),
      },
    });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

module.exports = { getMonthlyReport };
