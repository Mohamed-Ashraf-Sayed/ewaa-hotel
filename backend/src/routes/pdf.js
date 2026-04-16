const express = require('express');
const router = express.Router();
const { generateQuote, generateClientReport } = require('../controllers/pdfController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/quote', authenticate, authorize('sales_rep', 'sales_director', 'general_manager', 'vice_gm'), generateQuote);
router.get('/client-report', authenticate, generateClientReport);

module.exports = router;
