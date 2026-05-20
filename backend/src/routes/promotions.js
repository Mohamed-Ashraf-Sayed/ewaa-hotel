const express = require('express');
const router = express.Router();
const {
  getActivePromotions,
  getAllPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
} = require('../controllers/promotionController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const MANAGE_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm', 'marketing_manager'];

// Active promos for the logged-in user's dashboard banner
router.get('/active', authenticate, getActivePromotions);

// Management endpoints — restricted
router.get('/', authenticate, authorize(...MANAGE_ROLES), getAllPromotions);
router.get('/:id', authenticate, authorize(...MANAGE_ROLES), getPromotion);
router.post('/', authenticate, authorize(...MANAGE_ROLES), upload.single('image'), createPromotion);
router.put('/:id', authenticate, authorize(...MANAGE_ROLES), upload.single('image'), updatePromotion);
router.delete('/:id', authenticate, authorize(...MANAGE_ROLES), deletePromotion);

module.exports = router;
