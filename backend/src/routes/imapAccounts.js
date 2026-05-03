const express = require('express');
const router = express.Router();
const { list, getOne, create, update, remove, testConnection, pollNow } = require('../controllers/imapAccountController');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN = ['admin', 'general_manager', 'vice_gm'];

router.get('/', authenticate, authorize(...ADMIN), list);
router.post('/poll-now', authenticate, authorize(...ADMIN, 'reservations'), pollNow);
router.get('/:id', authenticate, authorize(...ADMIN), getOne);
router.post('/', authenticate, authorize(...ADMIN), create);
router.put('/:id', authenticate, authorize(...ADMIN), update);
router.delete('/:id', authenticate, authorize(...ADMIN), remove);
router.post('/:id/test', authenticate, authorize(...ADMIN), testConnection);

module.exports = router;
