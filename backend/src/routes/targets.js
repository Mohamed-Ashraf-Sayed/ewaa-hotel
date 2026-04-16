const express = require('express');
const router = express.Router();
const { getTargets, upsertTarget, deleteTarget, getTargetReport } = require('../controllers/targetController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getTargets);
router.get('/report', authenticate, getTargetReport);
router.post('/', authenticate, authorize('sales_director', 'general_manager', 'vice_gm'), upsertTarget);
router.delete('/:id', authenticate, authorize('sales_director', 'general_manager', 'vice_gm'), deleteTarget);

module.exports = router;
