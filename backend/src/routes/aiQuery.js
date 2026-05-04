const express = require('express');
const router = express.Router();
const { ask } = require('../controllers/aiQueryController');
const { authenticate } = require('../middleware/auth');

router.post('/ask', authenticate, ask);

module.exports = router;
