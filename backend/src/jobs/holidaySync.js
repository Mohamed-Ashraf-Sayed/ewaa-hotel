const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const SOURCE = 'nager'; // kept for DB compatibility; acts as "auto" source tag

// Fixed Saudi holidays on the Gregorian calendar.
const FIXED_HOLIDAYS = [
  { month: 2, day: 22, titleAr: 'يوم التأسيس', titleEn: 'Founding Day', type: 'official_holiday', color: '#DC2626', days: 1 },
  { month: 9, day: 23, titleAr: 'اليوم الوطني', titleEn: 'Saudi National Day', type: 'official_holiday', color: '#DC2626', days: 1 },
];

// Islamic events computed from the Hijri calendar (via Aladhan API).
const ISLAMIC_EVENTS = [
  { hDay: 1,  hMonth: 1,  titleAr: 'رأس السنة الهجرية', titleEn: 'Islamic New Year', type: 'religious', color: '#16A34A', days: 1 },
  { hDay: 9,  hMonth: 12, titleAr: 'يوم عرفة',          titleEn: 'Arafat Day',        type: 'religious', color: '#16A34A', days: 1 },
  { hDay: 10, hMonth: 12, titleAr: 'عيد الأضحى',         titleEn: 'Eid al-Adha',       type: 'religious', color: '#16A34A', days: 4 },
  { hDay: 1,  hMonth: 10, titleAr: 'عيد الفطر',          titleEn: 'Eid al-Fitr',       type: 'religious', color: '#16A34A', days: 3 },
];

const pad2 = (n) => String(n).padStart(2, '0');

const fetchJson = async (url, timeoutMs = 15000) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
};

// Gregorian year -> starting Hijri year (Hijri year that contains Jan 1 of gYear).
const getHijriYearAtJan1 = async (gYear) => {
  const data = await fetchJson(`https://api.aladhan.com/v1/gToH/01-01-${gYear}`);
  return parseInt(data.data.hijri.year, 10);
};

// Convert Hijri (d, m, y) -> Gregorian Date at UTC midnight (avoids TZ drift).
const hijriToGregorian = async (hDay, hMonth, hYear) => {
  const data = await fetchJson(`https://api.aladhan.com/v1/hToG/${pad2(hDay)}-${pad2(hMonth)}-${hYear}`);
  const [dd, mm, yyyy] = data.data.gregorian.date.split('-');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
};

const upsertEvent = async ({ extId, titleAr, titleEn, eventDate, endDate, type, color }) => {
  const existing = await prisma.localEvent.findUnique({
    where: { source_externalId: { source: SOURCE, externalId: extId } },
  });
  if (existing) {
    await prisma.localEvent.update({
      where: { id: existing.id },
      data: { title: titleAr, titleEn, eventDate, endDate, type, color },
    });
    return 'updated';
  }
  await prisma.localEvent.create({
    data: { title: titleAr, titleEn, eventDate, endDate, type, color, source: SOURCE, externalId: extId },
  });
  return 'added';
};

const syncHolidaysForYear = async (gYear) => {
  let added = 0, updated = 0, errors = 0;

  // 1) Fixed Gregorian holidays
  for (const h of FIXED_HOLIDAYS) {
    try {
      const start = new Date(`${gYear}-${pad2(h.month)}-${pad2(h.day)}T00:00:00.000Z`);
      const end = h.days > 1 ? new Date(start.getTime() + (h.days - 1) * 86400000) : null;
      const extId = `fixed:SA:${gYear}-${pad2(h.month)}-${pad2(h.day)}`;
      const result = await upsertEvent({
        extId, titleAr: h.titleAr, titleEn: h.titleEn,
        eventDate: start, endDate: end, type: h.type, color: h.color,
      });
      if (result === 'added') added++; else updated++;
    } catch (err) {
      errors++;
      console.error(`[HolidaySync] Fixed holiday error:`, err.message);
    }
  }

  // 2) Islamic holidays (iterate a few Hijri years to catch boundaries)
  try {
    const hBase = await getHijriYearAtJan1(gYear);
    const hYears = [hBase, hBase + 1]; // usually two Hijri years overlap one Gregorian year

    for (const hY of hYears) {
      for (const ev of ISLAMIC_EVENTS) {
        try {
          const start = await hijriToGregorian(ev.hDay, ev.hMonth, hY);
          if (start.getFullYear() !== gYear) continue;
          const end = ev.days > 1 ? new Date(start.getTime() + (ev.days - 1) * 86400000) : null;
          const extId = `islamic:${hY}-${pad2(ev.hMonth)}-${pad2(ev.hDay)}`;
          const result = await upsertEvent({
            extId, titleAr: ev.titleAr, titleEn: ev.titleEn,
            eventDate: start, endDate: end, type: ev.type, color: ev.color,
          });
          if (result === 'added') added++; else updated++;
        } catch (err) {
          errors++;
          console.error(`[HolidaySync] Islamic event error (${ev.titleEn} ${hY}):`, err.message);
        }
      }
    }
  } catch (err) {
    errors++;
    console.error(`[HolidaySync] Hijri base year error for ${gYear}:`, err.message);
  }

  console.log(`[HolidaySync] ${gYear}: +${added} new, ~${updated} updated, ${errors} errors`);
  return { added, updated, errors };
};

const runSync = async () => {
  try {
    const now = new Date();
    await syncHolidaysForYear(now.getFullYear());
    await syncHolidaysForYear(now.getFullYear() + 1);
  } catch (err) {
    console.error('[HolidaySync] runSync error:', err.message);
  }
};

const startHolidaySync = () => {
  // Run once on startup (after 10s), then daily
  setTimeout(runSync, 10 * 1000);
  setInterval(runSync, SYNC_INTERVAL_MS);
  console.log(`[HolidaySync] Started (interval: ${SYNC_INTERVAL_MS / 1000 / 3600}h)`);
};

module.exports = { startHolidaySync, syncHolidaysForYear, runSync };
