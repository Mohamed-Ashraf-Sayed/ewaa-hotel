const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient, lookupClient, importClients } = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/auth');
const { sanitizeBody, validateFields } = require('../middleware/validate');

// In-memory upload for bulk import (xlsx/csv parsed in controller, not saved to disk)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().match(/\.(xlsx|xls|csv)$/);
    if (ext) cb(null, true);
    else cb(new Error('Only .xlsx, .xls, or .csv files are allowed'));
  },
});

// Lead clients are skeleton records — company name, type and PHONE are the
// only required fields, everything else is optional. Active clients still
// need the full set (email/industry/source) so the corporate account record
// is complete before any contract or booking flow. Phone is required in
// both modes so every client is reachable.
const fullClientRules = {
  companyName: { required: true, type: 'name', label: 'اسم الشركة', minLength: 2, maxLength: 200 },
  contactPerson: { required: true, type: 'name', label: 'جهة الاتصال', minLength: 2, maxLength: 100 },
  phone: { required: true, type: 'phone', label: 'الهاتف' },
  email: { required: true, type: 'email', label: 'البريد الإلكتروني' },
  industry: { required: true, type: 'name', label: 'القطاع' },
  clientType: { required: true, label: 'النوع' },
  source: { required: true, label: 'مصدر العميل' },
};
const leadClientRules = {
  companyName: { required: true, type: 'name', label: 'اسم الشركة', minLength: 2, maxLength: 200 },
  contactPerson: { required: false, type: 'name', label: 'جهة الاتصال', minLength: 2, maxLength: 100 },
  phone: { required: true, type: 'phone', label: 'الهاتف' },
  email: { required: false, type: 'email', label: 'البريد الإلكتروني' },
  industry: { required: false, type: 'name', label: 'القطاع' },
  clientType: { required: true, label: 'النوع' },
  source: { required: false, label: 'مصدر العميل' },
};
const validateClient = (req, res, next) => {
  const isLead = String(req.body.clientType || '').toLowerCase() === 'lead';
  return validateFields(isLead ? leadClientRules : fullClientRules)(req, res, next);
};

router.get('/', authenticate, getClients);
router.get('/lookup', authenticate, lookupClient);
router.get('/:id', authenticate, getClient);
router.post('/', authenticate, sanitizeBody(['notes']), validateClient, createClient);
router.post('/import', authenticate, importUpload.single('file'), importClients);
router.put('/:id', authenticate, sanitizeBody(['notes']), updateClient);
// Soft-delete (archive) — restricted to admin / GM / vice GM / systems_info.
// Lower roles can never archive a client to avoid accidental data loss; if a
// sales_rep wants a client removed they have to escalate.
router.delete('/:id', authenticate, authorize('admin', 'general_manager', 'vice_gm', 'systems_info'), deleteClient);

module.exports = router;
