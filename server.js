/**
 * Server Entry Point
 *
 * Bootstraps the Express application:
 *  1. Loads environment variables.
 *  2. Connects to PostgreSQL via Sequelize and syncs models.
 *  3. Registers security (Helmet) and CORS middleware.
 *  4. Applies an in-memory rate limiter.
 *  5. Registers JSON body-parsing middleware.
 *  6. Serves Swagger UI at /api-docs.
 *  7. Serves static assets from /public.
 *  8. Mounts envelope and transaction API routers.
 *  9. Provides a health-check endpoint at GET /health.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');
const { PORT, API_BASE, TRANSACTIONS_BASE, STATUS, ERRORS } = require('./config/constants');
const { initDatabase } = require('./models');
const envelopeRoutes = require('./routes/envelopeRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

// ─── Security Middleware ────────────────────────────────────────────────────────

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));

// ─── In-Memory Rate Limiter ────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 100;
const rateLimitMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 2 * 60 * 1000);

app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;
  res.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - entry.count)));

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: ERRORS.RATE_LIMITED });
  }

  next();
});

// ─── Body Parser ────────────────────────────────────────────────────────────────

app.use(express.json());

// ─── API Documentation ──────────────────────────────────────────────────────────

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── Static Assets ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ─── Health Check ───────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(STATUS.OK).json({ status: 'ok', uptime: process.uptime() });
});

// ─── API Routes ─────────────────────────────────────────────────────────────────

app.use(API_BASE, envelopeRoutes);
app.use(TRANSACTIONS_BASE, transactionRoutes);

// ─── 404 Catch-All ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(STATUS.NOT_FOUND).json({ error: 'Resource not found.' });
});

// ─── Global Error Handler ───────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.stack || err);
  res.status(STATUS.INTERNAL_ERROR).json({ error: 'Internal server error.' });
});

// ─── Start ──────────────────────────────────────────────────────────────────────

async function startServer() {
  if (!process.env.DATABASE_URL) {
    console.error('✖  DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  try {
    await initDatabase();
    console.log('✓  PostgreSQL connected and models synchronized.');
  } catch (err) {
    console.error('✖  Database initialization failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✦  Envelope Budget API listening on http://localhost:${PORT}`);
    console.log(`   Envelopes:    ${API_BASE}`);
    console.log(`   Transactions: ${TRANSACTIONS_BASE}`);
    console.log(`   Swagger:      /api-docs`);
    console.log(`   Health:       /health`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
