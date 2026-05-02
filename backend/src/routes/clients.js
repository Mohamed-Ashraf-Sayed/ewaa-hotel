const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient, lookupClient, importClients } = require('../controllers/clientController');
const { authenticate } = require('../middleware/auth');
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
router.get('/lookup', authenticate, lookupClient);
router.get('/:id', authenticate, getClient);
router.post('/', authenticate, sanitizeBody(['notes']), validateFields(clientRules), createClient);
router.post('/import', authenticate, importUpload.single('file'), importClients);
router.put('/:id', authenticate, sanitizeBody(['notes']), updateClient);
router.delete('/:id', authenticate, deleteClient);

module.exports = router;
