// Arabic-language quote rendered as HTML and turned into a PDF via Puppeteer
// (or wkhtmltopdf on legacy Windows). Uses the SAME boilerplate content as
// the old PDFKit version (benefits, terms, cancellation policy, payments,
// bank account, rate disclosure, force majeure, jurisdiction, standard
// terms, welcoming line, signature block) — we're only switching the
// renderer, not the wording.

const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../../../frontend/public/logo.png');
let logoDataUri = '';
try {
  if (fs.existsSync(logoPath)) {
    logoDataUri = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  }
} catch (_) { /* logo optional */ }

const footerPath = path.join(__dirname, '../../../frontend/public/quote-footer.jpg');
let footerDataUri = '';
try {
  if (fs.existsSync(footerPath)) {
    footerDataUri = 'data:image/jpeg;base64,' + fs.readFileSync(footerPath).toString('base64');
  }
} catch (_) { /* footer optional */ }

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatNum = (n) => Number(n || 0).toLocaleString('en-US');

const formatDateAr = (d) => {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// The Arabic boilerplate the old PDFKit version was using. Kept verbatim so
// the new HTML output reads exactly the same as what the team is used to.
const T = {
  title: 'عرض السعر',
  quoteDetails: 'بيانات عرض السعر',
  clientDetails: 'بيانات العميل',
  reference: 'المرجع', date: 'التاريخ', validUntil: 'صالح حتى', preparedBy: 'أُعدّ بواسطة',
  arrivalDate: 'تاريخ الوصول',
  company: 'الشركة', contact: 'جهة الاتصال', phone: 'الهاتف', email: 'البريد الإلكتروني',
  descRoom: 'الوصف', roomType: 'نوع الغرفة', rooms: 'الغرف', nights: 'الليالي',
  rateNight: 'السعر / ليلة (ر.س)', totalCol: 'الإجمالي (ر.س)',
  hotelCol: 'الفندق',
  clientApproval: 'موافقة العميل',
  subtotal: 'المجموع الفرعي', vat: 'ضريبة القيمة المضافة (15%)', municipalityTax: 'رسوم البلدية', grandTotal: 'الإجمالي النهائي',
  sar: 'ر.س',
  notesTerms: 'ملاحظات وشروط',
  benefits: 'المزايا',
  benefit1: (tax) => `الأسعار أعلاه تشمل ضريبة القيمة المضافة 15%${tax > 0 ? ` ورسوم البلدية ${tax}%` : ''} في فنادق إيواء.`,
  benefit2: 'الأسعار أعلاه صافية وغير قابلة للعمولة وبالريال السعودي.',
  benefit3: 'الأسعار المعروضة شاملة الإنترنت اللاسلكي WI-Fi.',
  // Meals can be one or more of: none / breakfast / lunch / dinner / full_board.
  // Compose an Arabic line listing every meal the rep selected, joined with "و".
  // 'none' suppresses the line entirely; 'full_board' expands to all three.
  benefit4: (meals) => {
    const arr = Array.isArray(meals)
      ? meals
      : String(meals || '').split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length === 0 || arr.includes('none')) return null;
    if (arr.includes('full_board')) {
      return 'الأسعار شاملة الإفطار والغداء والعشاء.';
    }
    const labels = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
    const picked = ['breakfast','lunch','dinner'].filter(k => arr.includes(k)).map(k => labels[k]);
    if (picked.length === 0) return null;
    if (picked.length === 1) return `الأسعار شاملة ${picked[0]}.`;
    // For 2+, join with "و" before every element except the first:
    //   ["الإفطار","الغداء","العشاء"] → "الإفطار والغداء والعشاء"
    const joined = picked[0] + picked.slice(1).map(p => ' و' + p).join('');
    return `الأسعار شاملة ${joined}.`;
  },
  termsTitle: 'الشروط والأحكام',
  terms1: 'موعد تسجيل الدخول الساعة 15:00 ومغادرة الغرفة الساعة 12:00 ظهرًا. أي تأخير في المغادرة بعد الساعة 16:00 يخضع لرسوم 50% من السعر المتفق عليه، وأي تأخير بعد الساعة 18:00 يخضع لرسوم ليلة كاملة إضافية. تسجيل الدخول المبكر أو تمديد المغادرة متاحان حسب التوفر.',
  terms2: 'في حال رغبة المجموعة في البقاء بعد الساعة 12:00 ظهرًا، يمكن استلام الأمتعة وتخزينها حتى وقت المغادرة، مع إمكانية استخدام كافة خدمات الفندق.',
  terms3: 'تتعهد الشركة بأن ضيوفها سيلتزمون بجميع القوانين واللوائح المعمول بها في المملكة العربية السعودية والأنظمة الداخلية للفندق.',
  terms4: 'تنفيذ هذه الاتفاقية من قبل أي طرف يخضع للقوة القاهرة كالكوارث والقرارات الحكومية والإضرابات والاضطرابات المدنية أو أي حالة طارئة تجعل تقديم الخدمات أو المرافق غير ممكن. يجوز لأي طرف إنهاء هذا العقد لأي من الأسباب المذكورة بإشعار مكتوب للطرف الآخر دون أي مسؤولية.',
  cancellation: 'سياسة الإلغاء',
  cancelIntro: 'تفاصيل سياسة رسوم الإلغاء كما يلي:',
  cancel1: 'الإلغاء قبل وصول المجموعة بـ 6 أيام: 50% من سعر الغرفة عن المدة المتفق عليها.',
  cancel2: 'الإلغاء قبل وصول المجموعة بـ 3 أيام: 75% من سعر الغرفة عن المدة المتفق عليها.',
  cancel3: 'الإلغاء يوم وصول المجموعة: 100% من سعر الغرفة عن المدة المتفق عليها.',
  otherConditions: 'شروط أخرى',
  otherText: 'يخضع تنفيذ هذه الاتفاقية للإنهاء دون أي مسؤولية عند حدوث أي ظرف خارج عن إرادة الطرفين — كالكوارث الطبيعية والحرب والإرهاب والأنظمة الحكومية والإضرابات والاضطرابات المدنية أو تعليق وسائل النقل — إلى الحد الذي يجعل تقديم خدمات الفندق أو استخدامها غير ممكن. يشترط لإنهاء الاتفاقية بموجب هذه الفقرة تسليم إشعار مكتوب للطرف الآخر يوضح أساس الإنهاء في أقرب وقت ممكن، وبما لا يتجاوز 10 أيام من علم الطرف بالظرف.',
  payments: 'الدفعات',
  bankAccount: 'بيانات الحساب البنكي',
  bankNameLabel: 'اسم البنك',
  beneficiaryLabel: 'اسم المستفيد',
  nationalIdLabel: 'رقم الهوية الوطنية',
  accountNumberLabel: 'رقم الحساب',
  ibanLabel: 'الآيبان',
  bankMissing: 'سيتم تزويدكم ببيانات الحساب البنكي بشكل منفصل.',
  rateDisclosure: 'سرية الأسعار',
  rateDisclosureText: 'الأسعار الواردة في هذا العرض تخص هذه الاتفاقية فقط وهي سرية تمامًا. يلتزم العميل بعدم الإفصاح عن الأسعار لأي طرف ثالث بشكل مباشر أو غير مباشر بأي وسيلة. في حال إعادة البيع غير المباشر، يلتزم العميل بإلزام الطرف المتعاقد بنفس الالتزامات.',
  forceMajeure: 'القوة القاهرة',
  forceMajeureText: 'إذا تعذّر تنفيذ هذا العقد أو أي التزام بموجبه أو تأخّر بسبب القوة القاهرة (أي ظرف خارج عن إرادة الطرفين بشكل معقول)، وقام الطرف غير القادر على الوفاء بإشعار الطرف الآخر فورًا بشكل مكتوب، فإن التزامات الطرف المتمسك بهذا الحكم تُعلَّق بالقدر الضروري بسبب هذا الحدث. تشمل القوة القاهرة (دون حصر): الكوارث الطبيعية والحرائق والأوبئة والانفجارات والتخريب والعواصف وأوامر السلطات العسكرية أو المدنية والطوارئ الوطنية والاضطرابات والثورات والحروب والإضرابات وتوقّف العمل أو فشل الموردين. يبذل الطرف المعفى جهودًا معقولة لتجنب أو إزالة أسباب عدم التنفيذ ويستأنف التنفيذ بسرعة معقولة فور إزالة هذه الأسباب.',
  jurisdiction: 'الاختصاص القضائي',
  jurisdictionText: 'تخضع هذه الاتفاقية لقوانين المملكة العربية السعودية، ويتفق الطرفان على أن المحاكم في المملكة العربية السعودية لها الاختصاص الحصري لتسوية أي نزاع بين الطرفين.',
  standardTerms: 'الشروط العامة',
  standard1: 'يقرّ الطرفان ويضمنان أن لديهما الصلاحية الكاملة والسلطة والحق القانوني للدخول في هذه الاتفاقية، وأن جميع الإجراءات الشكلية المتعلقة بتنفيذها قد استُكمِلت. لا يجوز تعديل هذه الاتفاقية إلا بمستند مكتوب صريح موقّع من ممثلين مفوّضين من الطرفين.',
  standard2: 'يرجى ملاحظة أنه تم بالفعل عمل حجز مبدئي لكم. ومع ذلك، نشكر لكم الرد المكتوب السريع لكي نتمكن من الاستعداد اللازم.',
  standard3: 'نأمل أن يكون العرض أعلاه يفي بمتطلباتكم. يرجى توقيع العرض ووضع ختم الشركة لتأكيد الموافقة على الشروط والأحكام أعلاه. وفي حال احتجتم أي توضيحات، لا تترددوا في التواصل معي مباشرةً.',
  standard4: 'نكون ممتنين لو تكرمتم بإرسال التأكيد قبل تاريخ الوصول بـ 15 يومًا على الأقل. وفي حال عدم وصول رد منكم خلال هذه الفترة، سنعتبر أن الحجز لم يعد مطلوبًا وسنقوم بتحرير المساحة المحجوزة.',
  welcoming: 'نتطلّع لاستقبالكم واستقبال ضيوفكم في فنادق إيواء.',
  confirmOn: 'التأكيد بالنيابة عن:',
  name: 'الاسم', signature: 'التوقيع', titleField: 'المسمى الوظيفي', dateField: 'التاريخ',
  phoneField: 'رقم الجوال', companyStamp: 'ختم الشركة',
};

