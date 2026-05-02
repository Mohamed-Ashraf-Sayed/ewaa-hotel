const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const { extractBooking } = require('../utils/bookingExtractor');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];
const RESERVATIONS_ROLES = ['reservations', 'admin', 'general_manager', 'vice_gm'];

// Filter bookings by user role
const buildBookingFilter = async (user) => {
  if (ADMIN_ROLES.includes(user.role) || user.role === 'reservations' || user.role === 'contract_officer') return {};
  if (user.role === 'assistant_sales' && user.managerId) {
    const teamIds = await getSubordinateIds(user.managerId);
    return { assignedRepId: { in: [user.managerId, ...teamIds] } };
  }
  if (user.role === 'sales_director') {
    const subIds = await getSubordinateIds(user.id);
    return { assignedRepId: { in: [user.id, ...subIds] } };
  }
  return { assignedRepId: user.id };
};

const calcNights = (arrival, departure) => {
  const ms = new Date(departure).getTime() - new Date(arrival).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
};

const bookingInclude = {
  client: { select: { id: true, companyName: true, contactPerson: true, phone: true, email: true } },
  hotel: { select: { id: true, name: true, nameEn: true } },
  contract: { select: { id: true, contractRef: true } },
  assignedRep: { select: { id: true, name: true, email: true } },
  bookedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
};

