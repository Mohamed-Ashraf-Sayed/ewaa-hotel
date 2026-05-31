const express = require('express');
const { prisma } = require('../lib/db');
const { normalize } = require('../services/hotels');

const router = express.Router();

// Build a fresh "normalized name -> rooms" map on each request. Inventory
// rarely changes so the lookup is small (under 100 entries) and cached
// queries would only save microseconds — not worth the staleness risk.
async function buildInventoryMap() {
  const inv = await prisma.otaBranchInventory.findMany({ where: { isActive: true } });
  const map = new Map();
  for (const r of inv) map.set(normalize(r.name), { rooms: r.rooms, brand: r.brand });
  return map;
}
function lookupRooms(invMap, hotelName, hotelNameEn) {
  if (hotelName) {
    const hit = invMap.get(normalize(hotelName));
    if (hit) return hit.rooms;
  }
  if (hotelNameEn) {
    const hit = invMap.get(normalize(hotelNameEn));
    if (hit) return hit.rooms;
  }
  return null;
}

function parseRange(req) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
  const from = req.query.from ? new Date(req.query.from) : defaultFrom;
  const to = req.query.to ? new Date(req.query.to) : now;
  return { from, to };
}

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const where = { occurredAt: { gte: from, lte: to } };

    const grouped = await prisma.bookingEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { _all: true },
    });
    const counts = { new: 0, cancellation: 0, modification: 0 };
    for (const g of grouped) counts[g.eventType] = g._count._all;

    const bySource = await prisma.$queryRaw`
      SELECT r.source AS source, be.eventType AS eventType, COUNT(*) AS c
      FROM BookingEvent be
      JOIN Reservation r ON r.id = be.reservationId
      WHERE be.occurredAt >= ${from} AND be.occurredAt <= ${to}
      GROUP BY r.source, be.eventType
    `;
    const sourceTotals = {};
    for (const row of bySource) {
      const src = row.source;
      if (!sourceTotals[src]) sourceTotals[src] = { new: 0, cancellation: 0, modification: 0 };
      sourceTotals[src][row.eventType] = Number(row.c);
    }

    res.json({
      range: { from, to },
      totals: {
        ...counts,
        net: counts.new - counts.cancellation,
        cancellationRate: counts.new ? +(counts.cancellation / counts.new * 100).toFixed(1) : 0,
      },
      bySource: sourceTotals,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/by-hotel', async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const rows = await prisma.$queryRaw`
      SELECT h.id AS hotelId, h.name AS hotelName, h.nameEn AS hotelNameEn, h.city AS city,
             be.eventType AS eventType, COUNT(*) AS c
      FROM BookingEvent be
      JOIN Hotel h ON h.id = be.hotelId
      WHERE be.occurredAt >= ${from} AND be.occurredAt <= ${to}
      GROUP BY h.id, be.eventType
      ORDER BY h.name
    `;
    const byHotel = {};
    for (const row of rows) {
      if (!byHotel[row.hotelId]) {
        byHotel[row.hotelId] = {
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          hotelNameEn: row.hotelNameEn,
          city: row.city,
          new: 0, cancellation: 0, modification: 0,
        };
      }
      byHotel[row.hotelId][row.eventType] = Number(row.c);
    }
    const invMap = await buildInventoryMap();
    const result = Object.values(byHotel).map((h) => {
      const inventoryRooms = lookupRooms(invMap, h.hotelName, h.hotelNameEn);
      return {
        ...h,
        net: h.new - h.cancellation,
        cancellationRate: h.new ? +(h.cancellation / h.new * 100).toFixed(1) : 0,
        inventoryRooms,
        // Bookings-per-room ratio — useful as a relative "OTA pressure"
        // signal across branches. Not true occupancy (no length-of-stay).
        bookingsPerRoom: inventoryRooms ? +(h.new / inventoryRooms * 100).toFixed(1) : null,
      };
    });
    result.sort((a, b) => b.new - a.new);
    res.json({ range: { from, to }, hotels: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const granularity = req.query.granularity === 'month' ? 'month' :
                        req.query.granularity === 'week' ? 'week' : 'day';
    const hotelId = req.query.hotelId ? parseInt(req.query.hotelId, 10) : null;

    const fmt = granularity === 'month' ? '%Y-%m'
              : granularity === 'week'  ? '%Y-%W'
              :                            '%Y-%m-%d';

    let rows;
    if (hotelId) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT strftime('${fmt}', be.occurredAt / 1000, 'unixepoch') AS bucket,
                be.eventType AS eventType, COUNT(*) AS c
         FROM BookingEvent be
         WHERE be.occurredAt >= ? AND be.occurredAt <= ? AND be.hotelId = ?
         GROUP BY bucket, be.eventType
         ORDER BY bucket`,
        from, to, hotelId
      );
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT strftime('${fmt}', be.occurredAt / 1000, 'unixepoch') AS bucket,
                be.eventType AS eventType, COUNT(*) AS c
         FROM BookingEvent be
         WHERE be.occurredAt >= ? AND be.occurredAt <= ?
         GROUP BY bucket, be.eventType
         ORDER BY bucket`,
        from, to
      );
    }

    const buckets = {};
    for (const row of rows) {
      if (!buckets[row.bucket]) buckets[row.bucket] = { bucket: row.bucket, new: 0, cancellation: 0, modification: 0 };
      buckets[row.bucket][row.eventType] = Number(row.c);
    }
    res.json({
      range: { from, to },
      granularity,
      hotelId,
      series: Object.values(buckets),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/by-source', async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const rows = await prisma.$queryRaw`
      SELECT r.source AS source, be.eventType AS eventType, COUNT(*) AS c
      FROM BookingEvent be
      JOIN Reservation r ON r.id = be.reservationId
      WHERE be.occurredAt >= ${from} AND be.occurredAt <= ${to}
      GROUP BY r.source, be.eventType
    `;
    const bySource = {};
    for (const row of rows) {
      if (!bySource[row.source]) bySource[row.source] = { source: row.source, new: 0, cancellation: 0, modification: 0 };
      bySource[row.source][row.eventType] = Number(row.c);
    }
    const result = Object.values(bySource).map((s) => ({
      ...s,
      net: s.new - s.cancellation,
      cancellationRate: s.new ? +(s.cancellation / s.new * 100).toFixed(1) : 0,
    }));
    result.sort((a, b) => b.new - a.new);
    res.json({ range: { from, to }, sources: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/by-hotel-platform-day', async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT
         h.id AS hotelId,
         h.name AS hotelName,
         h.nameEn AS hotelNameEn,
         h.city AS city,
         h.bookingComId AS bookingComId,
         h.agodaId AS agodaId,
         r.source AS source,
         strftime('%Y-%m-%d', be.occurredAt / 1000, 'unixepoch') AS day,
         SUM(CASE WHEN be.eventType = 'new' THEN 1 ELSE 0 END) AS newCount,
         SUM(CASE WHEN be.eventType = 'cancellation' THEN 1 ELSE 0 END) AS cancelCount,
         SUM(CASE WHEN be.eventType = 'modification' THEN 1 ELSE 0 END) AS modCount
       FROM BookingEvent be
       JOIN Reservation r ON r.id = be.reservationId
       LEFT JOIN Hotel h ON h.id = be.hotelId
       WHERE be.occurredAt >= ? AND be.occurredAt <= ?
       GROUP BY h.id, r.source, day
       ORDER BY day DESC, h.name ASC, r.source ASC`,
      from, to
    );
    const invMap = await buildInventoryMap();
    const result = rows.map((r) => {
      const inventoryRooms = lookupRooms(invMap, r.hotelName, r.hotelNameEn);
      const newCount = Number(r.newCount);
      return {
        ...r,
        newCount,
        cancelCount: Number(r.cancelCount),
        modCount: Number(r.modCount),
        net: newCount - Number(r.cancelCount),
        inventoryRooms,
        // OTA bookings as % of room inventory for the day. Crude proxy for
        // OTA-driven occupancy — accurate enough to compare branches and
        // spot anomalies without joining length-of-stay.
        otaShare: inventoryRooms ? +(newCount / inventoryRooms * 100).toFixed(1) : null,
      };
    });
    // Sort by highest OTA share first so the busiest hotels float to the
    // top. Rows without inventory match (otaShare = null) sink to the
    // bottom. Ties broken by raw newCount then most-recent day.
    result.sort((a, b) => {
      const av = a.otaShare ?? -1;
      const bv = b.otaShare ?? -1;
      if (bv !== av) return bv - av;
      if (b.newCount !== a.newCount) return b.newCount - a.newCount;
      return String(b.day).localeCompare(String(a.day));
    });
    res.json({ range: { from, to }, rows: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
