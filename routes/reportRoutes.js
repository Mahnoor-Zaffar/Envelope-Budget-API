const { Router } = require('express');
const ctrl = require('../controllers/reportController');

const router = Router();

router.get('/monthly', ctrl.getMonthlyReport);

module.exports = router;
