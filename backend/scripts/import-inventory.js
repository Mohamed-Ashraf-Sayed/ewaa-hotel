// One-time importer for the Hotels Inventory May26 spreadsheet into
// OtaBranchInventory. Idempotent — re-running it updates room counts if
// the name matches (case-insensitive trim), and skips zero-room rows.
const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const COLS = [
  { nameCol: 0, roomCol: 1, brand: 'muhaidib_serviced' },
  { nameCol: 2, roomCol: 3, brand: 'awa_hotels'        },
  { nameCol: 4, roomCol: 5, brand: 'grand_plaza'       },
];

(async () => {
  const file = process.argv[2] || path.join(__dirname, '..', '_inv.xlsx');
  const wb = xlsx.readFile(file);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sh, { defval: '', header: 1 });
  const entries = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    for (const col of COLS) {
      const name = String(r[col.nameCol] || '').trim();
      const rooms = parseInt(r[col.roomCol], 10);
      if (!name || isNaN(rooms) || rooms <= 0) continue;
      entries.push({ brand: col.brand, name, rooms });
    }
  }
  console.log(`Parsed ${entries.length} entries from sheet`);

  let created = 0, updated = 0;
  for (const e of entries) {
    const existing = await p.otaBranchInventory.findFirst({
      where: { name: { equals: e.name } },
    });
    if (existing) {
      if (existing.rooms !== e.rooms || existing.brand !== e.brand) {
        await p.otaBranchInventory.update({ where: { id: existing.id }, data: { rooms: e.rooms, brand: e.brand } });
        updated++;
      }
    } else {
      await p.otaBranchInventory.create({ data: e });
      created++;
    }
  }

  const totals = await p.otaBranchInventory.groupBy({
    by: ['brand'],
    _count: { _all: true },
    _sum: { rooms: true },
  });
  console.log(`\nImported: created=${created}, updated=${updated}`);
  console.log('Totals by brand:');
  totals.forEach(t => console.log(`  ${t.brand}: ${t._count._all} branches, ${t._sum.rooms} rooms`));
  const grandTotal = totals.reduce((s, t) => s + (t._sum.rooms || 0), 0);
  console.log(`  GRAND TOTAL: ${grandTotal} rooms`);

  await p.$disconnect();
})();
