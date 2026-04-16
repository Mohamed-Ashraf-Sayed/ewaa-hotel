const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authenticate, authorize('general_manager', 'vice_gm'), async (req, res) => {
  try {
    const { name, nameEn, location, city, country, stars, type, group } = req.body;
    const hotel = await prisma.hotel.create({
      data: {
        name, nameEn, location,
        city: city || null,
        country: country || 'Saudi Arabia',
        stars: stars ? parseInt(stars) : null,
        type: type || null,
        group: group || null
      }
    });
    res.status(201).json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authenticate, authorize('general_manager', 'vice_gm'), async (req, res) => {
  try {
    const hotel = await prisma.hotel.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
