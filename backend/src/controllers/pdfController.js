const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { shapeArabic, shapeForVisual, reverseArabicForLTR, isArabic, isPureArabic, ARABIC_FEATURES, arabicTextOpts } = require('../utils/arabicPdf');
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
// The original Cairo TTF shipped with this repo was a 39KB subset that was
// missing many glyphs, producing tofu boxes for punctuation/digits in
// mixed Arabic strings. Switched to Amiri (430KB full font, complete
// OpenType tables, designed for digital typesetting). Variables kept as
// CAIRO_* so existing call sites don't need to change.
const CAIRO_REG = path.join(__dirname, '../../fonts/Amiri-Regular.ttf');
const CAIRO_BOLD = path.join(__dirname, '../../fonts/Amiri-Bold.ttf');

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
  assistant_sales: 'Assistant Director of Sales',
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
  // Apply Arabic OpenType features so fontkit handles shaping + BiDi for
  // any string that contains Arabic. Mixing in non-Arabic chars is fine —
  // they get rendered as-is alongside the shaped Arabic runs.
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
// Footer banner drawn on every page of every report PDF (image is 1728x229).
// Width 600 → height ~80 in landscape; centered horizontally near bottom.
const drawReportFooterFn = (doc) => {
  if (!hasQuoteFooter) return;
  doc.save();
  doc.image(quoteFooterPath, 121, 505, { width: 600 });
  doc.restore();
};
const attachReportFooter = (doc) => {
  doc.on('pageAdded', () => drawReportFooterFn(doc));
  drawReportFooterFn(doc);
};

const drawReportHeader = (doc, { title, subtitle, user, pageW = 812, marginX = 30 }) => {
  let y = 25;
  const logoH = 42;

  // Logo kept top-right (Ewaa brand position) even though table is LTR.
  if (hasLogo) {
    doc.image(logoPath, pageW - marginX - 50, y, { height: logoH });
  }

  // Centered title (English — uses Helvetica for clean Latin glyphs)
  doc.font('Helvetica-Bold').fontSize(20).fillColor(NAVY);
  doc.text(title || '', marginX, y + 4, { align: 'center', width: pageW - marginX * 2 });

  // Subtitle
  if (subtitle) {
    doc.font('Helvetica').fontSize(11).fillColor(MID);
    doc.text(subtitle, marginX, y + 28, { align: 'center', width: pageW - marginX * 2 });
  }

  y += logoH + 12;

  // Meta line: user (left, LTR), date/time (right)
  const halfW = (pageW - marginX * 2) / 2;
  const midX = marginX + halfW;
  doc.font('Helvetica').fontSize(9).fillColor(LIGHT);
  doc.text(`Generated by: ${user?.name || '-'}`, marginX, y, { width: halfW, align: 'left' });
  doc.text(formatDateTime(new Date()), midX, y, { width: halfW, align: 'right' });

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
    descRoom: 'Description', roomType: 'Room Type', stayDates: 'Stay Dates', rooms: 'Rooms', nights: 'Nights',
    rateNight: 'Rate/Night (SAR)', totalCol: 'Total (SAR)',
    hallType: 'Hall Type', persons: 'Persons', duration: 'Duration (days)', rateDay: 'Rate/Day (SAR)',
    roomsHeading: 'Hotel Rooms', meetingsHeading: 'Meeting Rooms',
    subtotal: 'Subtotal', vat: 'VAT (15%)', municipalityTax: 'Municipality Tax', grandTotal: 'Grand Total',
    sar: 'SAR', notesTerms: 'Notes & Terms',
    benefits: 'Benefits:',
    benefit1: (tax) => `Above room rates are excluding 15% VAT${tax > 0 ? `, ${tax}% municipality tax` : ''} at Ewaa Express Hotels.`,
    benefit2: 'The above rates are NET, Non-Commissionable, and quoted in Saudi Riyals.',
    benefit3: 'The above quoted rates are inclusive of WI – Fi internet.',
    benefit4: (meals) => {
      const arr = Array.isArray(meals)
        ? meals
        : String(meals || '').split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length === 0 || arr.includes('none')) return null;
      if (arr.includes('full_board')) return 'Above rates include breakfast, lunch, and dinner.';
      const labels = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner' };
      const picked = ['breakfast','lunch','dinner'].filter(k => arr.includes(k)).map(k => labels[k]);
      if (picked.length === 0) return null;
      // Oxford-style join: a / a and b / a, b, and c.
      let joined;
      if (picked.length === 1) joined = picked[0];
      else if (picked.length === 2) joined = `${picked[0]} and ${picked[1]}`;
      else joined = `${picked.slice(0, -1).join(', ')}, and ${picked[picked.length - 1]}`;
      return `Above rates include ${joined}.`;
    },
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
    bankNameLabel: 'Bank name:',
    beneficiaryLabel: 'Beneficiary name:',
    nationalIdLabel: 'Unified National ID:',
    accountNumberLabel: 'Account number:',
    ibanLabel: 'IBAN:',
    bankMissing: 'Bank account details will be provided separately.',
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
    clientApproval: 'Client Approval:',
  },
  ar: {
    title: 'عرض السعر',
    quoteDetails: 'بيانات عرض السعر',
    clientDetails: 'بيانات العميل',
    reference: 'المرجع', date: 'التاريخ', validUntil: 'صالح حتى', preparedBy: 'أُعدّ بواسطة',
    company: 'الشركة', contact: 'جهة الاتصال', phone: 'الهاتف', email: 'البريد الإلكتروني',
    descRoom: 'الوصف', roomType: 'نوع الغرفة', stayDates: 'تواريخ الإقامة', rooms: 'الغرف', nights: 'الليالي',
    rateNight: 'السعر / ليلة (ر.س)', totalCol: 'الإجمالي (ر.س)',
    hallType: 'نوع القاعة', persons: 'الأشخاص', duration: 'المدة (يوم)', rateDay: 'السعر / يوم (ر.س)',
    roomsHeading: 'الغرف الفندقية', meetingsHeading: 'قاعات الاجتماعات',
    subtotal: 'المجموع الفرعي', vat: 'ضريبة القيمة المضافة (15%)', municipalityTax: 'رسوم البلدية', grandTotal: 'الإجمالي النهائي',
    sar: 'ر.س', notesTerms: 'ملاحظات وشروط',
    benefits: 'المزايا:',
    benefit1: (tax) => `الأسعار أعلاه لا تشمل ضريبة القيمة المضافة 15%${tax > 0 ? ` ورسوم البلدية ${tax}%` : ''} في فنادق إيواء اكسبريس.`,
    benefit2: 'الأسعار أعلاه صافية وغير قابلة للعمولة وبالريال السعودي.',
    benefit3: 'الأسعار المعروضة شاملة الإنترنت اللاسلكي WI-Fi.',
    benefit4: (meals) => {
      const arr = Array.isArray(meals)
        ? meals
        : String(meals || '').split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length === 0 || arr.includes('none')) return null;
      if (arr.includes('full_board')) return 'الأسعار شاملة الإفطار والغداء والعشاء.';
      const labels = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
      const picked = ['breakfast','lunch','dinner'].filter(k => arr.includes(k)).map(k => labels[k]);
      if (picked.length === 0) return null;
      const joined = picked[0] + picked.slice(1).map(p => ' و' + p).join('');
      return `الأسعار شاملة ${joined}.`;
    },
    termsTitle: 'الشروط والأحكام:',
    terms1: 'موعد تسجيل الدخول الساعة 15:00 ومغادرة الغرفة الساعة 12:00 ظهرًا. أي تأخير في المغادرة بعد الساعة 16:00 يخضع لرسوم 50% من السعر المتفق عليه، وأي تأخير بعد الساعة 18:00 يخضع لرسوم ليلة كاملة إضافية. تسجيل الدخول المبكر أو تمديد المغادرة متاحان حسب التوفر.',
    terms2: 'في حال رغبة المجموعة في البقاء بعد الساعة 12:00 ظهرًا، يمكن استلام الأمتعة وتخزينها حتى وقت المغادرة، مع إمكانية استخدام كافة خدمات الفندق.',
    terms3: 'تتعهد الشركة بأن ضيوفها سيلتزمون بجميع القوانين واللوائح المعمول بها في المملكة العربية السعودية والأنظمة الداخلية للفندق.',
    terms4: 'تنفيذ هذه الاتفاقية من قبل أي طرف يخضع للقوة القاهرة كالكوارث والقرارات الحكومية والإضرابات والاضطرابات المدنية أو أي حالة طارئة تجعل تقديم الخدمات أو المرافق غير ممكن. يجوز لأي طرف إنهاء هذا العقد لأي من الأسباب المذكورة بإشعار مكتوب للطرف الآخر دون أي مسؤولية.',
    cancellation: 'سياسة الإلغاء:',
    cancelIntro: 'تفاصيل سياسة رسوم الإلغاء كما يلي:',
    cancel1: 'الإلغاء قبل وصول المجموعة بـ 6 أيام: 50% من سعر الغرفة عن المدة المتفق عليها.',
    cancel2: 'الإلغاء قبل وصول المجموعة بـ 3 أيام: 75% من سعر الغرفة عن المدة المتفق عليها.',
    cancel3: 'الإلغاء يوم وصول المجموعة: 100% من سعر الغرفة عن المدة المتفق عليها.',
    otherConditions: 'شروط أخرى:',
    otherText: 'يخضع تنفيذ هذه الاتفاقية للإنهاء دون أي مسؤولية عند حدوث أي ظرف خارج عن إرادة الطرفين — كالكوارث الطبيعية والحرب والإرهاب والأنظمة الحكومية والإضرابات والاضطرابات المدنية أو تعليق وسائل النقل — إلى الحد الذي يجعل تقديم خدمات الفندق أو استخدامها غير ممكن. يشترط لإنهاء الاتفاقية بموجب هذه الفقرة تسليم إشعار مكتوب للطرف الآخر يوضح أساس الإنهاء في أقرب وقت ممكن، وبما لا يتجاوز 10 أيام من علم الطرف بالظرف.',
    payments: 'الدفعات:',
    pay1: 'يتم سداد 50% من إجمالي مبلغ المجموعة بعد توقيع هذا العرض.',
    pay2: 'يتم سداد المبلغ المتبقي مع كشف الإقامة (Rooming List) قبل الوصول بـ 3 أيام.',
    bankAccount: 'بيانات الحساب البنكي:',
    bankNameLabel: 'اسم البنك:',
    beneficiaryLabel: 'اسم المستفيد:',
    nationalIdLabel: 'رقم الهوية الوطنية:',
    accountNumberLabel: 'رقم الحساب:',
    ibanLabel: 'الآيبان:',
    bankMissing: 'سيتم تزويدكم ببيانات الحساب البنكي بشكل منفصل.',
    rateDisclosure: 'سرية الأسعار:',
    rateDisclosureText: 'الأسعار الواردة في هذا العرض تخص هذه الاتفاقية فقط وهي سرية تمامًا. يلتزم العميل بعدم الإفصاح عن الأسعار لأي طرف ثالث بشكل مباشر أو غير مباشر بأي وسيلة. في حال إعادة البيع غير المباشر، يلتزم العميل بإلزام الطرف المتعاقد بنفس الالتزامات.',
    forceMajeure: 'القوة القاهرة:',
    forceMajeureText: 'إذا تعذّر تنفيذ هذا العقد أو أي التزام بموجبه أو تأخّر بسبب القوة القاهرة (أي ظرف خارج عن إرادة الطرفين بشكل معقول)، وقام الطرف غير القادر على الوفاء بإشعار الطرف الآخر فورًا بشكل مكتوب، فإن التزامات الطرف المتمسك بهذا الحكم تُعلَّق بالقدر الضروري بسبب هذا الحدث. تشمل القوة القاهرة (دون حصر): الكوارث الطبيعية والحرائق والأوبئة والانفجارات والتخريب والعواصف وأوامر السلطات العسكرية أو المدنية والطوارئ الوطنية والاضطرابات والثورات والحروب والإضرابات وتوقّف العمل أو فشل الموردين. يبذل الطرف المعفى جهودًا معقولة لتجنب أو إزالة أسباب عدم التنفيذ ويستأنف التنفيذ بسرعة معقولة فور إزالة هذه الأسباب.',
    jurisdiction: 'الاختصاص القضائي:',
    jurisdictionText: 'تخضع هذه الاتفاقية لقوانين المملكة العربية السعودية، ويتفق الطرفان على أن المحاكم في المملكة العربية السعودية لها الاختصاص الحصري لتسوية أي نزاع بين الطرفين.',
    standardTerms: 'الشروط العامة:',
    standard1: 'يقرّ الطرفان ويضمنان أن لديهما الصلاحية الكاملة والسلطة والحق القانوني للدخول في هذه الاتفاقية، وأن جميع الإجراءات الشكلية المتعلقة بتنفيذها قد استُكمِلت. لا يجوز تعديل هذه الاتفاقية إلا بمستند مكتوب صريح موقّع من ممثلين مفوّضين من الطرفين.',
    standard2: 'يرجى ملاحظة أنه تم بالفعل عمل حجز مبدئي لكم. ومع ذلك، نشكر لكم الرد المكتوب السريع لكي نتمكن من الاستعداد اللازم.',
    standard3: 'نأمل أن يكون العرض أعلاه يفي بمتطلباتكم. يرجى توقيع العرض ووضع ختم الشركة لتأكيد الموافقة على الشروط والأحكام أعلاه. وفي حال احتجتم أي توضيحات، لا تترددوا في التواصل معي مباشرةً.',
    standard4: 'نكون ممتنين لو تكرمتم بإرسال التأكيد قبل تاريخ الوصول بـ 15 يومًا على الأقل. وفي حال عدم وصول رد منكم خلال هذه الفترة، سنعتبر أن الحجز لم يعد مطلوبًا وسنقوم بتحرير المساحة المحجوزة.',
    welcoming: 'نتطلّع لاستقبالكم واستقبال ضيوفكم في فنادق إيواء اكسبريس.',
    confirmOn: 'التأكيد بالنيابة عن:',
    name: 'الاسم', signature: 'التوقيع', titleField: 'المسمى الوظيفي', dateField: 'التاريخ', companyStamp: 'ختم الشركة',
    clientApproval: 'موافقة العميل:',
  },
};

