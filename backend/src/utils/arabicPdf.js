const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
// Anything ASCII-printable that isn't a space \u2014 digits, Latin letters, AND
// punctuation like / - . , : ( ) %. Pure Arabic strings often include the
// regular space (U+0020) so we explicitly keep that out of the "non-Arabic"
// set.
const NON_ARABIC_RE = /[!-~]/;

// PDFKit 0.18 + fontkit 2 handle Arabic shaping and BiDi correctly when the
// OpenType features `rtla` + `arab` are passed to text(). Pre-shaping with
// arabic-reshaper/bidi-js gave bad output in viewers (letters appeared
// disconnected), so we leave text raw and rely on features.
const shapeArabic = (text) => (text == null ? '' : String(text));
const isArabic = (text) => ARABIC_RE.test(String(text || ''));
// Pure Arabic = has Arabic chars and NO Latin letters / ASCII digits. Passing
// the rtla/arab OpenType features to a mixed string ("100,000 \u0631.\u0633") makes
// fontkit try to substitute the Latin digits with Arabic alternates that
// Cairo doesn't have, producing .notdef tofu boxes. Apply features only when
// the whole string is Arabic.
const isPureArabic = (text) => {
  const s = String(text || '');
  return ARABIC_RE.test(s) && !NON_ARABIC_RE.test(s);
};
const ARABIC_FEATURES = ['rtla', 'arab'];
// Convenience: returns the text-options fragment to spread when calling
// doc.text(). Empty object for non-pure-Arabic strings \u2014 Cairo renders Latin
// digits and shapes mixed-content Arabic natively without the features flag.
const arabicTextOpts = (text) => (isPureArabic(text) ? { features: ARABIC_FEATURES } : {});

module.exports = { shapeArabic, isArabic, isPureArabic, ARABIC_FEATURES, arabicTextOpts };
