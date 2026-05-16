const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize, getSubordinateIds } = require('../middleware/auth');
const { generateQuote } = require('../controllers/pdfController');

const prisma = new PrismaClient();
const APPROVER_ROLES = ['sales_director', 'general_manager', 'vice_gm', 'admin'];

// Sweep any approved-but-consumed quotes whose linked booking has departed,
// flipping them to 'closed'. Called before every quote listing so the team
// sees up-to-date statuses without us running a cron. Cheap query: only
// touches the small set of approved quotes that actually have a link.
const closeExpiredQuotes = async () => {
  const stale = await prisma.quote.findMany({
    where: {
      status: 'approved',
      linkedBookingId: { not: null },
      linkedBooking: { departureDate: { lt: new Date() } },
    },
    select: { id: true },
  });
  if (stale.length === 0) return;
  await prisma.quote.updateMany({
    where: { id: { in: stale.map(q => q.id) } },
    data: { status: 'closed', closedAt: new Date() },
  });
};

// Shared select shape used by both the per-client listing and the global
// "pending approval" listing for managers.
const quoteListShape = (q) => ({
  id: q.id,
  reference: q.reference,
  clientId: q.clientId,
  clientName: q.client?.companyName || null,
  hotelId: q.hotelId,
  hotelName: q.hotel?.name || null,
  salesRepId: q.salesRepId,
  salesRepName: q.salesRep?.name || null,
  subtotal: q.subtotal,
  munTaxRate: q.munTaxRate,
  munTax: q.munTax,
  vat: q.vat,
  grandTotal: q.grandTotal,
  validUntil: q.validUntil,
  arrivalDate: q.arrivalDate,
  lang: q.lang,
  meals: q.meals,
  status: q.status,
  approvalNote: q.approvalNote,
  approvedAt: q.approvedAt,
  approvedByName: q.approvedBy?.name || null,
  closedAt: q.closedAt,
  linkedBookingId: q.linkedBookingId,
  createdAt: q.createdAt,
});

