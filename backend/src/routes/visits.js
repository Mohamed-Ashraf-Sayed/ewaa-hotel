const express = require('express');
const router = express.Router();
const { getVisits, createVisit, updateVisit, getUpcomingFollowUps } = require('../controllers/visitController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getVisits);
router.get('/follow-ups', authenticate, getUpcomingFollowUps);
router.post('/', authenticate, createVisit);
router.put('/:id', authenticate, updateVisit);

module.exports = router;
