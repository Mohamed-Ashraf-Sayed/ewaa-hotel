const { prisma } = require('../lib/db');
const { parseEmail } = require('../parsers');
const { findOrCreateHotel } = require('./hotels');

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function mapAction(action) {
  if (!action) return null;
  const a = action.toLowerCase();
  if (a === 'new' || a === 'confirmed' || a === 'confirmation') return 'new';
  if (a === 'cancellation' || a === 'cancelled' || a === 'canceled') return 'cancellation';
  if (a === 'modification' || a === 'modified' || a === 'updated') return 'modification';
  return null;
}

async function ingestEmail(emailRow) {
  try {
    const { parsed, method } = await parseEmail({
      subject: emailRow.subject,
      fromAddr: emailRow.fromAddr,
      text: emailRow.rawText,
      html: emailRow.rawHtml,
    });

    if (parsed && parsed.skipped) {
      await prisma.bookingEmail.update({
        where: { id: emailRow.id },
        data: {
          parseStatus: 'skipped',
          parseMethod: method,
          parsedAt: new Date(),
        },
      });
      return { status: 'skipped', reason: parsed.skipReason };
    }

    const eventType = mapAction(parsed.action);
    if (!eventType || !parsed.externalId) {
      await prisma.bookingEmail.update({
        where: { id: emailRow.id },
        data: {
          parseStatus: 'manual_review',
          parseMethod: method,
          parseError: 'missing action or external_booking_id',
          parsedAt: new Date(),
        },
      });
      return { status: 'manual_review', parsed };
    }

    const hotel = await findOrCreateHotel({
      bookingComId: parsed.bookingComHotelId || parsed.booking_com_hotel_id,
      agodaId: parsed.agodaHotelId || parsed.agoda_hotel_id,
      expediaId: parsed.expediaHotelId || parsed.expedia_hotel_id,
      almosaferId: parsed.almosaferHotelId || parsed.almosafer_hotel_id,
      name: parsed.hotelName || parsed.hotel_name,
    });

    const source = parsed.source || 'Other';
    const externalId = String(parsed.externalId || parsed.external_booking_id);

    const updateData = {
      hotelId: hotel ? hotel.id : null,
      guestName: parsed.guestName || parsed.guest_name || undefined,
      checkIn: toDate(parsed.checkIn || parsed.check_in) || undefined,
      checkOut: toDate(parsed.checkOut || parsed.check_out) || undefined,
      nights: parsed.nights || undefined,
      rooms: parsed.rooms || undefined,
      roomType: parsed.roomType || parsed.room_type || undefined,
      totalPrice: parsed.totalPrice || parsed.total_price || undefined,
      currency: parsed.currency || undefined,
      currentStatus: eventType === 'cancellation' ? 'cancelled'
                   : eventType === 'modification' ? 'modified'
                   : 'confirmed',
    };

    const reservation = await prisma.reservation.upsert({
      where: { source_externalId: { source, externalId } },
      update: updateData,
      create: {
        source,
        externalId,
        ...updateData,
      },
    });

    await prisma.bookingEvent.create({
      data: {
        reservationId: reservation.id,
        emailId: emailRow.id,
        hotelId: hotel ? hotel.id : null,
        eventType,
        snapshot: JSON.stringify(parsed),
        occurredAt: emailRow.receivedAt,
      },
    });

    await prisma.bookingEmail.update({
      where: { id: emailRow.id },
      data: {
        parseStatus: 'parsed',
        parseMethod: method,
        parsedAt: new Date(),
      },
    });

    return { status: 'parsed', reservation, parsed };
  } catch (err) {
    await prisma.bookingEmail.update({
      where: { id: emailRow.id },
      data: {
        parseStatus: 'failed',
        parseError: err.message.slice(0, 500),
        parsedAt: new Date(),
      },
    });
    return { status: 'failed', error: err.message };
  }
}

module.exports = { ingestEmail };
