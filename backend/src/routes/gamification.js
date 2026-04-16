const express = require('express');
const router = express.Router();
const { getLeaderboard, ratePerformance } = require('../controllers/gamificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/leaderboard', authenticate, getLeaderboard);
router.post('/rate', authenticate, authorize('sales_director', 'general_manager', 'vice_gm'), ratePerformance);

module.exports = router;
