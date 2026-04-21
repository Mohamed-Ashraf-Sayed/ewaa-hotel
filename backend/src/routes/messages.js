const express = require('express');
const router = express.Router();
const { getContacts, getConversation, sendMessage, broadcast, getUnreadCount } = require('../controllers/messageController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/contacts', authenticate, getContacts);
router.get('/unread-count', authenticate, getUnreadCount);
router.get('/with/:userId', authenticate, getConversation);
router.post('/', authenticate, upload.single('attachment'), sendMessage);
router.post('/broadcast', authenticate, authorize('sales_director', 'general_manager', 'vice_gm', 'admin'), broadcast);

module.exports = router;
