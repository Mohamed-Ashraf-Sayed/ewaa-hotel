const express = require('express');
const router = express.Router();
const { getActivities, createActivity } = require('../controllers/activityController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getActivities);
router.post('/', authenticate, createActivity);

module.exports = router;
