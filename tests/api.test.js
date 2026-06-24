/**
 * API integration tests — envelopes, transactions, distribute, and fund flows.
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /(postgresql:\/\/[^/]+\/)([^/?]+)/,
    '$1$2_test',
  );
} else {
  throw new Error('DATABASE_URL or TEST_DATABASE_URL is required to run tests.');
}

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { setupTestDatabase, resetDatabase } = require('./helpers');

const app = require('../server');

describe('Envelope Budget API', () => {
  before(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    const { sequelize } = require('./helpers');
    await sequelize.close();
  });

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
    });
  });

  describe('Envelopes', () => {
    it('creates and lists envelopes', async () => {
      const createRes = await request(app)
        .post('/envelopes')
        .send({ title: 'Groceries', budget: 500 });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.data.title, 'Groceries');
      assert.equal(createRes.body.data.balance, 500);

      const listRes = await request(app).get('/envelopes');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.envelopes.length, 1);
      assert.equal(listRes.body.data.totalBudget, 500);
    });

    it('transfers funds atomically', async () => {
      const a = await request(app).post('/envelopes').send({ title: 'A', budget: 100 });
      const b = await request(app).post('/envelopes').send({ title: 'B', budget: 50 });

      const transferRes = await request(app)
        .post(`/envelopes/transfer/${a.body.data.id}/${b.body.data.id}`)
        .send({ amount: 30 });

      assert.equal(transferRes.status, 200);
      assert.equal(transferRes.body.data.from.balance, 70);
      assert.equal(transferRes.body.data.to.balance, 80);
    });

    it('rejects transfer when funds are insufficient', async () => {
      const a = await request(app).post('/envelopes').send({ title: 'A', budget: 10 });
      const b = await request(app).post('/envelopes').send({ title: 'B', budget: 10 });

      const transferRes = await request(app)
        .post(`/envelopes/transfer/${a.body.data.id}/${b.body.data.id}`)
        .send({ amount: 50 });

      assert.equal(transferRes.status, 400);
      assert.match(transferRes.body.error, /insufficient funds/i);
    });

    it('distributes income proportionally by budget', async () => {
      await request(app).post('/envelopes').send({ title: 'Rent', budget: 600 });
      await request(app).post('/envelopes').send({ title: 'Food', budget: 400 });

      const distributeRes = await request(app)
        .post('/envelopes/distribute')
        .send({ totalIncome: 1000 });

      assert.equal(distributeRes.status, 200);
      assert.equal(distributeRes.body.data.totalIncome, 1000);

      const rent = distributeRes.body.data.envelopes.find((e) => e.title === 'Rent');
      const food = distributeRes.body.data.envelopes.find((e) => e.title === 'Food');
      assert.equal(rent.balance, 1200);
      assert.equal(food.balance, 800);
    });

    it('adds funds to a single envelope', async () => {
      const created = await request(app)
        .post('/envelopes')
        .send({ title: 'Transport', budget: 100 });

      const fundRes = await request(app)
        .post(`/envelopes/${created.body.data.id}/fund`)
        .send({ amount: 25 });

      assert.equal(fundRes.status, 200);
      assert.equal(fundRes.body.data.balance, 125);
    });
  });

  describe('Transactions', () => {
    it('deducts balance when creating a transaction', async () => {
      const envelope = await request(app)
        .post('/envelopes')
        .send({ title: 'Groceries', budget: 200 });

      const txRes = await request(app)
        .post('/transactions')
        .send({
          date: new Date().toISOString(),
          amount: 45.5,
          recipient: 'Whole Foods',
          envelopeId: envelope.body.data.id,
        });

      assert.equal(txRes.status, 201);
      assert.equal(txRes.body.data.amount, 45.5);

      const listRes = await request(app).get('/envelopes');
      const updated = listRes.body.data.envelopes[0];
      assert.equal(updated.balance, 154.5);
    });

    it('refunds balance when deleting a transaction', async () => {
      const envelope = await request(app)
        .post('/envelopes')
        .send({ title: 'Groceries', budget: 200 });

      const txRes = await request(app)
        .post('/transactions')
        .send({
          date: new Date().toISOString(),
          amount: 20,
          recipient: 'Trader Joes',
          envelopeId: envelope.body.data.id,
        });

      const deleteRes = await request(app).delete(`/transactions/${txRes.body.data.id}`);
      assert.equal(deleteRes.status, 204);

      const listRes = await request(app).get('/envelopes');
      assert.equal(listRes.body.data.envelopes[0].balance, 200);
    });

    it('rejects spending when balance is insufficient', async () => {
      const envelope = await request(app)
        .post('/envelopes')
        .send({ title: 'Groceries', budget: 10 });

      const txRes = await request(app)
        .post('/transactions')
        .send({
          date: new Date().toISOString(),
          amount: 50,
          recipient: 'Store',
          envelopeId: envelope.body.data.id,
        });

      assert.equal(txRes.status, 400);
      assert.match(txRes.body.error, /insufficient funds/i);
    });
  });
});
