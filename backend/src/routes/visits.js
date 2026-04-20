const express = require('express');
const router = express.Router();
const { getVisits, createVisit, updateVisit, getUpcomingFollowUps } = require('../controllers/visitController');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validateFields } = require('../middleware/validate');

const visitRules = {
  clientId: { required: true, label: 'العميل' },
  visitDate: { required: true, label: 'تاريخ الزيارة' },
  visitType: { required: true, label: 'نوع الزيارة' },
  purpose: { required: true, label: 'الغرض', minLength: 2, maxLength: 500 },
};

router.get('/', authenticate, getVisits);
router.get('/follow-ups', authenticate, getUpcomingFollowUps);
router.post('/', authenticate, sanitizeBody(['notes', 'outcome', 'purpose']), validateFields(visitRules), createVisit);
router.put('/:id', authenticate, sanitizeBody(['notes', 'outcome', 'purpose']), updateVisit);

module.exports = router;
