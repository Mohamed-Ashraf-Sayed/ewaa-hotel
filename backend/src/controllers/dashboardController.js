const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['general_manager', 'vice_gm'];

const getDashboard = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let clientFilter = {};
    let contractFilter = {};
    let visitFilter = {};
    let teamIds = [userId];

    if (ADMIN_ROLES.includes(role)) {
      clientFilter = {};
      contractFilter = {};
      visitFilter = {};
      teamIds = (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);
    } else if (role === 'sales_director') {
      const subIds = await getSubordinateIds(userId);
      teamIds = [userId, ...subIds];
      clientFilter = { salesRepId: { in: teamIds } };
      contractFilter = { salesRepId: { in: teamIds } };
      visitFilter = { salesRepId: { in: teamIds } };
    } else if (role === 'contract_officer' || role === 'reservations' || role === 'credit_manager' || role === 'credit_officer') {
      clientFilter = {};
      contractFilter = {};
      visitFilter = {};
    } else {
      clientFilter = { salesRepId: userId };
      contractFilter = { salesRepId: userId };
      visitFilter = { salesRepId: userId };
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalClients, activeClients, leads,
      totalContracts, pendingContracts, approvedContracts,
      contractsThisMonth, expiringIn30,
      totalVisits, visitsThisMonth, upcomingFollowUps,
      atRiskClients, hotLeads, recentActivities,
      teamPerformance
    ] = await Promise.all([
      prisma.client.count({ where: { ...clientFilter, isActive: true } }),
      prisma.client.count({ where: { ...clientFilter, isActive: true, clientType: 'active' } }),
      prisma.client.count({ where: { ...clientFilter, isActive: true, clientType: 'lead' } }),
      prisma.contract.count({ where: contractFilter }),
      prisma.contract.count({ where: { ...contractFilter, status: 'pending' } }),
      prisma.contract.count({ where: { ...contractFilter, status: 'approved' } }),
      prisma.contract.count({ where: { ...contractFilter, createdAt: { gte: thisMonthStart } } }),
      prisma.contract.findMany({
        where: { ...contractFilter, status: 'approved', endDate: { gte: now, lte: thirtyDaysFromNow } },
        include: { client: { select: { companyName: true } }, salesRep: { select: { name: true } } },
        orderBy: { endDate: 'asc' }, take: 5
      }),
      prisma.visit.count({ where: visitFilter }),
      prisma.visit.count({ where: { ...visitFilter, visitDate: { gte: thisMonthStart } } }),
      prisma.visit.findMany({
        where: { ...visitFilter, nextFollowUp: { gte: now, lte: sevenDaysFromNow } },
        include: { client: { select: { id: true, companyName: true } } },
        orderBy: { nextFollowUp: 'asc' }, take: 5
      }),
      // At Risk: high risk pulse score
      prisma.dealPulseScore.findMany({
        where: { riskLevel: 'high', ...(role === 'sales_rep' ? { salesRepId: userId } : role === 'sales_director' ? { salesRepId: { in: teamIds } } : {}) },
        include: { client: { select: { id: true, companyName: true, contactPerson: true } }, salesRep: { select: { name: true } } },
        orderBy: { engagementScore: 'asc' }, take: 5
      }),
      // Hot Leads: high score but no active contract
      prisma.dealPulseScore.findMany({
        where: {
          engagementScore: { gte: 60 },
          contractScore: { lt: 50 },
          ...(role === 'sales_rep' ? { salesRepId: userId } : role === 'sales_director' ? { salesRepId: { in: teamIds } } : {})
        },
        include: { client: { select: { id: true, companyName: true, clientType: true } } },
        orderBy: { engagementScore: 'desc' }, take: 5
      }),
      // Recent activities
      prisma.activity.findMany({
        where: { ...(role === 'sales_rep' ? { userId } : {}) },
        include: {
          user: { select: { name: true } },
          client: { select: { id: true, companyName: true } }
        },
        orderBy: { createdAt: 'desc' }, take: 10
      }),
      // Team performance (only for managers/admins)
      (ADMIN_ROLES.includes(role) || role === 'sales_director')
        ? prisma.user.findMany({
            where: { id: { in: teamIds }, role: 'sales_rep', isActive: true },
            select: {
              id: true, name: true,
              _count: { select: { assignedClients: true, contracts: true, visits: true } }
            }
          })
        : Promise.resolve([])
    ]);

    res.json({
      stats: {
        totalClients, activeClients, leads,
        totalContracts, pendingContracts, approvedContracts,
        contractsThisMonth, totalVisits, visitsThisMonth
      },
      expiringIn30: expiringIn30.map(c => ({
        ...c,
        daysUntilExpiry: Math.ceil((new Date(c.endDate) - now) / (1000 * 60 * 60 * 24))
      })),
      upcomingFollowUps,
      atRiskClients,
      hotLeads,
      recentActivities,
      teamPerformance
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getPulseReport = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let filter = {};
    if (role === 'sales_rep') filter = { salesRepId: userId };
    else if (role === 'sales_director') {
      const subIds = await getSubordinateIds(userId);
      filter = { salesRepId: { in: [userId, ...subIds] } };
    }

    const scores = await prisma.dealPulseScore.findMany({
      where: filter,
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true, clientType: true } },
        salesRep: { select: { id: true, name: true } }
      },
      orderBy: { engagementScore: 'desc' }
    });

    res.json(scores);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDashboard, getPulseReport };
