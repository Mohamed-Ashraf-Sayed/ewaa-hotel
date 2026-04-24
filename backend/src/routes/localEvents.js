const express = require('express');
const router = express.Router();
const {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  triggerSync,
} = require('../controllers/localEventController');
const { authenticate, authorize } = require('../middleware/auth');

const MANAGER_ROLES = ['general_manager', 'vice_gm', 'sales_director'];

router.get('/', authenticate, getEvents);
router.post('/', authenticate, authorize(...MANAGER_ROLES), createEvent);
router.post('/sync', authenticate, authorize(...MANAGER_ROLES), triggerSync);
router.put('/:id', authenticate, authorize(...MANAGER_ROLES), updateEvent);
router.delete('/:id', authenticate, authorize(...MANAGER_ROLES), deleteEvent);

module.exports = router;
