const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];
const MANAGER_ROLES = ['sales_director'];

const buildAccessFilter = async (user) => {
  if (ADMIN_ROLES.includes(user.role)) return {};
  // Assistant sales sees same team as their director (sibling reps + director)
  if (user.role === 'assistant_sales' && user.managerId) {
    const teamIds = await getSubordinateIds(user.managerId);
    return { salesRepId: { in: [user.managerId, ...teamIds] } };
  }
  if (MANAGER_ROLES.includes(user.role)) {
    const subIds = await getSubordinateIds(user.id);
    return { salesRepId: { in: [user.id, ...subIds] } };
  }
  return { salesRepId: user.id };
};

const getClients = async (req, res) => {
  try {
    const { type, search, hotelId } = req.query;
    const accessFilter = await buildAccessFilter(req.user);
    const where = {
      ...accessFilter,
      isActive: true,
      ...(type && { clientType: type }),
      ...(hotelId && { hotelId: parseInt(hotelId) }),
      ...(search && {
        OR: [
          { companyName: { contains: search } },
          { contactPerson: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ]
      })
    };

    const clients = await prisma.client.findMany({
      where,
      include: {
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } },
        pulseScore: true,
        _count: { select: { contracts: true, visits: true, activities: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getClient = async (req, res) => {
  try {
    const { id } = req.params;
    const accessFilter = await buildAccessFilter(req.user);
    const client = await prisma.client.findFirst({
      where: { id: parseInt(id), ...accessFilter },
      include: {
        salesRep: { select: { id: true, name: true, email: true, phone: true } },
        hotel: { select: { id: true, name: true } },
        contracts: {
          include: {
            hotel: { select: { name: true } },
            approvals: { include: { approver: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 1 }
          },
          orderBy: { createdAt: 'desc' }
        },
        visits: {
          include: { salesRep: { select: { name: true } } },
          orderBy: { visitDate: 'desc' }
        },
        activities: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        },
        pulseScore: true
      }
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Normalize for duplicate detection (trim, lowercase, remove extra spaces, strip Arabic diacritics)
const normalizeName = (s) => {
  if (!s) return '';
  return String(s).trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u064B-\u065F\u0670]/g, ''); // Remove Arabic diacritics
};

const createClient = async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, address, industry,
      clientType, source, hotelId, estimatedRooms, annualBudget, website, notes } = req.body;

    // === Duplicate detection ===
    const allClients = await prisma.client.findMany({
      where: { isActive: true },
      include: { salesRep: { select: { id: true, name: true } } }
    });

    const normalizedCompany = normalizeName(companyName);
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const normalizedEmail = (email || '').trim().toLowerCase();

    const existing = allClients.find(c => {
      if (normalizeName(c.companyName) === normalizedCompany) return true;
      if (normalizedPhone && c.phone && c.phone.replace(/\D/g, '') === normalizedPhone) return true;
      if (normalizedEmail && c.email && c.email.toLowerCase() === normalizedEmail) return true;
      return false;
    });

    if (existing) {
      let reason = '';
      if (normalizeName(existing.companyName) === normalizedCompany) reason = 'اسم الشركة';
      else if (normalizedPhone && existing.phone?.replace(/\D/g, '') === normalizedPhone) reason = 'رقم الهاتف';
      else if (normalizedEmail && existing.email?.toLowerCase() === normalizedEmail) reason = 'البريد الإلكتروني';

      return res.status(409).json({
        message: `العميل موجود بالفعل (${reason} مكرر) — مسجل لدى المندوب: ${existing.salesRep?.name || 'غير معروف'}`,
        existingClient: {
          id: existing.id,
          companyName: existing.companyName,
          salesRepName: existing.salesRep?.name,
        }
      });
    }

    const client = await prisma.client.create({
      data: {
        companyName, contactPerson, phone, email, address, industry,
        clientType: clientType || 'lead',
        source,
        salesRepId: req.user.id,
        hotelId: hotelId ? parseInt(hotelId) : null,
        estimatedRooms: estimatedRooms ? parseInt(estimatedRooms) : null,
        annualBudget: annualBudget ? parseFloat(annualBudget) : null,
        website, notes
      },
      include: {
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } }
      }
    });

    // Initialize pulse score
    await prisma.dealPulseScore.create({
      data: { clientId: client.id, salesRepId: req.user.id }
    });

    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (data.hotelId) data.hotelId = parseInt(data.hotelId);
    if (data.estimatedRooms) data.estimatedRooms = parseInt(data.estimatedRooms);
    if (data.annualBudget) data.annualBudget = parseFloat(data.annualBudget);
    delete data.salesRepId;

    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data,
      include: {
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } }
      }
    });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.update({ where: { id: parseInt(id) }, data: { isActive: false } });
    res.json({ message: 'Client archived successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getClients, getClient, createClient, updateClient, deleteClient };
