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
    const { name, nameEn, location, city, country, stars, type, group,
            bankName, beneficiaryName, nationalId, accountNumber, iban } = req.body;
    const hotel = await prisma.hotel.create({
      data: {
        name, nameEn, location,
        city: city || null,
        country: country || 'Saudi Arabia',
        stars: stars ? parseInt(stars) : null,
        type: type || null,
        group: group || null,
        bankName: bankName?.trim() || null,
        beneficiaryName: beneficiaryName?.trim() || null,
        nationalId: nationalId?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
        iban: iban?.trim().replace(/\s+/g, '') || null,
      }
    });
    res.status(201).json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authenticate, authorize('general_manager', 'vice_gm'), async (req, res) => {
  try {
    const b = req.body || {};
    const data = {};
    if (b.name !== undefined) data.name = b.name;
    if (b.nameEn !== undefined) data.nameEn = b.nameEn?.trim() || null;
    if (b.location !== undefined) data.location = b.location;
    if (b.city !== undefined) data.city = b.city?.trim() || null;
    if (b.country !== undefined) data.country = b.country || 'Saudi Arabia';
    if (b.stars !== undefined) data.stars = b.stars === '' || b.stars == null ? null : parseInt(b.stars);
    if (b.type !== undefined) data.type = b.type || null;
    if (b.group !== undefined) data.group = b.group || null;
    if (b.isActive !== undefined) data.isActive = !!b.isActive;
    if (b.bankName !== undefined) data.bankName = b.bankName?.trim() || null;
    if (b.beneficiaryName !== undefined) data.beneficiaryName = b.beneficiaryName?.trim() || null;
    if (b.nationalId !== undefined) data.nationalId = b.nationalId?.trim() || null;
    if (b.accountNumber !== undefined) data.accountNumber = b.accountNumber?.trim() || null;
    if (b.iban !== undefined) data.iban = b.iban?.trim().replace(/\s+/g, '') || null;
    const hotel = await prisma.hotel.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
