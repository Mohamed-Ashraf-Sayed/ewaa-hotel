function detectAction(subject) {
  const s = subject.toLowerCase();
  if (s.includes('cancel')) return 'cancellation';
  if (s.includes('modif') || s.includes('change') || s.includes('amend')) return 'modification';
  if (s.includes('new booking') || s.includes('booking confirmation') || s.includes('reservation confirmed')) return 'new';
  if (/تم تأكيد|حجز جديد/.test(subject)) return 'new';
  if (/تم إلغاء|إلغاء حجز/.test(subject)) return 'cancellation';
  return null;
}

function extractExternalId(subject, body) {
  let m = body.match(/(?:Booking|Reservation|Agoda)\s*(?:ID|Number|#)[:\s]+([A-Z0-9-]{6,30})/i);
  if (m) return m[1];
  m = subject.match(/[#-]\s*(\d{8,15})\b/);
  if (m) return m[1];
  return null;
}

function extractHotelName(text) {
  const m = text.match(/(?:Hotel|Property)[:\s]+([^\n]{3,120})/i);
  return m ? m[1].trim() : null;
}

function extractGuestName(text) {
  const m = text.match(/(?:Guest|Customer)\s*Name[:\s]+([^\n]{2,80})/i);
  return m ? m[1].trim() : null;
}

function parseAgodaEmail({ subject, text, html }) {
  const body = (text || '') + '\n' + (html || '');

  return {
    source: 'Agoda',
    action: detectAction(subject),
    externalId: extractExternalId(subject, body),
    hotelName: extractHotelName(text || ''),
    guestName: extractGuestName(text || ''),
    confidence: 0.5,
    needsAiFallback: true,
  };
}

module.exports = { parseAgodaEmail };
