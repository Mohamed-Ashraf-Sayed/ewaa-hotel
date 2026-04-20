const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, resetPassword, getOrgChart, updateCommissionRate } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { sanitizeBody, validateFields } = require('../middleware/validate');

const userRules = {
  name: { required: true, type: 'name', label: 'الاسم', minLength: 2, maxLength: 100 },
  email: { required: true, type: 'email', label: 'البريد الإلكتروني' },
  password: { required: true, label: 'كلمة المرور', minLength: 6, maxLength: 100 },
  role: { required: true, label: 'الدور' },
};

const passwordRules = {
  newPassword: { required: true, label: 'كلمة المرور الجديدة', minLength: 6, maxLength: 100 },
};

router.get('/', authenticate, getUsers);
router.get('/org-chart', authenticate, getOrgChart);
router.post('/', authenticate, authorize('general_manager', 'vice_gm'), sanitizeBody(['password']), validateFields(userRules), createUser);
router.put('/:id', authenticate, authorize('general_manager', 'vice_gm'), sanitizeBody(['password']), updateUser);
router.put('/:id/reset-password', authenticate, authorize('general_manager', 'vice_gm'), sanitizeBody(['newPassword']), validateFields(passwordRules), resetPassword);
router.put('/:id/commission', authenticate, authorize('general_manager'), updateCommissionRate);

module.exports = router;
