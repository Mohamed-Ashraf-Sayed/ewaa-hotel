const express = require('express');
const router = express.Router();
const { getContracts, getContract, uploadContract, approveContract, getExpiringContracts, downloadContract } = require('../controllers/contractController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getContracts);
router.get('/expiring', authenticate, getExpiringContracts);
router.get('/:id', authenticate, getContract);
router.get('/:id/download', authenticate, downloadContract);
router.post('/', authenticate, authorize('sales_rep', 'sales_director'), upload.single('file'), uploadContract);
router.put('/:id/approve', authenticate, authorize('sales_director', 'contract_officer', 'credit_manager', 'general_manager', 'vice_gm'), approveContract);

module.exports = router;
