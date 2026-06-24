/**
 * Transaction Model
 *
 * Logs an external expenditure against a parent envelope.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define(
  'Transaction',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: { msg: 'Date must be a valid timestamp.' },
      },
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: { args: [0.01], msg: 'Amount must be a positive number.' },
      },
    },
    recipient: {
      type: DataTypes.STRING(256),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Recipient is required and must be a non-empty string.' },
        len: { args: [1, 256], msg: 'Recipient must not exceed 256 characters.' },
      },
    },
    envelopeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'envelopes',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
  {
    tableName: 'transactions',
    timestamps: true,
  },
);

module.exports = Transaction;
