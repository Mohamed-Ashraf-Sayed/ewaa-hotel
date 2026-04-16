const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /notifications/:id/read
const markRead = async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { isRead: true },
    });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /notifications/generate — auto-generate notifications (called periodically or on-demand)
const generateNotifications = async (req, res) => {
  try {
    const created = [];

    // 1. Contracts expiring in 30 days — notify sales rep
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const expiringContracts = await prisma.contract.findMany({
      where: {
        status: 'approved',
        endDate: { lte: soon, gte: new Date() },
      },
      include: { client: true, salesRep: true },
    });

    for (const c of expiringContracts) {
      const days = Math.ceil((new Date(c.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      const exists = await prisma.notification.findFirst({
        where: {
          userId: c.salesRepId,
          type: 'contract_expiring',
          message: { contains: c.contractRef || `#${c.id}` },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      if (!exists) {
        const n = await prisma.notification.create({
          data: {
            userId: c.salesRepId,
            type: 'contract_expiring',
            title: 'عقد يقترب من الانتهاء',
            message: `عقد ${c.contractRef || '#' + c.id} لشركة ${c.client.companyName} ينتهي خلال ${days} يوم`,
            link: `/clients/${c.clientId}`,
          },
        });
        created.push(n);
      }
    }

    // 2. Pending contracts — notify contract officers
    const pendingContracts = await prisma.contract.findMany({
      where: { status: 'pending' },
      include: { client: true },
    });
    const officers = await prisma.user.findMany({
      where: { role: 'contract_officer', isActive: true },
    });

    for (const c of pendingContracts) {
      for (const officer of officers) {
        const exists = await prisma.notification.findFirst({
          where: {
            userId: officer.id,
            type: 'pending_approval',
            message: { contains: c.contractRef || `#${c.id}` },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
        if (!exists) {
          const n = await prisma.notification.create({
            data: {
              userId: officer.id,
              type: 'pending_approval',
              title: 'عقد جديد ينتظر الموافقة',
              message: `عقد ${c.contractRef || '#' + c.id} لشركة ${c.client.companyName} بانتظار مراجعتك`,
              link: `/contracts`,
            },
          });
          created.push(n);
        }
      }
    }

    // 3. Clients not visited in 30 days — notify sales rep
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeClients = await prisma.client.findMany({
      where: { clientType: 'active', isActive: true },
      include: {
        visits: { orderBy: { visitDate: 'desc' }, take: 1 },
      },
    });

    for (const client of activeClients) {
      const lastVisit = client.visits[0]?.visitDate;
      if (!lastVisit || new Date(lastVisit) < thirtyDaysAgo) {
        const exists = await prisma.notification.findFirst({
          where: {
            userId: client.salesRepId,
            type: 'client_inactive',
            message: { contains: client.companyName },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        });
        if (!exists) {
          const days = lastVisit ? Math.ceil((new Date() - new Date(lastVisit)) / (1000 * 60 * 60 * 24)) : 999;
          const n = await prisma.notification.create({
            data: {
              userId: client.salesRepId,
              type: 'client_inactive',
              title: 'عميل يحتاج متابعة',
              message: `شركة ${client.companyName} لم تتم زيارتها منذ ${days > 900 ? 'فترة طويلة' : days + ' يوم'}`,
              link: `/clients/${client.id}`,
            },
          });
          created.push(n);
        }
      }
    }

    // 4. Target missed — notify sales directors (check previous month)
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const targets = await prisma.salesTarget.findMany({
      where: { period: 'monthly', month: prevMonth, year: prevYear },
      include: { user: true },
    });

    for (const t of targets) {
      const startDate = new Date(prevYear, prevMonth - 1, 1);
      const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);

      const actualContracts = await prisma.contract.count({
        where: { salesRepId: t.userId, createdAt: { gte: startDate, lte: endDate } },
      });

      const pct = t.targetContracts > 0 ? Math.round((actualContracts / t.targetContracts) * 100) : 100;

      if (pct < 70 && t.user.managerId) {
        const exists = await prisma.notification.findFirst({
          where: {
            userId: t.user.managerId,
            type: 'target_missed',
            message: { contains: t.user.name },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        });
        if (!exists) {
          const n = await prisma.notification.create({
            data: {
              userId: t.user.managerId,
              type: 'target_missed',
              title: 'مندوب لم يحقق التارجت',
              message: `${t.user.name} حقق ${pct}% فقط من تارجت العقود للشهر الماضي`,
              link: `/targets`,
            },
          });
          created.push(n);
        }
      }
    }

    res.json({ message: `Generated ${created.length} notifications`, count: created.length });
  } catch (err) {
    console.error('Generate notifications error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getNotifications, markAllRead, markRead, generateNotifications };
