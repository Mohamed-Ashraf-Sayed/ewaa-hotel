// One-off wipe of all transactional/business data.
// Keeps: User (with passwords + SMTP), Hotel (with bank info),
// UserHotel (assignments), Message (employee chat).
// Wipes everything else so the team can start entering real data.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const before = {};
  const after = {};

  const tables = [
    // Leaf tables first (depend on others)
    'bookingChangeLog',
    'quote',
    'payment',
    'contractApproval',
    'clientAttachment',
    'clientOtpCode',
    'activity',
    'visit',
    'dealPulseScore',
    'reminder',
    'task',
    'notification',
    'emailLog',
    'booking',
    'contract',
    'salesTarget',
    'performanceScore',
    'promotion',
    'localEvent',
    // Parent tables last
    'client',
  ];

  // Snapshot counts so we know what we wiped.
  for (const t of tables) {
    before[t] = await prisma[t].count();
  }
  before.user = await prisma.user.count();
  before.hotel = await prisma.hotel.count();
  before.message = await prisma.message.count();

  console.log('--- BEFORE ---');
  console.log(JSON.stringify(before, null, 2));

  // Run deletes in the listed order so FK constraints don't fight us.
  for (const t of tables) {
    const r = await prisma[t].deleteMany({});
    console.log(`Deleted ${r.count} from ${t}`);
  }

  for (const t of tables) {
    after[t] = await prisma[t].count();
  }
  after.user = await prisma.user.count();
  after.hotel = await prisma.hotel.count();
  after.message = await prisma.message.count();

  console.log('--- AFTER ---');
  console.log(JSON.stringify(after, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
