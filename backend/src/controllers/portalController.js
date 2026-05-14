const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendSystemEmail } = require('../utils/systemEmail');
const prisma = new PrismaClient();

const OTP_TTL_MIN = 10;
const OTP_RATE_LIMIT_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;
const PORTAL_TOKEN_TTL = '7d';

// Per-client booking-submission cap (anti-spam, complements per-IP route limit)
const BOOKING_RATE_PER_HOUR_PER_CLIENT = 10;
const BOOKING_RATE_PER_DAY_PER_CLIENT = 30;

// Hard input caps to prevent DoS / OOM
const MAX_GUESTS_PER_BOOKING = 20;
const MAX_NAME_LEN = 120;
const MAX_NATIONALITY_LEN = 60;
const MAX_NOTES_LEN = 1000;

// RFC 5321 max email length is 254
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (s) => typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s);

// Same generic message regardless of whether the email exists, to prevent email enumeration
const GENERIC_OTP_MSG = 'إذا كان البريد مسجلاً لدينا، تم إرسال كود تحقق إليه.';

// A throwaway hash used purely to keep request-otp's response time roughly
// constant whether or not the email matches — defeats simple timing oracles
// that try to enumerate registered emails by measuring response latency.
const TIMING_DECOY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // bcrypt('password')
const constantTimeDelay = async () => {
  // Run a real bcrypt op to mirror the work done in the success path.
  await bcrypt.compare('decoy', TIMING_DECOY_HASH).catch(() => {});
};

// Audit logger — writes to Activity table where possible (so it shows in the
// CRM activity feed under the relevant client) and falls back to console if
// the client isn't known yet (e.g. an OTP request for an unregistered email).
const audit = async ({ clientId, salesRepId, type, description }) => {
  try {
    if (clientId) {
      await prisma.activity.create({
        data: { clientId, userId: salesRepId, type, description },
      });
    } else {
      console.log(`[Portal Audit] ${type}: ${description}`);
    }
  } catch (err) {
    console.error('audit log error:', err.message);
  }
};

const otpEmailHtml = (companyName, code) => `
<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#f0f4f8;">
  <div style="background:#1a2f44;color:white;padding:22px;border-radius:8px 8px 0 0;text-align:center;">
    <h2 style="margin:0;">بوابة العملاء — Ewaa Hotels</h2>
  </div>
  <div style="background:white;padding:25px;border-radius:0 0 8px 8px;border:1px solid #d9e2ec;">
    <p style="font-size:15px;color:#243b53;line-height:1.7;">السلام عليكم،</p>
    <p style="font-size:15px;color:#243b53;line-height:1.7;">تم استلام طلب تسجيل دخول لحساب <b>${companyName || ''}</b> على بوابة العملاء.</p>
    <p style="font-size:15px;color:#486581;">كود التحقق:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1a2f44;background:#f0f4f8;padding:14px;border-radius:8px;text-align:center;margin:14px 0;">
      ${code}
    </div>
    <p style="font-size:13px;color:#829ab1;margin-top:14px;">الكود صالح لمدة ${OTP_TTL_MIN} دقائق فقط. لا تشاركه مع أحد.</p>
    <p style="font-size:13px;color:#829ab1;">إذا لم تطلب هذا الكود، تجاهل هذه الرسالة.</p>
  </div>
</div>`;

