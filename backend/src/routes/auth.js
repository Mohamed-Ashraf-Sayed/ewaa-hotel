const express = require('express');
const router = express.Router();
const {
  login, getMe, changePassword,
  forgotPassword, verifyResetCode, resetPassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validateFields } = require('../middleware/validate');

const loginRules = {
  email: { required: true, type: 'email', label: 'البريد الإلكتروني' },
  password: { required: true, label: 'كلمة المرور', minLength: 1 },
};
const forgotRules = { email: { required: true, type: 'email', label: 'البريد الإلكتروني' } };
const verifyRules = {
  email: { required: true, type: 'email', label: 'البريد الإلكتروني' },
  code:  { required: true, label: 'كود التحقق' },
};

router.post('/login', sanitizeBody(['password']), validateFields(loginRules), login);
router.post('/forgot-password', validateFields(forgotRules), forgotPassword);
router.post('/verify-reset-code', validateFields(verifyRules), verifyResetCode);
router.post('/reset-password', sanitizeBody(['newPassword', 'resetToken']), resetPassword);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, sanitizeBody(['currentPassword', 'newPassword']), changePassword);

module.exports = router;
