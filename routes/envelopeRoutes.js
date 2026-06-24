/**
 * Envelope API Routes
 *
 * Decoupled from server configuration – registers route-to-controller bindings
 * on an Express Router instance.
 */

const { Router } = require('express');
const ctrl = require('../controllers/envelopeController');

const router = Router();

router.post('/', ctrl.createEnvelope);
router.get('/', ctrl.getAllEnvelopes);

// Transfer must be registered before /:id to avoid route shadowing
router.post('/transfer/:fromId/:toId', ctrl.transferFunds);

router.get('/:id', ctrl.getEnvelopeById);
router.put('/:id', ctrl.updateEnvelope);
router.delete('/:id', ctrl.deleteEnvelope);

module.exports = router;
