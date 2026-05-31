const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// Now that we use Amiri (full OpenType tables: init/medi/fina/isol +
// ligatures + kashidas), fontkit can shape Arabic and apply BiDi on its
// own. Forcing rtla + arab on top of that caused fontkit to double-
// process the text and produce visually-reversed words. So we let the
// font do its job and pass no extra features.
const shapeArabic = (text) => (text == null ? '' : String(text));
const shapeForVisual = (text) => (text == null ? '' : String(text));
const isArabic = (text) => ARABIC_RE.test(String(text || ''));
const isPureArabic = (text) => isArabic(text);
const ARABIC_FEATURES = [];
const arabicTextOpts = () => ({});

// Pre-reverse the *word order* of an Arabic run so it reads correctly when
// it lands inside an LTR (English) PDF. PDFKit + fontkit shape each Arabic
// word's glyphs correctly on their own (initial / medial / final), but it
// places multiple words in logical order — which a right-to-left reader
// sees as backwards. Reversing the whitespace-delimited tokens flips
// that, so visually the words read in the original logical order.
//
// Only call this when the *surrounding document direction is LTR* (i.e.
// English quote PDF). For Arabic-context PDFs the whole renderer is
// already RTL-aware and reversing here would double-flip the words.
const reverseArabicForLTR = (text) => {
  const s = String(text ?? '');
  if (!ARABIC_RE.test(s)) return s;
  return s.split(/(\s+)/).reverse().join('');
};

module.exports = {
  shapeArabic,
  shapeForVisual,
  reverseArabicForLTR,
  isArabic,
  isPureArabic,
  ARABIC_FEATURES,
  arabicTextOpts,
};
