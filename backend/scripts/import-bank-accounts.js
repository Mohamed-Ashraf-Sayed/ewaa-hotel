// Import bank accounts from "ارقام حسابات البنوك.xlsx" into existing Hotel
// rows. Explicit code -> hotelId mapping built by hand (fuzzy matching is
// too noisy on the heavy spelling variants). Re-run with --apply to commit.
const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const APPLY = process.argv.includes('--apply');
// IBAN bank code 80 = NCB / Saudi National Bank
const BANK_NAME = 'البنك الأهلي السعودي';
const BENEFICIARY = 'فنادق إيواء وشقق المهيدب المخدومة وفنادق جراند بلازا';

// Explicit Excel-code -> CRM Hotel.id mapping. Built by reading both lists
// side by side. Codes with no good match (e.g. "Ewaa El Maadi", "MUHAIDB
// BLACK BOX") are intentionally absent — they'll print as "no mapping" in
// the dry-run output and just get skipped.
const CODE_TO_HOTEL = {
  // === Ewaa Express (20001-20010) ===
  '20002': 64,  // Tabuk
  '20003': 65,  // Al Olaya
  '20004': 70,  // Khurais
  '20005': 67,  // Al Rawda
  '20006': 69,  // Gaber
  '20007': 63,  // Buraydah
  '20008': 68,  // Al Shate
  '20009': 62,  // Al Jouf
  '20010': 61,  // Abha

  // === Almuhaidb (30002-30031) ===
  '30003': 85,  // Abqarino / Abcareno
  '30004': 98,  // Abha
  '30005': 80,  // Al Askary (Sulaimanya hospital area)
  '30006': 101, // Al Dwadmy / Aldawadmi
  '30008': 83,  // Al Malaz
  '30009': 97,  // King Abdulaziz - Al Malaz
  '30010': 84,  // Al Muhammadiah
  '30012': 87,  // Al Jawazat (2)
  '30013': 100, // Alhamra
  '30017': 91,  // Al-Suwaidi 24
  '30018': 104, // Al Taif Hotel
  '30019': 102, // Al Khobar
  '30020': 87,  // Al Jawazat (1) — same CRM row as 30012
  '30021': 93,  // Alnarges
  '30022': 95,  // Gharnata - Almalaz
  '30025': 94,  // Khurais (Alolaya Khurais)
  '30027': 90,  // Al Olaya Suites
  '30028': 99,  // Palestine - Jeddah
  '30030': 105, // Sudair

  // === Nawara / Neyyara (30032-30039) ===
  '30032': 106, // Nawara Al Askary
  '30033': 111, // Nawara New Azizia
  '30034': 113, // Nawara Takhasossi
  '30035': 107, // Nawara Apartments 24 (Swedi 24)
  '30036': 108, // Nawara Dala (Dalla Elshatea)
  '30037': 109, // Nawara Khanshalila
  '30038': 114, // Neyyara Al Takhasossi

  // === Taef Resort ===
  '30040': 103, // Almuhaidb Resort Alhada (Taef resort)
};

(async () => {
  const file = path.join(__dirname, '..', '_banks.xlsx');
  const wb = xlsx.readFile(file);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sh, { defval: '', header: 1 });

  const entries = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const code = String(r[0] || '').trim();
    const name = String(r[1] || '').trim();
    const accountNumber = String(r[2] || '').trim();
    const iban = String(r[3] || '').trim();
    if (!name || name === 'Hotel Name' || /^\d{1,2}$/.test(code)) continue;
    if (!accountNumber || accountNumber === 'Closed') continue;
    entries.push({ code, name, accountNumber, iban });
  }
  console.log(`Parsed ${entries.length} entries with account numbers`);

  // Pull the active hotels we'll update — print before/after for visibility
  const ids = Array.from(new Set(Object.values(CODE_TO_HOTEL)));
  const hotels = await p.hotel.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, nameEn: true, accountNumber: true, iban: true, bankName: true, beneficiaryName: true },
  });
  const hotelById = new Map(hotels.map(h => [h.id, h]));

  const willUpdate = [];
  const noMap = [];
  for (const e of entries) {
    const hid = CODE_TO_HOTEL[e.code];
    if (!hid) { noMap.push(e); continue; }
    const h = hotelById.get(hid);
    if (!h) { console.log(`  ⚠ mapped to id ${hid} but hotel not found`); continue; }
    willUpdate.push({ e, h });
  }

  console.log(`\n--- Mapped (${willUpdate.length}) ---`);
  for (const { e, h } of willUpdate) {
    const dup = h.iban && h.iban !== e.iban;
    const same = h.iban === e.iban && h.accountNumber === e.accountNumber;
    const flag = same ? '◆ same' : dup ? '⚠ overwrite' : '✓ set';
    console.log(`  ${flag} [${h.id}] ${(h.nameEn || h.name).slice(0, 50)}`);
    console.log(`         ← ${e.code} ${e.name.trim().slice(0, 45)} / ${e.iban}`);
  }
  if (noMap.length) {
    console.log(`\n--- Unmapped (${noMap.length}) — review manually if needed ---`);
    noMap.forEach(e => console.log(`  ${e.code} ${e.name.trim()}`));
  }

  if (APPLY) {
    console.log('\n--- Applying ---');
    let applied = 0;
    for (const { e, h } of willUpdate) {
      if (h.iban === e.iban && h.accountNumber === e.accountNumber) continue;
      await p.hotel.update({
        where: { id: h.id },
        data: {
          accountNumber: e.accountNumber,
          iban: e.iban,
          bankName: h.bankName || BANK_NAME,
          beneficiaryName: h.beneficiaryName || BENEFICIARY,
        },
      });
      applied++;
    }
    console.log(`Applied: ${applied}`);
  } else {
    console.log('\nDRY RUN — re-run with --apply to commit.');
  }

  await p.$disconnect();
})();
