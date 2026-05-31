const express = require('express');
const { prisma } = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { hotelId, source, status, from, to, page = '1', pageSize = '50' } = req.query;
    const where = {};
    if (hotelId) where.hotelId = parseInt(hotelId, 10);
    if (source) where.source = source;
    if (status) where.currentStatus = status;
    if (from || to) {
      where.firstSeenAt = {};
      if (from) where.firstSeenAt.gte = new Date(from);
      if (to) where.firstSeenAt.lte = new Date(to);
    }
    const take = Math.min(parseInt(pageSize, 10), 200);
    const skip = (parseInt(page, 10) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: { hotel: true, _count: { select: { events: true } } },
        orderBy: { firstSeenAt: 'desc' },
        take, skip,
      }),
      prisma.reservation.count({ where }),
    ]);
    res.json({ items, total, page: parseInt(page, 10), pageSize: take });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        hotel: true,
        events: { orderBy: { occurredAt: 'asc' }, include: { email: true } },
      },
    });
    if (!reservation) return res.status(404).json({ error: 'Not found' });
    res.json(reservation);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
