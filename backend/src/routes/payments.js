const express = require('express');
const router = express.Router();
const { getPayments, createPayment, getPaymentSummary, deletePayment } = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getPayments);
router.get('/summary', authenticate, getPaymentSummary);
router.post('/', authenticate, upload.single('receipt'), createPayment);
router.delete('/:id', authenticate, authorize('general_manager', 'vice_gm', 'sales_director'), deletePayment);

module.exports = router;
