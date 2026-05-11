const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { generateQuote } = require('../controllers/pdfController');

const prisma = new PrismaClient();

// List all quotes for a given client (newest first)
router.get('/client/:clientId', authenticate, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!Number.isFinite(clientId)) return res.status(400).json({ message: 'Invalid clientId' });

    const quotes = await prisma.quote.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        hotel:    { select: { id: true, name: true, nameEn: true } },
        salesRep: { select: { id: true, name: true } },
      },
    });
    // Hide the items JSON from the list view — clients only need summary
    res.json(quotes.map(q => ({
      id: q.id,
      reference: q.reference,
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
      lang: q.lang,
      meals: q.meals,
      createdAt: q.createdAt,
    })));
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

    // Reshape into the same body the original POST /pdf/quote takes, then
    // delegate to generateQuote with skipSave=true and frozen ref/dates so
    // we get a byte-identical re-render without creating a duplicate row.
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
