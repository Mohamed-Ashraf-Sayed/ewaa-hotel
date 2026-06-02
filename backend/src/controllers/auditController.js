const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /audit-log
// Admin-level only (gated at the route layer). Filters: userId, from, to,
// search (matches inside the action label). Returns newest first.
const getAuditLog = async (req, res) => {
  try {
    const { userId, from, to, search, limit } = req.query;
    const where = {};

    if (userId) where.userId = parseInt(userId);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(`${to}T23:59:59`);
    }
    if (search) where.action = { contains: String(search) };

    const take = Math.min(parseInt(limit) || 500, 2000);

    const logs = await prisma.auditLog.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { id: true, name: true, role: true } },
      },
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getAuditLog };
