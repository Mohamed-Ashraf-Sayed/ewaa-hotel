function detectAction(subject) {
  const s = subject.toLowerCase();
  if (s.includes('cancellation')) return 'cancellation';
  if (s.includes('modification') || s.includes('modified')) return 'modification';
  if (s.includes('new reservation') || s.includes('new booking')) return 'new';
  return null;
}

function extractSource(subject) {
  const m = subject.match(/-\s*([A-Za-z. ]+?)\s*$/);
  if (!m) return null;
  const src = m[1].trim();
  if (/booking/i.test(src)) return 'Booking.com';
  if (/expedia|hotels\.com/i.test(src)) return 'Expedia';
  if (/agoda/i.test(src)) return 'Agoda';
  if (/airbnb/i.test(src)) return 'Airbnb';
  if (/almosafer|tajawal/i.test(src)) return 'Almosafer';
  if (/trip\.com|ctrip/i.test(src)) return 'Trip.com';
  return src;
}

function extractExternalId(subject) {
  const m = subject.match(/-\s*(MC-\d+-\d+)\s*-/);
  if (m) return m[1];
  return null;
}

function cleanLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function extractHotelName(text) {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);

  const m1 = text.match(/transmit\s+the\s+following[^\n]*reservation[^\n]*\n+(?:[^\n]*\n+)?\s*([^\n]{3,150})/i);
  if (m1) {
    const candidate = cleanLine(m1[1]);
    if (isHotelLine(candidate)) return stripHotelSuffix(candidate);
  }

  for (let i = 0; i < lines.length; i++) {
    if (/^Traveller$/i.test(lines[i]) || /^Guest\s+(Name|Info)/i.test(lines[i])) {
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (isHotelLine(lines[j])) return stripHotelSuffix(lines[j]);
      }
    }
  }

  for (const line of lines) {
    if (/\([A-Z]{2,4}\s+\d{2,8}\)/.test(line) && line.length > 10) {
      return stripHotelSuffix(line);
    }
  }

  return null;
}

function isHotelLine(line) {
  if (!line || line.length < 5 || line.length > 150) return false;
  if (/^(New Reservation|Reservation|Cancellation|Modification|Traveller|Guest|Name|Email|Phone|Address|Contact|Rooms|Check-in|Check-out|Payment|Total|Rate|Extra|We are pleased|Please contact|external reference|Number of|Date|Price|Hotel Collect)/i.test(line)) return false;
  if (/^[\d.,\s]+$/.test(line)) return false;
  if (/@/.test(line) && !/\s/.test(line.split('@')[1] || '')) return false;
  if (/^https?:/i.test(line)) return false;
  return true;
}

function stripHotelSuffix(name) {
  return name.replace(/,?\s*[A-Z][a-zA-Z\s]+\s*\([A-Z]{2,4}\s+\d{2,8}\)\s*$/, '').trim();
}

function extractGuestName(text) {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/^Traveller$/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        if (/^Name$/i.test(lines[j]) && lines[j + 1]) return cleanLine(lines[j + 1]);
      }
    }
  }
  return null;
}

function extractDate(text, label) {
  const lines = text.split(/\r?\n/).map(cleanLine);
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^${label}$`, 'i').test(lines[i])) {
      const next = lines[i + 1];
      if (!next) continue;
      const m = next.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        const [, dd, mm, yyyy] = m;
        const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
        if (!isNaN(d.getTime())) return d;
      }
      const m2 = next.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m2) {
        const d = new Date(m2[0]);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
}

function extractNights(text) {
  const lines = text.split(/\r?\n/).map(cleanLine);
  for (let i = 0; i < lines.length; i++) {
    if (/^Number\s+of\s+Nights$/i.test(lines[i])) {
      const n = parseInt(lines[i + 1], 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function extractPrice(text) {
  const lines = text.split(/\r?\n/).map(cleanLine);
  let lastTotal = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^Total$/i.test(lines[i]) || /^Amount$/i.test(lines[i])) {
      const next = lines[i + 1];
      if (!next) continue;
      const m = next.match(/([\d,]+\.?\d*)\s*([A-Z]{3})/);
      if (m) {
        lastTotal = {
          totalPrice: parseFloat(m[1].replace(/,/g, '')),
          currency: m[2],
        };
      }
    }
  }
  return lastTotal;
}

function parseBookLogicEmail({ subject, text, html }) {
  const action = detectAction(subject);
  const source = extractSource(subject);
  const externalId = extractExternalId(subject);
  const hotelName = extractHotelName(text || '');
  const guestName = extractGuestName(text || '');
  const checkIn = extractDate(text || '', 'Check-in');
  const checkOut = extractDate(text || '', 'Check-out');
  const nights = extractNights(text || '');
  const price = extractPrice(text || '');

  return {
    source: source || 'Other',
    via: 'BookLogic',
    action,
    externalId,
    hotelName,
    guestName,
    checkIn,
    checkOut,
    nights,
    ...(price || {}),
    confidence: action && externalId && hotelName ? 0.85 : 0.5,
    needsAiFallback: !hotelName,
  };
}

module.exports = { parseBookLogicEmail };
