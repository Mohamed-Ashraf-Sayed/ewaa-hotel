require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
app.set('trust proxy', 1);

// === Security Headers ===
app.use(helmet({
  contentSecurityPolicy: false, // disabled for SPA
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// === Rate Limiting ===
// Global limit: 300 requests per minute per IP
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم تجاوز الحد المسموح به من الطلبات، حاول مرة أخرى بعد قليل' },
}));

// Login rate limit disabled during training phase

// === CORS ===
app.use(cors({ origin: true, credentials: true }));

// === Body Parsers (with size limits) ===
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/hotels', require('./routes/hotels'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/targets', require('./routes/targets'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/email', require('./routes/email'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/local-events', require('./routes/localEvents'));
app.use('/api', require('./routes/attachments'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/inbox', require('./routes/inbox'));
app.use('/api/imap-accounts', require('./routes/imapAccounts'));
app.use('/api/ai', require('./routes/aiQuery'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/promotions', require('./routes/promotions'));

// === OTA Bookings (ported from ewaa-bookings) — analytics + email ingest ===
// Mounted under /api/ota so the existing /api/hotels and /api/bookings routes
// (corporate / Opera flow) stay untouched. Role-gated to the 4 roles that
// own the OTA workflow: admin (مدير النظام), reservations (يوزر الحجوزات),
// general_manager (المدير العام), vice_gm (نائب المدير). Same list is used
// by the UI tabs in Bookings.tsx so the API matches the visible affordance.
const { authenticate, authorize } = require('./middleware/auth');
const otaRoles = ['admin', 'general_manager', 'vice_gm', 'reservations'];
app.use('/api/ota/analytics',    authenticate, authorize(...otaRoles), require('./ota/routes/analytics'));
app.use('/api/ota/hotels',       authenticate, authorize(...otaRoles), require('./ota/routes/hotels'));
app.use('/api/ota/reservations', authenticate, authorize(...otaRoles), require('./ota/routes/reservations'));
app.use('/api/ota/settings',     authenticate, authorize(...otaRoles), require('./ota/routes/settings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve frontend in production
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

const PORT = process.env.PORT || 3001;

// HTTPS support: if certs/server.key + certs/server.crt exist next to the
// app, listen over TLS on PORT. Otherwise fall back to plain HTTP (dev /
// pre-cert deploys). Generate certs with `node scripts/generate-cert.js`.
const certDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certDir, 'server.key');
const crtPath = path.join(certDir, 'server.crt');
const hasCerts = fs.existsSync(keyPath) && fs.existsSync(crtPath);

const startJobs = () => {
  require('./jobs/taskOverdueChecker').startTaskOverdueChecker();
  require('./jobs/holidaySync').startHolidaySync();
  require('./jobs/inboxPoll').startInboxPoll();
  // OTA inbox poller — pulls Booking.com / Expedia / Agoda / Almosafer
  // reservation emails on a configurable interval (default 120s). Reads
  // the active OtaImapAccount from the DB; if none is configured the
  // scheduler just no-ops on each tick.
  require('./ota/worker/scheduler').start().catch((e) => {
    console.error('[ota-scheduler] failed to start:', e.message);
  });
};

if (hasCerts) {
  const credentials = {
    key:  fs.readFileSync(keyPath),
    cert: fs.readFileSync(crtPath),
  };
  https.createServer(credentials, app).listen(PORT, () => {
    console.log(`Hotel CRM running on HTTPS port ${PORT}`);
    startJobs();
  });
} else {
  http.createServer(app).listen(PORT, () => {
    console.log(`Hotel CRM running on HTTP port ${PORT} (no certs found in ${certDir})`);
    startJobs();
  });
}
