const express = require('express');
const router = express.Router();
const { getTargets, upsertTarget, deleteTarget, getTargetReport } = require('../controllers/targetController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getTargets);
router.get('/report', authenticate, getTargetReport);
// assistant_sales can also set/delete targets for their team. The controller
// limits them to people inside the manager's scope so a deputy can't set a
// target on someone in a different team.
router.post('/', authenticate, authorize('sales_director', 'assistant_sales', 'general_manager', 'systems_info', 'vice_gm'), upsertTarget);
router.delete('/:id', authenticate, authorize('sales_director', 'assistant_sales', 'general_manager', 'systems_info', 'vice_gm'), deleteTarget);

module.exports = router;
