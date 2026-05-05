const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  requestOtp,
  verifyOtp,
  getMe,
  getHotels,
  getContracts,
  getMyBookings,
  getMyBooking,
  requestBooking,
  getAccountSummary,
} = require('../controllers/portalController');
const { getStatementPdf } = require('../controllers/portalStatementPdf');
const { portalAuth } = require('../middleware/portalAuth');

// Tight rate-limit on OTP request to slow down enumeration / spam
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم تجاوز الحد المسموح به، حاول بعد قليل' },
});

// === Auth (public) ===
router.post('/auth/request-otp', otpLimiter, requestOtp);
router.post('/auth/verify-otp', verifyOtp);

// === Authenticated portal endpoints ===
router.get('/me', portalAuth, getMe);
router.get('/hotels', portalAuth, getHotels);
router.get('/contracts', portalAuth, getContracts);
router.get('/account-summary', portalAuth, getAccountSummary);
router.get('/statement.pdf', portalAuth, getStatementPdf);
router.get('/bookings', portalAuth, getMyBookings);
router.get('/bookings/:id', portalAuth, getMyBooking);
router.post('/bookings', portalAuth, requestBooking);

module.exports = router;
