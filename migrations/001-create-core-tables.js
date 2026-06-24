/** @type {import('sequelize').Migration} */
module.exports = {
  name: '001-create-core-tables',

  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

    if (!names.includes('envelopes')) {
      await queryInterface.createTable('envelopes', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: {
          type: Sequelize.STRING(128),
          allowNull: false,
          unique: true,
        },
        budget: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        balance: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    if (!names.includes('transactions')) {
      await queryInterface.createTable('transactions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        recipient: {
          type: Sequelize.STRING(256),
          allowNull: false,
        },
        envelopeId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'envelopes', key: 'id' },
          onDelete: 'CASCADE',
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transactions');
    await queryInterface.dropTable('envelopes');
  },
};
