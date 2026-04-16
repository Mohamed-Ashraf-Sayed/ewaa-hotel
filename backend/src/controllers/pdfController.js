const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();

const logoPath = path.join(__dirname, '../../../frontend/public/logo.png');
// Verify logo is a valid PNG/JPG (not SVG) - PDFKit doesn't support SVG
let hasLogo = false;
try {
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath, { encoding: null });
    const header = buf.slice(0, 4).toString('hex');
    // PNG: 89504e47, JPEG: ffd8ffe0/e1/e2
    hasLogo = header.startsWith('89504e47') || header.startsWith('ffd8');
  }
} catch (e) { hasLogo = false; }

// Arabic font paths
const CAIRO_REG = path.join(__dirname, '../../fonts/Cairo-Regular.ttf');
const CAIRO_BOLD = path.join(__dirname, '../../fonts/Cairo-Bold.ttf');

const NAVY = '#1a2f44';
const DARK = '#243b53';
const MID = '#486581';
const LIGHT = '#829ab1';
const BG = '#f0f4f8';
const WHITE = '#ffffff';

const formatNum = (n) => n ? n.toLocaleString('en-US') : '0';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-';

// Check if text contains Arabic
const isArabic = (text) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

// Set font based on content
const setFont = (doc, bold, text) => {
  if (isArabic(String(text || ''))) {
    doc.font(bold ? CAIRO_BOLD : CAIRO_REG);
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
  }
};

// Draw a table row
const drawRow = (doc, y, cols, widths, options = {}) => {
  const { bold, bg, textColor, headerLine, fontSize } = options;
  const h = options.height || 22;
  const startX = 40;

  if (bg) {
    doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), h).fill(bg);
  }

  let x = startX;
  cols.forEach((text, i) => {
    const t = String(text || '');
    setFont(doc, bold, t);
    const align = isArabic(t) ? 'right' : (options.aligns?.[i] || 'left');
    doc.fontSize(fontSize || 8)
      .fillColor(textColor || DARK)
      .text(t, x + 4, y + 5, { width: widths[i] - 8, align, features: ['rtla', 'arab'] });
    x += widths[i];
  });

  if (headerLine) {
    doc.moveTo(startX, y + h).lineTo(startX + widths.reduce((a, b) => a + b, 0), y + h).strokeColor(NAVY).lineWidth(1.5).stroke();
  } else {
    doc.moveTo(startX, y + h).lineTo(startX + widths.reduce((a, b) => a + b, 0), y + h).strokeColor('#d9e2ec').lineWidth(0.5).stroke();
  }

  return y + h;
};

