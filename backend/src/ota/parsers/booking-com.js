const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseEnglishDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (!month) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function detectAction(subject) {
  const s = subject.toLowerCase();
  if (s.includes('cancelled booking') || s.includes('cancellation')) return 'cancellation';
  if (s.includes('modified booking') || s.includes('modification')) return 'modification';
  if (s.includes('new booking')) return 'new';
  return null;
}

function extractBookingId(subject, body) {
  let m = subject.match(/\((\d{8,12})[,\s)]/);
  if (m) return m[1];
  m = body.match(/(?:Cancellation|Confirmation|Modification)\s*[-—–]?\s*(\d{8,12})/i);
  if (m) return m[1];
  m = body.match(/res_id=(\d{8,12})/);
  if (m) return m[1];
  return null;
}

function extractBookingComHotelId(body) {
  const m = body.match(/hotel_id=(\d+)/);
  return m ? m[1] : null;
}

const NAME_SKIP_PATTERNS = [
  /^Booking\.?com\b/i,
  /online hotel reservation/i,
  /^(Booking\s+confirmation|Cancellation|Confirmation|Modification)\b/i,
  /^IATA\/TIDS/i,
  /security precautions/i,
  /admin\.booking\.com/i,
  /^https?:/i,
  /^[^a-zA-Zا-ي]/,
  /confirmation_hotel/i,
  /^(amp|tion);/i,
  /^Kind regards/i,
  /We can only sell/i,
  /database/i,
  /Please contact/i,
];

function isPlausibleHotelName(line) {
  if (!line || line.length < 3 || line.length > 120) return false;
  return !NAME_SKIP_PATTERNS.some((re) => re.test(line));
}

function extractHotelName(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (/^(Booking\s+confirmation|Cancellation|Modification)\b/i.test(lines[i])) {
      for (let j = i - 1; j >= 0; j--) {
        if (isPlausibleHotelName(lines[j])) return lines[j];
      }
    }
  }

  for (const line of lines) {
    if (/You just received/i.test(line)) break;
    if (isPlausibleHotelName(line)) return line;
  }
  return null;
}

function parseBookingComEmail({ subject, text, html }) {
  const body = (text || '') + '\n' + (html || '');

  const action = detectAction(subject);
  const externalId = extractBookingId(subject, body);
  const bookingComHotelId = extractBookingComHotelId(body);
  const hotelName = extractHotelName(text || '');

  const dateMatch = subject.match(/,\s*([A-Za-z]+,\s*\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
  const checkIn = dateMatch ? parseEnglishDate(dateMatch[1]) : null;

  return {
    source: 'Booking.com',
    action,
    externalId,
    bookingComHotelId,
    hotelName: bookingComHotelId ? null : hotelName,
    checkIn,
    confidence: action && externalId && bookingComHotelId ? 0.9 : 0.5,
    needsAiFallback: !action || !externalId || (!bookingComHotelId && !hotelName),
  };
}

module.exports = { parseBookingComEmail };
