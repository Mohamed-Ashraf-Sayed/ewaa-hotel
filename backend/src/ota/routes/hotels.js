const express = require('express');
const { prisma } = require('../lib/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { reservations: true, events: true } } },
    });
    res.json(hotels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
