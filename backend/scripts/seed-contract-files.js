// One-off: generate a sample contract PDF and attach it to any seeded contract
// that doesn't already have a file uploaded. Safe to re-run — skips contracts
// that already have a fileUrl.
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { PrismaClient } = require('@prisma/client');
const { ARABIC_FEATURES } = require('../src/utils/arabicPdf');

const prisma = new PrismaClient();

const UPLOADS = path.join(__dirname, '../uploads');
const CAIRO_REG = path.join(__dirname, '../fonts/Cairo-Regular.ttf');
const CAIRO_BOLD = path.join(__dirname, '../fonts/Cairo-Bold.ttf');

const buildSamplePdf = (outPath, contractRef) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.registerFont('Cairo', CAIRO_REG);
  doc.registerFont('Cairo-Bold', CAIRO_BOLD);
  const stream = fs.createWriteStream(outPath);
  stream.on('finish', resolve);
  stream.on('error', reject);
  doc.pipe(stream);

  doc.font('Cairo-Bold').fontSize(24).fillColor('#1a2f44')
    .text('عقد فندقي', 40, 80, { align: 'center', width: 515, features: ARABIC_FEATURES });

  doc.font('Cairo').fontSize(12).fillColor('#486581')
    .text(`رقم العقد: ${contractRef || '—'}`, 40, 140, { align: 'center', width: 515, features: ARABIC_FEATURES });

  doc.moveTo(48, 180).lineTo(547, 180).strokeColor('#1a2f44').lineWidth(1).stroke();

  doc.font('Cairo').fontSize(11).fillColor('#243b53')
    .text(
      'هذه نسخة تجريبية من ملف العقد المرفق. يتم عرضها هنا كنموذج يوضح كيفية ' +
      'الاطلاع على ملف العقد أو تنزيله من قبل قسم الحجوزات، قسم الائتمان، ' +
      'إدارة العقود، والإدارة العليا أثناء دورة الموافقات.',
      60, 220, { align: 'right', width: 475, lineGap: 6, features: ARABIC_FEATURES });

  doc.font('Cairo-Bold').fontSize(10).fillColor('#829ab1')
    .text('Ewaa Hotels CRM • نموذج تجريبي', 40, 780, { align: 'center', width: 515, features: ARABIC_FEATURES });

  doc.end();
});

(async () => {
  if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });
  const contracts = await prisma.contract.findMany({ where: { fileUrl: null } });
  if (contracts.length === 0) {
    console.log('No contracts without files. Nothing to do.');
    return prisma.$disconnect();
  }

  console.log(`Generating sample PDFs for ${contracts.length} contracts…`);
  for (const c of contracts) {
    const filename = `sample-${c.contractRef || c.id}-${Date.now()}.pdf`;
    const fullPath = path.join(UPLOADS, filename);
    await buildSamplePdf(fullPath, c.contractRef);
    await prisma.contract.update({
      where: { id: c.id },
      data: { fileUrl: `/uploads/${filename}`, fileName: `${c.contractRef || 'contract'}.pdf` },
    });
    console.log(`  ✔ ${c.contractRef || c.id}`);
  }

  console.log('Done.');
  await prisma.$disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
