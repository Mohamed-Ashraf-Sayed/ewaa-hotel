const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { shapeArabic, isArabic, ARABIC_FEATURES } = require('../utils/arabicPdf');
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

const quoteFooterPath = path.join(__dirname, '../../../frontend/public/quote-footer.jpg');
let hasQuoteFooter = false;
try {
  if (fs.existsSync(quoteFooterPath)) {
    const buf = fs.readFileSync(quoteFooterPath, { encoding: null });
    const header = buf.slice(0, 4).toString('hex');
    hasQuoteFooter = header.startsWith('89504e47') || header.startsWith('ffd8');
  }
} catch (e) { hasQuoteFooter = false; }

// Arabic font paths
const CAIRO_REG = path.join(__dirname, '../../fonts/Cairo-Regular.ttf');
const CAIRO_BOLD = path.join(__dirname, '../../fonts/Cairo-Bold.ttf');

const NAVY = '#1a2f44';
const DARK = '#243b53';
const MID = '#486581';
const LIGHT = '#829ab1';
const BG = '#f0f4f8';
const WHITE = '#ffffff';

// Extract the English form of a user's name. Handles "English - Arabic" bilingual
// format, pure-Latin names, and Arabic-only names (fallback to email username).
const extractEnglishName = (name, email) => {
  if (!name) return (email || '').split('@')[0] || '';
  if (name.includes(' - ')) {
    const parts = name.split(' - ').map(s => s.trim()).filter(Boolean);
    const latin = parts.find(p => !isArabic(p));
    if (latin) return latin;
  }
  if (!isArabic(name)) return name;
  const username = (email || '').split('@')[0];
  if (!username) return name;
  return username.split(/[._-]/).filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
};

