const express = require('express');
const router = express.Router();
const { getSmtpSettings, saveSmtpSettings, testSmtp, sendEmail, getEmailLogs } = require('../controllers/emailController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/smtp-settings', authenticate, getSmtpSettings);
router.put('/smtp-settings', authenticate, saveSmtpSettings);
router.post('/test', authenticate, testSmtp);
router.post('/send', authenticate, upload.array('attachments', 5), sendEmail);
router.get('/logs', authenticate, getEmailLogs);

module.exports = router;
