const express = require('express');
const router = express.Router();
const {
  getBookings,
  getBooking,
  getClientBookings,
  createBooking,
  updateBooking,
  updateStatus,
  deleteBooking,
  extractFromLetter,
  getBookingHistory,
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const RES_ROLES = ['reservations', 'general_manager', 'vice_gm', 'admin'];

router.get('/', authenticate, getBookings);
router.get('/client/:clientId', authenticate, getClientBookings);
router.get('/:id/history', authenticate, getBookingHistory);
router.get('/:id', authenticate, getBooking);

router.post('/extract', authenticate, authorize(...RES_ROLES), upload.single('file'), extractFromLetter);
router.post('/', authenticate, authorize(...RES_ROLES), upload.single('confirmationLetter'), createBooking);
router.put('/:id', authenticate, authorize(...RES_ROLES), upload.single('confirmationLetter'), updateBooking);
router.put('/:id/status', authenticate, authorize(...RES_ROLES), updateStatus);
router.delete('/:id', authenticate, authorize('admin', 'general_manager'), deleteBooking);

module.exports = router;
