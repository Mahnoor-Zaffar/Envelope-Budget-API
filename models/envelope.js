/**
 * Envelope Model
 *
 * Represents a budget category with an allocated budget and spendable balance.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Envelope = sequelize.define(
  'Envelope',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'Title is required and must be a non-empty string.' },
        len: { args: [1, 128], msg: 'Title must not exceed 128 characters.' },
      },
    },
    budget: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: { args: [0], msg: 'Budget must be a non-negative number.' },
      },
    },
    balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: { args: [0], msg: 'Balance cannot drop below zero.' },
      },
    },
  },
  {
    tableName: 'envelopes',
    timestamps: true,
  },
);

module.exports = Envelope;
