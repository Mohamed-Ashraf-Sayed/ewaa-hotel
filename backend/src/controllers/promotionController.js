const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();

const MANAGE_ROLES = ['admin', 'general_manager', 'vice_gm', 'marketing_manager'];

const VIEW_BANNER_ROLES = [
  'sales_rep', 'assistant_sales', 'sales_director',
  'general_manager', 'vice_gm', 'marketing_manager', 'admin',
];

const includeAuthor = { createdBy: { select: { id: true, name: true } } };

// GET /promotions/active — promos that should currently render on the user's dashboard.
// Filters by date window + role visibility + (when set) hotel/brand assignment.
const getActivePromotions = async (req, res) => {
  try {
    if (!VIEW_BANNER_ROLES.includes(req.user.role)) return res.json([]);

    const now = new Date();
    const promos = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: includeAuthor,
      orderBy: { startsAt: 'desc' },
    });

    // Optional hotel/brand filtering: a promo restricted to certain hotels or
    // brands only renders for users tied to that hotel/brand. The filter is
    // *additive* — null on a promo means "show to everyone".
    // Get user's assigned hotels (UserHotel) for matching.
    let userHotelIds = null;
    if (promos.some(p => p.hotelIds || p.brands)) {
      const links = await prisma.userHotel.findMany({
        where: { userId: req.user.id },
        select: { hotel: { select: { id: true, group: true } } },
      });
      userHotelIds = links.map(l => l.hotel.id);
      const userBrands = new Set(links.map(l => l.hotel.group).filter(Boolean));

      const filtered = promos.filter(p => {
        // No hotel/brand filter on the promo → visible to everyone
        if (!p.hotelIds && !p.brands) return true;

        // Admin / marketing manager / GM see everything regardless
        if (['admin', 'general_manager', 'vice_gm', 'marketing_manager'].includes(req.user.role)) return true;

        if (p.hotelIds) {
          const ids = p.hotelIds.split(',').map(s => parseInt(s.trim())).filter(Number.isFinite);
          if (ids.some(id => userHotelIds.includes(id))) return true;
        }
        if (p.brands) {
          const brs = p.brands.split(',').map(s => s.trim()).filter(Boolean);
          if (brs.some(b => userBrands.has(b))) return true;
        }
        return false;
      });
      return res.json(filtered);
    }

    res.json(promos);
  } catch (err) {
    console.error('getActivePromotions error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /promotions — full list for management UI
const getAllPromotions = async (req, res) => {
  try {
    const promos = await prisma.promotion.findMany({
      include: includeAuthor,
      orderBy: { startsAt: 'desc' },
    });
    // Annotate with computed status: upcoming | active | expired | inactive
    const now = new Date();
    const annotated = promos.map(p => {
      let status = 'active';
      if (!p.isActive) status = 'inactive';
      else if (new Date(p.startsAt) > now) status = 'upcoming';
      else if (new Date(p.endsAt) < now) status = 'expired';
      return { ...p, status };
    });
    res.json(annotated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPromotion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const promo = await prisma.promotion.findUnique({ where: { id }, include: includeAuthor });
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const buildPromoData = (body, file) => {
  const { title, description, ctaLabel, ctaUrl, startsAt, endsAt, hotelIds, brands, isActive } = body;
  const data = {
    title: String(title || '').trim(),
    description: description ? String(description).trim() : null,
    ctaLabel: ctaLabel ? String(ctaLabel).trim() : null,
    ctaUrl: ctaUrl ? String(ctaUrl).trim() : null,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    hotelIds: hotelIds && String(hotelIds).trim() ? String(hotelIds).trim() : null,
    brands: brands && String(brands).trim() ? String(brands).trim() : null,
    isActive: isActive === undefined ? true : (isActive === true || isActive === 'true'),
  };
  if (file) data.imageUrl = `/uploads/${file.filename}`;
  return data;
};

const createPromotion = async (req, res) => {
  try {
    const data = buildPromoData(req.body, req.file);
    if (!data.title) return res.status(400).json({ message: 'العنوان مطلوب' });
    if (!data.startsAt || !data.endsAt) return res.status(400).json({ message: 'تاريخ البداية والنهاية مطلوبان' });
    if (data.endsAt <= data.startsAt) return res.status(400).json({ message: 'تاريخ النهاية لازم يكون بعد البداية' });

    data.createdById = req.user.id;
    const promo = await prisma.promotion.create({ data, include: includeAuthor });
    res.status(201).json(promo);
  } catch (err) {
    console.error('createPromotion error:', err);
    res.status(500).json({ message: err.message });
  }
};

const updatePromotion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    const data = buildPromoData(req.body, req.file);
    if (data.endsAt && data.startsAt && data.endsAt <= data.startsAt) {
      return res.status(400).json({ message: 'تاريخ النهاية لازم يكون بعد البداية' });
    }

    // If a new image was uploaded, remove the old file from disk
    if (req.file && existing.imageUrl) {
      const oldPath = path.join(__dirname, '../..', existing.imageUrl);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) {}
      }
    }
    // Don't overwrite the image if no new file came in
    if (!req.file) delete data.imageUrl;

    const promo = await prisma.promotion.update({ where: { id }, data, include: includeAuthor });
    res.json(promo);
  } catch (err) {
    console.error('updatePromotion error:', err);
    res.status(500).json({ message: err.message });
  }
};

const deletePromotion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    if (existing.imageUrl) {
      const filePath = path.join(__dirname, '../..', existing.imageUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }
    await prisma.promotion.delete({ where: { id } });
    res.json({ message: 'Promotion deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getActivePromotions,
  getAllPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
