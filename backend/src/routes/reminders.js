const express = require('express');
const router = express.Router();
const { getReminders, createReminder, updateReminder, deleteReminder, checkDueReminders } = require('../controllers/reminderController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getReminders);
router.post('/', authenticate, createReminder);
router.post('/check', authenticate, checkDueReminders);
router.put('/:id', authenticate, updateReminder);
router.delete('/:id', authenticate, deleteReminder);

module.exports = router;
