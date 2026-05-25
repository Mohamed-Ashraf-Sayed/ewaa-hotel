const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm'];

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
      // assistant_sales falls into this branch too — own data only.
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
      // Contract / visit counts exclude rows tied to archived clients so
      // bulk-archived spreadsheet imports don't keep inflating the dashboard
      // after the cleanup. `client.isActive: true` is added relationally on
      // every count and findMany below.
      prisma.contract.count({ where: { ...contractFilter, client: { isActive: true } } }),
      prisma.contract.count({ where: { ...contractFilter, status: 'pending', client: { isActive: true } } }),
      prisma.contract.count({ where: { ...contractFilter, status: 'approved', client: { isActive: true } } }),
      prisma.contract.count({ where: { ...contractFilter, createdAt: { gte: thisMonthStart }, client: { isActive: true } } }),
      prisma.contract.findMany({
        where: { ...contractFilter, status: 'approved', endDate: { gte: now, lte: thirtyDaysFromNow }, client: { isActive: true } },
        include: { client: { select: { companyName: true } }, salesRep: { select: { name: true } } },
        orderBy: { endDate: 'asc' }, take: 5
      }),
      prisma.visit.count({ where: { ...visitFilter, client: { isActive: true } } }),
      prisma.visit.count({ where: { ...visitFilter, visitDate: { gte: thisMonthStart }, client: { isActive: true } } }),
      prisma.visit.findMany({
        where: { ...visitFilter, nextFollowUp: { gte: now, lte: sevenDaysFromNow }, client: { isActive: true } },
        include: { client: { select: { id: true, companyName: true } } },
        orderBy: { nextFollowUp: 'asc' }, take: 5
      }),
      // At-Risk = no activity of any kind for more than 60 days. "Activity"
      // covers everything that signals the client is being worked on: a
      // visit, an entry in the activity log (note / call / email / meeting
      // logged manually), a contract, or a payment. We also count the
      // createdAt timestamp as day-zero activity so a freshly-added lead
      // doesn't jump straight into the widget. Computed on-the-fly from the
      // source tables instead of from DealPulseScore — that table is only
      // refreshed when a visit/contract fires, so freshly-imported clients
      // with stale scores were wrongly surfacing here.
      (async () => {
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const candidates = await prisma.client.findMany({
          where: {
            isActive: true,
            // Skip clients younger than 60 days entirely — they can't be
            // "at-risk" yet under the > 60-days rule.
            createdAt: { lte: sixtyDaysAgo },
            ...(role === 'sales_rep' ? { salesRepId: userId }
              : role === 'sales_director' ? { salesRepId: { in: teamIds } }
              : ADMIN_ROLES.includes(role) ? {}
              : {}),
          },
          select: {
            id: true, companyName: true, contactPerson: true, createdAt: true,
            salesRep: { select: { id: true, name: true } },
            visits:    { orderBy: { visitDate: 'desc' }, take: 1, select: { visitDate: true } },
            activities:{ orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            contracts: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            payments:  { orderBy: { paymentDate: 'desc' }, take: 1, select: { paymentDate: true } },
          },
        });
        const DAY = 1000 * 60 * 60 * 24;
        return candidates
          .map(c => {
            const ts = [
              c.createdAt,
              c.visits[0]?.visitDate,
              c.activities[0]?.createdAt,
              c.contracts[0]?.createdAt,
              c.payments[0]?.paymentDate,
            ].filter(Boolean).map(d => new Date(d).getTime());
            const lastActivityAt = ts.length ? Math.max(...ts) : new Date(c.createdAt).getTime();
            const daysSince = Math.floor((now.getTime() - lastActivityAt) / DAY);
            return { c, daysSince };
          })
          .filter(x => x.daysSince > 60)
          .sort((a, b) => b.daysSince - a.daysSince)
          .slice(0, 5)
          .map(x => ({
            id: x.c.id, // React key
            client: { id: x.c.id, companyName: x.c.companyName, contactPerson: x.c.contactPerson },
            salesRep: x.c.salesRep ? { name: x.c.salesRep.name } : null,
            // Reuse the field name the frontend already reads, so the widget
            // renders without UI changes — the label still says "since last
            // visit" but the count is now since the last activity of any
            // kind (visit / note / contract / payment / etc).
            daysSinceLastVisit: x.daysSince,
            engagementScore: Math.max(0, 100 - x.daysSince),
          }));
      })(),
      // Hot Leads: high score but no active contract. Also skip pulse rows
      // tied to archived clients — they linger after a soft-delete and would
      // otherwise leak into the widget.
      prisma.dealPulseScore.findMany({
        where: {
          engagementScore: { gte: 60 },
          contractScore: { lt: 50 },
          client: { isActive: true },
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
            where: { id: { in: teamIds }, role: { in: ['sales_rep', 'assistant_sales'] }, isActive: true },
            select: {
              id: true, name: true,
              _count: { select: { assignedClients: { where: { isActive: true } }, contracts: true, visits: true } }
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
