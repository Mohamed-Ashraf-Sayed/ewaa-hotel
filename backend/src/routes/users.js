const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, resetPassword, getOrgChart, updateCommissionRate } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getUsers);
router.get('/org-chart', authenticate, getOrgChart);
router.post('/', authenticate, authorize('general_manager', 'vice_gm'), createUser);
router.put('/:id', authenticate, authorize('general_manager', 'vice_gm'), updateUser);
router.put('/:id/reset-password', authenticate, authorize('general_manager', 'vice_gm'), resetPassword);
router.put('/:id/commission', authenticate, authorize('general_manager'), updateCommissionRate);

module.exports = router;
