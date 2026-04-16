const express = require('express');
const router = express.Router();
const { getPayments, createPayment, getPaymentSummary, deletePayment } = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getPayments);
router.get('/summary', authenticate, getPaymentSummary);
router.post('/', authenticate, createPayment);
router.delete('/:id', authenticate, authorize('general_manager', 'vice_gm', 'sales_director'), deletePayment);

module.exports = router;
