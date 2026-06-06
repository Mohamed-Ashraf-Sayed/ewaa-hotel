const express = require('express');
const router = express.Router();
const { getTasks, getTaskCount, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getTasks);
router.get('/count', authenticate, getTaskCount);
// assistant_sales (deputy of a sales_director) can also create/delete tasks
// for their team. The controller enforces team-scope so a deputy can't
// assign tasks to people outside the manager's team.
router.post('/', authenticate, authorize('sales_director', 'assistant_sales', 'general_manager', 'systems_info', 'vice_gm'), createTask);
router.put('/:id', authenticate, updateTask);
router.delete('/:id', authenticate, authorize('sales_director', 'assistant_sales', 'general_manager', 'systems_info', 'vice_gm'), deleteTask);

module.exports = router;
