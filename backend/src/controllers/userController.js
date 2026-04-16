const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['general_manager', 'vice_gm'];

const getUsers = async (req, res) => {
  try {
    const { role: userRole, id: userId } = req.user;
    let whereClause = { isActive: true };

    if (ADMIN_ROLES.includes(userRole)) {
      // sees all
    } else if (userRole === 'sales_director') {
      const subIds = await getSubordinateIds(userId);
      whereClause.id = { in: [userId, ...subIds] };
    } else {
      whereClause.id = userId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true, name: true, email: true, role: true, phone: true,
        isActive: true, createdAt: true, managerId: true, commissionRate: true,
        manager: { select: { id: true, name: true, role: true } },
        hotels: { include: { hotel: { select: { id: true, name: true } } } },
        _count: { select: { assignedClients: true, contracts: true } }
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
    const { name, email, password, role, managerId, phone, hotelIds } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed, role,
        managerId: managerId ? parseInt(managerId) : null,
        phone,
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
    const { name, email, role, managerId, phone, isActive, hotelIds } = req.body;
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name, email, role, phone, isActive,
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
    await prisma.user.update({ where: { id: parseInt(id) }, data: { password: hashed } });
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
        _count: { select: { assignedClients: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getUsers, createUser, updateUser, resetPassword, getOrgChart, updateCommissionRate };
