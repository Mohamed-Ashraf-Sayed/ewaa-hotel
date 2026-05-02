const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];
const MANAGER_ROLES = ['sales_director'];

const buildAccessFilter = async (user) => {
  if (ADMIN_ROLES.includes(user.role)) return {};
  // Credit team, contract_officer, and reservations need cross-rep visibility
  if (['credit_manager', 'credit_officer', 'contract_officer', 'reservations'].includes(user.role)) return {};
  // Assistant sales sees same team as their director (sibling reps + director)
  if (user.role === 'assistant_sales' && user.managerId) {
    const teamIds = await getSubordinateIds(user.managerId);
    return { salesRepId: { in: [user.managerId, ...teamIds] } };
  }
  if (MANAGER_ROLES.includes(user.role)) {
    const subIds = await getSubordinateIds(user.id);
    return { salesRepId: { in: [user.id, ...subIds] } };
  }
  return { salesRepId: user.id };
};

const getClients = async (req, res) => {
  try {
    const { type, search, hotelId } = req.query;
    const accessFilter = await buildAccessFilter(req.user);
    const where = {
      ...accessFilter,
      isActive: true,
      ...(type && { clientType: type }),
      ...(hotelId && { hotelId: parseInt(hotelId) }),
      ...(search && {
        OR: [
          { companyName: { contains: search } },
          { contactPerson: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ]
      })
    };

    const clients = await prisma.client.findMany({
      where,
      include: {
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } },
        pulseScore: true,
        _count: { select: { contracts: true, visits: true, activities: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getClient = async (req, res) => {
  try {
    const { id } = req.params;
    const accessFilter = await buildAccessFilter(req.user);
    const client = await prisma.client.findFirst({
      where: { id: parseInt(id), ...accessFilter },
      include: {
        salesRep: { select: { id: true, name: true, email: true, phone: true } },
        hotel: { select: { id: true, name: true } },
        contracts: {
          include: {
            hotel: { select: { name: true } },
            approvals: { include: { approver: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 1 }
          },
          orderBy: { createdAt: 'desc' }
        },
        visits: {
          include: { salesRep: { select: { name: true } } },
          orderBy: { visitDate: 'desc' }
        },
        activities: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        },
        pulseScore: true
      }
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Normalize for duplicate detection (trim, lowercase, remove extra spaces, strip Arabic diacritics)
const normalizeName = (s) => {
  if (!s) return '';
  return String(s).trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u064B-\u065F\u0670]/g, ''); // Remove Arabic diacritics
};

const normalizeRegNo = (s) => {
  if (!s) return '';
  return String(s).trim().replace(/[\s\-\/]/g, '');
};

const parseBrands = (b) => {
  if (!b) return [];
  if (Array.isArray(b)) return b.filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  return String(b).split(',').map(s => s.trim()).filter(Boolean);
};

const BRAND_LABEL_AR = {
  muhaidib_serviced: 'شقق المهيدب المخدومة',
  awa_hotels: 'فنادق إيواء',
  grand_plaza: 'جراند بلازا',
};
const brandLabels = (codes) => codes.map(c => BRAND_LABEL_AR[c] || c).join('، ');

const createClient = async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, address, industry,
      clientType, source, hotelId, brands, estimatedRooms, annualBudget, website,
      commercialRegNo, taxCardNo, latitude, longitude, notes } = req.body;

    // === Duplicate detection ===
    const allClients = await prisma.client.findMany({
      where: { isActive: true },
      include: { salesRep: { select: { id: true, name: true } } }
    });

    const normalizedCompany = normalizeName(companyName);
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedCommercial = normalizeRegNo(commercialRegNo);
    const normalizedTax = normalizeRegNo(taxCardNo);
    const newBrands = parseBrands(brands);

    // Find all records matching on any strong identifier
    const matches = allClients.filter(c => {
      if (normalizedCommercial && c.commercialRegNo && normalizeRegNo(c.commercialRegNo) === normalizedCommercial) return true;
      if (normalizedTax && c.taxCardNo && normalizeRegNo(c.taxCardNo) === normalizedTax) return true;
      if (normalizeName(c.companyName) === normalizedCompany) return true;
      if (normalizedPhone && c.phone && c.phone.replace(/\D/g, '') === normalizedPhone) return true;
      if (normalizedEmail && c.email && c.email.toLowerCase() === normalizedEmail) return true;
      return false;
    });

    // Reject only if a match shares a brand with the new submission.
    // Legacy matches with no brands set are treated as a conflict (unknown coverage).
    const conflict = matches.find(c => {
      const existingBrands = parseBrands(c.brands);
      if (existingBrands.length === 0) return true;
      if (newBrands.length === 0) return true;
      return newBrands.some(b => existingBrands.includes(b));
    });

    if (conflict) {
      let reason = '';
      if (normalizedCommercial && conflict.commercialRegNo && normalizeRegNo(conflict.commercialRegNo) === normalizedCommercial) reason = 'رقم السجل التجاري';
      else if (normalizedTax && conflict.taxCardNo && normalizeRegNo(conflict.taxCardNo) === normalizedTax) reason = 'رقم البطاقة الضريبية';
      else if (normalizeName(conflict.companyName) === normalizedCompany) reason = 'اسم الشركة';
      else if (normalizedPhone && conflict.phone?.replace(/\D/g, '') === normalizedPhone) reason = 'رقم الهاتف';
      else if (normalizedEmail && conflict.email?.toLowerCase() === normalizedEmail) reason = 'البريد الإلكتروني';

      const overlap = parseBrands(conflict.brands).filter(b => newBrands.includes(b));
      const brandPart = overlap.length > 0 ? ` للبراند: ${brandLabels(overlap)}` : '';

      return res.status(409).json({
        message: `العميل موجود بالفعل (${reason} مكرر${brandPart}) — مسجل لدى المندوب: ${conflict.salesRep?.name || 'غير معروف'}. لو هتشتغل على العميل لبراند مختلف، اختار براندات غير اللي متسجّلة معاه.`,
        existingClient: {
          id: conflict.id,
          companyName: conflict.companyName,
          salesRepName: conflict.salesRep?.name,
          brands: parseBrands(conflict.brands),
        }
      });
    }

    const brandsStr = Array.isArray(brands) ? brands.join(',') : (brands || null);

    const client = await prisma.client.create({
      data: {
        companyName, contactPerson, phone, email, address, industry,
        clientType: clientType || 'lead',
        source,
        salesRepId: req.user.id,
        hotelId: hotelId ? parseInt(hotelId) : null,
        brands: brandsStr,
        estimatedRooms: estimatedRooms ? parseInt(estimatedRooms) : null,
        annualBudget: annualBudget ? parseFloat(annualBudget) : null,
        website,
        commercialRegNo: commercialRegNo?.trim() || null,
        taxCardNo: taxCardNo?.trim() || null,
        latitude: latitude != null && latitude !== '' ? parseFloat(latitude) : null,
        longitude: longitude != null && longitude !== '' ? parseFloat(longitude) : null,
        notes
      },
      include: {
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } }
      }
    });

    // Initialize pulse score
    await prisma.dealPulseScore.create({
      data: { clientId: client.id, salesRepId: req.user.id }
    });

    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = parseInt(id);
    const data = req.body;
    if (data.hotelId) data.hotelId = parseInt(data.hotelId);
    if (data.estimatedRooms) data.estimatedRooms = parseInt(data.estimatedRooms);
    if (data.annualBudget) data.annualBudget = parseFloat(data.annualBudget);
    if (Array.isArray(data.brands)) data.brands = data.brands.join(',');
    if (data.latitude !== undefined) data.latitude = data.latitude === '' || data.latitude == null ? null : parseFloat(data.latitude);
    if (data.longitude !== undefined) data.longitude = data.longitude === '' || data.longitude == null ? null : parseFloat(data.longitude);
    delete data.salesRepId;

    // Once a sales rep has saved a geo location, they cannot change or clear it.
    // Only admins / general managers / vice GMs can override.
    if (data.latitude !== undefined || data.longitude !== undefined) {
      const ADMIN_OVERRIDE_ROLES = ['admin', 'general_manager', 'vice_gm'];
      if (!ADMIN_OVERRIDE_ROLES.includes(req.user.role)) {
        const existing = await prisma.client.findUnique({
          where: { id: clientId },
          select: { latitude: true, longitude: true },
        });
        const alreadySet = existing && existing.latitude != null && existing.longitude != null;
        if (alreadySet) {
          return res.status(403).json({
            message: 'الموقع الجغرافي تم حفظه مسبقاً ولا يمكن تغييره. تواصل مع الإدارة للتعديل.',
          });
        }
      }
    }

    // Brand-aware conflict check: allow same reg/tax across clients only if brands don't overlap
    if (data.commercialRegNo !== undefined || data.taxCardNo !== undefined || data.brands !== undefined) {
      const current = await prisma.client.findUnique({ where: { id: clientId } });
      const effectiveCommercial = data.commercialRegNo !== undefined ? data.commercialRegNo : current?.commercialRegNo;
      const effectiveTax = data.taxCardNo !== undefined ? data.taxCardNo : current?.taxCardNo;
      const effectiveBrands = parseBrands(data.brands !== undefined ? data.brands : current?.brands);

      const normCommercial = normalizeRegNo(effectiveCommercial);
      const normTax = normalizeRegNo(effectiveTax);

      if (normCommercial || normTax) {
        const others = await prisma.client.findMany({
          where: { isActive: true, NOT: { id: clientId } },
          include: { salesRep: { select: { id: true, name: true } } }
        });
        const matches = others.filter(c => {
          if (normCommercial && c.commercialRegNo && normalizeRegNo(c.commercialRegNo) === normCommercial) return true;
          if (normTax && c.taxCardNo && normalizeRegNo(c.taxCardNo) === normTax) return true;
          return false;
        });
        const clash = matches.find(c => {
          const existingBrands = parseBrands(c.brands);
          if (existingBrands.length === 0) return true;
          if (effectiveBrands.length === 0) return true;
          return effectiveBrands.some(b => existingBrands.includes(b));
        });
        if (clash) {
          const reason = normCommercial && clash.commercialRegNo && normalizeRegNo(clash.commercialRegNo) === normCommercial
            ? 'رقم السجل التجاري' : 'رقم البطاقة الضريبية';
          const overlap = parseBrands(clash.brands).filter(b => effectiveBrands.includes(b));
          const brandPart = overlap.length > 0 ? ` للبراند: ${brandLabels(overlap)}` : '';
          return res.status(409).json({
            message: `${reason} مستخدم بالفعل لدى عميل آخر${brandPart} — مسجل لدى المندوب: ${clash.salesRep?.name || 'غير معروف'}`,
            existingClient: { id: clash.id, companyName: clash.companyName, salesRepName: clash.salesRep?.name }
          });
        }
      }
    }

    if (typeof data.commercialRegNo === 'string') data.commercialRegNo = data.commercialRegNo.trim() || null;
    if (typeof data.taxCardNo === 'string') data.taxCardNo = data.taxCardNo.trim() || null;

    const client = await prisma.client.update({
      where: { id: clientId },
      data,
      include: {
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } }
      }
    });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Minimal lookup across all users — returns only whether the reg/tax no exists and who owns it
const lookupClient = async (req, res) => {
  try {
    const { regNo, taxNo } = req.query;
    const normCommercial = normalizeRegNo(regNo);
    const normTax = normalizeRegNo(taxNo);

    if (!normCommercial && !normTax) {
      return res.status(400).json({ message: 'أدخل رقم السجل التجاري أو رقم البطاقة الضريبية' });
    }

    const all = await prisma.client.findMany({
      where: { isActive: true },
      select: {
        commercialRegNo: true,
        taxCardNo: true,
        brands: true,
        salesRep: { select: { name: true } },
      },
    });

    const matches = all.filter(c => {
      if (normCommercial && c.commercialRegNo && normalizeRegNo(c.commercialRegNo) === normCommercial) return true;
      if (normTax && c.taxCardNo && normalizeRegNo(c.taxCardNo) === normTax) return true;
      return false;
    }).map(c => ({
      salesRepName: c.salesRep?.name || 'غير معروف',
      brands: parseBrands(c.brands),
      brandLabels: parseBrands(c.brands).map(b => BRAND_LABEL_AR[b] || b),
    }));

    res.json({ exists: matches.length > 0, matches });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.update({ where: { id: parseInt(id) }, data: { isActive: false } });
    res.json({ message: 'Client archived successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// === Bulk import from Excel/CSV ===
// Expected columns (Arabic headers, matches scripts/clients_template.csv):
//   اسم الشركة, اسم الشركة بالإنجليزي, جهة الاتصال, المنصب, رقم الهاتف, الإيميل,
//   المدينة / العنوان, القطاع, نوع العميل, مصدر العميل, الفندق المقترح,
//   المجموعات المهتم بها, عدد الغرف المتوقع سنوياً, الميزانية السنوية (ر.س),
//   الموقع الإلكتروني, ملاحظات, رقم السجل التجاري (optional), رقم البطاقة الضريبية (optional)
const COL = {
  companyName: ['اسم الشركة', 'اسم الشركة (مطلوب)', 'companyName', 'company name', 'company'],
  companyNameEn: ['اسم الشركة بالإنجليزي', 'companyNameEn', 'company name en'],
  contactPerson: ['جهة الاتصال', 'جهة الاتصال (مطلوب)', 'contactPerson', 'contact person', 'contact'],
  phone: ['رقم الهاتف', 'الهاتف', 'phone'],
  email: ['الإيميل', 'البريد الإلكتروني', 'email'],
  address: ['المدينة / العنوان', 'العنوان', 'address'],
  industry: ['القطاع', 'industry'],
  clientType: ['نوع العميل', 'نوع العميل (مطلوب)', 'clientType', 'type'],
  source: ['مصدر العميل', 'source'],
  hotelName: ['الفندق المقترح', 'الفندق المقترح (اسم الفندق بالعربي)', 'hotel'],
  brands: ['المجموعات المهتم بها', 'البراندات', 'brands'],
  estimatedRooms: ['عدد الغرف المتوقع سنوياً', 'عدد الغرف المتوقع', 'estimatedRooms'],
  annualBudget: ['الميزانية السنوية (ر.س)', 'الميزانية السنوية', 'annualBudget', 'budget'],
  website: ['الموقع الإلكتروني', 'website'],
  notes: ['ملاحظات', 'notes'],
  commercialRegNo: ['رقم السجل التجاري', 'commercialRegNo', 'cr no'],
  taxCardNo: ['رقم البطاقة الضريبية', 'taxCardNo', 'tax card'],
};

const pick = (row, keys) => {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.toString().trim().toLowerCase() === k.toLowerCase()) {
        const v = row[rk];
        if (v == null || v === '') return null;
        return String(v).trim();
      }
    }
  }
  return null;
};

const importClients = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'لم يتم رفع ملف' });

    const xlsx = require('xlsx');
    let rows;
    try {
      const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } catch (e) {
      return res.status(400).json({ message: 'ملف غير صالح. تأكد من استخدام صيغة Excel أو CSV.' });
    }
    if (!rows || rows.length === 0) return res.status(400).json({ message: 'الملف فارغ' });

    const allClients = await prisma.client.findMany({
      where: { isActive: true },
      include: { salesRep: { select: { name: true } } },
    });
    const allHotels = await prisma.hotel.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const findHotelByName = (name) => {
      if (!name) return null;
      const n = name.trim().toLowerCase();
      return allHotels.find(h => h.name.toLowerCase() === n) || null;
    };

    const validTypes = new Set(['active', 'lead', 'inactive']);
    const validSources = new Set(['cold_call', 'referral', 'exhibition', 'website', 'social_media', 'walk_in', 'other']);
    const validBrands = new Set(['muhaidib_serviced', 'awa_hotels', 'grand_plaza']);

    const summary = { created: 0, skipped: 0, errors: [], duplicates: [] };
    // Clone the master list — push newly created clients into it so dedup catches duplicates within the same upload.
    const liveList = [...allClients];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNo = i + 2; // +2 = +1 for header row, +1 for human-readable line numbers
      try {
        const companyName = pick(row, COL.companyName);
        const contactPerson = pick(row, COL.contactPerson);
        const clientType = (pick(row, COL.clientType) || 'lead').toLowerCase();

        if (!companyName) { summary.errors.push({ line: lineNo, message: 'اسم الشركة مطلوب' }); continue; }
        if (!contactPerson) { summary.errors.push({ line: lineNo, message: `سطر ${lineNo} (${companyName}): جهة الاتصال مطلوبة` }); continue; }
        if (!validTypes.has(clientType)) {
          summary.errors.push({ line: lineNo, message: `سطر ${lineNo} (${companyName}): نوع العميل غير صحيح — استخدم active/lead/inactive` });
          continue;
        }

        const source = (pick(row, COL.source) || '').toLowerCase() || null;
        if (source && !validSources.has(source)) {
          summary.errors.push({ line: lineNo, message: `سطر ${lineNo} (${companyName}): مصدر العميل غير صحيح` });
          continue;
        }

        const brandsRaw = pick(row, COL.brands) || '';
        const brandsArr = brandsRaw.split(',').map(s => s.trim()).filter(Boolean);
        const invalidBrand = brandsArr.find(b => !validBrands.has(b));
        if (invalidBrand) {
          summary.errors.push({ line: lineNo, message: `سطر ${lineNo} (${companyName}): براند غير معروف "${invalidBrand}"` });
          continue;
        }

        const phone = pick(row, COL.phone);
        const email = pick(row, COL.email);
        const commercialRegNo = pick(row, COL.commercialRegNo);
        const taxCardNo = pick(row, COL.taxCardNo);

        // Duplicate detection (mirrors createClient logic with brand-overlap rule)
        const normalizedCompany = normalizeName(companyName);
        const normalizedPhone = (phone || '').replace(/\D/g, '');
        const normalizedEmail = (email || '').toLowerCase();
        const normalizedCommercial = normalizeRegNo(commercialRegNo);
        const normalizedTax = normalizeRegNo(taxCardNo);

        const matches = liveList.filter(c => {
          if (normalizedCommercial && c.commercialRegNo && normalizeRegNo(c.commercialRegNo) === normalizedCommercial) return true;
          if (normalizedTax && c.taxCardNo && normalizeRegNo(c.taxCardNo) === normalizedTax) return true;
          if (normalizeName(c.companyName) === normalizedCompany) return true;
          if (normalizedPhone && c.phone && c.phone.replace(/\D/g, '') === normalizedPhone) return true;
          if (normalizedEmail && c.email && c.email.toLowerCase() === normalizedEmail) return true;
          return false;
        });
        const conflict = matches.find(c => {
          const existingBrands = parseBrands(c.brands);
          if (existingBrands.length === 0) return true;
          if (brandsArr.length === 0) return true;
          return brandsArr.some(b => existingBrands.includes(b));
        });
        if (conflict) {
          summary.duplicates.push({
            line: lineNo,
            companyName,
            existingSalesRep: conflict.salesRep?.name || '-',
          });
          summary.skipped += 1;
          continue;
        }

        const hotelName = pick(row, COL.hotelName);
        const hotel = hotelName ? findHotelByName(hotelName) : null;

        const estimatedRooms = pick(row, COL.estimatedRooms);
        const annualBudget = pick(row, COL.annualBudget);

        const created = await prisma.client.create({
          data: {
            companyName,
            companyNameEn: pick(row, COL.companyNameEn) || null,
            contactPerson,
            phone: phone || null,
            email: email || null,
            address: pick(row, COL.address) || null,
            industry: pick(row, COL.industry) || null,
            clientType,
            source,
            salesRepId: req.user.id,
            hotelId: hotel?.id || null,
            brands: brandsArr.length > 0 ? brandsArr.join(',') : null,
            estimatedRooms: estimatedRooms ? parseInt(estimatedRooms) || null : null,
            annualBudget: annualBudget ? parseFloat(annualBudget) || null : null,
            website: pick(row, COL.website) || null,
            commercialRegNo: commercialRegNo || null,
            taxCardNo: taxCardNo || null,
            notes: pick(row, COL.notes) || null,
          },
          include: { salesRep: { select: { name: true } } },
        });

        await prisma.dealPulseScore.create({ data: { clientId: created.id, salesRepId: req.user.id } }).catch(() => null);

        liveList.push(created);
        summary.created += 1;
      } catch (rowErr) {
        summary.errors.push({ line: lineNo, message: rowErr.message });
      }
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getClients, getClient, createClient, updateClient, deleteClient, lookupClient, importClients };
