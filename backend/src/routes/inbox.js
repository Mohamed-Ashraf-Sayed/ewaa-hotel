const express = require('express');
const router = express.Router();
const { list, getOne, markRead, markAllRead, pollNow } = require('../controllers/inboxController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, list);
router.get('/:id', authenticate, getOne);
router.put('/:id/read', authenticate, markRead);
router.put('/read-all', authenticate, markAllRead);
router.post('/poll-now', authenticate, authorize('admin', 'general_manager', 'vice_gm', 'reservations'), pollNow);

module.exports = router;
