const express = require('express');
const router = express.Router();
const { getTasks, getTaskCount, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getTasks);
router.get('/count', authenticate, getTaskCount);
router.post('/', authenticate, authorize('sales_director', 'general_manager', 'vice_gm'), createTask);
router.put('/:id', authenticate, updateTask);
router.delete('/:id', authenticate, authorize('sales_director', 'general_manager', 'vice_gm'), deleteTask);

module.exports = router;
