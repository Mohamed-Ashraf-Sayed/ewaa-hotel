const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const Tesseract = require('tesseract.js');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

// Convert "DD/MM/YY" or "DD/MM/YYYY" to ISO date string YYYY-MM-DD
const parseOperaDate = (s) => {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = (parseInt(yy) >= 70 ? '19' : '20') + yy;
  return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

// Extract raw text from a file (PDF text-layer or OCR)
const extractText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = (result?.text || '').trim();
      if (text.length > 50) return { text, source: 'pdf-text' };
    } catch (err) {
      // fall through to OCR
    }
    // Scanned PDF — use OCR
    const r = await Tesseract.recognize(buffer, 'eng+ara');
    return { text: r.data.text, source: 'pdf-ocr' };
  }
  if (IMAGE_EXTS.includes(ext)) {
    const r = await Tesseract.recognize(filePath, 'eng+ara');
    return { text: r.data.text, source: 'image-ocr' };
  }
  throw new Error(`Unsupported file type: ${ext}`);
};

// Pull a single value via regex; returns trimmed match or null
const grab = (text, re) => {
  const m = text.match(re);
  return m ? m[1].trim() : null;
};

// Apply Opera-letter regex patterns
const parseOperaFields = (text) => {
  const operaConfirmationNo = grab(text, /Confirmation Number\s*:?\s*(\d+)/i);
  const guestName = grab(text, /Guest Name\s*:?\s*([^\n\r]+)/i);
  // Company line may have Arabic on either side of the colon — pick whichever side has letters
  const companyMatch = text.match(/Company\/Travel Agent\s*:?\s*([^\n\r]+)/i);
  let companyName = null;
  if (companyMatch) {
    const raw = companyMatch[1].trim();
    // Strip leading colon if present
    companyName = raw.replace(/^:\s*/, '').replace(/\s*:\s*$/, '').trim() || null;
  }

  // Rate line: looks for "NUMBER PACKAGE per room per night" — handles multi-line layout
  // where "Room\nRate/Night\n: 255.00 Bed and Breakfast per room per night"
  const rateMatch = text.match(/([\d,.]+)\s+([A-Za-z][A-Za-z &]*?)\s+per\s+room\s+per\s+night/i);
  const ratePerNight = rateMatch ? parseFloat(rateMatch[1].replace(/,/g, '')) : null;
  const ratePackage = rateMatch ? rateMatch[2].trim() : null;

  const arrivalDate = parseOperaDate(grab(text, /Arrival Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i));
  const departureDate = parseOperaDate(grab(text, /Departure Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i));

  const nights = parseInt(grab(text, /No\.?\s*of\s*Nights\s*:?\s*(\d+)/i)) || null;
  const roomsCount = parseInt(grab(text, /No\.?\s*of\s*Rooms\s*:?\s*(\d+)/i)) || null;
  const adultsCount = parseInt(grab(text, /No\.?\s*of\s*Adults\s*:?\s*(\d+)/i)) || null;
  const childrenCount = parseInt(grab(text, /No\.?\s*of\s*Children\s*:?\s*(\d+)/i));
  const roomType = grab(text, /Room Type\s*:?\s*([^\n\r]+)/i);
  const paymentMethod = grab(text, /Payment Details\s*:?\s*([^\n\r]+)/i);
  const reservationMadeBy = grab(text, /Reservation made by\s*:?\s*([^\s\n\r]+)/i);

  // Detect VAT/Municipality if present (e.g. "+15 %VAT and 2.5% Municipality Fee.")
  const vatMatch = text.match(/(\d+(?:\.\d+)?)\s*%?\s*VAT/i);
  const muniMatch = text.match(/(\d+(?:\.\d+)?)\s*%?\s*Municipality/i);
  const vatPercent = vatMatch ? parseFloat(vatMatch[1]) : null;
  const municipalityFeePercent = muniMatch ? parseFloat(muniMatch[1]) : null;

  return {
    operaConfirmationNo,
    guestName,
    companyName,
    arrivalDate,
    departureDate,
    nights,
    roomsCount,
    adultsCount,
    childrenCount: isNaN(childrenCount) ? null : childrenCount,
    roomType,
    ratePerNight,
    ratePackage,
    paymentMethod,
    reservationMadeBy,
    vatPercent,
    municipalityFeePercent,
  };
};

const extractBooking = async (filePath) => {
  const { text, source } = await extractText(filePath);
  const fields = parseOperaFields(text);

  // List which fields were successfully extracted
  const extracted = Object.keys(fields).filter(k => fields[k] !== null && fields[k] !== '');

  return {
    extractionSource: source,    // pdf-text | pdf-ocr | image-ocr
    extractedFields: extracted,  // names of fields populated
    fields,
    rawTextLength: text.length,
  };
};

module.exports = { extractBooking, extractText, parseOperaFields, parseOperaDate };
