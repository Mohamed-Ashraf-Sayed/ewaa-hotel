const express = require('express');
const router = express.Router();
const { getAuditLog } = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

// Restricted to the IT admin role — the audit log exposes every user's
// activity, so it stays with whoever owns the system, not GM/VGM/IT-info.
router.get('/', authenticate, authorize('admin'), getAuditLog);

module.exports = router;
