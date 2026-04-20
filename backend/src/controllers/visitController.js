const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const { recalculatePulse } = require('./contractController');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];

const getVisits = async (req, res) => {
  try {
    const { clientId, upcoming } = req.query;
    let salesRepFilter = {};
    if (!ADMIN_ROLES.includes(req.user.role)) {
      if (req.user.role === 'assistant_sales' && req.user.managerId) {
        const teamIds = await getSubordinateIds(req.user.managerId);
        salesRepFilter = { salesRepId: { in: [req.user.managerId, ...teamIds] } };
      } else if (req.user.role === 'sales_director') {
        const subIds = await getSubordinateIds(req.user.id);
        salesRepFilter = { salesRepId: { in: [req.user.id, ...subIds] } };
      } else {
        salesRepFilter = { salesRepId: req.user.id };
      }
    }

    const where = {
      ...salesRepFilter,
      ...(clientId && { clientId: parseInt(clientId) }),
      ...(upcoming === 'true' && { nextFollowUp: { gte: new Date() } })
    };

    const visits = await prisma.visit.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true } },
        salesRep: { select: { id: true, name: true } }
      },
      orderBy: { visitDate: 'desc' }
    });
    res.json(visits);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const createVisit = async (req, res) => {
  try {
    const { clientId, visitDate, visitType, purpose, outcome, nextFollowUp, notes } = req.body;

    const visit = await prisma.visit.create({
      data: {
        clientId: parseInt(clientId),
        salesRepId: req.user.id,
        visitDate: new Date(visitDate),
        visitType,
        purpose,
        outcome,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
        notes
      },
      include: {
        client: { select: { companyName: true } },
        salesRep: { select: { name: true } }
      }
    });

    await prisma.activity.create({
      data: {
        clientId: parseInt(clientId),
        userId: req.user.id,
        type: 'visit',
        description: `Visit logged: ${visitType || 'in_person'} - ${purpose || 'General meeting'}${outcome ? ' | Outcome: ' + outcome : ''}`
      }
    });

    await recalculatePulse(parseInt(clientId));
    res.status(201).json(visit);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { visitDate, visitType, purpose, outcome, nextFollowUp, notes } = req.body;
    const visit = await prisma.visit.update({
      where: { id: parseInt(id) },
      data: {
        visitDate: visitDate ? new Date(visitDate) : undefined,
        visitType, purpose, outcome,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
        notes
      }
    });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getUpcomingFollowUps = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const future = new Date();
    future.setDate(future.getDate() + days);
    let salesRepFilter = { salesRepId: req.user.id };
    if (req.user.role === 'assistant_sales' && req.user.managerId) {
      const teamIds = await getSubordinateIds(req.user.managerId);
      salesRepFilter = { salesRepId: { in: [req.user.managerId, ...teamIds] } };
    } else if (req.user.role === 'sales_director') {
      const subIds = await getSubordinateIds(req.user.id);
      salesRepFilter = { salesRepId: { in: [req.user.id, ...subIds] } };
    } else if (ADMIN_ROLES.includes(req.user.role)) {
      salesRepFilter = {};
    }

    const visits = await prisma.visit.findMany({
      where: {
        ...salesRepFilter,
        nextFollowUp: { gte: new Date(), lte: future }
      },
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true, phone: true } },
        salesRep: { select: { name: true } }
      },
      orderBy: { nextFollowUp: 'asc' }
    });
    res.json(visits);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getVisits, createVisit, updateVisit, getUpcomingFollowUps };
