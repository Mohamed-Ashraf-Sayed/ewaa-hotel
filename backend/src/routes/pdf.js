const express = require('express');
const router = express.Router();
const {
  generateQuote, generateClientReport,
  generateContractsReport, generateVisitsReport, generatePaymentsReport,
  generatePaymentMethodsReport, generateTeamReport,
} = require('../controllers/pdfController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/quote', authenticate, authorize('sales_rep', 'sales_director', 'assistant_sales', 'general_manager', 'vice_gm'), generateQuote);
router.get('/client-report', authenticate, generateClientReport);
router.get('/contracts-report', authenticate, generateContractsReport);
router.get('/visits-report', authenticate, generateVisitsReport);
router.get('/payments-report', authenticate, generatePaymentsReport);
router.get('/payment-methods-report', authenticate, generatePaymentMethodsReport);
router.get('/team-report', authenticate, generateTeamReport);

module.exports = router;
