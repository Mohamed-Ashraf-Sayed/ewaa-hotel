const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];

const getSubordinateIds = async (userId) => {
  const subs = await prisma.user.findMany({ where: { managerId: userId }, select: { id: true } });
  return subs.map(s => s.id);
};

// GET /tasks
const getTasks = async (req, res) => {
  try {
    const { status, priority, assigneeId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = parseInt(assigneeId);

    if (!ADMIN_ROLES.includes(req.user.role)) {
      if (req.user.role === 'assistant_sales' && req.user.managerId) {
        const teamIds = await getSubordinateIds(req.user.managerId);
        where.OR = [
          { assigneeId: { in: [req.user.managerId, ...teamIds] } },
          { createdById: req.user.id },
        ];
      } else if (req.user.role === 'sales_director') {
        const subIds = await getSubordinateIds(req.user.id);
        where.OR = [
          { assigneeId: { in: [req.user.id, ...subIds] } },
          { createdById: req.user.id },
        ];
      } else {
        where.assigneeId = req.user.id;
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
        contract: { select: { id: true, contractRef: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /tasks
const createTask = async (req, res) => {
  try {
    const { title, description, taskType, assigneeId, clientId, contractId, priority, dueDate } = req.body;
    if (!title || !assigneeId) {
      return res.status(400).json({ message: 'Title and assignee are required' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        taskType: taskType || 'general',
        assigneeId: parseInt(assigneeId),
        createdById: req.user.id,
        clientId: clientId ? parseInt(clientId) : null,
        contractId: contractId ? parseInt(contractId) : null,
        priority: priority || 'normal',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Send notification to assignee
    await prisma.notification.create({
      data: {
        userId: parseInt(assigneeId),
        type: 'task_assigned',
        title: 'مهمة جديدة',
        message: `${req.user.name} أسند إليك مهمة: ${title}`,
        link: '/tasks',
      },
    });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Map task type to visit type
const TASK_TO_VISIT_TYPE = {
  visit: 'in_person',
  call: 'phone',
  meeting: 'in_person',
  follow_up: 'phone',
};

// PUT /tasks/:id
const updateTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    // Once task is completed, lock it - only admins can reopen
    if (existing.status === 'completed' && !ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'لا يمكن تعديل مهمة مكتملة' });
    }

    const { status, priority, dueDate, title, description, completionNotes } = req.body;
    const data = {};
    if (status) {
      data.status = status;
      if (status === 'completed') data.completedAt = new Date();
    }
    if (priority) data.priority = priority;
    if (dueDate) data.dueDate = new Date(dueDate);
    if (title) data.title = title;
    if (description !== undefined) data.description = description;
    if (completionNotes !== undefined) data.completionNotes = completionNotes;

    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
      },
    });

    // Auto-create Visit/Activity when visit-type task is completed
    const becameCompleted = status === 'completed' && existing.status !== 'completed';
    if (becameCompleted && task.clientId && existing.taskType !== 'general' && !existing.generatedVisitId) {
      const visitType = TASK_TO_VISIT_TYPE[existing.taskType] || 'in_person';
      try {
        const visit = await prisma.visit.create({
          data: {
            clientId: task.clientId,
            salesRepId: task.assigneeId,
            visitDate: new Date(),
            visitType,
            purpose: existing.title,
            outcome: completionNotes || (req.body.completionNotes) || null,
            notes: existing.description || null,
          }
        });
        // Link visit back to task
        await prisma.task.update({
          where: { id: taskId },
          data: { generatedVisitId: visit.id }
        });
        // Activity log
        await prisma.activity.create({
          data: {
            clientId: task.clientId,
            userId: task.assigneeId,
            type: 'visit',
            description: `تم إنجاز مهمة "${existing.title}" — ${TASK_TO_VISIT_TYPE[existing.taskType] === 'phone' ? 'مكالمة' : 'زيارة'}${completionNotes ? ': ' + completionNotes : ''}`
          }
        });
      } catch (e) { console.error('Auto-visit error:', e.message); }
    }

    // Notify task creator when completed
    if (becameCompleted && existing.createdById !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: existing.createdById,
          type: 'general',
          title: 'تم إنجاز المهمة',
          message: `${req.user.name} أكمل مهمة: ${existing.title}`,
          link: '/tasks',
        }
      });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /tasks/:id
const deleteTask = async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
