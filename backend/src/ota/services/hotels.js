const { prisma } = require('../lib/db');

const GARBAGE_NAME_PATTERNS = [
  /booking\.com\b/i,
  /online hotel/i,
  /confirmation_hotel/i,
  /^(amp|tion);/i,
  /^Collect$/i,
  /database/i,
  /We can only sell/i,
  /Kind regards/i,
  /Please contact/i,
  /^[\d.,\s\-]+$/,
  /^\s*$/,
];

function isGarbageName(name) {
  if (!name || name.length < 4 || name.length > 150) return true;
  return GARBAGE_NAME_PATTERNS.some((re) => re.test(name));
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s*-\s*economic\s*$/i, '')
    .replace(/muahidb|muahideb|muhaideb|muhaidbresidence|muhaidb\s*residence/g, 'muhaidb')
    .replace(/residence\s*al/g, 'al')
    .replace(/\s+/g, ' ')
    .trim();
}

const OTA_FIELDS = [
  ['bookingComId', 'bookingComId'],
  ['agodaId', 'agodaId'],
  ['expediaId', 'expediaId'],
  ['almosaferId', 'almosaferId'],
];

async function findOrCreateHotel(ids = {}) {
  const { bookingComId, agodaId, expediaId, almosaferId } = ids;
  const name = isGarbageName(ids.name) ? null : ids.name;

  for (const [keyArg, field] of OTA_FIELDS) {
    const v = ids[keyArg];
    if (v) {
      const existing = await prisma.hotel.findUnique({ where: { [field]: String(v) } });
      if (existing) {
        const data = {};
        if (bookingComId && !existing.bookingComId) data.bookingComId = String(bookingComId);
        if (agodaId && !existing.agodaId) data.agodaId = String(agodaId);
        if (expediaId && !existing.expediaId) data.expediaId = String(expediaId);
        if (almosaferId && !existing.almosaferId) data.almosaferId = String(almosaferId);
        if (name && name !== existing.name) {
          const aliases = existing.aliases ? JSON.parse(existing.aliases) : [];
          if (!aliases.includes(name)) {
            aliases.push(name);
            data.aliases = JSON.stringify(aliases);
          }
        }
        if (Object.keys(data).length) {
          return prisma.hotel.update({ where: { id: existing.id }, data });
        }
        return existing;
      }
    }
  }

  if (name) {
    const norm = normalize(name);
    const all = await prisma.hotel.findMany();
    const match = all.find((h) => {
      if (normalize(h.name) === norm) return true;
      if (h.nameEn && normalize(h.nameEn) === norm) return true;
      if (h.aliases) {
        try {
          const aliases = JSON.parse(h.aliases);
          if (aliases.some((a) => normalize(a) === norm)) return true;
        } catch {}
      }
      return false;
    });
    if (match) {
      const data = {};
      if (bookingComId && !match.bookingComId) data.bookingComId = String(bookingComId);
      if (agodaId && !match.agodaId) data.agodaId = String(agodaId);
      if (expediaId && !match.expediaId) data.expediaId = String(expediaId);
      if (almosaferId && !match.almosaferId) data.almosaferId = String(almosaferId);
      if (Object.keys(data).length) {
        return prisma.hotel.update({ where: { id: match.id }, data });
      }
      return match;
    }
  }

  if (bookingComId || agodaId || expediaId || almosaferId) {
    return prisma.hotel.create({
      data: {
        bookingComId: bookingComId ? String(bookingComId) : null,
        agodaId: agodaId ? String(agodaId) : null,
        expediaId: expediaId ? String(expediaId) : null,
        almosaferId: almosaferId ? String(almosaferId) : null,
        name: name || `Hotel ${bookingComId || agodaId || expediaId || almosaferId}`,
      },
    });
  }

  if (name) {
    return prisma.hotel.create({ data: { name } });
  }

  return null;
}

module.exports = { findOrCreateHotel, normalize, isGarbageName };
