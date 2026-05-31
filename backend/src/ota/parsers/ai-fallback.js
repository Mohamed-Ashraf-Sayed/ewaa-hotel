const { extractJson } = require('../lib/gemini');

const KNOWN_PLATFORMS = [
  'Booking.com', 'Expedia', 'Hotels.com', 'Agoda', 'Airbnb',
  'Almosafer', 'Tajawal', 'Trip.com', 'Ctrip', 'HotelBeds', 'WebBeds',
  'HyperGuest', 'Goibibo', 'MakeMyTrip', 'Cleartrip', 'Yatra',
];

const SCHEMA_PROMPT = `You extract structured booking data from hotel reservation emails. The email may be from any OTA (online travel agency) or a channel manager that consolidates multiple OTAs.

Known OTA platforms include: ${KNOWN_PLATFORMS.join(', ')}.
Known channel managers: BookLogic, SiteMinder, Cloudbeds, STAAH, D-EDGE.

Return ONLY a JSON object with this exact shape (use null for missing fields):
{
  "source": "<the OTA the booking originated from, e.g. Booking.com, Expedia, Agoda, Almosafer, Manual, Other>",
  "via": "<channel manager name if applicable, e.g. BookLogic, or null>",
  "action": "new" | "cancellation" | "modification" | null,
  "external_booking_id": string | null,
  "booking_com_hotel_id": string | null,
  "agoda_hotel_id": string | null,
  "expedia_hotel_id": string | null,
  "almosafer_hotel_id": string | null,
  "hotel_name": string | null,
  "guest_name": string | null,
  "check_in": "YYYY-MM-DD" | null,
  "check_out": "YYYY-MM-DD" | null,
  "nights": number | null,
  "rooms": number | null,
  "room_type": string | null,
  "total_price": number | null,
  "currency": string | null,
  "booking_date": "YYYY-MM-DD" | null,
  "confidence": number
}

Rules:
- "source" should be the OTA where the guest booked, even if email came through a channel manager. e.g. subject "New Reservation - MC-1-123 - Expedia" → source="Expedia", via="BookLogic".
- "action": new = first booking; cancellation = guest cancelled; modification = dates/room/price changed.
- hotel_name: the exact hotel/property name, not the chain.
- If the email is not actually a booking (e.g. price update, availability alert, marketing), set action=null and confidence<0.3.
- Output JSON only. No markdown, no comments.`;

async function extractWithAi({ subject, fromAddr, text, html, hintSource, hintChannel }) {
  const bodyForAi = (text || '').slice(0, 8000);
  const htmlSnippet = html ? `\n--- HTML SNIPPET ---\n${html.slice(0, 1500)}` : '';

  const hints = [];
  if (hintSource && hintSource !== 'Other') hints.push(`Likely source: ${hintSource}`);
  if (hintChannel) hints.push(`Came via channel manager: ${hintChannel}`);
  const hintBlock = hints.length ? `\n--- HINTS FROM SENDER DETECTION ---\n${hints.join('\n')}\n` : '';

  const prompt = `${SCHEMA_PROMPT}
${hintBlock}
--- EMAIL FROM ---
${fromAddr}

--- SUBJECT ---
${subject}

--- TEXT BODY ---
${bodyForAi}${htmlSnippet}`;

  return extractJson(prompt);
}

module.exports = { extractWithAi };