const ROLE_TITLE_EN = {
  admin: 'IT Administrator',
  general_manager: 'General Manager',
  vice_gm: 'Vice General Manager',
  sales_director: 'Sales Director',
  assistant_sales: 'Assistant Sales',
  sales_rep: 'Sales Representative',
  reservations: 'Reservations Officer',
  credit_manager: 'Credit Manager',
  credit_officer: 'Credit Officer',
  contract_officer: 'Contract Officer',
};
const roleTitle = (role) => ROLE_TITLE_EN[role] || (role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');

const formatNum = (n) => n ? n.toLocaleString('en-US') : '0';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-';
const formatDateTime = (d) => {
  const x = d ? new Date(d) : new Date();
  const date = x.toLocaleDateString('en-GB');
  const time = x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

// Set font based on content
const setFont = (doc, bold, text) => {
  if (isArabic(String(text || ''))) {
    doc.font(bold ? CAIRO_BOLD : CAIRO_REG);
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
  }
};

// Draw a cell of text. When the run contains Arabic we pass OpenType features
// (rtla + arab) so fontkit does letter-joining and BiDi reordering — without
// them the glyphs render isolated and read as gibberish in PDF viewers.
const drawText = (doc, text, x, y, options = {}) => {
  const raw = String(text ?? '');
  const opts = isArabic(raw)
    ? { ...options, features: [...(options.features || []), ...ARABIC_FEATURES] }
    : options;
  doc.text(raw, x, y, opts);
};

// Draw a table row. Table is drawn LEFT-TO-RIGHT in the `cols` array — for RTL
// tables the caller must pass columns already in the desired visual left→right order.
const drawRow = (doc, y, cols, widths, options = {}) => {
  const { bold, bg, textColor, headerLine, fontSize } = options;
  const h = options.height || 22;
  const startX = options.startX || 30;
  const totalW = widths.reduce((a, b) => a + b, 0);

  if (bg) {
    doc.rect(startX, y, totalW, h).fill(bg);
  }

  let x = startX;
  cols.forEach((text, i) => {
    const t = String(text ?? '');
    setFont(doc, bold, t);
    const align = options.aligns?.[i] || (isArabic(t) ? 'right' : 'left');
    doc.fontSize(fontSize || 8).fillColor(textColor || DARK);
    drawText(doc, t, x + 4, y + 6, { width: widths[i] - 8, align });
    x += widths[i];
  });

  if (headerLine) {
    doc.moveTo(startX, y + h).lineTo(startX + totalW, y + h).strokeColor(NAVY).lineWidth(1.5).stroke();
  } else {
    doc.moveTo(startX, y + h).lineTo(startX + totalW, y + h).strokeColor('#d9e2ec').lineWidth(0.5).stroke();
  }

  return y + h;
};

// Shared report header: logo (right), centered title, meta line with user + date/time
const drawReportHeader = (doc, { titleAr, subtitleAr, user, pageW = 812, marginX = 30 }) => {
  let y = 25;
  const logoH = 42;

  // Logo on the right (RTL convention)
  if (hasLogo) {
    doc.image(logoPath, pageW - marginX - 50, y, { height: logoH });
  }

  // Centered title
  doc.font(CAIRO_BOLD).fontSize(20).fillColor(NAVY);
  drawText(doc, titleAr, marginX, y + 4, { align: 'center', width: pageW - marginX * 2 });

  // Subtitle under the title
  if (subtitleAr) {
    doc.font(CAIRO_REG).fontSize(11).fillColor(MID);
    drawText(doc, subtitleAr, marginX, y + 28, { align: 'center', width: pageW - marginX * 2 });
  }

  y += logoH + 12;

  // Meta line: generated by + date/time
  const genLabel = 'أنشأ التقرير:';
  const dateLabel = 'التاريخ والوقت:';
  doc.font(CAIRO_REG).fontSize(9).fillColor(LIGHT);
  // Right side: user name
  drawText(doc, `${genLabel} ${user?.name || '-'}`, marginX, y, { width: (pageW - marginX * 2) / 2, align: 'right' });
  // Left side: date/time (LTR)
  doc.font('Helvetica').fontSize(9).fillColor(LIGHT);
  doc.text(`${formatDateTime(new Date())}`, marginX, y, { width: (pageW - marginX * 2) / 2, align: 'left' });

  y += 16;
  doc.moveTo(marginX, y).lineTo(pageW - marginX, y).strokeColor(NAVY).lineWidth(1.5).stroke();
  return y + 10;
};

// ==================== PRICE QUOTE PDF ====================
// Quote PDF labels (English-only)
const QUOTE_T = {
  en: {
    title: 'PRICE QUOTATION',
    quoteDetails: 'Quotation Details',
    clientDetails: 'Client Details',
    reference: 'Reference', date: 'Date', validUntil: 'Valid Until', preparedBy: 'Prepared By',
    company: 'Company', contact: 'Contact', phone: 'Phone', email: 'Email',
    descRoom: 'Description / Room Type', rooms: 'Rooms', nights: 'Nights',
    rateNight: 'Rate/Night (SAR)', totalCol: 'Total (SAR)',
    subtotal: 'Subtotal', vat: 'VAT (15%)', municipalityTax: 'Municipality Tax', grandTotal: 'Grand Total',
    sar: 'SAR', notesTerms: 'Notes & Terms',
    benefits: 'Benefits:',
    benefit1: (tax) => `Above room rates are excluding 15% VAT${tax > 0 ? `, ${tax}% municipality tax` : ''} at Ewaa Express Hotels.`,
    benefit2: 'The above rates are NET, Non-Commissionable, and quoted in Saudi Riyals.',
    benefit3: 'The above quoted rates are inclusive of WI – Fi internet.',
    benefit4: 'Above rates are on BB.',
    termsTitle: 'Terms & Conditions:',
    terms1: 'Check in time is 15:00PM and check out time is at 12:00PM. Any late check-out after 16:00 hours will be subject to a 50% of the contracted rate and any check out after 18:00 hours will be subject to an additional full night rate. Early check in and extended check out facilities is subject to availability.',
    terms2: 'Should the group wish to stay longer than 12.00 noon then luggage can be picked up and stored until departure time while all guests can avail of the use of all hotel service.',
    terms3: 'The Company undertakes that their guests shall comply with all applicable laws, rules and regulations under the laws of the Kingdom of Saudi Arabia and the internal regulations applicable to guests of the Hotelier.',
    terms4: 'The performance of this agreement by either party is subject to acts of God, government authority, disaster, strikes, civil disorders, or other emergencies, any of which make it illegal or impossible to provide the facilities and / or services. It is provided that this Contract may be terminated for any one or more such reasons by written notice from one party to the other without liability.',
    cancellation: 'Cancellation:',
    cancelIntro: 'The details for the cancellation charges policy are as follows:',
    cancel1: '06 days prior to the group’s arrival, any cancellation will be charged 50% of the room rate or event charge for the agreed stay.',
    cancel2: '03 days prior to the group’s arrival, any cancellation will be charged 75% of the room rate or event charge for the agreed stay.',
    cancel3: 'On the day of the group’s arrival, any cancellation will be charged 100% of the room rate for the agreed stay.',
    otherConditions: 'Other Conditions:',
    otherText: 'The performance of this Agreement is subject to termination without liability upon the occurrence of any circumstance beyond the control of either party — such as acts of God, war, acts of terrorism, government regulations, disaster, strikes, civil disorder, or curtailment of transportation facilities — to the extent that such circumstance makes it illegal or impossible for the Hotel to provide, or for groups in general to use, the Hotel facilities. The ability to terminate this Agreement without liability pursuant to this paragraph is conditioned upon delivery of written notice to the other party setting forth the basis for such termination as soon as reasonably practical — but in no event longer than ten (10) days — after learning of such basis.',
    payments: 'Payments:',
    pay1: '50% of total group amount to be received after signing this offer.',
    pay2: 'Rest of payment with rooming list to be received 03 days before arrival.',
    bankAccount: 'Bank Account Details:',
    bankName: 'Bank name: Bank Al-Rajhi',
    accountName: 'Account name: Grand Plaza Hotel – Gulf',
    accountNumber: 'Account number: 504 6080 10080399',
    iban: 'IBAN: SA 48 8000 0504 6080 1008 0399',
    rateDisclosure: 'Rate & Rate Disclosure:',
    rateDisclosureText: 'The rates specified herein are applicable to this agreement only and are strictly confidential. The Client shall refrain from directly or indirectly disclosing the rates to a third party using any medium. In case of an indirect resale, the Client shall bind the contracting party to the same obligations.',
    forceMajeure: 'Force Majeure:',
    forceMajeureText: 'If performance of this Contract or any obligation under this Contract is prevented, restricted, or interfered with by causes beyond either party’s reasonable control ("Force Majeure"), and if the party unable to carry out its obligations gives the other party prompt written notice of such event, then the obligations of the party invoking this provision shall be suspended to the extent necessary by such event. The term Force Majeure shall include, without limitation, acts of God, fire, pandemic, epidemic, explosion, vandalism, storm or other similar occurrence, orders or acts of military or civil authority, or by national emergencies, insurrections, riots, or wars, or strikes, lock-outs, work stoppages or other labor disputes, or supplier failures. The excused party shall use reasonable efforts under the circumstances to avoid or remove such causes of non-performance and shall proceed to perform with reasonable dispatch whenever such causes are removed or ceased. An act of omission shall be deemed within the reasonable control of a party if committed, omitted, or caused by such party, or its employees, officers, agents, or affiliates. In such event, the Provider will submit to the Recipient documentation evidencing (1) fees incurred and (2) the respective proof of payment for costs relating to the SOW shown above, as of the date the Force Majeure was enforced. The Recipient will only compensate the Provider if both conditions have been met.',
    jurisdiction: 'Jurisdiction:',
    jurisdictionText: 'This agreement is governed by the laws of the Kingdom of Saudi Arabia, and both parties agree that the Courts in Saudi Arabia shall have exclusive jurisdiction to settle any dispute between the parties.',
    standardTerms: 'Standard Terms:',
    standard1: 'The parties hereto, hereby represent and warrant that they have full power, authority and legal right to enter into this agreement and that all formalities, if any, concerning the execution of this agreement have been duly complied with. This agreement shall only be amended if there is a written document expressly stating to amend the agreement signed by duly authorized representatives of both parties.',
    standard2: 'Please note that we already made a tentative booking for you. Nevertheless your prompt written reply will be highly appreciated to allow us to prepare as necessary.',
    standard3: 'I trust the above offer is to your satisfaction, kindly sign the offer and affix your company stamp to confirm to the above terms and conditions. In the meantime if you require any clarifications, please do not hesitate to contact me directly.',
    standard4: 'We would be grateful if you could advise us with the confirmation by no later than 15 days prior to arrival date. Should we not hear from you by then, we will assume that you will no longer require the space reserved and will duly release it.',
    welcoming: 'We look forward to welcoming you and your guests at EWAA Express Hotels.',
    confirmOn: 'Confirm on / and or behalf of:',
    name: 'Name', signature: 'Signature', titleField: 'Title', dateField: 'Date', companyStamp: 'Company Stamp',
  },
};

const generateQuote = async (req, res) => {
  try {
    const { clientId, hotelId, items, validDays, notes, companyName, contactPerson,
      municipalityTaxPercent } = req.body;
    const t = QUOTE_T.en;
    const isAr = false;

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
    const munTaxRate = Math.max(0, parseFloat(municipalityTaxPercent) || 0);
    const munTax = Math.round(subtotal * munTaxRate / 100);
    const grandTotal = subtotal + vat + munTax;

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Quote_${ref}.pdf`);
    doc.pipe(res);

    // Register Cairo fonts
    doc.registerFont('Cairo', CAIRO_REG);
    doc.registerFont('Cairo-Bold', CAIRO_BOLD);

    // Footer banner on every page (image is ~1728x229, scales to width 515 ≈ height 68)
    const drawQuoteFooter = () => {
      if (!hasQuoteFooter) return;
      doc.save();
      doc.image(quoteFooterPath, 40, 768, { width: 515 });
      doc.restore();
    };
    doc.on('pageAdded', drawQuoteFooter);
    drawQuoteFooter();

    // Header — hotel name on the left (sits just above the divider), logo pinned to the far right
    let y = 40;
    const lineY = 120;  // header band ends here

    if (hasLogo) {
      // Logo is 1414x926; at height=80 width ≈ 122. Right edge aligned with margin (555).
      doc.image(logoPath, 433, y, { height: 80 });
    }

    const hotelName = hotel?.nameEn || hotel?.name || 'Ewaa Hotels';
    const loc = [hotel?.location, hotel?.city].filter(Boolean).join(', ');

    if (loc) {
      setFont(doc, false, loc);
      doc.fontSize(9).fillColor(MID).text(loc, 40, lineY - 38, { features: ARABIC_FEATURES });
    }
    setFont(doc, true, hotelName);
    doc.fontSize(16).fillColor(NAVY).text(hotelName, 40, lineY - 22, { features: ARABIC_FEATURES });

    y = lineY;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(NAVY).lineWidth(2).stroke();
    y += 15;

    // Title
    setFont(doc, true, t.title);
    doc.fontSize(15).fillColor(NAVY).text(t.title, 40, y, { align: 'center', features: ARABIC_FEATURES });
    y += 30;

    // Info columns
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(t.quoteDetails, 40, y);
    doc.text(t.clientDetails, 300, y);
    y += 16;

    const infoStyle = (label, value, x, yy) => {
      const labelStr = `${label}: `;
      const valueStr = String(value ?? '');
      const valIsArabic = isArabic(valueStr);
      // Label always Helvetica for clean Latin rendering.
      doc.font('Helvetica').fontSize(8).fillColor(MID).text(labelStr, x, yy, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelStr);
      // Value font based on content (Cairo for Arabic, Helvetica for Latin).
      setFont(doc, false, valueStr);
      doc.fontSize(8).fillColor(DARK);
      const opts = { width: 250 - labelWidth - 5, lineBreak: false };
      if (valIsArabic) opts.features = ARABIC_FEATURES;
      // Cairo at fontSize 8 has a taller ascent than Helvetica — lift Arabic
      // values 3px to put their baseline on the Helvetica label baseline.
      const offsetY = valIsArabic ? -3 : 0;
      doc.text(valueStr, x + labelWidth, yy + offsetY, opts);
    };

    infoStyle(t.reference, ref, 40, y);
    infoStyle(t.company, companyName || client?.companyName || '-', 300, y); y += 13;
    infoStyle(t.date, formatDate(today), 40, y);
    infoStyle(t.contact, contactPerson || client?.contactPerson || '-', 300, y); y += 13;
    infoStyle(t.validUntil, formatDate(validUntil), 40, y);
    infoStyle(t.phone, client?.phone || '-', 300, y); y += 13;
    const preparedBy = extractEnglishName(req.user.name, req.user.email);
    infoStyle(t.preparedBy, preparedBy, 40, y);
    infoStyle(t.email, client?.email || '-', 300, y);
    y += 25;

    // Items table
    if (parsedItems.length > 0) {
      const widths = [190, 60, 60, 80, 125];
      const headers = [t.descRoom, t.rooms, t.nights, t.rateNight, t.totalCol];
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
      const tx = 330;
      const drawTotal = (label, value, bold = false) => {
        setFont(doc, bold, label);
        doc.fontSize(bold ? 11 : 9).fillColor(bold ? NAVY : MID).text(label, tx, y, { width: 130, lineBreak: false, features: ARABIC_FEATURES });
        setFont(doc, bold, value);
        doc.fillColor(bold ? NAVY : DARK).text(value, tx + 130, y, { align: 'right', width: 95, lineBreak: false, features: ARABIC_FEATURES });
      };
      drawTotal(`${t.subtotal}:`, `${formatNum(subtotal)} ${t.sar}`); y += 15;
      drawTotal(`${t.vat}:`, `${formatNum(vat)} ${t.sar}`); y += 15;
      if (munTaxRate > 0) {
        drawTotal(`${t.municipalityTax} (${munTaxRate}%):`, `${formatNum(munTax)} ${t.sar}`); y += 15;
      }
      doc.moveTo(tx, y - 2).lineTo(555, y - 2).strokeColor(NAVY).lineWidth(1).stroke(); y += 5;
      drawTotal(`${t.grandTotal}:`, `${formatNum(grandTotal)} ${t.sar}`, true);
      y += 30;
    }

    // Notes
    if (notes) {
      setFont(doc, true, t.notesTerms);
      doc.fontSize(10).fillColor(NAVY).text(t.notesTerms, 40, y, { width: 515, align: isAr ? 'right' : 'left', features: ARABIC_FEATURES }); y += 14;
      setFont(doc, false, notes);
      doc.fontSize(8).fillColor(MID).text(notes, 40, y, { width: 515, align: isAr ? 'right' : 'left', features: ARABIC_FEATURES });
      y += doc.heightOfString(notes, { width: 515 }) + 15;
    }

    // === Standard Quote Boilerplate ===
    const PAGE_BOTTOM = hasQuoteFooter ? 760 : 800;
    const align = isAr ? 'right' : 'left';
    const ensureSpace = (cy, needed) => {
      if (cy + needed > PAGE_BOTTOM) { doc.addPage(); return 40; }
      return cy;
    };
    const section = (cy, title) => {
      cy = ensureSpace(cy, 22);
      setFont(doc, true, title);
      doc.fontSize(10).fillColor(NAVY).text(title, 40, cy, { width: 515, align, features: ARABIC_FEATURES });
      return cy + 14;
    };
    const para = (cy, text) => {
      setFont(doc, false, text);
      doc.fontSize(8).fillColor(MID);
      const h = doc.heightOfString(text, { width: 515 });
      cy = ensureSpace(cy, h + 6);
      doc.text(text, 40, cy, { width: 515, align: isAr ? 'right' : 'justify', features: ARABIC_FEATURES });
      return cy + h + 6;
    };
    const bullet = (cy, text) => {
      const display = isAr ? `${text}  •` : `•  ${text}`;
      setFont(doc, false, display);
      doc.fontSize(8).fillColor(MID);
      const h = doc.heightOfString(display, { width: 510 });
      cy = ensureSpace(cy, h + 3);
      doc.text(display, isAr ? 40 : 50, cy, { width: isAr ? 510 : 500, align, features: ARABIC_FEATURES });
      return cy + h + 3;
    };

    y += 5;
    y = section(y, t.benefits);
    y = bullet(y, t.benefit1(munTaxRate));
    y = bullet(y, t.benefit2);
    y = bullet(y, t.benefit3);
    y = bullet(y, t.benefit4);

    y += 6;
    y = section(y, t.termsTitle);
    y = para(y, t.terms1);
    y = para(y, t.terms2);
    y = para(y, t.terms3);
    y = para(y, t.terms4);

    y += 4;
    y = section(y, t.cancellation);
    y = para(y, t.cancelIntro);
    y = bullet(y, t.cancel1);
    y = bullet(y, t.cancel2);
    y = bullet(y, t.cancel3);

    y += 4;
    y = section(y, t.otherConditions);
    y = para(y, t.otherText);

    // Force the Payments section (and everything after) onto a new page
    doc.addPage();
    y = 40;
    y = section(y, t.payments);
    y = bullet(y, t.pay1);
    y = bullet(y, t.pay2);

    y += 4;
    y = section(y, t.bankAccount);
    y = bullet(y, t.bankName);
    y = bullet(y, t.accountName);
    y = bullet(y, t.accountNumber);
    y = bullet(y, t.iban);

    y += 4;
    y = section(y, t.rateDisclosure);
    y = para(y, t.rateDisclosureText);

    y += 4;
    y = section(y, t.forceMajeure);
    y = para(y, t.forceMajeureText);

    y += 4;
    y = section(y, t.jurisdiction);
    y = para(y, t.jurisdictionText);

    y += 4;
    y = section(y, t.standardTerms);
    y = para(y, t.standard1);
    y = para(y, t.standard2);
    y = para(y, t.standard3);
    y = para(y, t.standard4);

    y += 6;
    y = ensureSpace(y, 60);
    setFont(doc, true, t.welcoming);
    doc.fontSize(10).fillColor(NAVY).text(t.welcoming, 40, y, { width: 515, align: 'center', features: ARABIC_FEATURES });
    y += 30;

    y = ensureSpace(y, 90);
    setFont(doc, true, t.confirmOn);
    doc.fontSize(9).fillColor(NAVY).text(t.confirmOn, 40, y, { width: 515, align, features: ARABIC_FEATURES }); y += 28;

    const repTitle = roleTitle(req.user.role);
    const repDate = formatDate(today);

    const filledField = (label, value, labelX, valueX, lineEndX) => {
      doc.font('Helvetica').fontSize(8).fillColor(MID).text(`${label}:`, labelX, y);
      doc.font('Helvetica-Bold').fillColor(DARK).text(value, valueX, y - 1);
      doc.moveTo(valueX, y + 10).lineTo(lineEndX, y + 10).strokeColor(LIGHT).lineWidth(0.5).stroke();
    };

    filledField(t.name, preparedBy, 40, 80, 280);
    doc.font('Helvetica').fontSize(8).fillColor(MID).text(`${t.signature}:`, 310, y);
    doc.moveTo(370, y + 10).lineTo(555, y + 10).strokeColor(LIGHT).lineWidth(0.5).stroke();
    y += 25;
    filledField(t.titleField, repTitle, 40, 80, 280);
    filledField(t.dateField, repDate, 310, 350, 555);
    y += 25;
    doc.font('Helvetica').fontSize(8).fillColor(MID).text(`${t.companyStamp}:`, 40, y);

    doc.end();
  } catch (err) {
    console.error('Quote PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ==================== CLIENT REPORT PDF ====================
const generateClientReport = async (req, res) => {
  try {
    const { type, hotelId, salesRepId } = req.query;
    const where = {};
    if (type) where.clientType = type;
    if (hotelId) where.hotelId = parseInt(hotelId);

    const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];
    if (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== 'contract_officer') {
      if (req.user.role === 'assistant_sales' && req.user.managerId) {
        const subs = await prisma.user.findMany({ where: { managerId: req.user.managerId }, select: { id: true } });
        where.salesRepId = { in: [req.user.managerId, ...subs.map(s => s.id)] };
      } else if (req.user.role === 'sales_director') {
        const subs = await prisma.user.findMany({ where: { managerId: req.user.id }, select: { id: true } });
        where.salesRepId = { in: [req.user.id, ...subs.map(s => s.id)] };
      } else {
        where.salesRepId = req.user.id;
      }
    }

    // Explicit rep filter from UI (admins or overriding the scoped default)
    if (salesRepId) where.salesRepId = parseInt(salesRepId);

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

    const pageW = 812; // landscape A4 width
    let y = drawReportHeader(doc, {
      titleAr: 'تقرير العملاء',
      subtitleAr: `فنادق إيواء — إجمالي ${clients.length} عميل`,
      user: req.user,
      pageW,
    });

    // Table columns are drawn left→right on the page. For an RTL table we
    // arrange them so the first (Arabic-reader) column "#" sits on the right.
    // visual order (from RIGHT to LEFT for reader): # | الشركة | جهة الاتصال | الهاتف | النوع | الفندق | المندوب | العقود | الزيارات
    // on-page order (LEFT to RIGHT): الزيارات | العقود | المندوب | الفندق | النوع | الهاتف | جهة الاتصال | الشركة | #
    const widths = [55, 55, 110, 115, 60, 90, 115, 170, 30];
    const headers = ['الزيارات', 'العقود', 'المندوب', 'الفندق', 'النوع', 'الهاتف', 'جهة الاتصال', 'الشركة', '#'];
    const aligns = ['center', 'center', 'right', 'right', 'center', 'center', 'right', 'right', 'center'];

    y = drawRow(doc, y, headers, widths, {
      bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns, fontSize: 9,
    });

    const typeLabel = { active: 'نشط', lead: 'محتمل', inactive: 'غير نشط' };

    clients.forEach((c, i) => {
      if (y > 530) {
        doc.addPage();
        y = drawReportHeader(doc, {
          titleAr: 'تقرير العملاء',
          subtitleAr: `فنادق إيواء — إجمالي ${clients.length} عميل`,
          user: req.user,
          pageW,
        });
        y = drawRow(doc, y, headers, widths, {
          bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns, fontSize: 9,
        });
      }
      y = drawRow(doc, y, [
        c._count.visits, c._count.contracts, c.salesRep?.name || '-', c.hotel?.name || '-',
        typeLabel[c.clientType] || c.clientType, c.phone || '-',
        c.contactPerson || '-', c.companyName, i + 1
      ], widths, {
        bg: i % 2 === 0 ? BG : null, aligns,
      });
    });

    // Summary
    y += 15;
    const active = clients.filter(c => c.clientType === 'active').length;
    const leads = clients.filter(c => c.clientType === 'lead').length;
    const inactive = clients.filter(c => c.clientType === 'inactive').length;

    doc.font(CAIRO_BOLD).fontSize(9).fillColor(NAVY);
    const summary = `نشط: ${active}   |   محتمل: ${leads}   |   غير نشط: ${inactive}`;
    drawText(doc, summary, 30, y, { align: 'center', width: pageW - 60 });

    doc.end();
  } catch (err) {
    console.error('Client report PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateQuote, generateClientReport };
