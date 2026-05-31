const { parseBookingComEmail } = require('./booking-com');
const { parseBookLogicEmail } = require('./booklogic');
const { parseExpediaEmail } = require('./expedia');
const { parseAgodaEmail } = require('./agoda');
const { extractWithAi } = require('./ai-fallback');
const { shouldSkip } = require('./noise-filter');

const SOURCE_RULES = [
  { pattern: /@booklogic\.net$/i, source: 'channel_manager', channel: 'BookLogic' },
  { pattern: /noreply@booking\.com$/i, source: 'Booking.com' },
  { pattern: /@booking\.com$/i, source: 'Booking.com' },
  { pattern: /@expedia\.com$/i, source: 'Expedia' },
  { pattern: /@expediapartnercentral\.com$/i, source: 'Expedia' },
  { pattern: /@hotels\.com$/i, source: 'Expedia' },
  { pattern: /@agoda\.com$/i, source: 'Agoda' },
  { pattern: /@transactional\.agoda\.global$/i, source: 'Agoda' },
  { pattern: /@ycs\.agoda\.com$/i, source: 'Agoda' },
  { pattern: /@almosafer\.com$/i, source: 'Almosafer' },
  { pattern: /@tajawal\.com$/i, source: 'Almosafer' },
  { pattern: /@trip\.com$/i, source: 'Trip.com' },
  { pattern: /@ctrip\.com$/i, source: 'Trip.com' },
  { pattern: /@hotelbeds\.com$/i, source: 'HotelBeds' },
  { pattern: /@webbeds\.com$/i, source: 'WebBeds' },
  { pattern: /@airbnb\.com$/i, source: 'Airbnb' },
  { pattern: /@goibibo\.com$/i, source: 'Goibibo' },
  { pattern: /@makemytrip\.com$/i, source: 'MakeMyTrip' },
  { pattern: /@cleartrip\.com$/i, source: 'Cleartrip' },
  { pattern: /@yatra\.com$/i, source: 'Yatra' },
  { pattern: /@hyperguest\.com$/i, source: 'HyperGuest' },
  { pattern: /@siteminder\.com$/i, source: 'channel_manager', channel: 'SiteMinder' },
  { pattern: /@cloudbeds\.com$/i, source: 'channel_manager', channel: 'Cloudbeds' },
  { pattern: /@staah\.com$/i, source: 'channel_manager', channel: 'STAAH' },
  { pattern: /@d-edge\.com$/i, source: 'channel_manager', channel: 'D-EDGE' },
];

const SUBJECT_FALLBACK = [
  { pattern: /booking\.com/i, source: 'Booking.com' },
  { pattern: /expedia|hotels\.com/i, source: 'Expedia' },
  { pattern: /agoda/i, source: 'Agoda' },
  { pattern: /almosafer|المسافر/i, source: 'Almosafer' },
  { pattern: /trip\.com/i, source: 'Trip.com' },
];

function detectSource(fromAddr = '', subject = '') {
  for (const rule of SOURCE_RULES) {
    if (rule.pattern.test(fromAddr)) {
      return { source: rule.source, channel: rule.channel || null };
    }
  }
  for (const rule of SUBJECT_FALLBACK) {
    if (rule.pattern.test(subject)) {
      return { source: rule.source, channel: null };
    }
  }
  return { source: 'Other', channel: null };
}

async function parseEmail({ subject, fromAddr, text, html }) {
  const skipCheck = shouldSkip({ fromAddr, subject });
  if (skipCheck.skip) {
    return { parsed: { skipped: true, skipReason: skipCheck.reason }, method: `skip:${skipCheck.reason}` };
  }

  const detected = detectSource(fromAddr, subject);
  let parsed = null;
  let method = null;

  if (detected.channel === 'BookLogic') {
    parsed = parseBookLogicEmail({ subject, text, html });
    method = 'regex:booklogic';
  } else if (detected.source === 'Booking.com') {
    parsed = parseBookingComEmail({ subject, text, html });
    method = 'regex:booking.com';
  } else if (detected.source === 'Expedia') {
    parsed = parseExpediaEmail({ subject, text, html });
    method = 'regex:expedia';
  } else if (detected.source === 'Agoda') {
    parsed = parseAgodaEmail({ subject, text, html });
    method = 'regex:agoda';
  }

  if (!parsed || parsed.needsAiFallback) {
    try {
      const ai = await extractWithAi({ subject, fromAddr, text, html, hintSource: detected.source, hintChannel: detected.channel });
      if (parsed) {
        parsed = { ...parsed, ...ai, source: parsed.source || ai.source, via: parsed.via || detected.channel };
        method += '+ai';
      } else {
        parsed = ai;
        method = `ai:${(detected.source || 'other').toLowerCase()}`;
      }
    } catch (e) {
      if (!parsed) {
        return { parsed: null, method: `ai_error:${e.message.slice(0, 80)}` };
      }
      method += ' (ai failed)';
    }
  }

  return { parsed, method };
}

module.exports = { parseEmail, detectSource, SOURCE_RULES };
