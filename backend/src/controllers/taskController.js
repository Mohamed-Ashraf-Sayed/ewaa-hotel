const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['general_manager', 'vice_gm'];

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
      if (req.user.role === 'sales_director') {
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
    const { title, description, assigneeId, clientId, contractId, priority, dueDate } = req.body;
    if (!title || !assigneeId) {
      return res.status(400).json({ message: 'Title and assignee are required' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
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

// PUT /tasks/:id
const updateTask = async (req, res) => {
  try {
    const { status, priority, dueDate, title, description } = req.body;
    const data = {};
    if (status) {
      data.status = status;
      if (status === 'completed') data.completedAt = new Date();
    }
    if (priority) data.priority = priority;
    if (dueDate) data.dueDate = new Date(dueDate);
    if (title) data.title = title;
    if (description !== undefined) data.description = description;

    const task = await prisma.task.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
      },
    });

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
