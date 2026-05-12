const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const NON_ARABIC_RE = /[!-~]/;

let _reshaper = null;
const getReshaper = () => {
  if (!_reshaper) _reshaper = require('arabic-reshaper');
  return _reshaper;
};

const isArabic = (text) => ARABIC_RE.test(String(text || ''));
const isPureArabic = (text) => {
  const s = String(text || '');
  return ARABIC_RE.test(s) && !NON_ARABIC_RE.test(s);
};

// === Visual-order shaping for PDFKit ========================================
//
// PDFKit renders left-to-right and pdfkit 0.18 + Cairo's Arabic-feature path
// produces tofu boxes whenever a string contains digits or Latin punctuation
// alongside Arabic. The robust workaround is to pre-shape the Arabic into
// presentation forms (arabic-reshaper) and then reverse the character order
// of Arabic runs so an LTR renderer ends up drawing the glyphs in their
// correct right-to-left visual order. Latin/digit runs stay LTR internally
// but their *position* in the line is flipped (run order reversed) so they
// sit on the correct side relative to the Arabic.
//
// Input:  "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 (15%)"
// Output: "(15%) <reshaped+reversed Arabic>"
// When rendered LTR, an Arabic reader scans right\u2192left and reads the Arabic
// first, then the "(15%)", matching the logical sentence.
const ARABIC_CHARS = (s) => ARABIC_CHAR_RE.test(s);

const shapeForVisual = (text) => {
  const raw = String(text == null ? '' : text);
  if (!ARABIC_RE.test(raw)) return raw;

  // Walk the string and split into runs of "Arabic-or-attached-space"
  // vs runs of Latin/digit/punct.
  const runs = [];
  let buf = '';
  let bufKind = null;     // 'ar' | 'ltr' | null
  const flush = () => {
    if (buf !== '') { runs.push({ kind: bufKind, text: buf }); buf = ''; }
  };
  for (const ch of raw) {
    const isAr = ARABIC_CHARS(ch);
    // Spaces glue to whichever run is currently open so we don't fragment.
    if (ch === ' ' && bufKind !== null) {
      buf += ch;
      continue;
    }
    const kind = isAr ? 'ar' : 'ltr';
    if (bufKind === null) { bufKind = kind; buf = ch; continue; }
    if (kind !== bufKind) { flush(); bufKind = kind; buf = ch; continue; }
    buf += ch;
  }
  flush();

  // Reshape + reverse Arabic runs. Leave LTR runs intact.
  const reshaper = getReshaper();
  const processed = runs.map(r => {
    if (r.kind !== 'ar') return r.text;
    const shaped = reshaper.convertArabic(r.text);
    return [...shaped].reverse().join('');
  });
  // Reverse the run order \u2014 when rendered LTR by PDFKit, an RTL reader will
  // scan right-to-left and read the Arabic content in its logical order
  // with the Latin/digit content positioned correctly relative to it.
  return processed.reverse().join('');
};

// `shapeArabic` kept as the legacy no-op so call sites can be migrated
// incrementally if needed. New code should use `shapeForVisual`.
const shapeArabic = (text) => (text == null ? '' : String(text));

// Historical features list \u2014 no longer needed because text is pre-shaped,
// but exported to keep imports stable.
const ARABIC_FEATURES = [];
const arabicTextOpts = () => ({});

module.exports = {
  shapeArabic,
  shapeForVisual,
  isArabic,
  isPureArabic,
  ARABIC_FEATURES,
  arabicTextOpts,
};
