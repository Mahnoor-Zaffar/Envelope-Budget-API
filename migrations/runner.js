/**
 * Migration runner — applies ordered SQL migrations tracked in SequelizeMeta.
 */

const sequelize = require('../config/database');
const migration001 = require('./001-create-core-tables');
const migration002 = require('./002-create-users-table');

const migrations = [migration001, migration002];

async function ensureMetaTable() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

  if (!tableNames.includes('SequelizeMeta')) {
    await queryInterface.createTable('SequelizeMeta', {
      name: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true,
      },
    });
  }
}

async function getAppliedMigrations() {
  const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name ASC;');
  return rows.map((row) => row.name);
}

async function runMigrations() {
  await ensureMetaTable();
  const applied = await getAppliedMigrations();
  const queryInterface = sequelize.getQueryInterface();
  const Sequelize = sequelize.Sequelize;

  for (const migration of migrations) {
    if (applied.includes(migration.name)) continue;

    await migration.up(queryInterface, Sequelize);
    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name);', {
      replacements: { name: migration.name },
    });
    console.log(`✓  Migration applied: ${migration.name}`);
  }
}

module.exports = { runMigrations };
