/**
 * Models Index
 *
 * Initializes Sequelize associations and exports the model registry.
 */

const sequelize = require('../config/database');
const Envelope = require('./envelope');
const Transaction = require('./transaction');
const User = require('./user');

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
 * Authenticate and prepare the database schema.
 * Production uses versioned migrations; development uses sync.
 * @returns {Promise<void>}
 */
async function initDatabase() {
  await sequelize.authenticate();

  if (process.env.NODE_ENV === 'production') {
    const { runMigrations } = require('../migrations/runner');
    await runMigrations();
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    await sequelize.sync();
  }
}

module.exports = {
  sequelize,
  Envelope,
  Transaction,
  User,
  initDatabase,
};
