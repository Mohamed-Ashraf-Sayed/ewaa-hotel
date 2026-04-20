require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

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

// Stricter limit on auth: 10 login attempts per 15 minutes
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { message: 'تم تجاوز محاولات تسجيل الدخول المسموح بها، حاول بعد 15 دقيقة' },
}));

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
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/email', require('./routes/email'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api', require('./routes/attachments'));

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
app.listen(PORT, () => console.log(`Hotel CRM running on port ${PORT}`));
