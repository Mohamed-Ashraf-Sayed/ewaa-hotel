const express = require('express');
const router = express.Router();
const { getContacts, getConversation, sendMessage, broadcast, getUnreadCount } = require('../controllers/messageController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/contacts', authenticate, getContacts);
router.get('/unread-count', authenticate, getUnreadCount);
router.get('/with/:userId', authenticate, getConversation);
router.post('/', authenticate, sendMessage);
router.post('/broadcast', authenticate, authorize('sales_director', 'general_manager', 'vice_gm', 'admin'), broadcast);

module.exports = router;
