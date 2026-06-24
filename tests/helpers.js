/**
 * Shared test utilities — database reset and HTTP helpers.
 */

const { Envelope, Transaction, initDatabase, sequelize } = require('../models');

async function setupTestDatabase() {
  await initDatabase();
  await sequelize.sync({ force: true });
}

async function resetDatabase() {
  await Transaction.destroy({ where: {}, truncate: true, cascade: true });
  await Envelope.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
}

async function createEnvelope(title, budget) {
  return Envelope.create({
    title,
    budget,
    balance: budget,
  });
}

module.exports = {
  setupTestDatabase,
  resetDatabase,
  createEnvelope,
  sequelize,
};