// POST /portal/auth/request-otp { email }
const requestOtp = async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();

    // Validate format. Always return generic message on bad email so we don't
    // confirm whether shape was right or wrong.
    if (!isValidEmail(rawEmail)) {
      await constantTimeDelay();
      return res.json({ message: GENERIC_OTP_MSG });
    }

    // Per-email rate limit (defense in depth on top of per-IP middleware).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.clientOtpCode.count({
      where: { email: rawEmail, createdAt: { gte: oneHourAgo } },
    });
    if (recent >= OTP_RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ message: 'تم تجاوز عدد محاولات الدخول. حاول بعد ساعة.' });
    }

    // Look up client by email. Always send back the same message whether or not
    // the email matches; combined with constantTimeDelay below this defeats
    // both content- and timing-based enumeration.
    const client = await prisma.client.findFirst({
      where: { email: { equals: rawEmail }, isActive: true },
    });

    if (!client) {
      // Audit suspicious login attempts on unknown emails (helpful when probed)
      await audit({ type: 'portal_otp_unknown_email', description: `طلب كود لبريد غير مسجل: ${rawEmail}` });
      // Match the success-path workload before responding
      await constantTimeDelay();
      return res.json({ message: GENERIC_OTP_MSG });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

    // Invalidate any prior unused codes for this email
    await prisma.clientOtpCode.updateMany({
      where: { email: rawEmail, used: false },
      data: { used: true },
    });
    await prisma.clientOtpCode.create({ data: { email: rawEmail, codeHash, expiresAt } });

    // Dev-only: log code to console for testing without SMTP. The production
    // build sets NODE_ENV=production and never trips this branch unless
    // PORTAL_OTP_DEBUG is explicitly set — which should never be set in prod.
    if (process.env.NODE_ENV !== 'production' || process.env.PORTAL_OTP_DEBUG === '1') {
      console.log(`[Portal OTP] email=${rawEmail} code=${code} (expires ${expiresAt.toISOString()})`);
    }

    await audit({ clientId: client.id, salesRepId: client.salesRepId, type: 'portal_otp_requested', description: `تم إرسال كود دخول إلى ${rawEmail}` });

    // Skip the SMTP send for demo accounts when the bypass is on — the
    // demo email may be a non-routable domain (e.g. .test) and there's no
    // mailbox to receive the code anyway. The fixed code 000000 still works.
    const skipSmtp = isDemoBypassEnabled() && DEMO_BYPASS.emails.includes(rawEmail);
    if (!skipSmtp) {
      try {
        await sendSystemEmail({
          to: rawEmail,
          subject: 'كود التحقق - بوابة عملاء Ewaa Hotels',
          html: otpEmailHtml(client.companyName, code),
        });
      } catch (err) {
        console.error('Portal OTP email failed:', err.message);
        // In dev, swallow the mail error so the tester can still grab the code from the console log above.
        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({ message: 'فشل إرسال البريد، تواصل مع المسؤول.' });
        }
      }
    }

    res.json({ message: GENERIC_OTP_MSG });
  } catch (err) {
    console.error('requestOtp error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Demo bypass — opt-in via env flag, restricted to a hardcoded email/code pair.
// Two independent guards:
//   1) PORTAL_DEMO_BYPASS=1                   (must be explicitly set per env;
//      MUST NOT be set on real production servers — see DEPLOYMENT.md)
//   2) hardcoded email + fixed code allowlist (only one specific demo account)
// Each successful bypass is logged with the source IP so unexpected use is auditable.
const DEMO_BYPASS = {
  emails: ['demo@portal.test'],
  fixedCode: '000000',
};
const isDemoBypassEnabled = () => process.env.PORTAL_DEMO_BYPASS === '1';

// POST /portal/auth/verify-otp { email, code }
const verifyOtp = async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const rawCode = String(req.body?.code || '').trim();

    if (!isValidEmail(rawEmail) || !/^\d{6}$/.test(rawCode)) {
      return res.status(400).json({ message: 'البريد والكود مطلوبان' });
    }

    // Dev-only bypass
    if (isDemoBypassEnabled() && DEMO_BYPASS.emails.includes(rawEmail) && rawCode === DEMO_BYPASS.fixedCode) {
      const client = await prisma.client.findFirst({ where: { email: { equals: rawEmail }, isActive: true } });
      if (!client) return res.status(400).json({ message: 'العميل غير موجود' });
      console.warn(`[Portal] DEMO BYPASS used for ${rawEmail} from IP ${req.ip}`);
      const token = jwt.sign({ clientId: client.id, type: 'portal' }, process.env.JWT_SECRET, { expiresIn: PORTAL_TOKEN_TTL });
      return res.json({
        token,
        client: { id: client.id, companyName: client.companyName, contactPerson: client.contactPerson, email: client.email, phone: client.phone },
      });
    }

    const record = await prisma.clientOtpCode.findFirst({
      where: { email: rawEmail, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      await audit({ type: 'portal_otp_invalid', description: `محاولة دخول بكود منتهي / غير صالح من ${rawEmail} (IP ${req.ip})` });
      return res.status(400).json({ message: 'الكود غير صالح أو انتهت صلاحيته' });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.clientOtpCode.update({ where: { id: record.id }, data: { used: true } });
      await audit({ type: 'portal_otp_locked', description: `تم قفل الكود بعد ${OTP_MAX_ATTEMPTS} محاولات فاشلة - ${rawEmail} (IP ${req.ip})` });
      return res.status(400).json({ message: 'تم تجاوز عدد المحاولات، اطلب كود جديد.' });
    }

    const ok = await bcrypt.compare(rawCode, record.codeHash);
    if (!ok) {
      await prisma.clientOtpCode.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
      });
      return res.status(400).json({ message: 'الكود غير صحيح' });
    }

    // Mark used (single-use OTP)
    await prisma.clientOtpCode.update({ where: { id: record.id }, data: { used: true } });

    const client = await prisma.client.findFirst({
      where: { email: { equals: rawEmail }, isActive: true },
    });
    if (!client) return res.status(400).json({ message: 'العميل غير موجود' });

    const token = jwt.sign(
      { clientId: client.id, type: 'portal' },
      process.env.JWT_SECRET,
      { expiresIn: PORTAL_TOKEN_TTL }
    );

    await audit({ clientId: client.id, salesRepId: client.salesRepId, type: 'portal_login', description: `دخول البورتال - IP ${req.ip}` });

    res.json({
      token,
      client: {
        id: client.id,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
      },
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /portal/me
const getMe = async (req, res) => {
  const c = req.client;
  res.json({
    id: c.id,
    companyName: c.companyName,
    companyNameEn: c.companyNameEn,
    contactPerson: c.contactPerson,
    email: c.email,
    phone: c.phone,
    salesRep: c.salesRep,
  });
};

// GET /portal/hotels — hotels available to this client
const getHotels = async (req, res) => {
  try {
    // For now: return all active hotels. (Could be filtered by client's contracts later.)
    const hotels = await prisma.hotel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameEn: true, city: true, country: true, stars: true, group: true },
      orderBy: { name: 'asc' },
    });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /portal/contracts — active contracts for this client (so we can show contract rates)
const getContracts = async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { clientId: req.client.id, status: 'approved' },
      select: {
        id: true, contractRef: true, hotelId: true,
        ratePerRoom: true, startDate: true, endDate: true,
        hotel: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { endDate: 'desc' },
    });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bookingPortalSelect = {
  id: true,
  hotelId: true,
  contractId: true,
  guestName: true,
  arrivalDate: true,
  departureDate: true,
  nights: true,
  roomsCount: true,
  adultsCount: true,
  childrenCount: true,
  roomType: true,
  ratePerNight: true,
  ratePackage: true,
  totalAmount: true,
  currency: true,
  paymentMethod: true,
  status: true,
  cancellationReason: true,
  operaConfirmationNo: true,
  notes: true,
  submittedByClient: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true, nameEn: true } },
  contract: { select: { id: true, contractRef: true } },
  guests: { select: { id: true, name: true, nationality: true, isPrimary: true }, orderBy: { isPrimary: 'desc' } },
};

