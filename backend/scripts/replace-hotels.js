const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REAL_HOTELS = [
  // Ewaa Express - 10
  { name: 'Ewaa Express Hotel - Abha', group: 'awa_hotels', city: 'أبها' },
  { name: 'Ewaa Express Hotel - Al Jouf', group: 'awa_hotels', city: 'الجوف' },
  { name: 'Ewaa Express Hotel - Buraydah', group: 'awa_hotels', city: 'بريدة' },
  { name: 'Ewaa Express Hotel - Tabuk', group: 'awa_hotels', city: 'تبوك' },
  { name: 'Ewaa Express Hotel - Al Olaya', group: 'awa_hotels', city: 'الرياض' },
  { name: 'Ewaa Express Hotel - Al Hamra', group: 'awa_hotels', city: 'جدة' },
  { name: 'Ewaa Express Hotel - Al Rawda', group: 'awa_hotels', city: 'الرياض' },
  { name: 'Ewaa Express Hotel - Al Shate', group: 'awa_hotels', city: 'جدة' },
  { name: 'Ewaa Express Hotel - Gaber', group: 'awa_hotels', city: 'الرياض' },
  { name: 'Ewaa Express Hotel - Khurais', group: 'awa_hotels', city: 'الرياض' },
  // Grand Plaza - 6
  { name: 'Grand Plaza Dhabab Hotel', group: 'grand_plaza', city: 'الرياض' },
  { name: 'Grand Plaza Gulf Hotel', group: 'grand_plaza', city: 'الخبر' },
  { name: 'Grand Plaza Hotel - King Fahad', group: 'grand_plaza', city: 'الرياض' },
  { name: 'Grand Plaza Takhasosi Hotel', group: 'grand_plaza', city: 'الرياض' },
  { name: 'Grand Plaza Hotel - Tabuk', group: 'grand_plaza', city: 'تبوك' },
  { name: 'Grand Plaza Jazan', group: 'grand_plaza', city: 'جازان' },
  // Almuhaidb / Nawara / Neyyara / Sama Al Qasr - all under Muhaidib brand
  { name: 'Almuhaidb Takhasosi Value', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Takhasosi Suites', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Takhasosi Hotel', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Sulaimanya Askary Hospital', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Residence Salahuddin', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Residence Altakhsosi', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Residence Almalaz', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Al Muhaidb Al Muhammadiah', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Al Muhaidb Al Takhassosi Abaqrino', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Al Muhaidb Down Town', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Al Muhaidb Residence Jawazat', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Al Diwan', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Al Malaz - Al Farazdaq Road', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Al Olaya Suites', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Al-Suwaidi 24', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Almalaz - Aljamiah', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Alnarges', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Alolaya Khurais', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Gharnata - Almalaz', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Jarir - Almalaz', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb King Abdulaziz - Almalaz', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Almuhaidb Residence Abha', group: 'muhaidib_serviced', city: 'أبها' },
  { name: 'Almuhaidb Palastine - Jeddah', group: 'muhaidib_serviced', city: 'جدة' },
  { name: 'Almuhaidb Alhamra Jeddah', group: 'muhaidib_serviced', city: 'جدة' },
  { name: 'Almuhaidb Residence Aldawadmi', group: 'muhaidib_serviced', city: 'الدوادمي' },
  { name: 'Almuhaidb Residence Alkhobar', group: 'muhaidib_serviced', city: 'الخبر' },
  { name: 'Almuhaidb Resort Alhada', group: 'muhaidib_serviced', city: 'الطائف' },
  { name: 'Al Muhaidb Al Taif Hotel', group: 'muhaidib_serviced', city: 'الطائف' },
  { name: 'Almuhaidb Sudair', group: 'muhaidib_serviced', city: 'سدير' },
  { name: 'Nawara Al Askary', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Nawara Apartments 24', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Nawara Dala', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Nawara Hotel Khanshalila', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Nawara Medical City', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Nawara New Azizia', group: 'muhaidib_serviced', city: 'مكة' },
  { name: 'Nawara Old Azizia', group: 'muhaidib_serviced', city: 'مكة' },
  { name: 'Nawara Takhasossi', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Neyyara Al Takhasossi', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Neyyara Khanshalila', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Sama Al Qasr Al Muhammadiah', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Sama Al Qasr Al Narges', group: 'muhaidib_serviced', city: 'الرياض' },
  { name: 'Sama Al Qasr Khorais', group: 'muhaidib_serviced', city: 'الرياض' },
];

(async () => {
  const oldCount = await prisma.hotel.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });
  console.log('🚫 Deactivated', oldCount.count, 'old hotels');

  let added = 0;
  for (const h of REAL_HOTELS) {
    const existing = await prisma.hotel.findFirst({ where: { name: h.name } });
    if (existing) {
      await prisma.hotel.update({
        where: { id: existing.id },
        data: { isActive: true, group: h.group, city: h.city }
      });
    } else {
      await prisma.hotel.create({
        data: {
          name: h.name, nameEn: h.name, location: h.city, city: h.city,
          country: 'Saudi Arabia', stars: 4, type: 'Business', group: h.group, isActive: true
        }
      });
    }
    added++;
  }
  console.log('✅ Added/activated', added, 'real hotels');

  // Reassign hotels to directors
  const dir1 = await prisma.user.findUnique({ where: { email: 'dir1@hotelcrm.com' } });
  const dir2 = await prisma.user.findUnique({ where: { email: 'Mohamed.saleh@ewaahotels.com' } });

  if (dir1 && dir2) {
    await prisma.userHotel.deleteMany({ where: { userId: { in: [dir1.id, dir2.id] } } });

    const muhaidibHotels = await prisma.hotel.findMany({ where: { group: 'muhaidib_serviced', isActive: true } });
    const grandHotels = await prisma.hotel.findMany({ where: { group: 'grand_plaza', isActive: true } });
    const ewaaHotels = await prisma.hotel.findMany({ where: { group: 'awa_hotels', isActive: true } });

    await prisma.userHotel.createMany({
      data: muhaidibHotels.map(h => ({ userId: dir1.id, hotelId: h.id }))
    });
    console.log('📌', muhaidibHotels.length, 'Muhaidib hotels assigned to dir1');

    await prisma.userHotel.createMany({
      data: [...grandHotels, ...ewaaHotels].map(h => ({ userId: dir2.id, hotelId: h.id }))
    });
    console.log('📌', grandHotels.length + ewaaHotels.length, 'Grand+Ewaa hotels assigned to dir2');
  }

  console.log('\n✅ Done!');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
