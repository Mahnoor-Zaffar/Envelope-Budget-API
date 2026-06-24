/**
 * Models Index
 *
 * Initializes Sequelize associations and exports the model registry.
 */

const sequelize = require('../config/database');
const Envelope = require('./envelope');
const Transaction = require('./transaction');

Envelope.hasMany(Transaction, {
  foreignKey: 'envelopeId',
  as: 'transactions',
  onDelete: 'CASCADE',
  hooks: true,
});

Transaction.belongsTo(Envelope, {
  foreignKey: 'envelopeId',
  as: 'envelope',
});

/**
 * Authenticate and synchronize models with the database schema.
 * @returns {Promise<void>}
 */
async function initDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
}

module.exports = {
  sequelize,
  Envelope,
  Transaction,
  initDatabase,
};
