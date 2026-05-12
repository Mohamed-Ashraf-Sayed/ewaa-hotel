const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// PDFKit 0.18 + fontkit 2 handle Arabic shaping and BiDi correctly when the
// OpenType features `rtla` + `arab` are passed to text(). Pre-shaping with
// arabic-reshaper + manual run reversal double-shaped against Cairo's own
// contextual rendering and produced character-reversed text — so we leave
// the raw string untouched and rely on the OpenType features instead.
const shapeArabic = (text) => (text == null ? '' : String(text));
// Identity passthrough — kept for any caller that wants a uniform helper.
// New code should pass raw strings to doc.text() with the features set.
const shapeForVisual = (text) => (text == null ? '' : String(text));
const isArabic = (text) => ARABIC_RE.test(String(text || ''));
const isPureArabic = (text) => isArabic(text);
const ARABIC_FEATURES = ['rtla', 'arab'];
const arabicTextOpts = (text) => (isArabic(text) ? { features: ARABIC_FEATURES } : {});

module.exports = {
  shapeArabic,
  shapeForVisual,
  isArabic,
  isPureArabic,
  ARABIC_FEATURES,
  arabicTextOpts,
};
