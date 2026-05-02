const express = require('express');
const router = express.Router();
const {
  getPayments, createPayment, approvePayment, rejectPayment,
  getPaymentSummary, deletePayment,
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getPayments);
router.get('/summary', authenticate, getPaymentSummary);
router.post('/', authenticate, upload.single('receipt'), createPayment);
router.post('/:id/approve', authenticate, authorize('admin', 'general_manager', 'vice_gm', 'credit_manager'), approvePayment);
router.post('/:id/reject', authenticate, authorize('admin', 'general_manager', 'vice_gm', 'credit_manager'), rejectPayment);
router.delete('/:id', authenticate, authorize('general_manager', 'vice_gm', 'sales_director'), deletePayment);

module.exports = router;
