const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { isManagerScope, getAccessUserIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm'];

const getUsers = async (req, res) => {
  try {
    const { role: userRole, id: userId } = req.user;
    let whereClause = { isActive: true };

    if (ADMIN_ROLES.includes(userRole)) {
      // sees all
    } else if (isManagerScope(req.user)) {
      const ids = await getAccessUserIds(req.user);
      whereClause.id = { in: ids };
    } else {
      whereClause.id = userId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true, name: true, email: true, role: true, title: true, phone: true,
        isActive: true, createdAt: true, managerId: true, commissionRate: true,
        manager: { select: { id: true, name: true, role: true } },
        hotels: { include: { hotel: { select: { id: true, name: true } } } },
        _count: { select: { assignedClients: { where: { isActive: true } }, contracts: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, managerId, phone, title, hotelIds } = req.body;
    // Normalize email to lowercase so login is case-insensitive (stored emails are always lowercase)
    const emailNormalized = String(email || '').trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name, email: emailNormalized, password: hashed, role,
        managerId: managerId ? parseInt(managerId) : null,
        phone,
        title: title || null,
        hotels: hotelIds?.length
          ? { create: hotelIds.map(id => ({ hotelId: parseInt(id) })) }
          : undefined
      },
      include: {
        manager: { select: { id: true, name: true } },
        hotels: { include: { hotel: { select: { id: true, name: true } } } }
      }
    });
    const { password: _, ...userOut } = user;
    res.status(201).json(userOut);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateCommissionRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionRate } = req.body;
    if (commissionRate === undefined || commissionRate === null) {
      return res.status(400).json({ message: 'commissionRate is required' });
    }
    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: 'commissionRate must be between 0 and 100' });
    }
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { commissionRate: rate },
      select: { id: true, name: true, email: true, role: true, commissionRate: true }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, managerId, phone, title, isActive, hotelIds } = req.body;
    // Normalize email if changing it (stored emails are always lowercase for case-insensitive login)
    const emailNormalized = email !== undefined ? String(email).trim().toLowerCase() : undefined;
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name,
        ...(emailNormalized !== undefined && { email: emailNormalized }),
        role, phone, isActive,
        ...(title !== undefined && { title: title || null }),
        managerId: managerId ? parseInt(managerId) : null,
        hotels: hotelIds !== undefined ? {
          deleteMany: {},
          create: hotelIds.map(hid => ({ hotelId: parseInt(hid) }))
        } : undefined
      },
      include: {
        manager: { select: { id: true, name: true } },
        hotels: { include: { hotel: { select: { id: true, name: true } } } }
      }
    });
    const { password: _, ...userOut } = updated;
    res.json(userOut);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const hashed = await bcrypt.hash(newPassword, 10);
    // Force the user to set their own password on next login.
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashed, mustChangePassword: true },
    });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getOrgChart = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, role: true, managerId: true,
        _count: { select: { assignedClients: { where: { isActive: true } } } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Transfer all active clients from one rep to another. Used when an employee
// leaves and a replacement takes over their book. Only the salesRepId on the
// Client record is rewritten — historical visits / contracts / payments keep
// their original owner so the audit trail isn't lost.
const transferClients = async (req, res) => {
  try {
    const fromId = parseInt(req.params.id);
    const { toUserId, alsoDeactivate } = req.body;
    const toId = parseInt(toUserId);

    if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
      return res.status(400).json({ message: 'Invalid user IDs' });
    }
    if (fromId === toId) {
      return res.status(400).json({ message: 'لا يمكن نقل العملاء من المندوب لنفسه' });
    }

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromId }, select: { id: true, name: true, isActive: true } }),
      prisma.user.findUnique({ where: { id: toId }, select: { id: true, name: true, isActive: true } }),
    ]);
    if (!fromUser) return res.status(404).json({ message: 'المندوب المصدر غير موجود' });
    if (!toUser) return res.status(404).json({ message: 'المندوب الجديد غير موجود' });
    if (!toUser.isActive) return res.status(400).json({ message: 'المندوب الجديد غير مفعّل' });

    const { count: transferredClients } = await prisma.client.updateMany({
      where: { salesRepId: fromId, isActive: true },
      data: { salesRepId: toId },
    });

    let deactivated = false;
    if (alsoDeactivate && fromUser.isActive) {
      await prisma.user.update({ where: { id: fromId }, data: { isActive: false } });
      deactivated = true;
    }

    res.json({
      transferredClients,
      deactivated,
      fromUser: { id: fromUser.id, name: fromUser.name },
      toUser: { id: toUser.id, name: toUser.name },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getUsers, createUser, updateUser, resetPassword, getOrgChart, updateCommissionRate, transferClients };
