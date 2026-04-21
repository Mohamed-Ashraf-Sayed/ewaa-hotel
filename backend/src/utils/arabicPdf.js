const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// PDFKit 0.18 + fontkit 2 handle Arabic shaping and BiDi correctly when the
// OpenType features `rtla` + `arab` are passed to text(). Pre-shaping with
// arabic-reshaper/bidi-js gave bad output in viewers (letters appeared
// disconnected), so we leave text raw and rely on features.
const shapeArabic = (text) => (text == null ? '' : String(text));
const isArabic = (text) => ARABIC_RE.test(String(text || ''));
const ARABIC_FEATURES = ['rtla', 'arab'];

module.exports = { shapeArabic, isArabic, ARABIC_FEATURES };
