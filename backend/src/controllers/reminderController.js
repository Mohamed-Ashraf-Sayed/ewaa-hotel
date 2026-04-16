const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /reminders — get user's reminders (optionally filter by month/year)
const getReminders = async (req, res) => {
  try {
    const { month, year, upcoming } = req.query;
    const where = { userId: req.user.id };

    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.reminderDate = { gte: start, lte: end };
    }

    if (upcoming === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      where.reminderDate = { gte: today, lte: nextWeek };
      where.isCompleted = false;
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
      },
      orderBy: { reminderDate: 'asc' },
    });

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /reminders
const createReminder = async (req, res) => {
  try {
    const { title, description, reminderDate, reminderTime, type, clientId } = req.body;
    if (!title || !reminderDate) {
      return res.status(400).json({ message: 'title and reminderDate are required' });
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: req.user.id,
        clientId: clientId ? parseInt(clientId) : null,
        title,
        description: description || null,
        reminderDate: new Date(reminderDate),
        reminderTime: reminderTime || null,
        type: type || 'general',
      },
      include: { client: { select: { id: true, companyName: true } } },
    });

    res.json(reminder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /reminders/:id
const updateReminder = async (req, res) => {
  try {
    const { isCompleted, title, description, reminderDate, reminderTime, type } = req.body;
    const data = {};
    if (isCompleted !== undefined) data.isCompleted = isCompleted;
    if (title) data.title = title;
    if (description !== undefined) data.description = description;
    if (reminderDate) data.reminderDate = new Date(reminderDate);
    if (reminderTime !== undefined) data.reminderTime = reminderTime;
    if (type) data.type = type;

    const reminder = await prisma.reminder.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: { client: { select: { id: true, companyName: true } } },
    });
    res.json(reminder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /reminders/:id
const deleteReminder = async (req, res) => {
  try {
    await prisma.reminder.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /reminders/check — check and send notifications for due reminders
const checkDueReminders = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const dueReminders = await prisma.reminder.findMany({
      where: {
        reminderDate: { gte: todayStart, lte: todayEnd },
        isCompleted: false,
        notified: false,
      },
      include: { client: true, user: true },
    });

    const typeLabels = {
      call: 'مكالمة', visit: 'زيارة', meeting: 'اجتماع',
      follow_up: 'متابعة', general: 'تذكير',
    };

    let count = 0;
    for (const r of dueReminders) {
      await prisma.notification.create({
        data: {
          userId: r.userId,
          type: 'general',
          title: `تذكير: ${typeLabels[r.type] || r.type}`,
          message: `${r.title}${r.client ? ' — ' + r.client.companyName : ''}${r.reminderTime ? ' الساعة ' + r.reminderTime : ''}`,
          link: r.clientId ? `/clients/${r.clientId}` : '/calendar',
        },
      });
      await prisma.reminder.update({
        where: { id: r.id },
        data: { notified: true },
      });
      count++;
    }

    res.json({ message: `Sent ${count} reminder notifications` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getReminders, createReminder, updateReminder, deleteReminder, checkDueReminders };
