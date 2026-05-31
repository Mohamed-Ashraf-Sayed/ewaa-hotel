// Branch inventory — list active branches + total rooms per brand. Used by
// the OTA dashboard to show OTA bookings as a share of actual capacity.
const express = require('express');
const { prisma } = require('../lib/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const rows = await prisma.otaBranchInventory.findMany({
      where: { isActive: true },
      orderBy: [{ brand: 'asc' }, { name: 'asc' }],
    });
    const byBrand = {};
    for (const r of rows) {
      if (!byBrand[r.brand]) byBrand[r.brand] = { brand: r.brand, branches: 0, rooms: 0 };
      byBrand[r.brand].branches += 1;
      byBrand[r.brand].rooms    += r.rooms;
    }
    const totalRooms    = rows.reduce((s, r) => s + r.rooms, 0);
    const totalBranches = rows.length;
    res.json({ items: rows, byBrand: Object.values(byBrand), totalBranches, totalRooms });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update rooms count for a single branch — kept minimal; full CRUD can come
// later if the user wants to add/delete branches from the UI.
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rooms, isActive } = req.body;
    const data = {};
    if (rooms !== undefined) data.rooms = parseInt(rooms, 10);
    if (isActive !== undefined) data.isActive = !!isActive;
    const row = await prisma.otaBranchInventory.update({ where: { id }, data });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
