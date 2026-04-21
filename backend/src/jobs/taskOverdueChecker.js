const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

const checkOverdueTasks = async () => {
  try {
    const now = new Date();
    const overdue = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { not: 'completed' },
        overdueNotified: false,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
      },
    });

    for (const task of overdue) {
      // Notify the creator (manager) that their assignee missed the deadline
      if (task.createdById && task.createdById !== task.assigneeId) {
        const clientPart = task.client ? ` (عميل: ${task.client.companyName})` : '';
        await prisma.notification.create({
          data: {
            userId: task.createdById,
            type: 'task_overdue',
            title: 'مهمة متأخرة — لم يتم تنفيذها',
            message: `المندوب ${task.assignee.name} لم ينفذ المهمة "${task.title}"${clientPart} بحلول الموعد المحدد`,
            link: '/tasks',
          },
        });
      }
      // Also let the assignee know the deadline has passed
      await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'task_overdue',
          title: 'مهمة تجاوزت الموعد',
          message: `لم يتم تنفيذ المهمة "${task.title}" بحلول الموعد المحدد`,
          link: '/tasks',
        },
      });

      await prisma.task.update({
        where: { id: task.id },
        data: { overdueNotified: true },
      });
    }

    if (overdue.length > 0) {
      console.log(`[TaskOverdueChecker] Notified ${overdue.length} overdue task(s)`);
    }
  } catch (err) {
    console.error('[TaskOverdueChecker] Error:', err.message);
  }
};

const startTaskOverdueChecker = () => {
  // Run once on startup, then every interval
  checkOverdueTasks();
  setInterval(checkOverdueTasks, CHECK_INTERVAL_MS);
  console.log(`[TaskOverdueChecker] Started (interval: ${CHECK_INTERVAL_MS / 1000}s)`);
};

module.exports = { startTaskOverdueChecker, checkOverdueTasks };
