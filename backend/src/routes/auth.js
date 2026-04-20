const express = require('express');
const router = express.Router();
const { login, getMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validateFields } = require('../middleware/validate');

const loginRules = {
  email: { required: true, type: 'email', label: 'البريد الإلكتروني' },
  password: { required: true, label: 'كلمة المرور', minLength: 1 },
};

router.post('/login', sanitizeBody(['password']), validateFields(loginRules), login);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, sanitizeBody(['currentPassword', 'newPassword']), changePassword);

module.exports = router;
