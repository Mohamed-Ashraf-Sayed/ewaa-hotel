// Arabic-language quote rendered as HTML and turned into a PDF via Puppeteer.
// PDFKit can't shape Arabic punctuation/digits reliably; Chromium handles RTL
// and Arabic shaping natively, so the Arabic quote lives here instead.

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

// Arabic month names so the formatted date reads naturally on the letter.
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const formatDateAr = (d) => {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
const formatDateArShort = (d) => {
  const dt = new Date(d);
  return `${dt.getDate()} ${AR_MONTHS[dt.getMonth()]}`;
};

// Convert an integer amount to Arabic words. Used for the "by words" sentence
// underneath the total. Handles up to billions which is plenty for a quote.
const numberToArabicWords = (num) => {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'صفر';
  const ones = ['', 'واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  const tens = ['', '', 'عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  const under1000 = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = Math.floor(n / 10), u = n % 10;
      return u === 0 ? tens[t] : `${ones[u]} و${tens[t]}`;
    }
    const h = Math.floor(n / 100), r = n % 100;
    const hMap = ['', 'مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
    return r === 0 ? hMap[h] : `${hMap[h]} و${under1000(r)}`;
  };
  const parts = [];
  const billions = Math.floor(num / 1_000_000_000);
  const millions = Math.floor((num % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((num % 1_000_000) / 1000);
  const remainder = num % 1000;
  if (billions) parts.push(`${under1000(billions)} مليار`);
  if (millions) parts.push(`${under1000(millions)} مليون`);
  if (thousands) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands < 11) parts.push(`${under1000(thousands)} آلاف`);
    else parts.push(`${under1000(thousands)} ألف`);
  }
  if (remainder) parts.push(under1000(remainder));
  return parts.join(' و');
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
  year,
}) => {
  const hotelName = hotel?.name || hotel?.nameEn || 'فنادق إيواء';
  const recipientCompany = companyName || client?.companyName || '-';
  const recipientContact = contactPerson || client?.contactPerson || '-';
  const repName = preparedByName || '-';
  const repTitle = preparedByTitle || 'مدير المبيعات';
  const repPhone = preparedByPhone || '';
  const todayStr = formatDateAr(today);
  const arrivalStr = items[0]?.arrivalDate ? formatDateArShort(items[0].arrivalDate) : formatDateArShort(today);
  const departureStr = items[0]?.departureDate ? formatDateArShort(items[0].departureDate) : formatDateArShort(validUntil);

  // Items row(s)
  const itemRows = items.map((it, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, '0')}</td>
        <td>${escapeHtml(it.description || '-')}${it.roomType ? ' ' + escapeHtml(it.roomType) : ''}</td>
        <td>${formatNum(it.rate)}</td>
        <td>${escapeHtml(arrivalStr)}</td>
        <td>${escapeHtml(departureStr)}</td>
        <td>${String(it.nights || 0).padStart(2, '0')}</td>
        <td>${formatNum(it.total)}</td>
      </tr>`).join('');

  const mealsLine = (() => {
    switch (meals) {
      case 'lunch':      return 'شامل الغداء';
      case 'dinner':     return 'شامل العشاء';
      case 'full_board': return 'شامل الإفطار والغداء والعشاء';
      case 'none':       return '';
      case 'breakfast':
      default:           return 'شامل الإفطار';
    }
  })();

  // Bank details — only render the block if the hotel has anything saved.
  const bankRows = [
    ['اسم البنك', hotel?.bankName],
    ['اسم المستفيد', hotel?.beneficiaryName],
    ['رقم الهوية الوطنية', hotel?.nationalId],
    ['رقم الحساب', hotel?.accountNumber],
    ['الآيبان (IBAN)', hotel?.iban],
  ].filter(([, v]) => v && String(v).trim() !== '');

  const totalWords = numberToArabicWords(grandTotal);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>عرض سعر ${escapeHtml(ref)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm 22mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    font-size: 11pt;
    color: #1f2937;
    line-height: 1.7;
    direction: rtl;
    margin: 0;
    padding: 0;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #0f4c81;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .header .hotel {
    font-size: 17pt;
    font-weight: 700;
    color: #0f4c81;
  }
  .header img { height: 60px; }
  .meta-row {
    margin: 6px 0;
    font-size: 11pt;
  }
  .meta-row strong { color: #0f4c81; }
  .subject {
    background: #f3f4f6;
    border-right: 4px solid #0f4c81;
    padding: 8px 14px;
    margin: 8px 0 14px;
    font-weight: 600;
  }
  .recipients {
    margin: 14px 0 18px;
  }
  .recipients .row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .recipients .left { color: #374151; }
  .intro {
    margin: 14px 0;
    text-align: justify;
  }
  .hotel-section-title {
    background: #0f4c81;
    color: #fff;
    font-weight: 700;
    padding: 8px 14px;
    margin: 16px 0 8px;
    border-radius: 4px;
  }
  .rates-intro {
    margin: 4px 0 6px;
    font-weight: 600;
    color: #0f4c81;
  }
  table.prices {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 10px;
    font-size: 10.5pt;
  }
  table.prices th, table.prices td {
    border: 1px solid #cbd5e1;
    padding: 8px 6px;
    text-align: center;
  }
  table.prices thead th {
    background: #0f4c81;
    color: #fff;
    font-weight: 600;
  }
  table.prices tfoot td {
    background: #fff7ed;
    font-weight: 600;
  }
  .total-words {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 4px;
    padding: 8px 12px;
    margin: 10px 0;
    font-weight: 600;
    color: #166534;
    text-align: center;
  }
  ul.bullets {
    margin: 6px 0 14px 0;
    padding-right: 18px;
    list-style: '◾ ';
  }
  ul.bullets li { margin: 4px 0; }
  .section-head {
    color: #0f4c81;
    font-weight: 700;
    margin: 14px 0 6px;
    border-bottom: 1px dashed #cbd5e1;
    padding-bottom: 3px;
  }
  .policy p { margin: 4px 0; }
  .signature {
    margin-top: 22px;
    display: flex;
    justify-content: space-between;
    gap: 30px;
  }
  .signature .col {
    width: 48%;
    border-top: 1px solid #cbd5e1;
    padding-top: 10px;
  }
  .signature .col strong { color: #0f4c81; display: block; margin-bottom: 4px; }
  .signature .col .who { font-weight: 600; margin-top: 6px; }
  .signature .col .role { font-size: 10pt; color: #6b7280; }
  .bank-section {
    margin-top: 22px;
    border-top: 2px solid #0f4c81;
    padding-top: 10px;
  }
  .bank-section h3 {
    color: #0f4c81;
    margin: 0 0 8px;
    font-size: 12pt;
  }
  table.bank {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
  }
  table.bank td {
    padding: 6px 10px;
    border: 1px solid #cbd5e1;
  }
  table.bank td.label {
    background: #f3f4f6;
    width: 38%;
    font-weight: 600;
    color: #0f4c81;
  }
  .footer-note {
    margin-top: 18px;
    font-size: 9pt;
    color: #6b7280;
    text-align: center;
  }
  ${footerDataUri ? `
  .footer-banner {
    position: fixed;
    bottom: 6mm;
    left: 16mm;
    right: 16mm;
    height: 20mm;
  }
  .footer-banner img { width: 100%; height: 100%; object-fit: contain; }
  ` : ''}
</style>
</head>
<body>
  <div class="header">
    <div class="hotel">${escapeHtml(hotelName)}</div>
    ${logoDataUri ? `<img src="${logoDataUri}" alt="logo">` : ''}
  </div>

  <div class="meta-row"><strong>المرجع:</strong> ${escapeHtml(ref)} &nbsp;&nbsp; <strong>التاريخ:</strong> ${todayStr}</div>

  <div class="subject">الموضوع: عرض ${escapeHtml(hotelName)} لعام ${year || new Date().getFullYear()}.</div>

  <div class="recipients">
    <div class="row"><span><strong>السادة:</strong> ${escapeHtml(recipientCompany)}</span><span class="left">المحترمين</span></div>
    <div class="row"><span><strong>سعادة الأستاذ:</strong> ${escapeHtml(recipientContact)}</span><span class="left">المحترم</span></div>
  </div>

  <p class="intro">
    بداية نود أن نشكركم على اهتمامكم بمجموعة فنادق إيواء كما يسعدنا استقبال ضيوفكم ومنسوبيكم الموقرين خلال هذا العام ${year || new Date().getFullYear()}.
  </p>
  <p class="intro">
    تعتبر مجموعة فنادقنا من الفنادق المميزة بمواقعها الاستراتيجية حيث تقدم لكم مايقرب من 3000 غرفة وجناح في أكثر المواقع أهمية وحيوية في مختلف مدن المملكة.
  </p>
  <p class="intro">
    بالإشارة إلى طلبكم الخاص بتسكين ضيوفكم الموقرين، نرجو كريم تفضلكم بدراسة العرض التالي:
  </p>

  <div class="hotel-section-title">${escapeHtml(hotelName)}</div>
  <div class="rates-intro">أسعار الإقامة بالفندق خلال الفترة أعلاه:</div>

  <table class="prices">
    <thead>
      <tr>
        <th>م</th>
        <th>نوع الغرف</th>
        <th>سعر الغرفة</th>
        <th>تاريخ الوصول</th>
        <th>تاريخ المغادرة</th>
        <th>عدد الليالي</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="total-words">
    المبلغ الإجمالي: <strong>${formatNum(grandTotal)} ر.س</strong>
    ${mealsLine ? `(${mealsLine}، شامل الضريبة)` : '(شامل الضريبة)'}
    <div style="font-size:10pt;font-weight:500;color:#166534;margin-top:4px;">فقط ${totalWords} ريال سعودي لا غير.</div>
  </div>

  <ul class="bullets">
    <li>الأسعار المذكورة أعلاه تشمل 15% ضريبة القيمة المضافة${munTaxRate > 0 ? ` + ${munTaxRate}% رسوم البلدية` : ''}.</li>
    <li>الأسعار أعلاه بالريال السعودي وغير خاضعة لأي عمولات.</li>
  </ul>

  <div class="section-head">مزايا الإقامة في مجموعة فنادق إيواء:</div>
  <ul class="bullets">
    <li>خدمة الواي فاي المجانية في الغرفة وجميع المناطق العامة داخل الفندق.</li>
    <li>مرافق صنع الشاي والقهوة في الغرفة.</li>
    <li>زجاجتان (صغيرتان) من المياه المعدنية يومياً.</li>
    ${mealsLine ? `<li>${escapeHtml(mealsLine)} مجاناً مع الغرفة.</li>` : ''}
    <li>خدمة مساعدة ذوي الاحتياجات الخاصة.</li>
  </ul>

  <div class="section-head">سياسة الدخول والخروج:</div>
  <div class="policy">
    <p>وقت تسجيل الدخول في الفندق هو 03:00 مساءً ووقت المغادرة هو 12:00 ظهراً. عند تسجيل المغادرة المتأخر حتى الساعة 6 مساءً، سيتم تحصيل 50% من السعر المتفق عليه المعمول به لكل غرفة في الليلة الواحدة. بالنسبة لعمليات تسجيل المغادرة بعد الساعة 6 مساءً، سيتم تطبيق سعر الليلة الكامل المعمول به. كلاهما يجب أن يتم ترتيبه مسبقاً مع الفندق من قبل الضيف.</p>
  </div>

  <div class="section-head">سياسة الإلغاء للحجوزات:</div>
  <ul class="bullets">
    <li>يتم إلغاء الحجوزات المؤكدة بدون رسوم إذا تم تبليغنا قبل الحجز بـ 24 ساعة على الأقل.</li>
    <li>يتم احتساب سعر ليلة في حالة إلغاء الحجوزات نفس اليوم.</li>
    <li>في حالة عدم حضور الضيوف يتم احتساب أول ليلة من الحجز.</li>
    <li>لاعتماد الحجز يرجى تحويل 100% من تكاليف الإقامة قبل الوصول بـ 48 ساعة.</li>
  </ul>

  <div class="section-head">طريقة السداد:</div>
  <p>تحويل بنكي.</p>

  ${notes ? `<div class="section-head">ملاحظات إضافية:</div><p style="white-space:pre-wrap;">${escapeHtml(notes)}</p>` : ''}

  <div class="signature">
    <div class="col">
      <strong>التأكيد على / ونيابة عن:</strong>
      ${escapeHtml(recipientCompany)}
      <div class="who">الأستاذ: ${escapeHtml(recipientContact)}</div>
    </div>
    <div class="col">
      <strong>التأكيد على / ونيابة عن:</strong>
      ${escapeHtml(hotelName)}
      <div class="who">${escapeHtml(repName)}</div>
      <div class="role">${escapeHtml(repTitle)}</div>
      ${repPhone ? `<div class="role">جوال: ${escapeHtml(repPhone)}</div>` : ''}
    </div>
  </div>

  ${bankRows.length > 0 ? `
  <div class="bank-section">
    <h3>التفاصيل البنكية</h3>
    <table class="bank">
      ${bankRows.map(([label, value]) => `
        <tr>
          <td class="label">${escapeHtml(label)}</td>
          <td dir="ltr" style="text-align:right;">${escapeHtml(value)}</td>
        </tr>`).join('')}
    </table>
  </div>` : ''}

  ${footerDataUri ? `<div class="footer-banner"><img src="${footerDataUri}" alt="footer"></div>` : ''}
</body>
</html>`;
};

module.exports = { renderQuoteHtmlAr };
