const { PrismaClient } = require('@prisma/client');
const { syncHolidaysForYear } = require('../jobs/holidaySync');
const prisma = new PrismaClient();

const DEFAULT_COLORS = {
  official_holiday: '#DC2626',
  religious: '#16A34A',
  school: '#2563EB',
  season: '#D97706',
  occasion: '#7C3AED',
};

// Expand a recurring event into the requested year (returns event with shifted dates).
const expandRecurring = (event, targetYear) => {
  const original = new Date(event.eventDate);
  const shifted = new Date(original);
  shifted.setUTCFullYear(targetYear);
  let shiftedEnd = null;
  if (event.endDate) {
    const endOrig = new Date(event.endDate);
    const diffMs = endOrig.getTime() - original.getTime();
    shiftedEnd = new Date(shifted.getTime() + diffMs);
  }
  return {
    ...event,
    eventDate: shifted.toISOString(),
    endDate: shiftedEnd ? shiftedEnd.toISOString() : null,
    _recurringFrom: original.toISOString(),
  };
};

// GET /local-events?month=&year=&type=
const getEvents = async (req, res) => {
  try {
    const { month, year, type } = req.query;
    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // If month is specified, restrict to that month window (UTC to stay consistent with stored UTC dates)
    let rangeStart, rangeEnd;
    if (month) {
      const m = parseInt(month);
      rangeStart = new Date(Date.UTC(targetYear, m - 1, 1));
      rangeEnd = new Date(Date.UTC(targetYear, m, 0, 23, 59, 59, 999));
    } else {
      rangeStart = new Date(Date.UTC(targetYear, 0, 1));
      rangeEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));
    }

    const where = {};
    if (type) where.type = type;

    const all = await prisma.localEvent.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { eventDate: 'asc' },
    });

    const result = [];
    for (const ev of all) {
      const d = new Date(ev.eventDate);
      if (ev.isRecurring) {
        const expanded = expandRecurring(ev, targetYear);
        const ed = new Date(expanded.eventDate);
        if (ed >= rangeStart && ed <= rangeEnd) result.push(expanded);
      } else {
        if (d >= rangeStart && d <= rangeEnd) result.push(ev);
      }
    }

    // Sort final list by (shifted) date
    result.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /local-events
const createEvent = async (req, res) => {
  try {
    const { title, titleEn, description, eventDate, endDate, type, color, isRecurring } = req.body;
    if (!title || !eventDate) {
      return res.status(400).json({ message: 'title and eventDate are required' });
    }
    const finalColor = color || DEFAULT_COLORS[type] || DEFAULT_COLORS.occasion;
    const event = await prisma.localEvent.create({
      data: {
        title,
        titleEn: titleEn || null,
        description: description || null,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        type: type || 'occasion',
        color: finalColor,
        isRecurring: !!isRecurring,
        source: 'manual',
        createdById: req.user.id,
      },
    });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /local-events/:id
const updateEvent = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.localEvent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Event not found' });
    if (existing.source !== 'manual') {
      return res.status(400).json({ message: 'Cannot edit auto-synced events. Delete and re-sync if needed.' });
    }

    const { title, titleEn, description, eventDate, endDate, type, color, isRecurring } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (titleEn !== undefined) data.titleEn = titleEn;
    if (description !== undefined) data.description = description;
    if (eventDate) data.eventDate = new Date(eventDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (type) data.type = type;
    if (color !== undefined) data.color = color;
    if (isRecurring !== undefined) data.isRecurring = !!isRecurring;

    const event = await prisma.localEvent.update({ where: { id }, data });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /local-events/:id
const deleteEvent = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.localEvent.delete({ where: { id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /local-events/sync — admin-triggered sync with Nager.Date
const triggerSync = async (req, res) => {
  try {
    const now = new Date();
    const years = [now.getFullYear(), now.getFullYear() + 1];
    const results = [];
    for (const y of years) {
      const r = await syncHolidaysForYear(y);
      results.push({ year: y, ...r });
    }
    res.json({ message: 'Sync complete', results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getEvents, createEvent, updateEvent, deleteEvent, triggerSync };
