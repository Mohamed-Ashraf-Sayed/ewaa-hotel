const express = require('express');
const router = express.Router();
const { getNotifications, markAllRead, markRead, generateNotifications } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getNotifications);
router.put('/read-all', authenticate, markAllRead);
router.put('/:id/read', authenticate, markRead);
router.post('/generate', authenticate, generateNotifications);

module.exports = router;
