const express = require('express');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validateFields } = require('../middleware/validate');

const clientRules = {
  companyName: { required: true, type: 'name', label: 'اسم الشركة', minLength: 2, maxLength: 200 },
  contactPerson: { required: true, type: 'name', label: 'جهة الاتصال', minLength: 2, maxLength: 100 },
  phone: { required: true, type: 'phone', label: 'الهاتف' },
  email: { required: true, type: 'email', label: 'البريد الإلكتروني' },
  industry: { required: true, type: 'name', label: 'القطاع' },
  clientType: { required: true, label: 'النوع' },
  source: { required: true, label: 'مصدر العميل' },
};

router.get('/', authenticate, getClients);
router.get('/:id', authenticate, getClient);
router.post('/', authenticate, sanitizeBody(['notes']), validateFields(clientRules), createClient);
router.put('/:id', authenticate, sanitizeBody(['notes']), updateClient);
router.delete('/:id', authenticate, deleteClient);

module.exports = router;
