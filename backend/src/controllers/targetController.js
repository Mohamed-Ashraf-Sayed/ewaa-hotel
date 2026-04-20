const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];

// Get subordinate IDs for a manager
const getSubordinateIds = async (userId) => {
  const subs = await prisma.user.findMany({ where: { managerId: userId }, select: { id: true } });
  return subs.map(s => s.id);
};

// GET /targets — list targets (filtered by role)
const getTargets = async (req, res) => {
  try {
    const { year, month, quarter, period, userId } = req.query;
    const where = {};

    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (quarter) where.quarter = parseInt(quarter);
    if (period) where.period = period;
    if (userId) where.userId = parseInt(userId);

    // Role-based filtering
    if (!ADMIN_ROLES.includes(req.user.role)) {
      if (req.user.role === 'assistant_sales' && req.user.managerId) {
        const teamIds = await getSubordinateIds(req.user.managerId);
        where.userId = { in: [req.user.managerId, ...teamIds] };
      } else if (req.user.role === 'sales_director') {
        const subIds = await getSubordinateIds(req.user.id);
        where.userId = { in: [req.user.id, ...subIds] };
      } else {
        where.userId = req.user.id;
      }
    }

    const targets = await prisma.salesTarget.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        setBy: { select: { id: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json(targets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /targets — create or update a target
const upsertTarget = async (req, res) => {
  try {
    const { userId, period, month, quarter, year, targetContracts, targetRevenue, targetVisits, targetClients, notes } = req.body;

    if (!userId || !period || !year) {
      return res.status(400).json({ message: 'userId, period, and year are required' });
    }

    // Authorization: sales_director can only set for their subordinates
    if (req.user.role === 'sales_director') {
      const subIds = await getSubordinateIds(req.user.id);
      if (!subIds.includes(parseInt(userId))) {
        return res.status(403).json({ message: 'You can only set targets for your team members' });
      }
    }

    const data = {
      userId: parseInt(userId),
      setById: req.user.id,
      period,
      month: month ? parseInt(month) : null,
      quarter: quarter ? parseInt(quarter) : null,
      year: parseInt(year),
      targetContracts: targetContracts ? parseInt(targetContracts) : 0,
      targetRevenue: targetRevenue ? parseFloat(targetRevenue) : 0,
      targetVisits: targetVisits ? parseInt(targetVisits) : 0,
      targetClients: targetClients ? parseInt(targetClients) : 0,
      notes: notes || null,
    };

    // Check if target already exists
    const existing = await prisma.salesTarget.findFirst({
      where: {
        userId: data.userId,
        period: data.period,
        year: data.year,
        ...(data.period === 'monthly' ? { month: data.month } : { quarter: data.quarter }),
      },
    });

    let target;
    if (existing) {
      target = await prisma.salesTarget.update({
        where: { id: existing.id },
        data,
        include: { user: { select: { id: true, name: true } } },
      });
    } else {
      target = await prisma.salesTarget.create({
        data,
        include: { user: { select: { id: true, name: true } } },
      });
    }

    res.json(target);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /targets/:id
const deleteTarget = async (req, res) => {
  try {
    await prisma.salesTarget.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /targets/report — achievement report
const getTargetReport = async (req, res) => {
  try {
    const { year, month, quarter, period } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetPeriod = period || 'monthly';

    const where = { year: targetYear, period: targetPeriod };
    if (targetPeriod === 'monthly') where.month = targetMonth;
    if (targetPeriod === 'quarterly' && quarter) where.quarter = parseInt(quarter);

    // Role-based filtering
    if (!ADMIN_ROLES.includes(req.user.role)) {
      if (req.user.role === 'assistant_sales' && req.user.managerId) {
        const teamIds = await getSubordinateIds(req.user.managerId);
        where.userId = { in: [req.user.managerId, ...teamIds] };
      } else if (req.user.role === 'sales_director') {
        const subIds = await getSubordinateIds(req.user.id);
        where.userId = { in: [req.user.id, ...subIds] };
      } else {
        where.userId = req.user.id;
      }
    }

    const targets = await prisma.salesTarget.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    // Calculate date range for actuals
    let startDate, endDate;
    if (targetPeriod === 'monthly') {
      startDate = new Date(targetYear, targetMonth - 1, 1);
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    } else {
      const q = parseInt(quarter) || 1;
      startDate = new Date(targetYear, (q - 1) * 3, 1);
      endDate = new Date(targetYear, q * 3, 0, 23, 59, 59);
    }

    // Get actuals for each user
    const report = await Promise.all(targets.map(async (t) => {
      const [contracts, visits, clients, revenue] = await Promise.all([
        // Contracts created in period
        prisma.contract.count({
          where: { salesRepId: t.userId, createdAt: { gte: startDate, lte: endDate } },
        }),
        // Visits in period
        prisma.visit.count({
          where: { salesRepId: t.userId, visitDate: { gte: startDate, lte: endDate } },
        }),
        // New clients in period
        prisma.client.count({
          where: { salesRepId: t.userId, createdAt: { gte: startDate, lte: endDate } },
        }),
        // Revenue from contracts created in period
        prisma.contract.aggregate({
          where: { salesRepId: t.userId, status: 'approved', createdAt: { gte: startDate, lte: endDate } },
          _sum: { totalValue: true },
        }),
      ]);

      const actualRevenue = revenue._sum.totalValue || 0;

      return {
        ...t,
        actual: {
          contracts,
          visits,
          clients,
          revenue: actualRevenue,
        },
        progress: {
          contracts: t.targetContracts > 0 ? Math.round((contracts / t.targetContracts) * 100) : 0,
          visits: t.targetVisits > 0 ? Math.round((visits / t.targetVisits) * 100) : 0,
          clients: t.targetClients > 0 ? Math.round((clients / t.targetClients) * 100) : 0,
          revenue: t.targetRevenue > 0 ? Math.round((actualRevenue / t.targetRevenue) * 100) : 0,
        },
      };
    }));

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTargets, upsertTarget, deleteTarget, getTargetReport };
