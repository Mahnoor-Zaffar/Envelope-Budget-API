/**
 * Server Entry Point
 *
 * Bootstraps the Express application:
 *  1. Registers JSON body-parsing middleware.
 *  2. Serves static assets from /public.
 *  3. Mounts the /envelopes API router.
 *  4. Provides a health-check endpoint at GET /.
 *  5. Catches unmatched routes with a 404 handler.
 *  6. Global error handler for unexpected failures.
 */

const path = require('path');
const express = require('express');
const { PORT, API_BASE, STATUS } = require('./config/constants');
const envelopeRoutes = require('./routes/envelopeRoutes');

const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────────────

app.use(express.json());

// ─── Static Assets ─────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ─── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(STATUS.OK).json({ status: 'ok', uptime: process.uptime() });
});

// ─── API Routes ────────────────────────────────────────────────────────────────

app.use(API_BASE, envelopeRoutes);

// ─── 404 Catch-All ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(STATUS.NOT_FOUND).json({ error: 'Resource not found.' });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.stack || err);
  res.status(STATUS.INTERNAL_ERROR).json({ error: 'Internal server error.' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✦  Envelope Budget API listening on http://localhost:${PORT}`);
  console.log(`   API base: ${API_BASE}`);
  console.log(`   Static:   /public`);
});

module.exports = app; // Exported for testing