// GET /bookings
const getBookings = async (req, res) => {
  try {
    const { status, hotelId, clientId, assignedRepId, search, fromDate, toDate } = req.query;
    const accessFilter = await buildBookingFilter(req.user);

    const where = {
      ...accessFilter,
      ...(status && { status }),
      ...(hotelId && { hotelId: parseInt(hotelId) }),
      ...(clientId && { clientId: parseInt(clientId) }),
      ...(assignedRepId && { assignedRepId: parseInt(assignedRepId) }),
      ...(search && {
        OR: [
          { guestName: { contains: search } },
          { operaConfirmationNo: { contains: search } },
          { client: { companyName: { contains: search } } },
        ],
      }),
      ...(fromDate || toDate ? {
        arrivalDate: {
          ...(fromDate && { gte: new Date(fromDate) }),
          ...(toDate && { lte: new Date(toDate) }),
        },
      } : {}),
    };

    const bookings = await prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { arrivalDate: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    console.error('getBookings error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /bookings/:id
const getBooking = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Access check
    const accessFilter = await buildBookingFilter(req.user);
    if (Object.keys(accessFilter).length > 0) {
      const allowed = await prisma.booking.findFirst({ where: { id, ...accessFilter }, select: { id: true } });
      if (!allowed) return res.status(403).json({ message: 'Access denied' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /bookings/client/:clientId
const getClientBookings = async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const accessFilter = await buildBookingFilter(req.user);

    const bookings = await prisma.booking.findMany({
      where: { clientId, ...accessFilter },
      include: bookingInclude,
      orderBy: { arrivalDate: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /bookings
const createBooking = async (req, res) => {
  try {
    const {
      clientId, hotelId, contractId,
      operaConfirmationNo, guestName, reservationMadeBy,
      arrivalDate, departureDate,
      roomsCount, adultsCount, childrenCount, roomType,
      ratePerNight, ratePackage, totalAmount, currency,
      vatPercent, municipalityFeePercent,
      paymentMethod, source, status, notes,
    } = req.body;

    // Required fields validation
    if (!clientId || !hotelId || !operaConfirmationNo || !guestName || !arrivalDate || !departureDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const arr = new Date(arrivalDate);
    const dep = new Date(departureDate);
    if (isNaN(arr.getTime()) || isNaN(dep.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    if (dep <= arr) {
      return res.status(400).json({ message: 'Departure must be after arrival' });
    }

    // Auto-assign rep from client
    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) }, select: { id: true, salesRepId: true, companyName: true } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const nights = calcNights(arr, dep);
    const rooms = parseInt(roomsCount) || 1;
    const rate = ratePerNight ? parseFloat(ratePerNight) : null;
    const computedTotal = totalAmount ? parseFloat(totalAmount) : (rate ? rate * nights * rooms : null);

    // Soft uniqueness: warn if Opera confirmation no already exists
    const existing = await prisma.booking.findFirst({
      where: { operaConfirmationNo, NOT: { status: 'cancelled' } },
      select: { id: true, clientId: true },
    });

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const fileName = req.file ? req.file.originalname : null;

    const booking = await prisma.booking.create({
      data: {
        clientId: parseInt(clientId),
        hotelId: parseInt(hotelId),
        contractId: contractId ? parseInt(contractId) : null,
        assignedRepId: client.salesRepId,
        bookedById: req.user.id,
        operaConfirmationNo: String(operaConfirmationNo).trim(),
        guestName: String(guestName).trim(),
        reservationMadeBy: reservationMadeBy || null,
        arrivalDate: arr,
        departureDate: dep,
        nights,
        roomsCount: rooms,
        adultsCount: parseInt(adultsCount) || 1,
        childrenCount: parseInt(childrenCount) || 0,
        roomType: roomType || null,
        ratePerNight: rate,
        ratePackage: ratePackage || null,
        totalAmount: computedTotal,
        currency: currency || 'SAR',
        vatPercent: vatPercent !== undefined ? parseFloat(vatPercent) : 15,
        municipalityFeePercent: municipalityFeePercent !== undefined ? parseFloat(municipalityFeePercent) : 2.5,
        paymentMethod: paymentMethod || null,
        source: source || 'outlook',
        status: status || 'confirmed',
        confirmationLetterUrl: fileUrl,
        confirmationLetterName: fileName,
        notes: notes || null,
      },
      include: bookingInclude,
    });

    // Activity log
    await prisma.activity.create({
      data: {
        clientId: booking.clientId,
        userId: req.user.id,
        type: 'booking_created',
        description: `حجز جديد ${booking.operaConfirmationNo} - ${booking.guestName} - ${nights} ليلة`,
      },
    });

    // Notify the assigned rep (unless they created it themselves)
    if (booking.assignedRepId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: booking.assignedRepId,
          type: 'booking_confirmed',
          title: 'حجز جديد لعميلك',
          message: `حجز ${booking.operaConfirmationNo} للضيف ${booking.guestName} في ${booking.hotel.name} من ${arr.toLocaleDateString('ar-EG')}`,
          link: `/bookings/${booking.id}`,
        },
      });
    }

    res.status(201).json({ booking, duplicate: existing ? { id: existing.id, sameClient: existing.clientId === booking.clientId } : null });
  } catch (err) {
    console.error('createBooking error:', err);
    res.status(500).json({ message: err.message });
  }
};

// PUT /bookings/:id
const updateBooking = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const {
      operaConfirmationNo, guestName, reservationMadeBy,
      arrivalDate, departureDate,
      roomsCount, adultsCount, childrenCount, roomType,
      ratePerNight, ratePackage, totalAmount, currency,
      vatPercent, municipalityFeePercent,
      paymentMethod, source, hotelId, contractId, notes,
    } = req.body;

    const arr = arrivalDate ? new Date(arrivalDate) : existing.arrivalDate;
    const dep = departureDate ? new Date(departureDate) : existing.departureDate;
    if (dep <= arr) return res.status(400).json({ message: 'Departure must be after arrival' });

    const nights = calcNights(arr, dep);
    const rooms = roomsCount !== undefined ? parseInt(roomsCount) : existing.roomsCount;
    const rate = ratePerNight !== undefined ? (ratePerNight === null || ratePerNight === '' ? null : parseFloat(ratePerNight)) : existing.ratePerNight;

    const data = {
      ...(operaConfirmationNo !== undefined && { operaConfirmationNo: String(operaConfirmationNo).trim() }),
      ...(guestName !== undefined && { guestName: String(guestName).trim() }),
      ...(reservationMadeBy !== undefined && { reservationMadeBy: reservationMadeBy || null }),
      arrivalDate: arr,
      departureDate: dep,
      nights,
      roomsCount: rooms,
      ...(adultsCount !== undefined && { adultsCount: parseInt(adultsCount) || 1 }),
      ...(childrenCount !== undefined && { childrenCount: parseInt(childrenCount) || 0 }),
      ...(roomType !== undefined && { roomType: roomType || null }),
      ratePerNight: rate,
      ...(ratePackage !== undefined && { ratePackage: ratePackage || null }),
      ...(totalAmount !== undefined ? { totalAmount: totalAmount === null || totalAmount === '' ? null : parseFloat(totalAmount) } : (rate ? { totalAmount: rate * nights * rooms } : {})),
      ...(currency && { currency }),
      ...(vatPercent !== undefined && { vatPercent: parseFloat(vatPercent) }),
      ...(municipalityFeePercent !== undefined && { municipalityFeePercent: parseFloat(municipalityFeePercent) }),
      ...(paymentMethod !== undefined && { paymentMethod: paymentMethod || null }),
      ...(source !== undefined && { source: source || 'outlook' }),
      ...(hotelId !== undefined && { hotelId: parseInt(hotelId) }),
      ...(contractId !== undefined && { contractId: contractId ? parseInt(contractId) : null }),
      ...(notes !== undefined && { notes: notes || null }),
    };

    // Handle new file upload (replace existing)
    if (req.file) {
      if (existing.confirmationLetterUrl) {
        const oldPath = path.join(__dirname, '../..', existing.confirmationLetterUrl);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (_) {}
        }
      }
      data.confirmationLetterUrl = `/uploads/${req.file.filename}`;
      data.confirmationLetterName = req.file.originalname;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data,
      include: bookingInclude,
    });

    res.json(booking);
  } catch (err) {
    console.error('updateBooking error:', err);
    res.status(500).json({ message: err.message });
  }
};

// PUT /bookings/:id/status
const updateStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, cancellationReason } = req.body;
    const allowedStatuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const data = { status };
    if (status === 'cancelled') {
      data.cancelledAt = new Date();
      data.cancelledById = req.user.id;
      data.cancellationReason = cancellationReason || null;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data,
      include: bookingInclude,
    });

    // Notify rep on cancellation
    if (status === 'cancelled' && booking.assignedRepId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: booking.assignedRepId,
          type: 'booking_cancelled',
          title: 'حجز تم إلغاؤه',
          message: `حجز ${booking.operaConfirmationNo} للضيف ${booking.guestName} تم إلغاؤه`,
          link: `/bookings/${booking.id}`,
        },
      });
    }

    await prisma.activity.create({
      data: {
        clientId: booking.clientId,
        userId: req.user.id,
        type: 'booking_status_changed',
        description: `حجز ${booking.operaConfirmationNo}: ${existing.status} → ${status}`,
      },
    });

    res.json(booking);
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /bookings/:id (hard delete - admins only)
const deleteBooking = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    if (existing.confirmationLetterUrl) {
      const filePath = path.join(__dirname, '../..', existing.confirmationLetterUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }
    await prisma.booking.delete({ where: { id } });
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /bookings/extract - parse confirmation letter and return suggested fields
const extractFromLetter = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const filePath = req.file.path;
  try {
    const result = await extractBooking(filePath);

    // Try to find a matching client by extracted company name
    let suggestedClient = null;
    if (result.fields.companyName) {
      const q = result.fields.companyName.trim();
      const matches = await prisma.client.findMany({
        where: {
          OR: [
            { companyName: { contains: q } },
            { companyNameEn: { contains: q } },
          ],
        },
        select: { id: true, companyName: true, companyNameEn: true, salesRepId: true },
        take: 5,
      });
      if (matches.length > 0) suggestedClient = matches[0];
    }

    // Don't keep the temp file - it'll be re-uploaded with the booking save
    try { fs.unlinkSync(filePath); } catch (_) {}

    res.json({ ...result, suggestedClient });
  } catch (err) {
    console.error('extractFromLetter error:', err);
    try { fs.unlinkSync(filePath); } catch (_) {}
    res.status(500).json({ message: err.message || 'Failed to extract data from file' });
  }
};

module.exports = {
  getBookings,
  getBooking,
  getClientBookings,
  createBooking,
  updateBooking,
  updateStatus,
  deleteBooking,
  extractFromLetter,
};
