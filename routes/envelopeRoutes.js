/**
 * Envelope API Routes
 *
 * Decoupled from server configuration – this module registers only the
 * route-to-controller bindings on an Express Router instance.
 */

const { Router } = require('express');
const ctrl = require('../controllers/envelopeController');

const router = Router();

// ─── Resource Routes ───────────────────────────────────────────────────────────

router.post('/', ctrl.createEnvelope);
router.get('/', ctrl.getAllEnvelopes);
router.get('/:id', ctrl.getEnvelopeById);
router.put('/:id', ctrl.updateEnvelope);
router.delete('/:id', ctrl.deleteEnvelope);

// ─── Transfer Route ────────────────────────────────────────────────────────────

router.post('/transfer/:fromId/:toId', ctrl.transferFunds);

module.exports = router;