const generateQuote = async (req, res) => {
  try {
    const { clientId, hotelId, items, validDays, notes, companyName, contactPerson,
      municipalityTaxPercent, lang, meals: mealsRaw,
      paymentTerms: paymentTermsRaw, arrivalDate: arrivalDateRaw } = req.body;

    // Meals is now multi-select: client can send an array like
    // ["breakfast","dinner"] or a CSV "breakfast,dinner". Normalize to a
    // deduped array of valid keys, then store as CSV in DB. Special cases:
    //   - "none" wins alone (drops everything else)
    //   - "full_board" wins alone (it's already all three)
    const validMeals = ['none','breakfast','lunch','dinner','full_board'];
    const mealsList = (Array.isArray(mealsRaw) ? mealsRaw : String(mealsRaw || '').split(','))
      .map(m => String(m || '').trim())
      .filter(m => validMeals.includes(m));
    const mealsSet = new Set(mealsList);
    let mealsArr;
    if (mealsSet.has('none'))            mealsArr = ['none'];
    else if (mealsSet.has('full_board')) mealsArr = ['full_board'];
    else if (mealsSet.size === 0)        mealsArr = ['breakfast'];
    else                                 mealsArr = ['breakfast','lunch','dinner'].filter(m => mealsSet.has(m));
    const meals = mealsArr.join(',');

    // Job title for the PDF signature block: prefer the rep's custom title
    // (set once on their User profile). If they don't have one, fall back
    // to the role label so a sales_rep stamps "تنفيذي مبيعات" / "Sales
    // Executive" automatically without needing an admin to backfill every
    // user. Re-download path supplies _overrideRepTitle from the saved
    // quote so historical PDFs render with their original title.
    const ROLE_LABEL_AR = {
      admin: 'مدير النظام',
      general_manager: 'مدير عام',
      vice_gm: 'نائب المدير العام',
      sales_director: 'مدير مبيعات',
      assistant_sales: 'مساعد مدير المبيعات',
      sales_rep: 'تنفيذي مبيعات',
      contract_officer: 'مسئول العقود',
      reservations: 'قسم الحجوزات',
      credit_manager: 'مدير الائتمان',
      credit_officer: 'موظف ائتمان',
      marketing_manager: 'مدير التسويق',
    };
    const ROLE_LABEL_EN = {
      admin: 'IT Admin',
      general_manager: 'General Manager',
      vice_gm: 'Vice General Manager',
      sales_director: 'Sales Director',
      assistant_sales: 'Assistant Director of Sales',
      sales_rep: 'Sales Executive',
      contract_officer: 'Contract Officer',
      reservations: 'Reservations',
      credit_manager: 'Credit Manager',
      credit_officer: 'Credit Officer',
      marketing_manager: 'Marketing Manager',
    };
    let preparedByTitle = null;
    if (req._overrideRepTitle !== undefined) {
      // Saved-quote re-download: if we're rendering English and the frozen
      // title is Arabic (most reps set their title in Arabic on their
      // profile), fall back to the English role label so the English PDF
      // doesn't ship a stray Arabic word in the signature block.
      const t = req._overrideRepTitle || null;
      preparedByTitle = (t && lang !== 'ar' && isArabic(t)) ? null : t;
    } else if (req.user?.id) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { title: true, role: true } });
        const map = (lang === 'ar') ? ROLE_LABEL_AR : ROLE_LABEL_EN;
        // Drop the user's custom title when it's Arabic but we need an
        // English PDF — same rationale as above for the re-download path.
        const customTitle = u?.title || null;
        const useCustom = customTitle && (lang === 'ar' || !isArabic(customTitle));
        preparedByTitle = (useCustom ? customTitle : null) || map[u?.role] || null;
      } catch (_) { /* non-fatal */ }
    }
    // Re-download path: if the saved (frozen) title was Arabic and we just
    // dropped it for an English PDF, look up the original rep's role by
    // email (unique) and use the English role label instead.
    if (!preparedByTitle && lang !== 'ar' && req._overrideRepEmail) {
      try {
        const overrideUser = await prisma.user.findUnique({
          where: { email: req._overrideRepEmail },
          select: { role: true },
        });
        if (overrideUser?.role) preparedByTitle = ROLE_LABEL_EN[overrideUser.role] || null;
      } catch (_) { /* non-fatal */ }
    }
    const paymentTerms = (paymentTermsRaw || '').toString().trim().slice(0, 2000) || null;
    const arrivalDate = arrivalDateRaw ? new Date(arrivalDateRaw) : null;
    // Pick language: 'ar' uses Cairo font + RTL alignment; everything else stays English.
    const isAr = lang === 'ar';
    const t = isAr ? QUOTE_T.ar : QUOTE_T.en;

    const hotel = hotelId ? await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } }) : null;
    const client = clientId ? await prisma.client.findUnique({ where: { id: parseInt(clientId) } }) : null;

    // Pick the recipient company name for THIS rendering:
    //   - English PDF: prefer client.companyNameEn (the dedicated English
    //     field on the client record), then the form-typed companyName,
    //     then the stored Arabic companyName as a last resort.
    //   - Arabic PDF: always the Arabic companyName (form value first, then
    //     the stored value). companyNameEn is ignored.
    // Reassigned into the existing companyName variable used by both render
    // paths below so they pick up the language-correct value automatically.
    let displayCompanyName;
    if (isAr) {
      displayCompanyName = companyName || client?.companyName || '-';
    } else {
      displayCompanyName = client?.companyNameEn || companyName || client?.companyName || '-';
    }

    // ref/today/validUntil can be overridden by the re-download path so a
    // saved quote re-renders with its original reference and dates.
    const ref = req._overrideRef || `QT-${Date.now().toString().slice(-8)}`;
    const today = req._overrideDate ? new Date(req._overrideDate) : new Date();
    const validUntil = req._overrideValidUntil
      ? new Date(req._overrideValidUntil)
      : (() => { const d = new Date(today); d.setDate(d.getDate() + (parseInt(validDays) || 30)); return d; })();

    // Items can carry an optional per-row hotelId (multi-hotel quote mode).
    // Resolve hotel names in a single query so the template can render a
    // "Hotel" column without N+1 round trips.
    const itemHotelIds = Array.from(new Set(
      (items || []).map(i => parseInt(i.hotelId)).filter(n => Number.isFinite(n))
    ));
    const itemHotelMap = new Map();
    if (itemHotelIds.length > 0) {
      const hotelRows = await prisma.hotel.findMany({
        where: { id: { in: itemHotelIds } },
        select: { id: true, name: true, nameEn: true },
      });
      hotelRows.forEach(h => itemHotelMap.set(h.id, h));
    }
    const parsedItems = (items || []).map(item => {
      const hid = parseInt(item.hotelId);
      const h = Number.isFinite(hid) ? itemHotelMap.get(hid) : null;
      const kind = item.kind === 'meeting' ? 'meeting' : 'room';
      return {
        description: item.description || '',
        roomType: item.roomType || '',  // also doubles as hall type when kind=meeting
        nights: parseInt(item.nights) || 0,  // duration in days when kind=meeting
        rooms: parseInt(item.rooms) || 0,    // persons count when kind=meeting (display only)
        rate: parseFloat(item.ratePerNight) || 0,  // rate/day when kind=meeting
        kind,
        hotelId: h ? h.id : null,
        hotelName: h ? (h.name || h.nameEn || '') : '',
        // Per-item stay window — lets one quote cover multiple arrivals
        // (e.g. a group splits into two waves, or two sub-groups stay at
        // different hotels on different dates). Empty strings when missing.
        arrivalDate: item.arrivalDate || '',
        departureDate: item.departureDate || '',
      };
    });
    // Both kinds use the same A × B × C shape — just the variable names
    // differ in the UI labels (room: rooms × nights × rate/night,
    // meeting: persons × duration × rate/day). User specifically asked
    // the meeting total to factor in persons so a quote for 50 attendees
    // × 3 days × 200 SAR/day = 30,000 SAR.
    parsedItems.forEach(i => { i.total = i.nights * i.rooms * i.rate; });
    // Multi-hotel mode = at least one item carries its own hotelId. Used by
    // templates to decide whether to render the extra "Hotel" column.
    const isMultiHotel = parsedItems.some(i => i.hotelName);
    const subtotal = parsedItems.reduce((s, i) => s + i.total, 0);
    // Municipality fee only applies to hotel rooms — meeting halls are exempt.
    // VAT still applies on the full subtotal + munTax (ZATCA-style compound).
    const roomsSubtotal = parsedItems.reduce((s, i) => s + (i.kind === 'meeting' ? 0 : i.total), 0);
    const munTaxRate = Math.max(0, parseFloat(municipalityTaxPercent) || 0);
    const munTax = Math.round(roomsSubtotal * munTaxRate / 100);
    const vat = Math.round((subtotal + munTax) * 0.15);
    const grandTotal = subtotal + munTax + vat;

    // Persist the quote so the rep can re-open it later from the client's
    // profile, and log an Activity entry so it shows up in the activities
    // tab. Skipped on the re-download path (req._skipSave = true) so the
    // same record isn't duplicated each time the PDF is re-fetched.
    if (!req._skipSave && clientId && req.user?.id) {
      try {
        await prisma.quote.create({
          data: {
            reference: ref,
            clientId: parseInt(clientId),
            hotelId: hotelId ? parseInt(hotelId) : null,
            salesRepId: req.user.id,
            items: JSON.stringify(parsedItems),
            subtotal, munTaxRate, munTax, vat, grandTotal,
            validDays: parseInt(validDays) || 30,
            validUntil,
            notes: notes || null,
            lang: isAr ? 'ar' : 'en',
            meals,
            preparedByTitle,
            paymentTerms,
            arrivalDate,
            status: 'pending_manager_approval',
          },
        });
        await prisma.activity.create({
          data: {
            clientId: parseInt(clientId),
            userId: req.user.id,
            type: 'quote_generated',
            description: hotel
              ? `أنشأ عرض سعر ${ref} على ${hotel.name} بإجمالي ${grandTotal.toLocaleString('en-US')} ر.س — بانتظار موافقة مدير المبيعات`
              : `أنشأ عرض سعر ${ref} بإجمالي ${grandTotal.toLocaleString('en-US')} ر.س — بانتظار موافقة مدير المبيعات`,
          },
        }).catch(() => null);
        // Notify the rep's manager so they can approve from the new tab.
        try {
          const rep = await prisma.user.findUnique({ where: { id: req.user.id }, select: { managerId: true, name: true } });
          if (rep?.managerId) {
            await prisma.notification.create({
              data: {
                userId: rep.managerId,
                type: 'quote_pending_approval',
                title: 'عرض سعر بانتظار موافقتك',
                message: `${rep.name || 'مندوب'} أنشأ عرض سعر ${ref}${hotel ? ` على ${hotel.name}` : ''} بإجمالي ${grandTotal.toLocaleString('en-US')} ر.س`,
                link: `/clients/${clientId}`,
              },
            });
          }
        } catch (_) { /* non-fatal */ }
      } catch (e) {
        // Don't fail the PDF response if persist fails — log and continue.
        console.error('[generateQuote] persist failed:', e.message);
      }
    }

    // === Arabic quote → HTML renderer (Chromium → wkhtmltopdf → PDFKit) ===
    // PDFKit's Arabic rendering is fragile. We render an HTML template via
    // a real browser instead. Preferred path is headless Chromium (cloud,
    // Ubuntu). When Chromium can't launch — e.g. the internal Windows
    // Server 2012 R2 box that can only run legacy binaries — we fall back
    // to wkhtmltopdf, an old but rock-solid Qt-WebKit renderer that
    // installs cleanly on every Windows version. Last-ditch fallback is
    // the PDFKit code path below so users always get *some* PDF.
    if (isAr) {
      const { renderQuoteHtmlAr, renderQuoteFooterHtml } = require('../services/quoteHtmlAr');
      // Look up the rep's phone from the User row — req.user is the decoded
      // JWT payload and doesn't carry phone, so the auth middleware's
      // shorthand object isn't enough. On PDF re-download, the route hands
      // us the ORIGINAL rep via _overrideRep* so a manager re-downloading
      // a quote doesn't get their own name stamped onto someone else's quote.
      const repNameOverride  = req._overrideRepName;
      const repPhoneOverride = req._overrideRepPhone;
      let preparedByPhone = '';
      if (repPhoneOverride != null) {
        preparedByPhone = repPhoneOverride || '';
      } else if (req.user?.id) {
        try {
          const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { phone: true } });
          preparedByPhone = u?.phone || '';
        } catch (_) { /* non-fatal */ }
      }
      const html = renderQuoteHtmlAr({
        ref, today, validUntil,
        hotel, client,
        companyName: displayCompanyName, contactPerson,
        items: parsedItems,
        isMultiHotel,
        subtotal, munTaxRate, munTax, vat, grandTotal,
        notes, meals: mealsArr,
        preparedByName: repNameOverride || req.user?.name || '',
        preparedByTitle: preparedByTitle || '',
        preparedByPhone,
        paymentTerms,
        arrivalDate,
      });
      const footerHtml = renderQuoteFooterHtml();

      // Try renderers in order until one produces a PDF.
      const renderers = [
        { name: 'chromium', mod: '../services/htmlPdf' },
        { name: 'wkhtmltopdf', mod: '../services/wkhtmlPdf' },
      ];
      for (const r of renderers) {
        try {
          const { htmlToPdf, isAvailable } = require(r.mod);
          if (typeof isAvailable === 'function' && !isAvailable()) continue;
          const pdfBuffer = await htmlToPdf(html, { footerHtml });
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=Quote_${ref}.pdf`);
          return res.send(pdfBuffer);
        } catch (err) {
          console.warn(`[generateQuote AR] ${r.name} failed: ${err.message}`);
          // try next renderer
        }
      }
      console.warn('[generateQuote AR] all HTML renderers failed, falling back to PDFKit');
      // Fall through to the PDFKit code path below.
    }

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

    // Header layout: Arabic flows RTL, so put logo on the LEFT and hotel
    // name on the RIGHT. English keeps the original LTR layout (logo on
    // the right, name on the left).
    if (hasLogo) {
      doc.image(logoPath, isAr ? 40 : 433, y, { height: 80 });
    }

    const hotelName = hotel?.nameEn || hotel?.name || 'Ewaa Hotels';
    setFont(doc, true, hotelName);
    doc.fontSize(16).fillColor(NAVY).text(
      shapeForVisual(hotelName),
      isAr ? 162 : 40,
      lineY - 22,
      { width: 393, align: isAr ? 'right' : 'left' },
    );

    y = lineY;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(NAVY).lineWidth(2).stroke();
    y += 15;

    // Title
    setFont(doc, true, t.title);
    doc.fontSize(15).fillColor(NAVY).text(shapeForVisual(t.title), 40, y, { align: 'center' });
    y += 30;

    // Info columns — Arabic flips the two columns: Quote-details on the
    // RIGHT, Client-details on the LEFT (since RTL readers start from the
    // right). The two x anchors stay the same; we just swap which column
    // sits where, and right-align both.
    const quoteColX  = isAr ? 300 : 40;
    const clientColX = isAr ? 40  : 300;
    const colAlign   = isAr ? 'right' : 'left';
    const colWidth   = 215;
    setFont(doc, true, t.quoteDetails);
    doc.fontSize(10).fillColor(NAVY).text(shapeForVisual(t.quoteDetails), quoteColX, y, { width: colWidth, align: colAlign });
    setFont(doc, true, t.clientDetails);
    doc.text(shapeForVisual(t.clientDetails), clientColX, y, { width: colWidth, align: colAlign });
    y += 16;

    // Each info pair is "Label: value". In English we draw label first
    // (LTR) then value to its right. In Arabic we draw the label
    // right-aligned and the value to its left, so they read naturally
    // right-to-left.
    const COL_W = 215;
    // Returns the rendered height of one info pair so the caller can advance
    // y by the taller of the two columns. Long values (long company names,
    // long emails) wrap inside the column instead of overflowing into the
    // row beneath — wrap was previously disabled with lineBreak:false and
    // that's what caused the text to overlap the next row.
    const infoStyle = (label, value, x, yy) => {
      const labelStr = `${label}: `;
      const valueStr = String(value ?? '');
      const labelIsArabic = isArabic(labelStr);
      const valIsArabic = isArabic(valueStr);
      setFont(doc, false, labelStr);
      doc.fontSize(8).fillColor(MID);
      const labelShaped = shapeForVisual(labelStr);
      const labelW = doc.widthOfString(labelShaped);
      const labelYOff = labelIsArabic ? -3 : 0;
      const valueW = COL_W - labelW - 5;
      setFont(doc, true, valueStr);
      doc.fontSize(8);
      // When an Arabic value lands inside an English PDF, PDFKit places
      // its words in logical (LTR) order, so a right-to-left reader sees
      // them backwards (the company name comes out word-reversed). Flip
      // the word order ourselves before drawing — fontkit still shapes
      // each individual word correctly because letter-by-letter glyph
      // selection is independent of word order.
      const ltrShaped = (!isAr && valIsArabic) ? reverseArabicForLTR(valueStr) : valueStr;
      const valShaped = shapeForVisual(ltrShaped);
      const valH = doc.heightOfString(valShaped, { width: valueW });
      setFont(doc, false, labelStr);
      doc.fontSize(8).fillColor(MID);
      if (isAr) {
        const labelX = x + COL_W - labelW;
        doc.text(labelShaped, labelX, yy + labelYOff, { lineBreak: false });
        setFont(doc, true, valueStr);
        doc.fontSize(8).fillColor(DARK);
        const valYOff = valIsArabic ? -3 : 0;
        doc.text(valShaped, x, yy + valYOff, { width: valueW, align: 'right' });
      } else {
        doc.text(labelShaped, x, yy + labelYOff, { lineBreak: false });
        setFont(doc, true, valueStr);
        doc.fontSize(8).fillColor(DARK);
        const valYOff = valIsArabic ? -3 : 0;
        doc.text(valShaped, x + labelW, yy + valYOff, { width: valueW });
      }
      return Math.max(11, valH + 2);
    };

    // Render rows in pairs (left+right) and advance y by the taller side
    // so a wrapped long value doesn't crash into the row underneath.
    const drawInfoPair = (leftFn, rightFn) => {
      const lh = leftFn(y);
      const rh = rightFn(y);
      y += Math.max(lh, rh) + 1;
    };
    drawInfoPair(
      (yy) => infoStyle(t.reference, ref, quoteColX, yy),
      (yy) => infoStyle(t.company, displayCompanyName, clientColX, yy),
    );
    drawInfoPair(
      (yy) => infoStyle(t.date, formatDate(today), quoteColX, yy),
      (yy) => infoStyle(t.contact, contactPerson || client?.contactPerson || '-', clientColX, yy),
    );
    drawInfoPair(
      (yy) => infoStyle(t.validUntil, formatDate(validUntil), quoteColX, yy),
      (yy) => infoStyle(t.phone, client?.phone || '-', clientColX, yy),
    );
    const preparedByName = req._overrideRepName
      ? extractEnglishName(req._overrideRepName, req._overrideRepEmail)
      : extractEnglishName(req.user.name, req.user.email);
    drawInfoPair(
      (yy) => infoStyle(t.preparedBy, preparedByName, quoteColX, yy),
      (yy) => infoStyle(t.email, client?.email || '-', clientColX, yy),
    );
    y += 12;

    // Items table — Room Type is its own column now (was glued to the
    // description). Arabic flips the entire column order so reading right
    // to left gives: Total → Rate → Nights → Rooms → Room Type → Description.
    // When multi-hotel mode is on, prepend a "Hotel" column so each row
    // shows which property it's quoted under.
    if (parsedItems.length > 0) {
      const hotelLabel = isAr ? 'الفندق' : 'Hotel';
      // Split items by kind so we can render one or two tables — meeting
      // items use different column headers (Hall Type / Persons / Duration /
      // Rate/Day) than rooms. If both kinds exist we draw two stacked tables
      // with a section heading on each so the reader knows which is which.
      const roomItems    = parsedItems.filter(i => i.kind !== 'meeting');
      const meetingItems = parsedItems.filter(i => i.kind === 'meeting');
      const hasBoth = roomItems.length > 0 && meetingItems.length > 0;

      const drawSection = (sectionItems, sectionKind, heading) => {
        if (sectionItems.length === 0) return;
        if (hasBoth && heading) {
          doc.font(isAr ? CAIRO_BOLD : 'Helvetica-Bold').fontSize(11).fillColor(NAVY);
          drawText(doc, heading, 30, y, { align: isAr ? 'right' : 'left', width: 555 });
          y += 16;
        }
        const isMeet = sectionKind === 'meeting';
        const colType  = isMeet ? t.hallType : t.roomType;
        const colCount = isMeet ? t.persons  : t.rooms;
        const colDur   = isMeet ? t.duration : t.nights;
        const colRate  = isMeet ? t.rateDay  : t.rateNight;

        // Compact "15 May - 20 May" formatter — wider formats overflow the
        // narrow Stay Dates column in the items table.
        const fmtShortDay = (raw) => {
          if (!raw) return '';
          const d = new Date(raw);
          if (isNaN(d.getTime())) return '';
          return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
        };
        const stayRange = (item) => {
          const a = fmtShortDay(item.arrivalDate);
          const dep = fmtShortDay(item.departureDate);
          if (a && dep) return `${a} - ${dep}`;
          return a || dep || '-';
        };

        const widthsEn  = isMultiHotel
          ? [55, 100, 55, 75, 40, 35, 55, 100]
          : [120, 65, 80, 45, 40, 60, 105];
        const headersEn = isMultiHotel
          ? [hotelLabel, t.descRoom, colType, t.stayDates, colCount, colDur, colRate, t.totalCol]
          : [t.descRoom, colType, t.stayDates, colCount, colDur, colRate, t.totalCol];
        const alignsEn  = isMultiHotel
          ? ['left', 'left', 'left', 'center', 'center', 'center', 'right', 'right']
          : ['left', 'left', 'center', 'center', 'center', 'right', 'right'];
        const widths  = isAr ? [...widthsEn].reverse()  : widthsEn;
        const headers = isAr ? [...headersEn].reverse() : headersEn;
        const arAligns = isMultiHotel
          ? ['right', 'right', 'center', 'center', 'center', 'center', 'right', 'right']
          : ['right', 'center', 'center', 'center', 'center', 'right', 'right'];
        const headerAligns = isAr ? arAligns : alignsEn;
        const bodyAligns   = isAr ? arAligns : alignsEn;

        y = drawRow(doc, y, headers, widths, {
          bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24,
          aligns: headerAligns,
        });

        sectionItems.forEach((item, i) => {
          const baseRowEn = [item.description, item.roomType || '-', stayRange(item), item.rooms, item.nights, formatNum(item.rate), formatNum(item.total)];
          const rowEn = isMultiHotel ? [item.hotelName || '-', ...baseRowEn] : baseRowEn;
          const row = isAr ? [...rowEn].reverse() : rowEn;
          y = drawRow(doc, y, row, widths, {
            bg: i % 2 === 0 ? BG : null,
            aligns: bodyAligns,
          });
        });
        y += 6;
      };

      drawSection(roomItems,    'room',    t.roomsHeading);
      drawSection(meetingItems, 'meeting', t.meetingsHeading);

      y += 4;
      // Totals block — flipped for Arabic so labels read right-to-left.
      // English: block sits on the right (label left, amount right-aligned).
      // Arabic: block sits on the left, label right-aligned within the
      // block, amount on the left so they read RTL as "السعر = القيمة".
      const totalsLeft  = isAr ? 30  : 330;       // x of the block's left edge
      const totalsRight = isAr ? 225 : 555;       // x of the block's right edge
      const labelW = 130;
      const amountW = 95;
      const drawTotal = (label, amount, bold = false) => {
        const num = formatNum(amount);
        const fs = bold ? 11 : 9;
        const color = bold ? NAVY : MID;
        const valueColor = bold ? NAVY : DARK;

        // Compute the amount block (digits in Helvetica + SAR in Cairo so
        // each font handles its own script and digits don't tofu out).
        const sarText = ` ${t.sar}`;
        doc.font(bold ? CAIRO_BOLD : CAIRO_REG).fontSize(fs);
        const sarW = doc.widthOfString(sarText);
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
        const numW = doc.widthOfString(num);
        const amtBlockW = numW + sarW;

        if (isAr) {
          setFont(doc, bold, label);
          doc.fontSize(fs).fillColor(color)
             .text(shapeForVisual(label), totalsRight - labelW, y, { width: labelW, align: 'right', lineBreak: false });
          const numX = totalsLeft;
          const sarX = numX + numW;
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(valueColor)
             .text(num, numX, y, { lineBreak: false });
          doc.font(bold ? CAIRO_BOLD : CAIRO_REG).fillColor(valueColor)
             .text(shapeForVisual(sarText), sarX, y, { lineBreak: false });
        } else {
          setFont(doc, bold, label);
          doc.fontSize(fs).fillColor(color)
             .text(label, totalsLeft, y, { width: labelW, lineBreak: false });
          const numX = totalsRight - amtBlockW;
          const sarX = numX + numW;
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(valueColor)
             .text(num, numX, y, { lineBreak: false });
          doc.font(bold ? CAIRO_BOLD : CAIRO_REG).fillColor(valueColor)
             .text(shapeForVisual(sarText), sarX, y, { lineBreak: false });
        }
        void amountW;
      };
      drawTotal(`${t.subtotal}:`, subtotal); y += 15;
      if (munTaxRate > 0) {
        drawTotal(`${t.municipalityTax} (${munTaxRate}%):`, munTax); y += 15;
      }
      drawTotal(`${t.vat}:`, vat); y += 15;
      doc.moveTo(totalsLeft, y - 2).lineTo(totalsRight, y - 2).strokeColor(NAVY).lineWidth(1).stroke(); y += 5;
      drawTotal(`${t.grandTotal}:`, grandTotal, true);
      y += 30;
    }

    // Notes
    if (notes) {
      setFont(doc, true, t.notesTerms);
      doc.fontSize(10).fillColor(NAVY).text(shapeForVisual(t.notesTerms), 40, y, { width: 515, align: isAr ? 'right' : 'left' }); y += 14;
      setFont(doc, false, notes);
      const notesShaped = shapeForVisual(notes);
      doc.fontSize(8).fillColor(MID).text(notesShaped, 40, y, { width: 515, align: isAr ? 'right' : 'left' });
      y += doc.heightOfString(notesShaped, { width: 515 }) + 15;
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
      doc.fontSize(10).fillColor(NAVY).text(shapeForVisual(title), 40, cy, { width: 515, align });
      return cy + 14;
    };
    const para = (cy, text) => {
      setFont(doc, false, text);
      doc.fontSize(8).fillColor(MID);
      const shaped = shapeForVisual(text);
      const h = doc.heightOfString(shaped, { width: 515 });
      cy = ensureSpace(cy, h + 6);
      doc.text(shaped, 40, cy, { width: 515, align: isAr ? 'right' : 'justify' });
      return cy + h + 6;
    };
    const bullet = (cy, text) => {
      const display = isAr ? `${text}  •` : `•  ${text}`;
      setFont(doc, false, display);
      doc.fontSize(8).fillColor(MID);
      const shaped = shapeForVisual(display);
      const h = doc.heightOfString(shaped, { width: 510 });
      cy = ensureSpace(cy, h + 3);
      doc.text(shaped, isAr ? 40 : 50, cy, { width: isAr ? 510 : 500, align });
      return cy + h + 3;
    };

    // Halls-only quote (every item is a meeting hall, no hotel rooms) drops
    // the room-centric lines: Wi-Fi and meals (benefits), the check-in /
    // check-out time paragraph (terms 1), and the word "room" in the
    // cancellation policy bullets.
    const isHallsOnly = parsedItems.length > 0 && parsedItems.every(i => i.kind === 'meeting');

    y += 5;
    y = section(y, t.benefits);
    y = bullet(y, t.benefit1(munTaxRate));
    y = bullet(y, t.benefit2);
    if (!isHallsOnly) {
      y = bullet(y, t.benefit3);
      const mealsLine = t.benefit4(meals);
      if (mealsLine) y = bullet(y, mealsLine);
    }

    y += 6;
    y = section(y, t.termsTitle);
    if (!isHallsOnly) y = para(y, t.terms1);
    y = para(y, t.terms2);
    y = para(y, t.terms3);
    y = para(y, t.terms4);

    y += 4;
    y = section(y, t.cancellation);
    y = para(y, t.cancelIntro);
    const cancelText = (s) => {
      if (!isHallsOnly) return s;
      return s
        .replace(/room rate or event charge/gi, 'event charge')
        .replace(/room rate/gi, 'rate')
        .replace(/سعر الغرفة/g, 'السعر');
    };
    y = bullet(y, cancelText(t.cancel1));
    y = bullet(y, cancelText(t.cancel2));
    y = bullet(y, cancelText(t.cancel3));

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
    const bankRows = [
      { label: t.bankNameLabel,        value: hotel?.bankName },
      { label: t.beneficiaryLabel,     value: hotel?.beneficiaryName },
      { label: t.nationalIdLabel,      value: hotel?.nationalId },
      { label: t.accountNumberLabel,   value: hotel?.accountNumber },
      { label: t.ibanLabel,            value: hotel?.iban },
    ].filter(r => r.value);
    if (bankRows.length === 0) {
      y = para(y, t.bankMissing);
    } else {
      bankRows.forEach(r => { y = bullet(y, `${r.label} ${r.value}`); });
    }

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
    doc.fontSize(10).fillColor(NAVY).text(shapeForVisual(t.welcoming), 40, y, { width: 515, align: 'center' });
    y += 30;

    y = ensureSpace(y, 90);
    setFont(doc, true, t.confirmOn);
    doc.fontSize(9).fillColor(NAVY).text(shapeForVisual(t.confirmOn), 40, y, { width: 515, align }); y += 28;

    // Title in the signature block is whatever the rep typed in the quote
    // form (preparedByTitle). NOT derived from req.user.role any more — the
    // rep wanted full control over how they present themselves on each quote.
    const repTitle = preparedByTitle || '';
    const repDate = formatDate(today);

    // All labels/values in this block may be Arabic (الاسم, التوقيع, المسمى
     // الوظيفي, التاريخ, ختم الشركة) — pick the font based on actual content.
    const drawLabel = (text, x, yy) => {
      setFont(doc, false, text);
      doc.fontSize(8).fillColor(MID).text(shapeForVisual(text), x, yy + (isArabic(text) ? -3 : 0), { lineBreak: false });
    };
    const filledField = (label, value, labelX, valueX, lineEndX) => {
      drawLabel(`${label}:`, labelX, y);
      const v = String(value ?? '');
      setFont(doc, true, v);
      doc.fontSize(8).fillColor(DARK).text(shapeForVisual(v), valueX, (y - 1) + (isArabic(v) ? -3 : 0), { lineBreak: false });
      doc.moveTo(valueX, y + 10).lineTo(lineEndX, y + 10).strokeColor(LIGHT).lineWidth(0.5).stroke();
    };

    filledField(t.name, preparedByName, 40, 80, 280);
    drawLabel(`${t.signature}:`, 310, y);
    doc.moveTo(370, y + 10).lineTo(555, y + 10).strokeColor(LIGHT).lineWidth(0.5).stroke();
    y += 25;
    // Title field dropped from the prepared-by block per business request —
    // the rep's name + signature is enough; the role/title is already shown
    // beside their name elsewhere. Date moves up to the left slot.
    filledField(t.dateField, repDate, 40, 80, 280);
    y += 25;
    drawLabel(`${t.companyStamp}:`, 40, y);
    y += 30;

    // === Client approval block — blank fields for the client to sign and stamp.
    y = ensureSpace(y, 90);
    setFont(doc, true, t.clientApproval);
    doc.fontSize(9).fillColor(NAVY).text(shapeForVisual(t.clientApproval), 40, y, { width: 515, align }); y += 28;

    filledField(t.name, '', 40, 80, 280);
    drawLabel(`${t.signature}:`, 310, y);
    doc.moveTo(370, y + 10).lineTo(555, y + 10).strokeColor(LIGHT).lineWidth(0.5).stroke();
    y += 25;
    filledField(t.titleField, '', 40, 80, 280);
    filledField(t.dateField, '', 310, 350, 555);
    y += 25;
    drawLabel(`${t.companyStamp}:`, 40, y);

    doc.end();
  } catch (err) {
    console.error('Quote PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ==================== CLIENT REPORT PDF ====================
const generateClientReport = async (req, res) => {
  try {
    const { type, hotelId, salesRepId, from, to } = req.query;
    const where = {};
    if (type) where.clientType = type;
    if (hotelId) where.hotelId = parseInt(hotelId);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(`${to}T23:59:59`);
    }

    const ADMIN_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm'];
    if (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== 'contract_officer') {
      if (req.user.role === 'sales_director') {
        const subs = await prisma.user.findMany({ where: { managerId: req.user.id }, select: { id: true } });
        where.salesRepId = { in: [req.user.id, ...subs.map(s => s.id)] };
      } else {
        // assistant_sales is treated like a regular sales_rep here.
        where.salesRepId = req.user.id;
      }
    }

    // Explicit rep filter from UI (admins or overriding the scoped default)
    if (salesRepId) where.salesRepId = parseInt(salesRepId);

    const clients = await prisma.client.findMany({
      where,
      include: {
        salesRep: { select: { name: true, email: true } },
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
    attachReportFooter(doc);
    const headerOpts = {
      title: 'Clients Report',
      subtitle: `Ewaa Hotels — Total ${clients.length} clients`,
      user: req.user,
      pageW,
    };
    let y = drawReportHeader(doc, headerOpts);

    // LTR layout: # sits on the left, primary column (Company) reads next.
    // visual order (LEFT to RIGHT): # | Company | Contact | Phone | Type | Hotel | Rep | Contracts | Visits
    const widths = [30, 170, 115, 90, 60, 115, 110, 55, 55];
    const headers = ['#', 'Company', 'Contact', 'Phone', 'Type', 'Hotel', 'Rep', 'Contracts', 'Visits'];
    const aligns  = ['center', 'left', 'left', 'left', 'center', 'left', 'left', 'center', 'center'];

    y = drawRow(doc, y, headers, widths, {
      bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns, fontSize: 9,
    });

    const typeLabel = { active: 'Active', lead: 'Lead', inactive: 'Inactive' };

    const dataBottomY = hasQuoteFooter ? 490 : 530;
    clients.forEach((c, i) => {
      if (y > dataBottomY) {
        doc.addPage();
        y = drawReportHeader(doc, headerOpts);
        y = drawRow(doc, y, headers, widths, {
          bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns, fontSize: 9,
        });
      }
      const repName = extractEnglishName(c.salesRep?.name, c.salesRep?.email) || '-';
      y = drawRow(doc, y, [
        i + 1,
        c.companyName || '-',
        c.contactPerson || '-',
        c.phone || '-',
        typeLabel[c.clientType] || c.clientType,
        c.hotel?.name || '-',
        repName,
        c._count.contracts,
        c._count.visits,
      ], widths, {
        bg: i % 2 === 0 ? BG : null, aligns,
      });
    });

    // Summary
    y += 15;
    const active = clients.filter(c => c.clientType === 'active').length;
    const leads = clients.filter(c => c.clientType === 'lead').length;
    const inactive = clients.filter(c => c.clientType === 'inactive').length;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY);
    const summary = `Active: ${active}   |   Leads: ${leads}   |   Inactive: ${inactive}`;
    doc.text(summary, 30, y, { align: 'center', width: pageW - 60 });

    doc.end();
  } catch (err) {
    console.error('Client report PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Apply role-based scope filter to a Prisma `where` clause for entities that
// have a `salesRepId` field. Admins / contract officers see everything;
// directors see their team; reps (including assistant_sales) see only own.
const applyAccessScope = async (user, where) => {
  const ADMIN_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm'];
  if (ADMIN_ROLES.includes(user.role) || user.role === 'contract_officer') return;
  if (user.role === 'sales_director') {
    const subs = await prisma.user.findMany({ where: { managerId: user.id }, select: { id: true } });
    where.salesRepId = { in: [user.id, ...subs.map(s => s.id)] };
  } else {
    where.salesRepId = user.id;
  }
};

// Report PDFs are English-only — these maps translate stored enum codes to
// human-readable labels in the rendered tables.
const CONTRACT_STATUS_EN = {
  pending: 'Pending', sales_approved: 'Sales Approved',
  credit_approved: 'Credit Approved', contract_approved: 'Contract Approved',
  approved: 'Final Approved', rejected: 'Rejected',
};
const VISIT_TYPE_EN = {
  in_person: 'In Person', phone: 'Phone', online: 'Online', site_visit: 'Site Visit',
};
const PAYMENT_METHOD_EN = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', check: 'Cheque', card: 'Card', online: 'Online',
};
const ROLE_EN = {
  sales_rep: 'Sales Rep', sales_director: 'Sales Director', assistant_sales: 'Assistant Director of Sales',
};

const dateRangeWhere = (from, to, field = 'createdAt') => {
  if (!from && !to) return {};
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(`${to}T23:59:59`);
  return { [field]: range };
};

const generateContractsReport = async (req, res) => {
  try {
    const { status, salesRepId, from, to } = req.query;
    const where = { ...dateRangeWhere(from, to, 'createdAt') };
    if (status) where.status = status;
    await applyAccessScope(req.user, where);
    if (salesRepId) where.salesRepId = parseInt(salesRepId);

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        client: { select: { companyName: true } },
        hotel: { select: { name: true } },
        salesRep: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.registerFont('Cairo', CAIRO_REG); doc.registerFont('Cairo-Bold', CAIRO_BOLD);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Contracts_Report.pdf`);
    doc.pipe(res);
    const pageW = 812;
    attachReportFooter(doc);

    const headerOpts = {
      title: 'Contracts Report',
      subtitle: `Ewaa Hotels — Total ${contracts.length} contracts`,
      user: req.user, pageW,
    };
    let y = drawReportHeader(doc, headerOpts);

    // LTR visual order: # | Company | Hotel | Rep | Rooms | Rate | Value | Collected | Status | Start | End
    const widths  = [30, 142, 50, 80, 50, 50, 65, 65, 80, 50, 60];
    const headers = ['#', 'Company', 'Hotel', 'Rep', 'Rooms', 'Rate', 'Value', 'Collected', 'Status', 'Start', 'End'];
    const aligns  = ['center', 'left', 'left', 'left', 'center', 'right', 'right', 'right', 'center', 'center', 'center'];
    y = drawRow(doc, y, headers, widths, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns, fontSize: 9 });

    contracts.forEach((c, i) => {
      if (y > 490) {
        doc.addPage();
        y = drawReportHeader(doc, headerOpts);
        y = drawRow(doc, y, headers, widths, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns, fontSize: 9 });
      }
      const repName = extractEnglishName(c.salesRep?.name, c.salesRep?.email) || '-';
      y = drawRow(doc, y, [
        i + 1,
        c.client?.companyName || '-',
        c.hotel?.name || '-',
        repName,
        c.roomsCount || '-',
        formatNum(c.ratePerRoom || 0),
        formatNum(c.totalValue || 0),
        formatNum(c.collectedAmount || 0),
        CONTRACT_STATUS_EN[c.status] || c.status,
        c.startDate ? formatDate(c.startDate) : '-',
        c.endDate ? formatDate(c.endDate) : '-',
      ], widths, { bg: i % 2 === 0 ? BG : null, aligns });
    });

    // Summary
    const totalValue = contracts.reduce((s, c) => s + (c.totalValue || 0), 0);
    const totalCollected = contracts.reduce((s, c) => s + (c.collectedAmount || 0), 0);
    y += 12;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY);
    doc.text(`Total Value: ${formatNum(totalValue)} SAR   |   Collected: ${formatNum(totalCollected)} SAR   |   Outstanding: ${formatNum(totalValue - totalCollected)} SAR`, 30, y, { align: 'center', width: pageW - 60 });

    doc.end();
  } catch (err) {
    console.error('Contracts PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

const generateVisitsReport = async (req, res) => {
  try {
    const { salesRepId, visitType, from, to } = req.query;
    const where = { ...dateRangeWhere(from, to, 'visitDate') };
    if (visitType) where.visitType = visitType;
    await applyAccessScope(req.user, where);
    if (salesRepId) where.salesRepId = parseInt(salesRepId);

    const visits = await prisma.visit.findMany({
      where,
      include: {
        client: { select: { companyName: true, contactPerson: true } },
        salesRep: { select: { name: true, email: true } },
      },
      orderBy: { visitDate: 'desc' },
    });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.registerFont('Cairo', CAIRO_REG); doc.registerFont('Cairo-Bold', CAIRO_BOLD);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Visits_Report.pdf`);
    doc.pipe(res);
    const pageW = 812;
    attachReportFooter(doc);

    const headerOpts = {
      title: 'Visits Report',
      subtitle: `Ewaa Hotels — Total ${visits.length} visits`,
      user: req.user, pageW,
    };
    let y = drawReportHeader(doc, headerOpts);

    // LTR visual order: # | Date | Hotel | Company | Contact | Rep | Type | Purpose/Outcome
    const W = [30, 50, 100, 160, 110, 90, 90, 180];
    const H = ['#', 'Date', 'Hotel', 'Company', 'Contact', 'Rep', 'Type', 'Purpose / Outcome'];
    const A = ['center', 'center', 'left', 'left', 'left', 'left', 'center', 'left'];
    y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });

    visits.forEach((v, i) => {
      if (y > 490) {
        doc.addPage();
        y = drawReportHeader(doc, headerOpts);
        y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });
      }
      const repName = extractEnglishName(v.salesRep?.name, v.salesRep?.email) || '-';
      const purposeOutcome = [v.purpose, v.outcome].filter(Boolean).join(' / ') || '-';
      y = drawRow(doc, y, [
        i + 1,
        formatDate(v.visitDate),
        '-',
        v.client?.companyName || '-',
        v.client?.contactPerson || '-',
        repName,
        VISIT_TYPE_EN[v.visitType] || v.visitType || '-',
        purposeOutcome,
      ], W, { bg: i % 2 === 0 ? BG : null, aligns: A });
    });

    doc.end();
  } catch (err) {
    console.error('Visits PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

const generatePaymentsReport = async (req, res) => {
  try {
    const { salesRepId, paymentType, from, to } = req.query;
    const where = { ...dateRangeWhere(from, to, 'paymentDate') };
    if (paymentType) where.paymentType = paymentType;

    // Payments scope: collectors are users; for sales scope, look at the contract's salesRepId.
    const ADMIN_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm'];
    if (!ADMIN_ROLES.includes(req.user.role) && !['credit_manager', 'credit_officer', 'contract_officer'].includes(req.user.role)) {
      // Restrict by collectedBy or by contract's salesRep
      where.OR = [];
      if (req.user.role === 'sales_director') {
        const subs = await prisma.user.findMany({ where: { managerId: req.user.id }, select: { id: true } });
        const ids = [req.user.id, ...subs.map(s => s.id)];
        where.OR = [{ collectedBy: { in: ids } }, { contract: { salesRepId: { in: ids } } }];
      } else {
        // assistant_sales is treated like a regular sales_rep here.
        where.OR = [{ collectedBy: req.user.id }, { contract: { salesRepId: req.user.id } }];
      }
    }
    if (salesRepId) {
      const id = parseInt(salesRepId);
      where.OR = [{ collectedBy: id }, { contract: { salesRepId: id } }];
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        client: { select: { companyName: true } },
        contract: { select: { contractRef: true } },
        collector: { select: { name: true, email: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.registerFont('Cairo', CAIRO_REG); doc.registerFont('Cairo-Bold', CAIRO_BOLD);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Payments_Report.pdf`);
    doc.pipe(res);
    const pageW = 812;
    attachReportFooter(doc);

    const headerOpts = {
      title: 'Collections Report',
      subtitle: `Ewaa Hotels — Total ${payments.length} payments`,
      user: req.user, pageW,
    };
    let y = drawReportHeader(doc, headerOpts);

    // LTR visual order: # | Date | Company | Contract | Amount | Method | Reference | Collected By
    const W = [30, 90, 180, 100, 90, 80, 100, 110];
    const H = ['#', 'Date', 'Company', 'Contract', 'Amount', 'Method', 'Reference', 'Collected By'];
    const A = ['center', 'center', 'left', 'left', 'right', 'center', 'left', 'left'];
    y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });

    let totalAmount = 0;
    payments.forEach((p, i) => {
      if (y > 490) {
        doc.addPage();
        y = drawReportHeader(doc, headerOpts);
        y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });
      }
      const collector = extractEnglishName(p.collector?.name, p.collector?.email) || '-';
      totalAmount += Number(p.amount || 0);
      y = drawRow(doc, y, [
        i + 1,
        formatDate(p.paymentDate),
        p.client?.companyName || '-',
        p.contract?.contractRef || '-',
        formatNum(p.amount),
        PAYMENT_METHOD_EN[p.paymentType] || p.paymentType || '-',
        p.reference || '-',
        collector,
      ], W, { bg: i % 2 === 0 ? BG : null, aligns: A });
    });

    y += 12;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY);
    doc.text(`Total Collected: ${formatNum(totalAmount)} SAR`, 30, y, { align: 'center', width: pageW - 60 });

    doc.end();
  } catch (err) {
    console.error('Payments PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

const generatePaymentMethodsReport = async (req, res) => {
  try {
    const { salesRepId, from, to } = req.query;
    const where = { ...dateRangeWhere(from, to, 'paymentDate') };

    const ADMIN_ROLES = ['admin', 'general_manager', 'systems_info', 'vice_gm'];
    if (!ADMIN_ROLES.includes(req.user.role) && !['credit_manager', 'credit_officer', 'contract_officer'].includes(req.user.role)) {
      if (req.user.role === 'sales_director') {
        const subs = await prisma.user.findMany({ where: { managerId: req.user.id }, select: { id: true } });
        const ids = [req.user.id, ...subs.map(s => s.id)];
        where.OR = [{ collectedBy: { in: ids } }, { contract: { salesRepId: { in: ids } } }];
      } else {
        // assistant_sales is treated like a regular sales_rep here.
        where.OR = [{ collectedBy: req.user.id }, { contract: { salesRepId: req.user.id } }];
      }
    }
    if (salesRepId) {
      const id = parseInt(salesRepId);
      where.OR = [{ collectedBy: id }, { contract: { salesRepId: id } }];
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        client: { select: { companyName: true } },
        contract: { select: { id: true, contractRef: true } },
      },
    });

    // Aggregate by contract
    const byContract = {};
    for (const p of payments) {
      const cid = p.contract?.id || p.contractId;
      if (!cid) continue;
      if (!byContract[cid]) {
        byContract[cid] = {
          contractRef: p.contract?.contractRef || `#${cid}`,
          companyName: p.client?.companyName || '-',
          cash: 0, bank_transfer: 0, cheque: 0, card: 0, total: 0, count: 0,
        };
      }
      const r = byContract[cid];
      r.total += Number(p.amount || 0);
      r.count += 1;
      const key = p.paymentType === 'check' ? 'cheque' : (p.paymentType || 'cash');
      if (r[key] !== undefined) r[key] += Number(p.amount || 0);
    }
    const rows = Object.values(byContract);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.registerFont('Cairo', CAIRO_REG); doc.registerFont('Cairo-Bold', CAIRO_BOLD);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Payment_Methods.pdf`);
    doc.pipe(res);
    const pageW = 812;
    attachReportFooter(doc);

    const headerOpts = {
      title: 'Payment Methods per Contract',
      subtitle: `Ewaa Hotels — Total ${rows.length} contracts`,
      user: req.user, pageW,
    };
    let y = drawReportHeader(doc, headerOpts);

    // LTR visual order: # | Contract | Company | Payments | Cash | Bank Transfer | Cheque | Card | Total
    const W = [30, 90, 220, 60, 70, 70, 70, 80, 90];
    const H = ['#', 'Contract', 'Company', 'Payments', 'Cash', 'Bank Transfer', 'Cheque', 'Card', 'Total'];
    const A = ['center', 'left', 'left', 'center', 'right', 'right', 'right', 'right', 'right'];
    y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });

    rows.forEach((r, i) => {
      if (y > 490) {
        doc.addPage();
        y = drawReportHeader(doc, headerOpts);
        y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });
      }
      y = drawRow(doc, y, [
        i + 1, r.contractRef, r.companyName, r.count,
        formatNum(r.cash), formatNum(r.bank_transfer), formatNum(r.cheque), formatNum(r.card),
        formatNum(r.total),
      ], W, { bg: i % 2 === 0 ? BG : null, aligns: A });
    });

    doc.end();
  } catch (err) {
    console.error('PaymentMethods PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

const generateTeamReport = async (req, res) => {
  try {
    const team = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['sales_rep', 'sales_director', 'assistant_sales'] } },
      include: {
        _count: { select: { assignedClients: { where: { isActive: true } }, contracts: true, visits: true } },
      },
      orderBy: { name: 'asc' },
    });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.registerFont('Cairo', CAIRO_REG); doc.registerFont('Cairo-Bold', CAIRO_BOLD);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Team_Performance.pdf`);
    doc.pipe(res);
    const pageW = 812;
    attachReportFooter(doc);

    const headerOpts = {
      title: 'Sales Team Performance',
      subtitle: `Ewaa Hotels — Total ${team.length} staff`,
      user: req.user, pageW,
    };
    let y = drawReportHeader(doc, headerOpts);

    // LTR visual order: # | Name | Phone | Email | Role | Commission | Clients | Contracts | Visits
    const W = [30, 162, 90, 180, 110, 60, 60, 60, 60];
    const H = ['#', 'Name', 'Phone', 'Email', 'Role', 'Commission %', 'Clients', 'Contracts', 'Visits'];
    const A = ['center', 'left', 'left', 'left', 'left', 'center', 'center', 'center', 'center'];
    y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });

    team.forEach((u, i) => {
      if (y > 490) {
        doc.addPage();
        y = drawReportHeader(doc, headerOpts);
        y = drawRow(doc, y, H, W, { bold: true, bg: NAVY, textColor: WHITE, headerLine: true, height: 24, aligns: A, fontSize: 9 });
      }
      const name = extractEnglishName(u.name, u.email) || '-';
      y = drawRow(doc, y, [
        i + 1,
        name,
        u.phone || '-',
        u.email || '-',
        ROLE_EN[u.role] || u.role,
        u.commissionRate != null ? `${u.commissionRate}%` : '-',
        u._count?.assignedClients || 0,
        u._count?.contracts || 0,
        u._count?.visits || 0,
      ], W, { bg: i % 2 === 0 ? BG : null, aligns: A });
    });

    doc.end();
  } catch (err) {
    console.error('Team PDF error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  generateQuote, generateClientReport,
  generateContractsReport, generateVisitsReport, generatePaymentsReport,
  generatePaymentMethodsReport, generateTeamReport,
};
