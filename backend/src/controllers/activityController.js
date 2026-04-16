const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getActivities = async (req, res) => {
  try {
    const { clientId, limit } = req.query;
    const activities = await prisma.activity.findMany({
      where: { ...(clientId && { clientId: parseInt(clientId) }) },
      include: {
        user: { select: { id: true, name: true, role: true } },
        client: { select: { id: true, companyName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : 50
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createActivity = async (req, res) => {
  try {
    const { clientId, type, description } = req.body;
    const activity = await prisma.activity.create({
      data: {
        clientId: parseInt(clientId),
        userId: req.user.id,
        type,
        description
      },
      include: {
        user: { select: { name: true, role: true } }
      }
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getActivities, createActivity };