// GET /portal/bookings
const getMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { clientId: req.client.id },
      select: bookingPortalSelect,
      orderBy: { arrivalDate: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /portal/bookings/:id
const getMyBooking = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const booking = await prisma.booking.findFirst({
      where: { id, clientId: req.client.id },
      select: bookingPortalSelect,
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /portal/bookings — submit a booking REQUEST (status = pending_reservations)
const requestBooking = async (req, res) => {
  try {
    // Per-client rate limiting (anti-spam — supplements the per-IP limit on the route).
    // A single legitimate token still shouldn't be able to spam bookings.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [hourCount, dayCount] = await Promise.all([
      prisma.booking.count({ where: { clientId: req.client.id, createdAt: { gte: oneHourAgo } } }),
      prisma.booking.count({ where: { clientId: req.client.id, createdAt: { gte: oneDayAgo } } }),
    ]);
    if (hourCount >= BOOKING_RATE_PER_HOUR_PER_CLIENT) {
      return res.status(429).json({ message: 'تم تجاوز حد طلبات الحجز لهذه الساعة. حاول لاحقًا.' });
    }
    if (dayCount >= BOOKING_RATE_PER_DAY_PER_CLIENT) {
      return res.status(429).json({ message: 'تم تجاوز حد طلبات الحجز اليومي. حاول غدًا.' });
    }

    const {
      hotelId, contractId,
      guestName, guests, arrivalDate, departureDate,
      roomsCount, adultsCount, childrenCount, roomType,
      ratePackage, paymentMethod, notes,
    } = req.body;

    // ── Input validation: types, lengths, ranges ──
    const hotelIdInt = parseInt(hotelId);
    if (!Number.isInteger(hotelIdInt) || hotelIdInt <= 0) {
      return res.status(400).json({ message: 'معرّف الفندق غير صالح' });
    }

    // Normalize + validate guests array.
    let normalizedGuests = Array.isArray(guests)
      ? guests
          .filter(g => g && typeof g.name === 'string' && g.name.trim())
          .map(g => ({
            name: String(g.name).trim().slice(0, MAX_NAME_LEN),
            nationality: g.nationality ? String(g.nationality).trim().slice(0, MAX_NATIONALITY_LEN) : null,
          }))
      : [];
    if (normalizedGuests.length === 0 && typeof guestName === 'string' && guestName.trim()) {
      normalizedGuests = [{ name: String(guestName).trim().slice(0, MAX_NAME_LEN), nationality: null }];
    }
    if (normalizedGuests.length > MAX_GUESTS_PER_BOOKING) {
      return res.status(400).json({ message: `عدد الضيوف لا يجب أن يتجاوز ${MAX_GUESTS_PER_BOOKING}` });
    }

    if (!hotelId || normalizedGuests.length === 0 || !arrivalDate || !departureDate) {
      return res.status(400).json({ message: 'بيانات ناقصة: الفندق وضيف واحد على الأقل والتواريخ مطلوبة' });
    }

    // Numeric counts: clamp to reasonable ranges (hotel rooms aren't ever in the thousands)
    const roomsInt = parseInt(roomsCount);
    const adultsInt = parseInt(adultsCount);
    const childrenInt = parseInt(childrenCount);
    if ((roomsCount !== undefined && (!Number.isFinite(roomsInt) || roomsInt < 1 || roomsInt > 100)) ||
        (adultsCount !== undefined && (!Number.isFinite(adultsInt) || adultsInt < 0 || adultsInt > 200)) ||
        (childrenCount !== undefined && (!Number.isFinite(childrenInt) || childrenInt < 0 || childrenInt > 200))) {
      return res.status(400).json({ message: 'أعداد الغرف / الكبار / الأطفال غير صالحة' });
    }

    if (typeof notes === 'string' && notes.length > MAX_NOTES_LEN) {
      return res.status(400).json({ message: 'الملاحظات طويلة جدًا' });
    }
    if (typeof roomType === 'string' && roomType.length > 80) {
      return res.status(400).json({ message: 'نوع الغرفة غير صالح' });
    }
    const arr = new Date(arrivalDate);
    const dep = new Date(departureDate);
    if (isNaN(arr.getTime()) || isNaN(dep.getTime())) {
      return res.status(400).json({ message: 'تاريخ غير صالح' });
    }
    if (dep <= arr) {
      return res.status(400).json({ message: 'تاريخ المغادرة لازم يكون بعد الوصول' });
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (arr < today) {
      return res.status(400).json({ message: 'لا يمكن الحجز في تاريخ سابق' });
    }

    const allowedPay = ['Cash', 'City Ledger'];
    if (paymentMethod && !allowedPay.includes(paymentMethod)) {
      return res.status(400).json({ message: 'طريقة الدفع غير مدعومة' });
    }

    const allowedPackages = ['Bed and Breakfast', 'Half Board', 'Full Board', 'Room Only', 'All Inclusive'];
    if (ratePackage && !allowedPackages.includes(ratePackage)) {
      return res.status(400).json({ message: 'الباقة غير مدعومة' });
    }

    const nights = Math.max(1, Math.round((dep - arr) / (1000 * 60 * 60 * 24)));
    const rooms = parseInt(roomsCount) || 1;

    // If client provided a contract, verify it belongs to them and is approved
    let linkedContract = null;
    if (contractId) {
      linkedContract = await prisma.contract.findFirst({
        where: { id: parseInt(contractId), clientId: req.client.id, status: 'approved' },
        select: { id: true, ratePerRoom: true, hotelId: true },
      });
      if (!linkedContract) {
        return res.status(400).json({ message: 'العقد غير موجود أو غير معتمد' });
      }
    } else {
      // Auto-link: pick the most recent approved contract for this hotel + this client (if any)
      linkedContract = await prisma.contract.findFirst({
        where: { clientId: req.client.id, hotelId: parseInt(hotelId), status: 'approved' },
        orderBy: { endDate: 'desc' },
        select: { id: true, ratePerRoom: true, hotelId: true },
      });
    }

    const ratePerNight = linkedContract?.ratePerRoom ?? null;
    const totalAmount = ratePerNight ? ratePerNight * nights * rooms : null;

    const booking = await prisma.booking.create({
      data: {
        clientId: req.client.id,
        hotelId: parseInt(hotelId),
        contractId: linkedContract?.id ?? null,
        assignedRepId: req.client.salesRepId,
        bookedById: null,             // submitted by client, no internal user
        submittedByClient: true,
        operaConfirmationNo: null,    // reservations team adds this when confirming in Opera
        guestName: normalizedGuests[0].name,    // legacy field — primary guest's name
        reservationMadeBy: null,
        arrivalDate: arr,
        departureDate: dep,
        nights,
        roomsCount: rooms,
        adultsCount: parseInt(adultsCount) || 1,
        childrenCount: parseInt(childrenCount) || 0,
        roomType: roomType || null,
        ratePerNight,
        ratePackage: ratePackage || null,
        totalAmount,
        currency: 'SAR',
        paymentMethod: paymentMethod || null,
        source: 'portal',
        status: 'pending_reservations',
        notes: notes ? String(notes).trim() : null,
        guests: {
          create: normalizedGuests.map((g, i) => ({
            name: g.name,
            nationality: g.nationality,
            isPrimary: i === 0,
          })),
        },
      },
      select: { ...bookingPortalSelect, guests: { select: { id: true, name: true, nationality: true, isPrimary: true } } },
    });

    // Notify reservations team + the assigned rep so both sides see the
    // request immediately.
    const reservationsUsers = await prisma.user.findMany({
      where: { role: 'reservations', isActive: true },
      select: { id: true },
    });
    for (const u of reservationsUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          type: 'booking_request',
          title: 'طلب حجز جديد من العميل',
          message: `${req.client.companyName} طلبت حجز ${rooms} غرفة من ${arr.toLocaleDateString('ar-EG')} إلى ${dep.toLocaleDateString('ar-EG')} - الضيف: ${booking.guestName}`,
          link: `/bookings`,
        },
      });
    }
    await prisma.notification.create({
      data: {
        userId: req.client.salesRepId,
        type: 'booking_request',
        title: 'طلب حجز من عميلك',
        message: `${req.client.companyName} قدّمت طلب حجز عبر البورتال`,
        link: `/bookings`,
      },
    });

    // Activity log on the client
    await prisma.activity.create({
      data: {
        clientId: req.client.id,
        userId: req.client.salesRepId, // attribute to rep since there's no internal user actor
        type: 'portal_booking_request',
        description: `طلب حجز عبر البورتال: ${booking.guestName} - ${nights} ليلة - ${rooms} غرفة`,
      },
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error('requestBooking error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /portal/account-summary?month=YYYY-MM
// Returns stats for the requested month (defaults to current), plus credit info,
// contracts, last-6-months trend, and recent activity for the dashboard.
const getAccountSummary = async (req, res) => {
  try {
    const clientId = req.client.id;

    // Parse month filter (YYYY-MM); default to current month
    const now = new Date();
    let monthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      const [y, m] = req.query.month.split('-').map(Number);
      monthDate = new Date(y, m - 1, 1);
    }
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const yearStart = new Date(monthDate.getFullYear(), 0, 1);
    const yearEnd = new Date(monthDate.getFullYear() + 1, 0, 1);
    const prevMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    const prevMonthEnd = monthStart;

    // Build a stat block from a list of bookings
    const aggBookings = (list) => list.reduce((acc, b) => {
      acc.count += 1;
      acc.nights += b.nights || 0;
      acc.rooms += b.roomsCount || 0;
      acc.spent += b.totalAmount || 0;
      return acc;
    }, { count: 0, nights: 0, rooms: 0, spent: 0 });

    // Excludes cancelled — those didn't actually consume anything
    const billable = (b) => b.status !== 'cancelled';

    // Selected month
    const monthBookings = await prisma.booking.findMany({
      where: { clientId, arrivalDate: { gte: monthStart, lt: monthEnd } },
      select: { id: true, status: true, nights: true, roomsCount: true, totalAmount: true, arrivalDate: true },
    });
    const thisMonth = aggBookings(monthBookings.filter(billable));

    // Previous month for delta
    const prevMonthBookings = await prisma.booking.findMany({
      where: { clientId, arrivalDate: { gte: prevMonthStart, lt: prevMonthEnd } },
      select: { id: true, status: true, nights: true, roomsCount: true, totalAmount: true },
    });
    const lastMonth = aggBookings(prevMonthBookings.filter(billable));

    // Year-to-date
    const yearBookings = await prisma.booking.findMany({
      where: { clientId, arrivalDate: { gte: yearStart, lt: yearEnd } },
      select: { id: true, status: true, nights: true, roomsCount: true, totalAmount: true, arrivalDate: true },
    });
    const thisYear = aggBookings(yearBookings.filter(billable));

    // Status breakdown for the entire account
    const allBookings = await prisma.booking.groupBy({
      by: ['status'],
      where: { clientId },
      _count: { _all: true },
    });
    const statusCounts = {
      pending_reservations: 0, confirmed: 0, checked_in: 0,
      checked_out: 0, cancelled: 0, no_show: 0,
    };
    for (const r of allBookings) statusCounts[r.status] = r._count._all;

    // Last 6 months trend (including the selected month)
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const ms = new Date(monthDate.getFullYear(), monthDate.getMonth() - i, 1);
      const me = new Date(monthDate.getFullYear(), monthDate.getMonth() - i + 1, 1);
      const items = await prisma.booking.findMany({
        where: { clientId, arrivalDate: { gte: ms, lt: me } },
        select: { status: true, nights: true, totalAmount: true },
      });
      const billed = items.filter(billable);
      trend.push({
        month: `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}`,
        bookings: billed.length,
        nights: billed.reduce((s, b) => s + (b.nights || 0), 0),
        spent: billed.reduce((s, b) => s + (b.totalAmount || 0), 0),
      });
    }

    // Credit ledger (City Ledger only — that's what consumes credit)
    // Outstanding = sum of City Ledger bookings (confirmed/checked_in/checked_out)
    //              minus payments made by/for this client.
    const creditBookings = await prisma.booking.findMany({
      where: {
        clientId,
        paymentMethod: 'City Ledger',
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
      select: { totalAmount: true },
    });
    const totalCharged = creditBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);

    const approvedPayments = await prisma.payment.aggregate({
      where: { clientId, status: 'approved' },
      _sum: { amount: true },
    });
    const totalPaid = approvedPayments._sum.amount || 0;

    const outstanding = Math.max(0, totalCharged - totalPaid);
    const creditLimit = req.client.creditLimit ?? null;
    const availableCredit = creditLimit != null ? Math.max(0, creditLimit - outstanding) : null;
    const utilizationPct = creditLimit && creditLimit > 0
      ? Math.min(100, Math.round((outstanding / creditLimit) * 100))
      : null;

    // Active contracts — show rate + days until expiry
    const contracts = await prisma.contract.findMany({
      where: { clientId, status: 'approved' },
      select: {
        id: true, contractRef: true, ratePerRoom: true,
        startDate: true, endDate: true, totalValue: true, collectedAmount: true,
        hotel: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { endDate: 'desc' },
    });
    const enrichedContracts = contracts.map(c => {
      const days = c.endDate
        ? Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...c, daysUntilExpiry: days };
    });

    // Recent activity — last 5 bookings + most recent change-log entries
    const recentBookings = await prisma.booking.findMany({
      where: { clientId },
      select: {
        id: true, status: true, guestName: true, arrivalDate: true,
        nights: true, totalAmount: true, currency: true,
        operaConfirmationNo: true, createdAt: true, updatedAt: true,
        hotel: { select: { name: true, nameEn: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    res.json({
      period: {
        month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        year: monthDate.getFullYear(),
      },
      thisMonth,
      lastMonth,
      thisYear,
      statusCounts,
      trend,
      credit: {
        creditLimit,
        outstanding,
        availableCredit,
        utilizationPct,
        totalCharged,
        totalPaid,
      },
      contracts: enrichedContracts,
      recentBookings,
    });
  } catch (err) {
    console.error('getAccountSummary error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  getMe,
  getHotels,
  getContracts,
  getMyBookings,
  getMyBooking,
  requestBooking,
  getAccountSummary,
};