// List all quotes for a given client (newest first)
router.get('/client/:clientId', authenticate, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!Number.isFinite(clientId)) return res.status(400).json({ message: 'Invalid clientId' });

    await closeExpiredQuotes();
    const quotes = await prisma.quote.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        hotel:      { select: { id: true, name: true, nameEn: true } },
        salesRep:   { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        client:     { select: { companyName: true } },
        linkedBooking: { select: { id: true, departureDate: true, operaConfirmationNo: true } },
      },
    });
    res.json(quotes.map(q => ({
      ...quoteListShape(q),
      linkedBookingDeparture: q.linkedBooking?.departureDate || null,
      linkedBookingOpera:     q.linkedBooking?.operaConfirmationNo || null,
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Listing for the "approvals" workspace — pending quotes the current user
// is allowed to approve. Sales director sees their team's, admins see all.
router.get('/pending-approval', authenticate, authorize(...APPROVER_ROLES), async (req, res) => {
  try {
    await closeExpiredQuotes();
    const isAdmin = ['admin', 'general_manager', 'vice_gm'].includes(req.user.role);
    const where = { status: 'pending_manager_approval' };
    if (!isAdmin && req.user.role === 'sales_director') {
      const subIds = await getSubordinateIds(req.user.id);
      where.salesRepId = { in: [req.user.id, ...subIds] };
    }
    const quotes = await prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        hotel:      { select: { id: true, name: true, nameEn: true } },
        salesRep:   { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        client:     { select: { companyName: true } },
      },
    });
    res.json(quotes.map(quoteListShape));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Manager approves a pending quote → status becomes 'approved'.
router.post('/:id/approve', authenticate, authorize(...APPROVER_ROLES), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const note = (req.body?.note || '').toString().trim() || null;
    const q = await prisma.quote.findUnique({
      where: { id },
      include: { salesRep: { select: { id: true, name: true, managerId: true } }, client: { select: { companyName: true } } },
    });
    if (!q) return res.status(404).json({ message: 'Quote not found' });
    if (q.status !== 'pending_manager_approval') {
      return res.status(400).json({ message: 'العرض ليس بانتظار موافقة' });
    }
    const isAdmin = ['admin', 'general_manager', 'vice_gm'].includes(req.user.role);
    const isManagerOfRep = req.user.role === 'sales_director' && q.salesRep.managerId === req.user.id;
    if (!isAdmin && !isManagerOfRep) return res.status(403).json({ message: 'لا تملك صلاحية الموافقة على هذا العرض' });

    const updated = await prisma.quote.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalNote: note,
      },
    });
    // Notify the rep
    await prisma.notification.create({
      data: {
        userId: q.salesRepId,
        type: 'quote_approved',
        title: 'تم اعتماد عرض السعر',
        message: `عرض السعر ${q.reference} للعميل ${q.client?.companyName || ''} تم اعتماده.`,
        link: `/clients/${q.clientId}`,
      },
    }).catch(() => null);
    await prisma.activity.create({
      data: {
        clientId: q.clientId,
        userId: req.user.id,
        type: 'quote_approved',
        description: `اعتمد عرض السعر ${q.reference}${note ? ` — ملاحظة: ${note}` : ''}`,
      },
    }).catch(() => null);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Manager rejects a pending quote → status becomes 'rejected'. Reason
// mandatory so the rep knows what to fix.
router.post('/:id/reject', authenticate, authorize(...APPROVER_ROLES), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const note = (req.body?.note || '').toString().trim();
    if (!note) return res.status(400).json({ message: 'سبب الرفض مطلوب' });
    const q = await prisma.quote.findUnique({
      where: { id },
      include: { salesRep: { select: { id: true, managerId: true } }, client: { select: { companyName: true } } },
    });
    if (!q) return res.status(404).json({ message: 'Quote not found' });
    if (q.status !== 'pending_manager_approval') {
      return res.status(400).json({ message: 'العرض ليس بانتظار موافقة' });
    }
    const isAdmin = ['admin', 'general_manager', 'vice_gm'].includes(req.user.role);
    const isManagerOfRep = req.user.role === 'sales_director' && q.salesRep.managerId === req.user.id;
    if (!isAdmin && !isManagerOfRep) return res.status(403).json({ message: 'لا تملك صلاحية رفض هذا العرض' });

    const updated = await prisma.quote.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalNote: note,
      },
    });
    await prisma.notification.create({
      data: {
        userId: q.salesRepId,
        type: 'quote_rejected',
        title: 'تم رفض عرض السعر',
        message: `عرض السعر ${q.reference} للعميل ${q.client?.companyName || ''} تم رفضه. السبب: ${note}`,
        link: `/clients/${q.clientId}`,
      },
    }).catch(() => null);
    await prisma.activity.create({
      data: {
        clientId: q.clientId,
        userId: req.user.id,
        type: 'quote_rejected',
        description: `رفض عرض السعر ${q.reference} — السبب: ${note}`,
      },
    }).catch(() => null);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Re-download the PDF for a saved quote (uses the frozen items + totals)
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });

    let items;
    try { items = JSON.parse(quote.items); } catch { items = []; }

    req.body = {
      clientId: quote.clientId,
      hotelId: quote.hotelId,
      items: items.map(i => ({
        description: i.description,
        roomType: i.roomType,
        nights: String(i.nights ?? ''),
        rooms: String(i.rooms ?? ''),
        ratePerNight: String(i.rate ?? ''),
      })),
      validDays: quote.validDays,
      notes: quote.notes,
      municipalityTaxPercent: quote.munTaxRate,
      lang: quote.lang,
      meals: quote.meals,
      preparedByTitle: quote.preparedByTitle,
      paymentTerms: quote.paymentTerms,
      arrivalDate: quote.arrivalDate,
      companyName: quote.client?.companyName,
      contactPerson: quote.client?.contactPerson,
    };
    req._skipSave = true;
    req._overrideRef = quote.reference;
    req._overrideDate = quote.createdAt;
    req._overrideValidUntil = quote.validUntil;
    return generateQuote(req, res);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
