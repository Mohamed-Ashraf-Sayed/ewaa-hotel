const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const list = async (req, res) => {
  try {
    const { unreadOnly, clientId, q, take } = req.query;
    const where = {};
    if (unreadOnly === 'true') where.isRead = false;
    if (clientId) where.clientId = parseInt(clientId);
    if (q) {
      const term = String(q).trim();
      where.OR = [
        { subject: { contains: term } },
        { fromEmail: { contains: term } },
        { fromName: { contains: term } },
      ];
    }

    const limit = Math.min(parseInt(take || '100', 10) || 100, 500);
    const items = await prisma.inboxEmail.findMany({
      where,
      include: { client: { select: { id: true, companyName: true, contactPerson: true, salesRep: { select: { id: true, name: true } } } } },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    const unread = await prisma.inboxEmail.count({ where: { isRead: false } });
    res.json({ unread, items });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await prisma.inboxEmail.findUnique({
      where: { id: parseInt(id) },
      include: { client: { select: { id: true, companyName: true, contactPerson: true, phone: true, email: true, salesRep: { select: { id: true, name: true } } } } },
    });
    if (!email) return res.status(404).json({ message: 'Email not found' });
    res.json(email);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;
    const email = await prisma.inboxEmail.update({
      where: { id: parseInt(id) },
      data: { isRead: isRead !== false },
    });
    res.json(email);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const markAllRead = async (_req, res) => {
  try {
    const result = await prisma.inboxEmail.updateMany({ where: { isRead: false }, data: { isRead: true } });
    res.json({ updated: result.count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const pollNow = async (_req, res) => {
  try {
    const { pollOnce } = require('../jobs/inboxPoll');
    pollOnce().catch(() => {});
    res.json({ message: 'Poll triggered' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { list, getOne, markRead, markAllRead, pollNow };