// ==================== PRICE QUOTE PDF ====================
const generateQuote = async (req, res) => {
  try {
    const { clientId, hotelId, items, validDays, notes, companyName, contactPerson } = req.body;

    const hotel = hotelId ? await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } }) : null;
    const client = clientId ? await prisma.client.findUnique({ where: { id: parseInt(clientId) } }) : null;

    const ref = `QT-${Date.now().toString().slice(-8)}`;
    const today = new Date();
    const validUntil = new Date(today);
    validUntil.setDate(validUntil.getDate() + (parseInt(validDays) || 30));

    const parsedItems = (items || []).map(item => ({
      description: item.description || '',
      roomType: item.roomType || '',
      nights: parseInt(item.nights) || 0,
      rooms: parseInt(item.rooms) || 0,
      rate: parseFloat(item.ratePerNight) || 0,
    }));
    parsedItems.forEach(i => { i.total = i.nights * i.rooms * i.rate; });
    const subtotal = parsedItems.reduce((s, i) => s + i.total, 0);
    const vat = Math.round(subtotal * 0.15);
    const grandTotal = subtotal + vat;

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Quote_${ref}.pdf`);
    doc.pipe(res);

    // Register Cairo fonts
    doc.registerFont('Cairo', CAIRO_REG);
    doc.registerFont('Cairo-Bold', CAIRO_BOLD);

    // Header
    let y = 40;
    if (hasLogo) {
      doc.image(logoPath, 40, y, { height: 50 });
    }
    const headerX = hasLogo ? 110 : 40;
    const hotelName = hotel?.nameEn || hotel?.name || 'Ewaa Hotels';
    setFont(doc, true, hotelName);
    doc.fontSize(16).fillColor(NAVY).text(hotelName, headerX, y, { features: ['rtla', 'arab'] });
    const loc = [hotel?.location, hotel?.city].filter(Boolean).join(', ');
    setFont(doc, false, loc);
    doc.fontSize(9).fillColor(MID).text(loc, headerX, y + 20, { features: ['rtla', 'arab'] });
    y += 55;

    // Line
    doc.moveTo(40, y).lineTo(555, y).strokeColor(NAVY).lineWidth(2).stroke();
    y += 15;

    // Title
    doc.font('Helvetica-Bold').fontSize(15).fillColor(NAVY).text('PRICE QUOTATION', 40, y, { align: 'center' });
    y += 30;

    // Info columns
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Quotation Details', 40, y);
    doc.text('Client Details', 300, y);
    y += 16;

    const infoStyle = (label, value, x, yy) => {
      doc.font('Helvetica').fontSize(8).fillColor(MID).text(`${label}: `, x, yy, { continued: true });
      setFont(doc, false, value);
      doc.fillColor(DARK).text(value, { features: ['rtla', 'arab'] });
    };

    infoStyle('Reference', ref, 40, y);
    infoStyle('Company', companyName || client?.companyName || '-', 300, y); y += 13;
    infoStyle('Date', formatDate(today), 40, y);
    infoStyle('Contact', contactPerson || client?.contactPerson || '-', 300, y); y += 13;
    infoStyle('Valid Until', formatDate(validUntil), 40, y);
    infoStyle('Phone', client?.phone || '-', 300, y); y += 13;
    const preparedBy = req.user.name;
    infoStyle('Prepared By', preparedBy, 40, y);
    infoStyle('Email', client?.email || '-', 300, y);
    y += 25;

    // Items table
    if (parsedItems.length > 0) {
      const widths = [190, 60, 60, 80, 125];
      const headers = ['Description / Room Type', 'Rooms', 'Nights', 'Rate/Night (SAR)', 'Total (SAR)'];
      y = drawRow(doc, y, headers, widths, {
        bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24,
        aligns: ['left', 'center', 'center', 'right', 'right']
      });

      parsedItems.forEach((item, i) => {
        const desc = item.description + (item.roomType ? ` - ${item.roomType}` : '');
        y = drawRow(doc, y, [desc, item.rooms, item.nights, formatNum(item.rate), formatNum(item.total)], widths, {
          bg: i % 2 === 0 ? BG : null,
          aligns: ['left', 'center', 'center', 'right', 'right']
        });
      });

      y += 10;
      // Totals
      const tx = 380;
      doc.font('Helvetica').fontSize(9).fillColor(MID).text('Subtotal:', tx, y);
      doc.font('Helvetica').fillColor(DARK).text(`${formatNum(subtotal)} SAR`, tx + 80, y, { align: 'right', width: 95 }); y += 15;
      doc.font('Helvetica').fillColor(MID).text('VAT (15%):', tx, y);
      doc.font('Helvetica').fillColor(DARK).text(`${formatNum(vat)} SAR`, tx + 80, y, { align: 'right', width: 95 }); y += 3;
      doc.moveTo(tx, y + 10).lineTo(555, y + 10).strokeColor(NAVY).lineWidth(1).stroke(); y += 15;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Grand Total:', tx, y);
      doc.text(`${formatNum(grandTotal)} SAR`, tx + 80, y, { align: 'right', width: 95 });
      y += 30;
    }

    // Notes
    if (notes) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Notes & Terms:', 40, y); y += 14;
      setFont(doc, false, notes);
      doc.fontSize(8).fillColor(MID).text(notes, 40, y, { width: 515, features: ['rtla', 'arab'] });
      y += doc.heightOfString(notes, { width: 515 }) + 15;
    }

    // Standard terms
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Terms & Conditions:', 40, y); y += 13;
    const terms = [
      'Prices are in Saudi Riyals (SAR) and include applicable taxes unless stated otherwise.',
      'This quotation is valid for the period mentioned above.',
      'Rates are subject to availability at the time of booking confirmation.',
    ];
    terms.forEach(t => {
      doc.font('Helvetica').fontSize(7).fillColor(LIGHT).text(`•  ${t}`, 40, y, { width: 515 }); y += 11;
    });

    doc.end();
  } catch (err) {
    console.error('Quote PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ==================== CLIENT REPORT PDF ====================
const generateClientReport = async (req, res) => {
  try {
    const { type, hotelId } = req.query;
    const where = {};
    if (type) where.clientType = type;
    if (hotelId) where.hotelId = parseInt(hotelId);

    const ADMIN_ROLES = ['general_manager', 'vice_gm'];
    if (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== 'contract_officer') {
      if (req.user.role === 'sales_director') {
        const subs = await prisma.user.findMany({ where: { managerId: req.user.id }, select: { id: true } });
        where.salesRepId = { in: [req.user.id, ...subs.map(s => s.id)] };
      } else {
        where.salesRepId = req.user.id;
      }
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        salesRep: { select: { name: true } },
        hotel: { select: { name: true } },
        _count: { select: { contracts: true, visits: true } },
      },
      orderBy: { companyName: 'asc' },
    });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.registerFont('Cairo', CAIRO_REG);
    doc.registerFont('Cairo-Bold', CAIRO_BOLD);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Client_Report.pdf`);
    doc.pipe(res);

    // Header - RTL (logo on right)
    let y = 30;
    const pageW = 812 - 60; // landscape width minus margins
    if (hasLogo) {
      doc.image(logoPath, 812 - 30 - 55, y, { height: 40 });
    }
    const hx = 812 - 30 - (hasLogo ? 70 : 0);
    doc.font('Cairo-Bold').fontSize(14).fillColor(NAVY).text('فنادق إيواء', 30, y, { align: 'right', width: hx - 30, features: ['rtla', 'arab'] });
    doc.font('Cairo').fontSize(11).fillColor(MID).text('تقرير العملاء', 30, y + 17, { align: 'right', width: hx - 30, features: ['rtla', 'arab'] });
    doc.font('Helvetica').fontSize(7).fillColor(LIGHT).text(`${formatDate(new Date())} | ${clients.length} عميل`, 30, y + 31, { align: 'right', width: hx - 30 });
    y += 50;

    doc.moveTo(30, y).lineTo(812 - 30, y).strokeColor(NAVY).lineWidth(2).stroke();
    y += 12;

    // Table - RTL: columns reversed (right to left)
    const widths = [50, 50, 100, 110, 60, 90, 110, 170, 30];
    const headers = ['الزيارات', 'العقود', 'المندوب', 'الفندق', 'النوع', 'الهاتف', 'جهة الاتصال', 'الشركة', '#'];
    const aligns = ['center', 'center', 'right', 'right', 'center', 'center', 'right', 'right', 'center'];

    y = drawRow(doc, y, headers, widths, {
      bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 22, aligns
    });

    const typeLabel = { active: 'نشط', lead: 'محتمل', inactive: 'غير نشط' };

    clients.forEach((c, i) => {
      if (y > 530) {
        doc.addPage(); y = 30;
        y = drawRow(doc, y, headers, widths, {
          bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 22, aligns
        });
      }
      y = drawRow(doc, y, [
        c._count.visits, c._count.contracts, c.salesRep?.name || '-', c.hotel?.name || '-',
        typeLabel[c.clientType] || c.clientType, c.phone || '-',
        c.contactPerson || '-', c.companyName, i + 1
      ], widths, {
        bg: i % 2 === 0 ? BG : null, aligns
      });
    });

    // Summary
    y += 15;
    const active = clients.filter(c => c.clientType === 'active').length;
    const leads = clients.filter(c => c.clientType === 'lead').length;
    const inactive = clients.filter(c => c.clientType === 'inactive').length;

    doc.font('Cairo-Bold').fontSize(9);
    const summary = `نشط: ${active}   |   محتمل: ${leads}   |   غير نشط: ${inactive}`;
    doc.fillColor(NAVY).text(summary, 30, y, { align: 'right', width: pageW, features: ['rtla', 'arab'] });

    doc.end();
  } catch (err) {
    console.error('Client report PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateQuote, generateClientReport };
