const express = require('express');
const router = express.Router();
const { getContracts, getContract, uploadContract, approveContract, confirmBooking, getExpiringContracts, downloadContract } = require('../controllers/contractController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getContracts);
router.get('/expiring', authenticate, getExpiringContracts);
router.get('/:id', authenticate, getContract);
router.get('/:id/download', authenticate, downloadContract);
router.post('/', authenticate, authorize('sales_rep', 'sales_director', 'assistant_sales'), upload.single('file'), uploadContract);
router.put('/:id/approve', authenticate, authorize('sales_director', 'credit_manager', 'contract_officer', 'vice_gm', 'general_manager'), approveContract);
router.put('/:id/confirm-booking', authenticate, authorize('reservations', 'general_manager', 'vice_gm'), upload.single('confirmationLetter'), confirmBooking);

module.exports = router;
