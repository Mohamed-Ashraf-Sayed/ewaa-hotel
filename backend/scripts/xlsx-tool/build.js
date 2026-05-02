const XLSX = require('xlsx');
const path = require('path');

const HEADERS = [
  'اسم الشركة (مطلوب)',
  'اسم الشركة بالإنجليزي',
  'جهة الاتصال (مطلوب)',
  'المنصب',
  'رقم الهاتف',
  'الإيميل',
  'المدينة / العنوان',
  'القطاع',
  'نوع العميل (مطلوب)',
  'مصدر العميل',
  'الفندق المقترح',
  'المجموعات المهتم بها',
  'عدد الغرف المتوقع سنوياً',
  'الميزانية السنوية (ر.س)',
  'الموقع الإلكتروني',
  'ملاحظات',
];

const EX1 = [
  'شركة الاتصالات السعودية','Saudi Telecom Company','م. سلطان الشمري','مدير الخدمات العامة',
  '0114700001','sultan@stc.com.sa','الرياض','الاتصالات','active','referral',
  'فندق إيواء الرياض العليا','muhaidib_serviced,awa_hotels',60,2000000,'www.stc.com.sa','عميل VIP سنوي',
];
const EX2 = [
  'مثال شركة محتملة','Example Company','أ. محمد أحمد','مدير المشتريات',
  '0500000000','example@company.com','جدة','المقاولات','lead','exhibition',
  '','awa_hotels',30,'','','من معرض ITB',
];

const dataRows = [HEADERS, EX1, EX2];
// Add empty rows so the sheet feels ready to type into
for (let i = 0; i < 50; i++) dataRows.push(Array(HEADERS.length).fill(''));

const ws = XLSX.utils.aoa_to_sheet(dataRows);

// RTL + column widths
ws['!cols'] = [30, 28, 25, 20, 16, 26, 20, 18, 18, 18, 28, 32, 22, 22, 24, 30].map(w => ({ wch: w }));
ws['!views'] = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataRows.length - 1, c: HEADERS.length - 1 } }) };

// Data validation — client type + source
ws['!dataValidation'] = [
  {
    sqref: `I2:I${dataRows.length}`,
    type: 'list',
    formula1: '"active,lead,inactive"',
    errorTitle: 'قيمة غير صحيحة',
    error: 'اختر: active أو lead أو inactive',
  },
  {
    sqref: `J2:J${dataRows.length}`,
    type: 'list',
    formula1: '"cold_call,referral,exhibition,website,social_media,walk_in,other"',
    errorTitle: 'قيمة غير صحيحة',
    error: 'اختر واحدة من القيم المحددة بالظبط',
  },
];

// === Guide sheet ===
const GUIDE = [
  ['دليل تعبئة ملف العملاء'],
  [''],
  ['الهدف: كل مندوب يعبّي بيانات عملائه الحاليين ويرجّع الشيت، وبعدها ترفع كلها مرة واحدة على النظام.'],
  ['بعد الرفع، تسجيل أي عميل جديد بيتم مباشرة من داخل النظام.'],
  [''],
  ['──────── قبل ما تبدأ ────────'],
  ['1. احفظ الملف باسمك: مثلاً clients_OmarAbdelrahman.xlsx'],
  ['2. افتحه في Microsoft Excel (مش Notepad)'],
  ['3. في شيت "العملاء" في سطرين مثال — احذفهم وابدأ تعبّي بياناتك'],
  ['4. متشيلش ولا تغيّر ترتيب الأعمدة، ومتغيّرش أسماء الأعمدة'],
  [''],
  ['──────── الحقول المطلوبة ────────'],
  ['• اسم الشركة (عمود 1) — الاسم الرسمي بالعربي'],
  ['• جهة الاتصال (عمود 3) — اسم الشخص اللي بتتعامل معاه'],
  ['• نوع العميل (عمود 9) — active / lead / inactive'],
  ['(باقي الحقول اختيارية لكن كل ما عبّيت أكتر كل ما العميل بيبقى أوضح في النظام)'],
  [''],
  ['──────── نوع العميل ────────'],
  ['active   = عميل نشط بيتعامل معانا حالياً'],
  ['lead     = محتمل لسه ما أبرمنا معاه عقد'],
  ['inactive = كان عميل وتوقف'],
  [''],
  ['──────── مصدر العميل ────────'],
  ['cold_call    = اتصال بارد'],
  ['referral     = إحالة من عميل أو شخص'],
  ['exhibition   = معرض'],
  ['website      = من الموقع الإلكتروني'],
  ['social_media = وسائل التواصل'],
  ['walk_in      = زيارة مباشرة للفندق'],
  ['other        = مصدر آخر'],
  [''],
  ['──────── المجموعات المهتم بها ────────'],
  ['اكتب واحد أو أكتر مفصولين بفاصلة (بدون مسافات):'],
  ['muhaidib_serviced = المهيدب للشقق المخدومة'],
  ['awa_hotels        = فنادق إيواء'],
  ['grand_plaza       = جراند بلازا'],
  ['مثال: muhaidib_serviced,awa_hotels'],
  [''],
  ['──────── ممنوعات ────────'],
  ['× متشيلش أي عمود حتى لو مش هتعبّيه — سيبه فاضي بس'],
  ['× متغيّرش ترتيب الأعمدة ولا أسماء الأعمدة'],
  ['× عميل واحد في كل سطر، وعدم تكرار اسم شركة مرتين'],
  ['× متحطش رموز غريبة < > { } في خانة الأسماء'],
  ['× متكتبش "نشط" في عمود نوع العميل، اكتب active'],
  [''],
  ['──────── نصائح ────────'],
  ['• رقم الهاتف: أرقام بس، ممكن يبدأ بـ 05 أو 011 أو +966'],
  ['• الإيميل: شرط فيه @ ونقطة'],
  ['• عدد الغرف والميزانية: أرقام بس بدون علامات عملة'],
  ['• لو عميل بيانات ناقصة، اكتب الشرح في عمود "ملاحظات"'],
  [''],
  ['──────── بعد ما تخلص ────────'],
  ['1. احفظ الملف (Ctrl+S)'],
  ['2. ابعته للإدارة بإيميل'],
  ['3. اكتب في عنوان الإيميل: عملاء - اسمك'],
];

const wsGuide = XLSX.utils.aoa_to_sheet(GUIDE);
wsGuide['!cols'] = [{ wch: 90 }];
wsGuide['!views'] = [{ rightToLeft: true }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'العملاء');
XLSX.utils.book_append_sheet(wb, wsGuide, 'دليل التعبئة');

const outPath = path.join(__dirname, '..', 'clients_template.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Wrote:', outPath);
