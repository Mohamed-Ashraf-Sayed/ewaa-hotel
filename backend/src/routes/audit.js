const express = require('express');
const router = express.Router();
const { getAuditLog } = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin-level only — the audit log surfaces every user's actions.
router.get('/', authenticate, authorize('admin', 'general_manager', 'systems_info', 'vice_gm'), getAuditLog);

module.exports = router;
