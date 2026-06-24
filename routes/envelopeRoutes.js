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

router.post('/distribute', ctrl.distributeIncome);
router.post('/transfer/:fromId/:toId', ctrl.transferFunds);
router.post('/:id/fund', ctrl.addFunds);

router.get('/:id', ctrl.getEnvelopeById);
router.put('/:id', ctrl.updateEnvelope);
router.delete('/:id', ctrl.deleteEnvelope);

module.exports = router;
