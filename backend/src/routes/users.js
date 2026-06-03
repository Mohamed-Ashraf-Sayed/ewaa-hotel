const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, resetPassword, getOrgChart, updateCommissionRate, transferClients } = require('../controllers/userController');
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
// User management is open to admin + systems_info (IT). Both are IT-side
// roles, so they can add/edit/disable team accounts. GM and VGM are
// intentionally NOT included — they manage people, not system accounts.
router.post('/', authenticate, authorize('admin', 'systems_info'), sanitizeBody(['password']), validateFields(userRules), createUser);
router.put('/:id', authenticate, authorize('admin', 'systems_info'), sanitizeBody(['password']), updateUser);
router.put('/:id/reset-password', authenticate, authorize('admin', 'systems_info'), sanitizeBody(['newPassword']), validateFields(passwordRules), resetPassword);
router.put('/:id/commission', authenticate, authorize('admin', 'systems_info'), updateCommissionRate);
// Transfer all active clients from one rep to another (handover when an
// employee leaves). Admin-only — same auth tier as user management.
router.post('/:id/transfer-clients', authenticate, authorize('admin', 'general_manager', 'systems_info', 'vice_gm'), transferClients);

module.exports = router;
