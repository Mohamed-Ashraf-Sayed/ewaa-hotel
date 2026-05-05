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

// ──────────────────────── Security layers ────────────────────────
//
// Per-IP rate limits stop crude bot attacks before they reach the controller.
// These complement the per-record / per-email checks inside the controllers
// (OTP record's `attempts` counter, email cooldown), which protect against
// distributed attempts that route around a single IP.

// OTP request: tight cap to slow email-enumeration & spam from one IP.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم تجاوز الحد المسموح به، حاول بعد قليل' },
});

// OTP verify: tighter still — guessing a 6-digit code from one IP is a
// classic brute-force vector. 20 attempts per 15 min per IP.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'محاولات كثيرة. اطلب كودًا جديدًا وأعد المحاولة بعد قليل' },
});

// Booking creation per IP — caps spam from one source. Per-client cap is
// applied inside requestBooking based on req.client.id.
const bookingCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,    // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'لقد تجاوزت الحد المسموح به من الطلبات لهذه الساعة' },
});

// Generic read limiter for authenticated endpoints — prevents API scraping.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,                     // 2 reads/sec on average
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم تجاوز الحد المسموح به من الطلبات' },
});

// === Auth (public) ===
router.post('/auth/request-otp', otpRequestLimiter, requestOtp);
router.post('/auth/verify-otp',  otpVerifyLimiter,  verifyOtp);

// === Authenticated portal endpoints ===
router.get('/me',              portalAuth, readLimiter, getMe);
router.get('/hotels',          portalAuth, readLimiter, getHotels);
router.get('/contracts',       portalAuth, readLimiter, getContracts);
router.get('/account-summary', portalAuth, readLimiter, getAccountSummary);
router.get('/statement.pdf',   portalAuth, readLimiter, getStatementPdf);
router.get('/bookings',        portalAuth, readLimiter, getMyBookings);
router.get('/bookings/:id',    portalAuth, readLimiter, getMyBooking);
router.post('/bookings',       portalAuth, bookingCreateLimiter, requestBooking);

module.exports = router;
