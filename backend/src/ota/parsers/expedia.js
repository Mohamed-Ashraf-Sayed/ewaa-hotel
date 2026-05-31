function detectAction(subject) {
  const s = subject.toLowerCase();
  if (s.includes('cancellation') || s.includes('cancelled')) return 'cancellation';
  if (s.includes('modified') || s.includes('modification') || s.includes('change')) return 'modification';
  if (s.includes('new booking') || s.includes('booking confirmation') || s.includes('reservation confirmation')) return 'new';
  return null;
}

function extractExternalId(subject, body) {
  let m = body.match(/(?:Reservation|Booking|Itinerary)\s*(?:ID|Number|#)[:\s]+([A-Z0-9-]{6,30})/i);
  if (m) return m[1];
  m = body.match(/\bExpedia\s*ID[:\s]+([A-Z0-9-]{6,30})/i);
  if (m) return m[1];
  m = subject.match(/-\s*([A-Z0-9-]{8,})\s*$/);
  if (m) return m[1];
  return null;
}

function extractDate(text, label) {
  const patterns = [
    new RegExp(`${label}[:\\s]+(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4})`, 'i'),
    new RegExp(`${label}[:\\s]+(\\d{4}-\\d{2}-\\d{2})`, 'i'),
    new RegExp(`Arriving on\\s+(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4})`, 'i'),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extractGuestName(text) {
  const m = text.match(/(?:Guest|Customer)\s*Name[:\s]+([^\n]{2,80})/i);
  return m ? m[1].trim() : null;
}

function extractHotelName(text) {
  const m = text.match(/(?:Hotel|Property)\s*Name[:\s]+([^\n]{3,120})/i);
  return m ? m[1].trim() : null;
}

function parseExpediaEmail({ subject, text, html }) {
  const body = (text || '') + '\n' + (html || '');

  const action = detectAction(subject);
  const externalId = extractExternalId(subject, body);
  const hotelName = extractHotelName(text || '');
  const guestName = extractGuestName(text || '');

  let checkIn = extractDate(text || '', 'Check[\\s-]?in') || extractDate(text || '', 'Arrival');
  if (!checkIn) {
    const m = subject.match(/Arriving on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) checkIn = d;
    }
  }
  const checkOut = extractDate(text || '', 'Check[\\s-]?out') || extractDate(text || '', 'Departure');

  return {
    source: 'Expedia',
    action,
    externalId,
    hotelName,
    guestName,
    checkIn,
    checkOut,
    confidence: action && externalId ? 0.8 : 0.4,
    needsAiFallback: !action || !externalId || !hotelName,
  };
}

module.exports = { parseExpediaEmail };
