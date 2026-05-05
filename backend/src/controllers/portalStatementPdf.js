const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { ARABIC_FEATURES } = require('../utils/arabicPdf');
const prisma = new PrismaClient();

const CAIRO_REG = path.join(__dirname, '../../fonts/Cairo-Regular.ttf');
const CAIRO_BOLD = path.join(__dirname, '../../fonts/Cairo-Bold.ttf');
const logoPath = path.join(__dirname, '../../../frontend/public/logo.png');

const NAVY = '#1a2f44';
const MID = '#486581';
const LIGHT = '#829ab1';
const ACCENT = '#0e7490';

const isArabic = (s) => /[؀-ۿ]/.test(String(s || ''));

const STATUS_LABELS = {
  pending_reservations: 'قيد المراجعة',
  confirmed: 'مؤكد',
  checked_in: 'داخل الفندق',
  checked_out: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};

// GET /portal/statement.pdf?month=YYYY-MM
const getStatementPdf = async (req, res) => {
  try {
    const client = req.client;
    const now = new Date();
    let monthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      const [y, m] = req.query.month.split('-').map(Number);
      monthDate = new Date(y, m - 1, 1);
    }
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

    const bookings = await prisma.booking.findMany({
      where: { clientId: client.id, arrivalDate: { gte: monthStart, lt: monthEnd } },
      select: {
        id: true, status: true, guestName: true, operaConfirmationNo: true,
        arrivalDate: true, departureDate: true, nights: true, roomsCount: true,
        ratePerNight: true, totalAmount: true, currency: true, paymentMethod: true,
        hotel: { select: { name: true, nameEn: true } },
      },
      orderBy: { arrivalDate: 'asc' },
    });

    // Aggregate (excludes cancelled)
    const billable = bookings.filter(b => b.status !== 'cancelled');
    const totals = billable.reduce((acc, b) => {
      acc.bookings += 1;
      acc.nights += b.nights || 0;
      acc.rooms += b.roomsCount || 0;
      acc.spent += b.totalAmount || 0;
      return acc;
    }, { bookings: 0, nights: 0, rooms: 0, spent: 0 });

    // Credit info
    const creditBookings = await prisma.booking.findMany({
      where: { clientId: client.id, paymentMethod: 'City Ledger', status: { in: ['confirmed', 'checked_in', 'checked_out'] } },
      select: { totalAmount: true },
    });
    const totalCharged = creditBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const approvedPayments = await prisma.payment.aggregate({
      where: { clientId: client.id, status: 'approved' },
      _sum: { amount: true },
    });
    const totalPaid = approvedPayments._sum.amount || 0;
    const outstanding = Math.max(0, totalCharged - totalPaid);
    const creditLimit = client.creditLimit ?? null;
    const availableCredit = creditLimit != null ? Math.max(0, creditLimit - outstanding) : null;

    const monthLabel = monthDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=statement-${client.id}-${req.query.month || ''}.pdf`);
    doc.pipe(res);

    doc.registerFont('Cairo', CAIRO_REG);
    doc.registerFont('Cairo-Bold', CAIRO_BOLD);

    const ar = (text) => doc.font(isArabic(text) ? 'Cairo' : 'Helvetica');
    const arBold = (text) => doc.font(isArabic(text) ? 'Cairo-Bold' : 'Helvetica-Bold');
    const arOpts = (extra = {}) => ({ features: ARABIC_FEATURES, ...extra });

    // Header
    let y = 40;
    let hasLogo = false;
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath, { encoding: null });
        const header = buf.slice(0, 4).toString('hex');
        hasLogo = header.startsWith('89504e47') || header.startsWith('ffd8');
      }
    } catch (_) {}
    if (hasLogo) doc.image(logoPath, 433, y, { height: 70 });

    arBold('Ewaa Hotels').fontSize(18).fillColor(NAVY).text('Ewaa Hotels', 40, y);
    ar('Client Portal Statement').fontSize(10).fillColor(MID).text('Client Portal Statement', 40, y + 26);

    y = 130;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(NAVY).lineWidth(2).stroke();
    y += 18;

    // Title
    arBold('كشف').fontSize(16).fillColor(NAVY).text('كشف الحجوزات الشهري', 40, y, arOpts({ align: 'center', width: 515 }));
    y += 24;
    ar(monthLabel).fontSize(11).fillColor(MID).text(monthLabel, 40, y, arOpts({ align: 'center', width: 515 }));
    y += 28;

    // Client block
    arBold('بيانات').fontSize(11).fillColor(NAVY).text('بيانات العميل', 40, y, arOpts());
    y += 18;
    const lines = [
      ['الشركة', client.companyName],
      ['جهة الاتصال', client.contactPerson],
      ['البريد', client.email || '—'],
      ['الهاتف', client.phone || '—'],
    ];
    for (const [label, value] of lines) {
      arBold(label).fontSize(9).fillColor(MID).text(`${label}:`, 40, y, arOpts());
      ar(String(value)).fontSize(9).fillColor(NAVY).text(String(value), 130, y, arOpts());
      y += 14;
    }
    y += 8;

    // Summary box
    const drawCard = (x, w, label, value, color = NAVY) => {
      doc.rect(x, y, w, 50).fillColor('#f0f4f8').fill();
      doc.rect(x, y, w, 50).strokeColor('#d9e2ec').lineWidth(0.5).stroke();
      ar(label).fontSize(9).fillColor(MID).text(label, x + 8, y + 8, arOpts({ width: w - 16, align: 'center' }));
      arBold(String(value)).fontSize(15).fillColor(color).text(String(value), x + 8, y + 24, arOpts({ width: w - 16, align: 'center' }));
    };
    const cardW = (515 - 12) / 4;
    drawCard(40, cardW, 'حجوزات الشهر', totals.bookings);
    drawCard(40 + cardW + 4, cardW, 'الليالي', totals.nights);
    drawCard(40 + (cardW + 4) * 2, cardW, 'الغرف', totals.rooms);
    drawCard(40 + (cardW + 4) * 3, cardW, 'الإجمالي (ر.س)', totals.spent.toLocaleString(), ACCENT);
    y += 60;

    // Credit block (only if a limit is set)
    if (creditLimit != null) {
      arBold('الحد الائتماني').fontSize(11).fillColor(NAVY).text('الحد الائتماني', 40, y, arOpts());
      y += 18;

      const creditCards = [
        ['الحد المعتمد', creditLimit, NAVY],
        ['المستحق علي الشركة', outstanding, '#dc2626'],
        ['المتاح', availableCredit ?? 0, '#059669'],
      ];
      const cw = (515 - 8) / 3;
      let cx = 40;
      for (const [label, value, color] of creditCards) {
        doc.rect(cx, y, cw, 46).fillColor('#fafbfc').fill();
        doc.rect(cx, y, cw, 46).strokeColor('#d9e2ec').lineWidth(0.5).stroke();
        ar(label).fontSize(8).fillColor(MID).text(label, cx + 6, y + 6, arOpts({ width: cw - 12, align: 'center' }));
        arBold(String(value)).fontSize(13).fillColor(color).text(`${Number(value).toLocaleString()} ر.س`, cx + 6, y + 22, arOpts({ width: cw - 12, align: 'center' }));
        cx += cw + 4;
      }
      y += 56;
    }

    // Bookings table
    arBold('تفاصيل').fontSize(11).fillColor(NAVY).text('تفاصيل الحجوزات', 40, y, arOpts());
    y += 18;

    if (bookings.length === 0) {
      ar('لا').fontSize(10).fillColor(LIGHT).text('لا توجد حجوزات في هذا الشهر.', 40, y, arOpts({ align: 'center', width: 515 }));
    } else {
      // Header row
      const cols = [
        { key: 'date',  label: 'الوصول',   w: 70 },
        { key: 'hotel', label: 'الفندق',    w: 130 },
        { key: 'guest', label: 'الضيف',     w: 110 },
        { key: 'opera', label: 'رقم اوبرا', w: 70 },
        { key: 'nr',    label: 'الليالي/الغرف', w: 60 },
        { key: 'total', label: 'الإجمالي',  w: 75 },
      ];
      const startX = 40;
      let cx = startX;
      doc.rect(startX, y, 515, 22).fillColor(NAVY).fill();
      for (const c of cols) {
        arBold(c.label).fontSize(9).fillColor('white').text(c.label, cx + 4, y + 6, arOpts({ width: c.w - 8, align: 'center' }));
        cx += c.w;
      }
      y += 22;

      // Body rows
      for (const b of bookings) {
        if (y > 760) {
          doc.addPage();
          y = 40;
        }
        if ((b.id % 2) === 0) {
          doc.rect(startX, y, 515, 28).fillColor('#f6f8fa').fill();
        }

        cx = startX;
        const arrival = new Date(b.arrivalDate).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' });
        const hotel = b.hotel?.name || '—';
        const opera = b.operaConfirmationNo || '—';
        const nr = `${b.nights} / ${b.roomsCount}`;
        const total = b.totalAmount != null ? `${b.totalAmount.toLocaleString()} ${b.currency}` : '—';

        const cells = [arrival, hotel, b.guestName, opera, nr, total];
        for (let i = 0; i < cols.length; i++) {
          const v = cells[i];
          ar(String(v)).fontSize(8).fillColor(NAVY).text(String(v), cx + 4, y + 5, arOpts({ width: cols[i].w - 8, align: 'center' }));
          cx += cols[i].w;
        }

        // Status badge under the row
        ar(STATUS_LABELS[b.status] || b.status).fontSize(7).fillColor(MID)
          .text(STATUS_LABELS[b.status] || b.status, startX + 4, y + 18, arOpts({ width: 70 }));

        y += 28;
      }
    }

    // Footer
    y = Math.max(y + 20, 770);
    ar('').fontSize(8).fillColor(LIGHT)
      .text(`تم إنشاء هذا الكشف من بوابة العملاء — Ewaa Hotels — ${new Date().toLocaleString('ar-EG')}`, 40, y, arOpts({ align: 'center', width: 515 }));

    doc.end();
  } catch (err) {
    console.error('getStatementPdf error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStatementPdf };
