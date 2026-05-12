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

module.exports = {
  shapeArabic,
  shapeForVisual,
  isArabic,
  isPureArabic,
  ARABIC_FEATURES,
  arabicTextOpts,
};
