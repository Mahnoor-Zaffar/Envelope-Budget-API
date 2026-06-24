/**
 * Transaction API Routes
 */

const { Router } = require('express');
const ctrl = require('../controllers/transactionController');

const router = Router();

router.post('/', ctrl.createTransaction);
router.get('/', ctrl.getAllTransactions);
router.get('/:id', ctrl.getTransactionById);
router.put('/:id', ctrl.updateTransaction);
router.delete('/:id', ctrl.deleteTransaction);

module.exports = router;
