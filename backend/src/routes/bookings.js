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
  confirmPendingRequest,
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const RES_ROLES = ['reservations', 'general_manager', 'systems_info', 'vice_gm', 'admin'];

router.get('/', authenticate, getBookings);
router.get('/client/:clientId', authenticate, getClientBookings);
router.get('/:id/history', authenticate, getBookingHistory);
router.get('/:id', authenticate, getBooking);

router.post('/extract', authenticate, authorize(...RES_ROLES), upload.single('file'), extractFromLetter);
router.post('/', authenticate, authorize(...RES_ROLES), upload.single('confirmationLetter'), createBooking);
router.put('/:id', authenticate, authorize(...RES_ROLES), upload.single('confirmationLetter'), updateBooking);
router.put('/:id/status', authenticate, authorize(...RES_ROLES), updateStatus);
router.post('/:id/confirm-request', authenticate, authorize(...RES_ROLES), upload.single('confirmationLetter'), confirmPendingRequest);
router.delete('/:id', authenticate, authorize('admin', 'general_manager', 'systems_info'), deleteBooking);

module.exports = router;
