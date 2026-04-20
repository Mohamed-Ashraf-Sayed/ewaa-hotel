const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const SAUDI_HOTELS = [
  // === المهيدب للشقق المخدومة (Muhaidib Serviced Apartments) ===
  { name: 'شقق المهيدب المخدومة - الرياض العليا', nameEn: 'Muhaidib Serviced Apts - Al Olaya', city: 'الرياض', group: 'muhaidib_serviced', stars: 5, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الرياض حي السفارات', nameEn: 'Muhaidib Serviced Apts - Diplomatic Quarter', city: 'الرياض', group: 'muhaidib_serviced', stars: 5, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الرياض النخيل', nameEn: 'Muhaidib Serviced Apts - Al Nakheel', city: 'الرياض', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الرياض العزيزية', nameEn: 'Muhaidib Serviced Apts - Al Azizia', city: 'الرياض', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الرياض الورود', nameEn: 'Muhaidib Serviced Apts - Al Wurud', city: 'الرياض', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - جدة الشاطئ', nameEn: 'Muhaidib Serviced Apts - Jeddah Corniche', city: 'جدة', group: 'muhaidib_serviced', stars: 5, type: 'Beach' },
  { name: 'شقق المهيدب المخدومة - جدة السلامة', nameEn: 'Muhaidib Serviced Apts - Al Salamah', city: 'جدة', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - جدة الزهراء', nameEn: 'Muhaidib Serviced Apts - Al Zahra', city: 'جدة', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - مكة المكرمة', nameEn: 'Muhaidib Serviced Apts - Makkah', city: 'مكة المكرمة', group: 'muhaidib_serviced', stars: 5, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - المدينة المنورة', nameEn: 'Muhaidib Serviced Apts - Madinah', city: 'المدينة المنورة', group: 'muhaidib_serviced', stars: 5, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الدمام السيف', nameEn: 'Muhaidib Serviced Apts - Al Sayf', city: 'الدمام', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الخبر', nameEn: 'Muhaidib Serviced Apts - Al Khobar', city: 'الخبر', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - أبها السحاب', nameEn: 'Muhaidib Serviced Apts - Abha', city: 'أبها', group: 'muhaidib_serviced', stars: 4, type: 'Resort' },
  { name: 'شقق المهيدب المخدومة - تبوك', nameEn: 'Muhaidib Serviced Apts - Tabuk', city: 'تبوك', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - الطائف', nameEn: 'Muhaidib Serviced Apts - Taif', city: 'الطائف', group: 'muhaidib_serviced', stars: 4, type: 'Resort' },
  { name: 'شقق المهيدب المخدومة - حائل', nameEn: 'Muhaidib Serviced Apts - Hail', city: 'حائل', group: 'muhaidib_serviced', stars: 3, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - القصيم', nameEn: 'Muhaidib Serviced Apts - Qassim', city: 'بريدة', group: 'muhaidib_serviced', stars: 3, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - ينبع', nameEn: 'Muhaidib Serviced Apts - Yanbu', city: 'ينبع', group: 'muhaidib_serviced', stars: 4, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - جازان', nameEn: 'Muhaidib Serviced Apts - Jazan', city: 'جازان', group: 'muhaidib_serviced', stars: 3, type: 'Business' },
  { name: 'شقق المهيدب المخدومة - نجران', nameEn: 'Muhaidib Serviced Apts - Najran', city: 'نجران', group: 'muhaidib_serviced', stars: 3, type: 'Business' },

  // === مجموعة فنادق إيواء (Awa Hotels Group) ===
  { name: 'فندق إيواء - الرياض العليا', nameEn: 'Awa Hotel - Al Olaya Riyadh', city: 'الرياض', group: 'awa_hotels', stars: 5, type: 'Business' },
  { name: 'فندق إيواء - الرياض المطار', nameEn: 'Awa Hotel - Riyadh Airport', city: 'الرياض', group: 'awa_hotels', stars: 4, type: 'Airport' },
  { name: 'فندق إيواء - الرياض المنهل', nameEn: 'Awa Hotel - Al Manhal Riyadh', city: 'الرياض', group: 'awa_hotels', stars: 4, type: 'Business' },
  { name: 'فندق إيواء - الرياض السليمانية', nameEn: 'Awa Hotel - Al Sulaimaniyah', city: 'الرياض', group: 'awa_hotels', stars: 5, type: 'Business' },
  { name: 'فندق إيواء - جدة العزيزية', nameEn: 'Awa Hotel - Al Azizia Jeddah', city: 'جدة', group: 'awa_hotels', stars: 5, type: 'Business' },
  { name: 'فندق إيواء - جدة الروضة', nameEn: 'Awa Hotel - Al Rawdah Jeddah', city: 'جدة', group: 'awa_hotels', stars: 4, type: 'Business' },
  { name: 'فندق إيواء - جدة المطار', nameEn: 'Awa Hotel - Jeddah Airport', city: 'جدة', group: 'awa_hotels', stars: 4, type: 'Airport' },
  { name: 'فندق إيواء - مكة العزيزية', nameEn: 'Awa Hotel - Makkah Al Azizia', city: 'مكة المكرمة', group: 'awa_hotels', stars: 5, type: 'Business' },
  { name: 'فندق إيواء - المدينة المنورة', nameEn: 'Awa Hotel - Madinah', city: 'المدينة المنورة', group: 'awa_hotels', stars: 5, type: 'Business' },
  { name: 'فندق إيواء - الدمام', nameEn: 'Awa Hotel - Dammam', city: 'الدمام', group: 'awa_hotels', stars: 4, type: 'Business' },
  { name: 'فندق إيواء - الخبر الكورنيش', nameEn: 'Awa Hotel - Al Khobar Corniche', city: 'الخبر', group: 'awa_hotels', stars: 4, type: 'Beach' },
  { name: 'فندق إيواء - الجبيل الصناعية', nameEn: 'Awa Hotel - Jubail Industrial', city: 'الجبيل', group: 'awa_hotels', stars: 4, type: 'Business' },
  { name: 'فندق إيواء - أبها', nameEn: 'Awa Hotel - Abha', city: 'أبها', group: 'awa_hotels', stars: 4, type: 'Resort' },
  { name: 'فندق إيواء - تبوك العقبة', nameEn: 'Awa Hotel - Tabuk Aqaba', city: 'تبوك', group: 'awa_hotels', stars: 4, type: 'Resort' },
  { name: 'فندق إيواء - الطائف الشفا', nameEn: 'Awa Hotel - Taif Al Shafa', city: 'الطائف', group: 'awa_hotels', stars: 4, type: 'Resort' },
  { name: 'فندق إيواء - الأحساء', nameEn: 'Awa Hotel - Al Ahsa', city: 'الأحساء', group: 'awa_hotels', stars: 4, type: 'Business' },
  { name: 'فندق إيواء - القطيف', nameEn: 'Awa Hotel - Qatif', city: 'القطيف', group: 'awa_hotels', stars: 3, type: 'Business' },
  { name: 'فندق إيواء - سكاكا', nameEn: 'Awa Hotel - Sakaka', city: 'سكاكا', group: 'awa_hotels', stars: 3, type: 'Business' },
  { name: 'فندق إيواء - عرعر', nameEn: 'Awa Hotel - Arar', city: 'عرعر', group: 'awa_hotels', stars: 3, type: 'Business' },
  { name: 'فندق إيواء - الباحة', nameEn: 'Awa Hotel - Al Baha', city: 'الباحة', group: 'awa_hotels', stars: 3, type: 'Resort' },

  // === مجموعة فنادق جراند بلازا (Grand Plaza Hotels Group) ===
  { name: 'جراند بلازا - الرياض البيزنس باك', nameEn: 'Grand Plaza - Riyadh Business Park', city: 'الرياض', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - الرياض الملك فهد', nameEn: 'Grand Plaza - King Fahd Road Riyadh', city: 'الرياض', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - الرياض الياسمين', nameEn: 'Grand Plaza - Al Yasmin Riyadh', city: 'الرياض', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - الرياض ديرة', nameEn: 'Grand Plaza - Al Dira Riyadh', city: 'الرياض', group: 'grand_plaza', stars: 4, type: 'City' },
  { name: 'جراند بلازا - الرياض المدينة الرياضية', nameEn: 'Grand Plaza - Sports City Riyadh', city: 'الرياض', group: 'grand_plaza', stars: 4, type: 'Business' },
  { name: 'جراند بلازا - جدة المحمدية', nameEn: 'Grand Plaza - Al Muhammadiyah Jeddah', city: 'جدة', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - جدة الكورنيش', nameEn: 'Grand Plaza - Corniche Jeddah', city: 'جدة', group: 'grand_plaza', stars: 5, type: 'Beach' },
  { name: 'جراند بلازا - جدة السرور', nameEn: 'Grand Plaza - Al Surur Jeddah', city: 'جدة', group: 'grand_plaza', stars: 4, type: 'Business' },
  { name: 'جراند بلازا - مكة أجياد', nameEn: 'Grand Plaza - Ajyad Makkah', city: 'مكة المكرمة', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - المدينة قباء', nameEn: 'Grand Plaza - Quba Madinah', city: 'المدينة المنورة', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - الدمام الفيصلية', nameEn: 'Grand Plaza - Faisaliyah Dammam', city: 'الدمام', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - الخبر الشرق', nameEn: 'Grand Plaza - Al Sharq Khobar', city: 'الخبر', group: 'grand_plaza', stars: 5, type: 'Business' },
  { name: 'جراند بلازا - الجبيل', nameEn: 'Grand Plaza - Jubail', city: 'الجبيل', group: 'grand_plaza', stars: 4, type: 'Business' },
  { name: 'جراند بلازا - أبها السياحية', nameEn: 'Grand Plaza - Abha Tourism', city: 'أبها', group: 'grand_plaza', stars: 5, type: 'Resort' },
  { name: 'جراند بلازا - تبوك شرما', nameEn: 'Grand Plaza - Sharma Tabuk', city: 'تبوك', group: 'grand_plaza', stars: 5, type: 'Resort' },
  { name: 'جراند بلازا - العلا', nameEn: 'Grand Plaza - Al Ula', city: 'العلا', group: 'grand_plaza', stars: 5, type: 'Resort' },
  { name: 'جراند بلازا - نيوم', nameEn: 'Grand Plaza - NEOM', city: 'تبوك', group: 'grand_plaza', stars: 5, type: 'Resort' },
  { name: 'جراند بلازا - خميس مشيط', nameEn: 'Grand Plaza - Khamis Mushait', city: 'خميس مشيط', group: 'grand_plaza', stars: 4, type: 'Business' },
  { name: 'جراند بلازا - ضباء', nameEn: 'Grand Plaza - Duba', city: 'ضباء', group: 'grand_plaza', stars: 4, type: 'Beach' },
  { name: 'جراند بلازا - القنفذة', nameEn: 'Grand Plaza - Al Qunfudhah', city: 'القنفذة', group: 'grand_plaza', stars: 3, type: 'Business' },
];

async function main() {
  console.log('🌱 Seeding database with Saudi Arabia hotel groups...');

  // Clear existing data in correct order
  await prisma.dealPulseScore.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.contractApproval.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.client.deleteMany();
  await prisma.userHotel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.hotel.deleteMany();

  // === Create 60 Saudi Hotels ===
  const hotels = [];
  for (const h of SAUDI_HOTELS) {
    const hotel = await prisma.hotel.create({
      data: {
        name: h.name,
        nameEn: h.nameEn,
        location: `${h.city}، المملكة العربية السعودية`,
        city: h.city,
        country: 'Saudi Arabia',
        group: h.group,
        stars: h.stars,
        type: h.type,
        isActive: true,
      }
    });
    hotels.push(hotel);
  }

  const muhaidibHotels = hotels.filter(h => SAUDI_HOTELS.find(s => s.name === h.name)?.group === 'muhaidib_serviced');
  const awaHotels = hotels.filter(h => SAUDI_HOTELS.find(s => s.name === h.name)?.group === 'awa_hotels');
  const grandPlazaHotels = hotels.filter(h => SAUDI_HOTELS.find(s => s.name === h.name)?.group === 'grand_plaza');

  console.log(`✅ Created ${hotels.length} hotels (${muhaidibHotels.length} Muhaidib, ${awaHotels.length} Awa, ${grandPlazaHotels.length} Grand Plaza)`);

  const hash = (p) => bcrypt.hash(p, 10);
  const riyadhHotels = hotels.filter(h => h.city === 'الرياض');
  const jeddahHotels = hotels.filter(h => h.city === 'جدة');
  const eastHotels = hotels.filter(h => ['الدمام', 'الخبر', 'الجبيل'].includes(h.city));
  const otherHotels = hotels.filter(h => !['الرياض', 'جدة', 'الدمام', 'الخبر', 'الجبيل'].includes(h.city));

  // === IT Admin (top level) ===
  await prisma.user.create({
    data: { name: 'مدير النظام (IT)', email: 'admin@hotelcrm.com', password: await hash('admin123'), role: 'admin' }
  });

  // === Org Hierarchy ===
  const gm = await prisma.user.create({
    data: {
      name: 'أحمد بن عبدالله الشمري',
      email: 'gm@hotelcrm.com',
      password: await hash('gm123'),
      role: 'general_manager',
      phone: '0500000001',
      commissionRate: 0,
      hotels: { create: hotels.slice(0, 10).map(h => ({ hotelId: h.id })) }
    }
  });

  const vgm = await prisma.user.create({
    data: {
      name: 'محمد بن فهد العتيبي',
      email: 'vgm@hotelcrm.com',
      password: await hash('vgm123'),
      role: 'vice_gm',
      managerId: gm.id,
      phone: '0500000002',
      commissionRate: 0,
      hotels: { create: hotels.slice(0, 10).map(h => ({ hotelId: h.id })) }
    }
  });

  const contractOfficer = await prisma.user.create({
    data: {
      name: 'نورة بنت سعد الزهراني',
      email: 'contracts@hotelcrm.com',
      password: await hash('contracts123'),
      role: 'contract_officer',
      managerId: vgm.id,
      phone: '0500000003',
      commissionRate: 0,
      hotels: { create: hotels.slice(0, 10).map(h => ({ hotelId: h.id })) }
    }
  });

  // Sales Director 1 - المهيدب للشقق المخدومة
  const dir1 = await prisma.user.create({
    data: {
      name: 'خالد بن ناصر المنصور',
      email: 'dir1@hotelcrm.com',
      password: await hash('dir123'),
      role: 'sales_director',
      managerId: vgm.id,
      phone: '0511000001',
      commissionRate: 1.5,
      hotels: { create: muhaidibHotels.map(h => ({ hotelId: h.id })) }
    }
  });

  // Sales Director 2 - جراند بلازا + إيواء اكسبريس
  const dir2 = await prisma.user.create({
    data: {
      name: 'فيصل بن عمر الحربي',
      email: 'dir2@hotelcrm.com',
      password: await hash('dir123'),
      role: 'sales_director',
      managerId: vgm.id,
      phone: '0511000002',
      commissionRate: 1.5,
      hotels: { create: [...grandPlazaHotels, ...awaHotels].map(h => ({ hotelId: h.id })) }
    }
  });

  // === مساعدي مديري المبيعات ===
  await prisma.user.create({
    data: {
      name: 'محمد بن خالد المنصور', email: 'asst1@hotelcrm.com',
      password: await hash('asst123'), role: 'assistant_sales',
      managerId: dir1.id, phone: '0512000001', commissionRate: 1.0,
    }
  });
  await prisma.user.create({
    data: {
      name: 'بدر بن عمر الحربي', email: 'asst2@hotelcrm.com',
      password: await hash('asst123'), role: 'assistant_sales',
      managerId: dir2.id, phone: '0512000002', commissionRate: 1.0,
    }
  });

  // === فريق المهيدب (تحت dir1) ===
  const [rep1, rep2, rep3] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'عمر بن سعيد الرشيدي', email: 'omar@hotelcrm.com',
        password: await hash('sales123'), role: 'sales_rep',
        managerId: dir1.id, phone: '0521000001',
        commissionRate: 2.5,
        hotels: { create: muhaidibHotels.slice(0, 7).map(h => ({ hotelId: h.id })) }
      }
    }),
    prisma.user.create({
      data: {
        name: 'سارة بنت أحمد الغامدي', email: 'sara@hotelcrm.com',
        password: await hash('sales123'), role: 'sales_rep',
        managerId: dir1.id, phone: '0521000002',
        commissionRate: 2.5,
        hotels: { create: muhaidibHotels.slice(7, 14).map(h => ({ hotelId: h.id })) }
      }
    }),
    prisma.user.create({
      data: {
        name: 'منى بنت طارق الدوسري', email: 'mona@hotelcrm.com',
        password: await hash('sales123'), role: 'sales_rep',
        managerId: dir1.id, phone: '0521000003',
        commissionRate: 2.0,
        hotels: { create: muhaidibHotels.slice(14, 20).map(h => ({ hotelId: h.id })) }
      }
    })
  ]);

  // === فريق جراند بلازا + إيواء (تحت dir2) ===
  const [rep4, rep5, rep6] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'حسن بن علي الصبيعي', email: 'hassan@hotelcrm.com',
        password: await hash('sales123'), role: 'sales_rep',
        managerId: dir2.id, phone: '0531000001',
        commissionRate: 2.5,
        hotels: { create: grandPlazaHotels.slice(0, 10).map(h => ({ hotelId: h.id })) }
      }
    }),
    prisma.user.create({
      data: {
        name: 'دينا بنت مصطفى القحطاني', email: 'dina@hotelcrm.com',
        password: await hash('sales123'), role: 'sales_rep',
        managerId: dir2.id, phone: '0531000002',
        commissionRate: 2.0,
        hotels: { create: [...grandPlazaHotels.slice(10, 20), ...awaHotels.slice(0, 5)].map(h => ({ hotelId: h.id })) }
      }
    }),
    prisma.user.create({
      data: {
        name: 'أمير بن جمال السهلي', email: 'amir@hotelcrm.com',
        password: await hash('sales123'), role: 'sales_rep',
        managerId: dir2.id, phone: '0531000003',
        commissionRate: 2.0,
        hotels: { create: awaHotels.slice(5, 20).map(h => ({ hotelId: h.id })) }
      }
    })
  ]);
  // Reservations user
  await prisma.user.create({
    data: { name: 'قسم الحجوزات', email: 'reservations@hotelcrm.com', password: await hash('res123'), role: 'reservations' }
  });

  // Credit Manager
  await prisma.user.create({
    data: { name: 'محمد العتيبي', email: 'credit@hotelcrm.com', password: await hash('credit123'), role: 'credit_manager', managerId: vgm.id }
  });

  // Credit Officer
  await prisma.user.create({
    data: { name: 'سعد الحربي', email: 'creditofficer@hotelcrm.com', password: await hash('credit123'), role: 'credit_officer', managerId: vgm.id }
  });

  console.log('✅ Created org hierarchy: GM → Vice GM → 2 Directors → 6 Sales Reps + Contract Officer + Reservations + Credit Manager + Credit Officer');

  // === Clients (Saudi companies) ===
  const riyadhHotel = riyadhHotels[0];
  const jeddahHotel = jeddahHotels[0];
  const dammamHotel = eastHotels[0];
  const makkahHotel = hotels.find(h => h.city === 'مكة المكرمة') || riyadhHotel;
  const khobarHotel = eastHotels[1] || dammamHotel;

  const clientsData = [
    { companyName: 'أرامكو السعودية', companyNameEn: 'Saudi Aramco', contactPerson: 'م. فهد الشهراني', phone: '0138700000', email: 'fhd@aramco.com', industry: 'النفط والغاز', clientType: 'active', source: 'referral', salesRepId: rep4.id, hotelId: dammamHotel.id, estimatedRooms: 150, annualBudget: 5000000 },
    { companyName: 'مجموعة سابك', companyNameEn: 'SABIC Group', contactPerson: 'أ. عبدالرحمن المقرن', phone: '0114700000', email: 'arm@sabic.com', industry: 'البتروكيماويات', clientType: 'active', source: 'referral', salesRepId: rep1.id, hotelId: riyadhHotel.id, estimatedRooms: 80, annualBudget: 3000000 },
    { companyName: 'شركة الاتصالات السعودية (STC)', companyNameEn: 'Saudi Telecom Company', contactPerson: 'م. سلطان الشمري', phone: '0114700001', email: 'sultan@stc.com.sa', industry: 'الاتصالات', clientType: 'active', source: 'referral', salesRepId: rep1.id, hotelId: riyadhHotel.id, estimatedRooms: 60, annualBudget: 2000000 },
    { companyName: 'مجموعة بن لادن السعودية', companyNameEn: 'Saudi Binladin Group', contactPerson: 'م. ماجد التميمي', phone: '0122700000', email: 'majed@sbg.com.sa', industry: 'المقاولات', clientType: 'active', source: 'exhibition', salesRepId: rep2.id, hotelId: jeddahHotel.id, estimatedRooms: 200, annualBudget: 8000000 },
    { companyName: 'مجموعة الفطيم', companyNameEn: 'Al-Futtaim Group', contactPerson: 'أ. نايف العصيمي', phone: '0114800000', email: 'nayef@alfuttaim.com', industry: 'التجزئة', clientType: 'lead', source: 'cold_call', salesRepId: rep1.id, hotelId: riyadhHotel.id, estimatedRooms: 30 },
    { companyName: 'شركة صافولا', companyNameEn: 'Savola Company', contactPerson: 'أ. خالد الحسيني', phone: '0122800000', email: 'khalid@savola.com', industry: 'الأغذية', clientType: 'active', source: 'exhibition', salesRepId: rep2.id, hotelId: jeddahHotel.id, estimatedRooms: 25, annualBudget: 900000 },
    { companyName: 'البنك الأهلي السعودي', companyNameEn: 'Saudi National Bank', contactPerson: 'أ. يوسف الدغيثر', phone: '0114400000', email: 'yusuf@alahli.com.sa', industry: 'البنوك والمالية', clientType: 'active', source: 'referral', salesRepId: rep3.id, hotelId: riyadhHotels[5]?.id || riyadhHotel.id, estimatedRooms: 45, annualBudget: 1500000 },
    { companyName: 'مجموعة الراجحي', companyNameEn: 'Al Rajhi Group', contactPerson: 'م. إبراهيم الراجحي', phone: '0114500000', email: 'ibrahim@alrajhi.com', industry: 'البنوك والمالية', clientType: 'active', source: 'referral', salesRepId: rep3.id, hotelId: riyadhHotels[6]?.id || riyadhHotel.id, estimatedRooms: 55, annualBudget: 2000000 },
    { companyName: 'شركة نسما للمقاولات', companyNameEn: 'Nasma Contracting', contactPerson: 'م. طارق الحمدان', phone: '0138900000', email: 'tariq@nasma.com.sa', industry: 'المقاولات', clientType: 'lead', source: 'cold_call', salesRepId: rep4.id, hotelId: dammamHotel.id, estimatedRooms: 40 },
    { companyName: 'المملكة القابضة', companyNameEn: 'Kingdom Holding', contactPerson: 'أ. وليد المالكي', phone: '0114600000', email: 'walid@kingdom.com.sa', industry: 'الاستثمار', clientType: 'active', source: 'referral', salesRepId: rep1.id, hotelId: riyadhHotels[1]?.id || riyadhHotel.id, estimatedRooms: 70, annualBudget: 2500000 },
    { companyName: 'شركة الشرق الأوسط للنقل', companyNameEn: 'Middle East Transport', contactPerson: 'م. عصام بن عيسى', phone: '0138600000', email: 'essam@met.com.sa', industry: 'النقل والخدمات اللوجستية', clientType: 'lead', source: 'cold_call', salesRepId: rep5.id, hotelId: khobarHotel.id, estimatedRooms: 20 },
  ];

  const clients = [];
  for (const cd of clientsData) {
    const c = await prisma.client.create({ data: cd });
    clients.push(c);
  }
  console.log(`✅ Created ${clients.length} clients`);

  // === Contracts ===
  const futureDate = (months) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d; };
  const pastDate = (months) => { const d = new Date(); d.setMonth(d.getMonth() - months); return d; };

  const contractsData = [
    { clientId: clients[0].id, hotelId: dammamHotel.id, salesRepId: rep4.id, status: 'approved', roomsCount: 150, ratePerRoom: 400, startDate: pastDate(3), endDate: futureDate(9), contractRef: 'CTR-SA-001', notes: 'عقد شركات أرامكو السعودية السنوي', collectedAmount: 10000000 },
    { clientId: clients[1].id, hotelId: riyadhHotel.id, salesRepId: rep1.id, status: 'approved', roomsCount: 80, ratePerRoom: 500, startDate: pastDate(2), endDate: futureDate(10), contractRef: 'CTR-SA-002', collectedAmount: 5000000 },
    { clientId: clients[2].id, hotelId: riyadhHotel.id, salesRepId: rep1.id, status: 'approved', roomsCount: 60, ratePerRoom: 450, startDate: pastDate(1), endDate: futureDate(11), contractRef: 'CTR-SA-003', collectedAmount: 2000000 },
    { clientId: clients[3].id, hotelId: jeddahHotel.id, salesRepId: rep2.id, status: 'approved', roomsCount: 200, ratePerRoom: 350, startDate: pastDate(4), endDate: futureDate(1), contractRef: 'CTR-SA-004', notes: 'عقد الأولوية القصوى', collectedAmount: 15000000 },
    { clientId: clients[4].id, hotelId: riyadhHotel.id, salesRepId: rep1.id, status: 'pending', roomsCount: 30, ratePerRoom: 600, startDate: futureDate(0), endDate: futureDate(12), contractRef: 'CTR-SA-005' },
    { clientId: clients[5].id, hotelId: jeddahHotel.id, salesRepId: rep2.id, status: 'approved', roomsCount: 25, ratePerRoom: 480, startDate: pastDate(1), endDate: futureDate(2), contractRef: 'CTR-SA-006', collectedAmount: 800000 },
    { clientId: clients[6].id, hotelId: riyadhHotels[5]?.id || riyadhHotel.id, salesRepId: rep3.id, status: 'approved', roomsCount: 45, ratePerRoom: 550, startDate: pastDate(2), endDate: futureDate(10), contractRef: 'CTR-SA-007', collectedAmount: 3000000 },
    { clientId: clients[9].id, hotelId: riyadhHotels[1]?.id || riyadhHotel.id, salesRepId: rep1.id, status: 'pending', roomsCount: 70, ratePerRoom: 520, startDate: futureDate(0), endDate: futureDate(12), contractRef: 'CTR-SA-008' },
  ];

  for (const cd of contractsData) {
    const totalValue = cd.roomsCount * cd.ratePerRoom * 365;
    await prisma.contract.create({ data: { ...cd, totalValue } });
  }

  const approvedContracts = await prisma.contract.findMany({ where: { status: 'approved' } });
  for (const c of approvedContracts) {
    await prisma.contractApproval.create({
      data: { contractId: c.id, approvedBy: contractOfficer.id, status: 'approved', notes: 'تمت مراجعة جميع الشروط والموافقة عليها' }
    });
    await prisma.client.update({ where: { id: c.clientId }, data: { clientType: 'active' } });
  }
  console.log(`✅ Created ${contractsData.length} contracts`);

  // === Payments (collection tracking) ===
  const contractList = await prisma.contract.findMany({ where: { status: 'approved' } });
  const paymentData = [
    { contract: contractList[0], amounts: [5000000, 3000000, 2000000], types: ['bank_transfer', 'bank_transfer', 'check'] },
    { contract: contractList[1], amounts: [3000000, 2000000], types: ['bank_transfer', 'bank_transfer'] },
    { contract: contractList[2], amounts: [2000000], types: ['bank_transfer'] },
    { contract: contractList[3], amounts: [8000000, 4000000, 3000000], types: ['bank_transfer', 'bank_transfer', 'check'] },
    { contract: contractList[4], amounts: [800000], types: ['cash'] },
    { contract: contractList[5], amounts: [2000000, 1000000], types: ['bank_transfer', 'check'] },
  ];

  for (const pd of paymentData) {
    if (!pd.contract) continue;
    for (let i = 0; i < pd.amounts.length; i++) {
      const payDate = new Date();
      payDate.setDate(payDate.getDate() - (i * 30 + 15));
      const collectorMap = {
        [rep1.id]: rep1.id, [rep2.id]: rep2.id, [rep3.id]: rep3.id,
        [rep4.id]: rep4.id, [rep5.id]: rep5.id,
      };
      await prisma.payment.create({
        data: {
          contractId: pd.contract.id,
          clientId: pd.contract.clientId,
          amount: pd.amounts[i],
          paymentDate: payDate,
          paymentType: pd.types[i],
          reference: `REF-${pd.contract.contractRef}-${i + 1}`,
          collectedBy: pd.contract.salesRepId,
        }
      });
    }
  }
  console.log('✅ Created sample payment records');

  // === Visits ===
  const now = new Date();
  const visitsData = [
    { clientId: clients[0].id, salesRepId: rep4.id, visitDate: new Date(now - 2 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'مراجعة سنوية للعقد', outcome: 'راضٍ عن الخدمة، يطلب تجديد العقد مع زيادة الغرف', nextFollowUp: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
    { clientId: clients[1].id, salesRepId: rep1.id, visitDate: new Date(now - 5 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'عرض التجديد', outcome: 'يدرس الأمر داخلياً، سيرد الأسبوع القادم' },
    { clientId: clients[2].id, salesRepId: rep1.id, visitDate: new Date(now - 3 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'مراجعة ربع سنوية', outcome: 'راضٍ، يفكر في توسيع الاتفاقية' },
    { clientId: clients[3].id, salesRepId: rep2.id, visitDate: new Date(now - 2 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'زيارة عميل VIP', outcome: 'يستفسر عن العقارات الأخرى', nextFollowUp: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    { clientId: clients[5].id, salesRepId: rep2.id, visitDate: new Date(now - 10 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'اجتماع أولي', outcome: 'إيجابي جداً، يطلب جولة في المنشأة' },
    { clientId: clients[6].id, salesRepId: rep3.id, visitDate: new Date(now - 7 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'مراجعة سنوية', outcome: 'سعيد بالخدمة، منفتح على نقاش التجديد', nextFollowUp: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) },
    { clientId: clients[9].id, salesRepId: rep1.id, visitDate: new Date(now - 1 * 24 * 60 * 60 * 1000), visitType: 'in_person', purpose: 'تقديم العقد', outcome: 'مهتم جداً، العقد قيد المراجعة' },
  ];

  for (const v of visitsData) {
    await prisma.visit.create({ data: v });
  }
  console.log(`✅ Created ${visitsData.length} visits`);

  // === Activities ===
  const activitiesData = [
    { clientId: clients[0].id, userId: rep4.id, type: 'note', description: 'جهة الاتصال الرئيسية: م. فهد الشهراني - يفضل دائماً التأكيد الكتابي' },
    { clientId: clients[0].id, userId: rep4.id, type: 'call', description: 'اتصال لمناقشة تجديد العقد - ردود فعل إيجابية، إرسال العرض بنهاية الأسبوع' },
    { clientId: clients[3].id, userId: rep2.id, type: 'note', description: 'مجموعة بن لادن - عميل أولوية قصوى. التواصل عبر م. ماجد التميمي فقط' },
    { clientId: clients[3].id, userId: rep2.id, type: 'email', description: 'إرسال عرض متعدد العقارات يشمل الرياض وجدة - في انتظار الرد' },
    { clientId: clients[1].id, userId: rep1.id, type: 'meeting', description: 'اجتماع في مقر سابك لمراجعة الاحتياجات السنوية - الطلب يتزايد' },
    { clientId: clients[6].id, userId: rep3.id, type: 'note', description: 'البنك الأهلي - يحتاج غرف بشكل مستمر للزوار والموظفين المتنقلين' },
    { clientId: clients[2].id, userId: rep1.id, type: 'whatsapp', description: 'واتساب - م. سلطان أكد الحاجة لغرف إضافية خلال موسم الصيف' },
  ];

  for (const a of activitiesData) {
    await prisma.activity.create({ data: a });
  }
  console.log(`✅ Created ${activitiesData.length} activities`);

  // === Calculate Pulse Scores ===
  const { recalculatePulse } = require('./controllers/contractController');
  for (const client of clients) {
    await recalculatePulse(client.id);
  }
  console.log('✅ Calculated Deal Pulse scores');

  console.log('\n🎉 Seeding complete!\n');
  console.log('='.repeat(70));
  console.log('📋 بيانات تسجيل الدخول / LOGIN CREDENTIALS:');
  console.log('='.repeat(70));
  console.log('👔 المدير العام:         gm@hotelcrm.com         / gm123');
  console.log('👔 نائب المدير العام:    vgm@hotelcrm.com        / vgm123');
  console.log('📄 مسئول العقود:         contracts@hotelcrm.com  / contracts123');
  console.log('🎯 مدير مبيعات 1:        dir1@hotelcrm.com       / dir123');
  console.log('🎯 مدير مبيعات 2:        dir2@hotelcrm.com       / dir123');
  console.log('👤 مندوب (عمر):          omar@hotelcrm.com       / sales123');
  console.log('👤 مندوب (سارة):         sara@hotelcrm.com       / sales123');
  console.log('👤 مندوب (منى):          mona@hotelcrm.com       / sales123');
  console.log('👤 مندوب (حسن):          hassan@hotelcrm.com     / sales123');
  console.log('👤 مندوب (دينا):         dina@hotelcrm.com       / sales123');
  console.log('👤 مندوب (أمير):         amir@hotelcrm.com       / sales123');
  console.log('='.repeat(70));
  console.log(`\n🏨 الفنادق: ${hotels.length} فندق في المملكة العربية السعودية`);
  console.log(`   - المهيدب للشقق المخدومة: ${muhaidibHotels.length} فندق`);
  console.log(`   - مجموعة فنادق إيواء: ${awaHotels.length} فندق`);
  console.log(`   - مجموعة فنادق جراند بلازا: ${grandPlazaHotels.length} فندق`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