const renderQuoteHtmlAr = ({
  ref,
  today,
  validUntil,
  hotel,
  client,
  companyName,
  contactPerson,
  items,
  isMultiHotel,
  subtotal,
  munTaxRate,
  munTax,
  vat,
  grandTotal,
  notes,
  meals,
  preparedByName,
  preparedByTitle,
  preparedByPhone,
  paymentTerms,
  arrivalDate,
}) => {
  const hotelName = hotel?.name || hotel?.nameEn || 'فنادق إيواء';
  const recipientCompany = companyName || client?.companyName || '-';
  const recipientContact = contactPerson || client?.contactPerson || '-';
  const recipientPhone   = client?.phone || '-';
  const recipientEmail   = client?.email || '-';
  const repName  = preparedByName || '-';
  const repTitle = preparedByTitle || '';
  const repPhone = (preparedByPhone || '').toString().trim();
  const todayStr = formatDateAr(today);
  const validStr = formatDateAr(validUntil);

  const benefit4Text = T.benefit4(meals);

  const itemRows = items.map((it) => `
      <tr>
        ${isMultiHotel ? `<td>${escapeHtml(it.hotelName || '-')}</td>` : ''}
        <td class="td-desc">${escapeHtml(it.description || '')}</td>
        <td>${escapeHtml(it.roomType || '-')}</td>
        <td>${it.rooms || 0}</td>
        <td>${it.nights || 0}</td>
        <td>${formatNum(it.rate)}</td>
        <td>${formatNum(it.total)}</td>
      </tr>`).join('');

  // Bank rows — only render rows the hotel actually has data for.
  const bankRows = [
    [T.bankNameLabel,        hotel?.bankName],
    [T.beneficiaryLabel,     hotel?.beneficiaryName],
    [T.nationalIdLabel,      hotel?.nationalId],
    [T.accountNumberLabel,   hotel?.accountNumber],
    [T.ibanLabel,            hotel?.iban],
  ].filter(([, v]) => v && String(v).trim() !== '');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>عرض سعر ${escapeHtml(ref)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm 22mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    font-size: 10.5pt;
    color: #1f2937;
    line-height: 1.7;
    direction: rtl;
    margin: 0;
    padding: 0;
  }
  /* Explicit left/right anchoring instead of flex so the layout is the
     same in Chromium and in wkhtmltopdf's older WebKit (whose flex+RTL
     interaction is flaky). The logo always lands on the LEFT, the hotel
     name on the RIGHT in this RTL document. */
  .header {
    position: relative;
    min-height: 90px;
    border-bottom: 2px solid #0f4c81;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .header .logo-slot {
    position: absolute;
    left: 0;
    top: 0;
  }
  /* Logo sized to match the English PDFKit version (height: 80pt). */
  .header .logo-slot img { height: 80px; display: block; }
  .header .hotel-name {
    text-align: right;
    font-size: 16pt;
    font-weight: 700;
    color: #0f4c81;
    padding-top: 28px;
  }
  h1.quote-title {
    font-size: 16pt;
    color: #0f4c81;
    text-align: center;
    margin: 8px 0 14px;
    font-weight: 700;
  }
  /* Two-column block holding "quote details" + "client details". Each col
     needs min-width:0 so a long company name can wrap inside its own
     column instead of pushing the layout out and overlapping the column
     beside / below it. */
  .info-block { display: flex; gap: 14px; margin-bottom: 12px; align-items: flex-start; }
  .info-col { flex: 1; min-width: 0; }
  .info-col h3 {
    color: #0f4c81;
    font-size: 11pt;
    margin: 0 0 6px;
    font-weight: 700;
  }
  .info-line {
    display: flex;
    gap: 6px;
    margin: 2px 0;
    font-size: 10pt;
    align-items: baseline;
    min-width: 0;
  }
  .info-line .lbl { color: #6b7280; min-width: 90px; flex-shrink: 0; }
  /* min-width:0 + overflow-wrap let very long values wrap inside the cell
     without pushing the row wider than its column. */
  .info-line .val {
    color: #1f2937;
    font-weight: 600;
    min-width: 0;
    flex: 1;
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: 1.45;
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 4px;
    font-size: 10pt;
  }
  table.items th, table.items td {
    border: 1px solid #cbd5e1;
    padding: 7px 5px;
    text-align: center;
  }
  table.items thead th {
    background: #0f4c81;
    color: #fff;
    font-weight: 600;
    font-size: 10pt;
  }
  table.items .td-desc { text-align: right; }

  .totals {
    margin: 10px 0 14px;
    margin-right: auto;
    width: 460px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    /* breathing room between "Label:" and the amount so the colon doesn't
       hug the number — required because flex space-between collapses to
       zero gap once the two ends reach each other. */
    gap: 48px;
    padding: 3px 0;
    border-bottom: 1px dotted #e5e7eb;
    font-size: 10pt;
  }
  .totals .row .lbl { color: #6b7280; flex-shrink: 0; }
  .totals .row .val { color: #1f2937; font-weight: 600; padding-inline-start: 32px; }
  .totals .row.grand {
    border-top: 1.5px solid #0f4c81;
    border-bottom: 1.5px solid #0f4c81;
    margin-top: 4px;
    padding: 6px 0;
    font-size: 11pt;
  }
  .totals .row.grand .lbl, .totals .row.grand .val { color: #0f4c81; font-weight: 700; }

  .section {
    margin: 10px 0;
    /* Sections themselves are allowed to split across pages — locking the
       whole section caused tall ones to jump to the next page and leave
       most of the prior page blank. We keep the smaller "don't split"
       rules below (heading stays with its first paragraph, individual
       paragraphs don't split) so the layout still reads cleanly. */
  }
  .section h2 {
    color: #0f4c81;
    font-size: 11pt;
    margin: 8px 0 4px;
    font-weight: 700;
    border-bottom: 1px dashed #cbd5e1;
    padding-bottom: 2px;
    /* Keep the heading with its first paragraph. */
    page-break-after: avoid;
    break-after: avoid;
  }
  .section p {
    margin: 4px 0;
    text-align: justify;
    font-size: 10pt;
    /* Single paragraphs stay intact (no orphaned half-sentences), but the
       parent section is allowed to split between paragraphs so the page
       fills naturally. */
    page-break-inside: avoid;
    break-inside: avoid;
    orphans: 2;
    widows: 2;
  }
  ul.bullets {
    margin: 4px 0;
    padding-right: 18px;
    /* Bullet lists may split — locking them was contributing to the
       half-empty pages too. */
  }
  ul.bullets li { margin: 3px 0; font-size: 10pt; }

  .page-break { page-break-before: always; }

  table.bank {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
    font-size: 10pt;
  }
  table.bank td {
    padding: 5px 10px;
    border: 1px solid #cbd5e1;
  }
  table.bank td.label {
    background: #f3f4f6;
    width: 35%;
    font-weight: 600;
    color: #0f4c81;
  }
  table.bank td.value { font-family: 'Cairo', monospace; }

  .welcoming {
    text-align: center;
    color: #0f4c81;
    font-weight: 600;
    font-size: 11pt;
    margin: 14px 0;
  }

  /* Wrapper holding the two signature blocks side-by-side. display:table
     is used instead of flex because wkhtmltopdf (old WebKit fallback on
     legacy Windows) doesn't render flex reliably and falls back to
     stacking. Tables are universally supported by every renderer. */
  .signature-row {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-spacing: 16px 0;
    margin-top: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .signature-block {
    display: table-cell;
    vertical-align: top;
    width: 50%;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .signature-block h2 {
    color: #0f4c81;
    font-size: 11pt;
    margin: 0 0 8px;
    font-weight: 700;
  }
  .signature-grid {
    display: grid;
    /* Single column — each field sits under the previous one so the rep
       can sign / stamp without the layout fighting them. The side-by-side
       wrapper already constrains the total width, so no max-width here. */
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 6px;
  }
  .sig-field {
    border-bottom: 1px solid #9ca3af;
    padding: 0 4px 2px;
    min-height: 22px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    font-size: 10pt;
  }
  .sig-field .lbl { color: #6b7280; min-width: 80px; }
  .sig-field .val { color: #1f2937; font-weight: 600; }

  /* Footer is rendered per-page via the PDF renderer's footer template
     (Puppeteer footerTemplate / wkhtmltopdf --footer-html), not as a
     position:fixed element in the body — those don't repeat reliably
     across pages and were overlapping the signature block. */
</style>
</head>
<body>
  <div class="header">
    ${logoDataUri ? `<div class="logo-slot"><img src="${logoDataUri}" alt="logo"></div>` : ''}
    <div class="hotel-name">${escapeHtml(hotelName)}</div>
  </div>

  <h1 class="quote-title">${T.title}</h1>

  <div class="info-block">
    <div class="info-col">
      <h3>${T.quoteDetails}</h3>
      <div class="info-line"><span class="lbl">${T.reference}:</span><span class="val">${escapeHtml(ref)}</span></div>
      <div class="info-line"><span class="lbl">${T.date}:</span><span class="val">${todayStr}</span></div>
      ${arrivalDate ? `<div class="info-line"><span class="lbl">${T.arrivalDate}:</span><span class="val">${formatDateAr(arrivalDate)}</span></div>` : ''}
      <div class="info-line"><span class="lbl">${T.validUntil}:</span><span class="val">${validStr}</span></div>
      <div class="info-line"><span class="lbl">${T.preparedBy}:</span><span class="val">${escapeHtml(repName)}${repTitle ? ' — ' + escapeHtml(repTitle) : ''}</span></div>
    </div>
    <div class="info-col">
      <h3>${T.clientDetails}</h3>
      <div class="info-line"><span class="lbl">${T.company}:</span><span class="val">${escapeHtml(recipientCompany)}</span></div>
      <div class="info-line"><span class="lbl">${T.contact}:</span><span class="val">${escapeHtml(recipientContact)}</span></div>
      <div class="info-line"><span class="lbl">${T.phone}:</span><span class="val" dir="ltr" style="text-align:right;">${escapeHtml(recipientPhone)}</span></div>
      <div class="info-line"><span class="lbl">${T.email}:</span><span class="val" dir="ltr" style="text-align:right;">${escapeHtml(recipientEmail)}</span></div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        ${isMultiHotel ? `<th>${T.hotelCol}</th>` : ''}
        <th>${T.descRoom}</th>
        <th>${T.roomType}</th>
        <th>${T.rooms}</th>
        <th>${T.nights}</th>
        <th>${T.rateNight}</th>
        <th>${T.totalCol}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="lbl">${T.subtotal}:</span><span class="val">${formatNum(subtotal)} ${T.sar}</span></div>
    ${munTaxRate > 0 ? `<div class="row"><span class="lbl">${T.municipalityTax} (${munTaxRate}%):</span><span class="val">${formatNum(munTax)} ${T.sar}</span></div>` : ''}
    <div class="row"><span class="lbl">${T.vat}:</span><span class="val">${formatNum(vat)} ${T.sar}</span></div>
    <div class="row grand"><span class="lbl">${T.grandTotal}:</span><span class="val">${formatNum(grandTotal)} ${T.sar}</span></div>
  </div>

  ${notes ? `
  <div class="section">
    <h2>${T.notesTerms}</h2>
    <p style="white-space:pre-wrap;">${escapeHtml(notes)}</p>
  </div>` : ''}

  <div class="section">
    <h2>${T.benefits}</h2>
    <ul class="bullets">
      <li>${T.benefit1(munTaxRate)}</li>
      <li>${T.benefit2}</li>
      <li>${T.benefit3}</li>
      ${benefit4Text ? `<li>${benefit4Text}</li>` : ''}
    </ul>
  </div>

  <div class="section">
    <h2>${T.termsTitle}</h2>
    <p>${T.terms1}</p>
    <p>${T.terms2}</p>
    <p>${T.terms3}</p>
    <p>${T.terms4}</p>
  </div>

  <div class="section">
    <h2>${T.cancellation}</h2>
    <p>${T.cancelIntro}</p>
    <ul class="bullets">
      <li>${T.cancel1}</li>
      <li>${T.cancel2}</li>
      <li>${T.cancel3}</li>
    </ul>
  </div>

  <div class="section">
    <h2>${T.otherConditions}</h2>
    <p>${T.otherText}</p>
  </div>

  ${(paymentTerms || '').toString().trim() ? `
  <div class="section">
    <h2>${T.payments}</h2>
    <p style="white-space:pre-wrap;">${escapeHtml(paymentTerms)}</p>
  </div>` : ''}

  <div class="section">
    <h2>${T.bankAccount}</h2>
    ${bankRows.length === 0
      ? `<p>${T.bankMissing}</p>`
      : `<table class="bank">${bankRows.map(([label, value]) => `
            <tr>
              <td class="label">${escapeHtml(label)}</td>
              <td class="value" dir="ltr" style="text-align:right;">${escapeHtml(value)}</td>
            </tr>`).join('')}</table>`}
  </div>

  <div class="section">
    <h2>${T.rateDisclosure}</h2>
    <p>${T.rateDisclosureText}</p>
  </div>

  <div class="section">
    <h2>${T.forceMajeure}</h2>
    <p>${T.forceMajeureText}</p>
  </div>

  <div class="section">
    <h2>${T.jurisdiction}</h2>
    <p>${T.jurisdictionText}</p>
  </div>

  <div class="section">
    <h2>${T.standardTerms}</h2>
    <p>${T.standard1}</p>
    <p>${T.standard2}</p>
    <p>${T.standard3}</p>
    <p>${T.standard4}</p>
  </div>

  <p class="welcoming">${T.welcoming}</p>

  <!-- Both signature blocks side-by-side so 12 rows of fields don't push the
       layout onto a new page that ends up half-empty. The wrapper itself is
       page-break-inside: avoid so the pair stays together. -->
  <div class="signature-row">
    <div class="signature-block">
      <h2>${T.confirmOn}</h2>
      <div class="signature-grid">
        <div class="sig-field"><span class="lbl">${T.name}:</span><span class="val">${escapeHtml(repName)}</span></div>
        <div class="sig-field"><span class="lbl">${T.titleField}:</span><span class="val">${escapeHtml(repTitle)}</span></div>
        <div class="sig-field"><span class="lbl">${T.signature}:</span><span class="val"></span></div>
        <div class="sig-field"><span class="lbl">${T.dateField}:</span><span class="val">${todayStr}</span></div>
        <div class="sig-field"><span class="lbl">${T.phoneField}:</span><span class="val" dir="ltr" style="text-align:right;">${escapeHtml(repPhone)}</span></div>
        <div class="sig-field"><span class="lbl">${T.companyStamp}:</span><span class="val"></span></div>
      </div>
    </div>

    <div class="signature-block">
      <h2>${T.clientApproval}</h2>
      <div class="signature-grid">
        <div class="sig-field"><span class="lbl">${T.name}:</span><span class="val"></span></div>
        <div class="sig-field"><span class="lbl">${T.titleField}:</span><span class="val"></span></div>
        <div class="sig-field"><span class="lbl">${T.signature}:</span><span class="val"></span></div>
        <div class="sig-field"><span class="lbl">${T.dateField}:</span><span class="val"></span></div>
        <div class="sig-field"><span class="lbl">${T.phoneField}:</span><span class="val"></span></div>
        <div class="sig-field"><span class="lbl">${T.companyStamp}:</span><span class="val"></span></div>
      </div>
    </div>
  </div>

</body>
</html>`;
};

// Separate footer HTML, repeated on every page by the renderer. Sized to
// match the English PDFKit version (width 515pt at the document margin
// edge). Banner ratio 1728×229, so 515pt wide → ~68pt tall ≈ 24mm.
const renderQuoteFooterHtml = () => {
  if (!footerDataUri) return '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  .wrap { width: 100%; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  img { width: 100%; height: 24mm; object-fit: contain; display: block; }
</style></head>
<body><div class="wrap"><img src="${footerDataUri}" alt="footer"></div></body>
</html>`;
};

module.exports = { renderQuoteHtmlAr, renderQuoteFooterHtml };
