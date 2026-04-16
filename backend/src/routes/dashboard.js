const express = require('express');
const router = express.Router();
const { getDashboard, getPulseReport } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getDashboard);
router.get('/pulse', authenticate, getPulseReport);

module.exports = router;
