const validator = require('validator');

// === Sanitization helpers ===
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  // Trim and escape HTML to prevent XSS
  return validator.escape(str.trim());
};

// Sanitize all string fields in body (except specified raw fields)
const sanitizeBody = (rawFields = []) => (req, res, next) => {
  const sanitizeObj = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
      if (rawFields.includes(key)) continue;
      const val = obj[key];
      if (typeof val === 'string') {
        obj[key] = sanitizeString(val);
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        sanitizeObj(val);
      }
    }
  };
  if (req.body) sanitizeObj(req.body);
  next();
};

// === Validators ===
const isValidEmail = (s) => typeof s === 'string' && validator.isEmail(s);
const isValidPhone = (s) => typeof s === 'string' && /^[+\d\s\-()]{6,20}$/.test(s);
const isCleanName = (s) => typeof s === 'string' && s.length >= 2 && s.length <= 200 && !/[<>{}[\]\\]/.test(s);
const isCleanText = (s, maxLen = 1000) => typeof s === 'string' && s.length <= maxLen && !/[<>]/.test(s);
const isPositiveNumber = (n) => !isNaN(n) && Number(n) > 0;
const isNonNegativeNumber = (n) => !isNaN(n) && Number(n) >= 0;

// Generic field validator factory
const validateFields = (rules) => (req, res, next) => {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const value = req.body[field];

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${rule.label || field} مطلوب` });
      continue;
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Type-specific checks
    if (rule.type === 'email' && !isValidEmail(value)) {
      errors.push({ field, message: `${rule.label || field}: يجب أن يكون بريد إلكتروني صحيح يحتوي على @` });
    }
    if (rule.type === 'phone' && !isValidPhone(value)) {
      errors.push({ field, message: `${rule.label || field}: رقم هاتف غير صحيح (أرقام فقط)` });
    }
    if (rule.type === 'name' && !isCleanName(value)) {
      errors.push({ field, message: `${rule.label || field}: لا يجب أن يحتوي على رموز خاصة (< > { } [ ] \\)` });
    }
    if (rule.type === 'text' && !isCleanText(value, rule.maxLen)) {
      errors.push({ field, message: `${rule.label || field}: نص غير صالح أو طويل جداً` });
    }
    if (rule.type === 'positive' && !isPositiveNumber(value)) {
      errors.push({ field, message: `${rule.label || field}: يجب أن يكون رقم موجب` });
    }
    if (rule.type === 'nonNegative' && !isNonNegativeNumber(value)) {
      errors.push({ field, message: `${rule.label || field}: يجب أن يكون رقم 0 أو أكثر` });
    }
    if (rule.minLength && String(value).length < rule.minLength) {
      errors.push({ field, message: `${rule.label || field}: يجب أن يكون ${rule.minLength} أحرف على الأقل` });
    }
    if (rule.maxLength && String(value).length > rule.maxLength) {
      errors.push({ field, message: `${rule.label || field}: يجب ألا يتجاوز ${rule.maxLength} حرف` });
    }
  }
  if (errors.length > 0) {
    return res.status(400).json({ message: errors[0].message, errors });
  }
  next();
};

module.exports = {
  sanitizeBody,
  sanitizeString,
  validateFields,
  isValidEmail,
  isValidPhone,
  isCleanName,
};
