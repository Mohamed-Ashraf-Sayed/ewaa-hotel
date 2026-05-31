const SKIP_SENDER_PATTERNS = [
  /^operation@etg\.sa$/i,
  /@guest\.booking\.com$/i,
  /@support\.booking\.com$/i,
  /mea\.marketing@webbeds/i,
  /@ewaahotels\.com$/i,
];

const SKIP_SUBJECT_PATTERNS = [
  /^Read:/i,
  /^مقروءة:/,
  /request is subject to availability/i,
  /Changes in the extranet/i,
  /تنبيه التوافر/,
  /تغيير الاسعار/,
  /تلقينا هذه الرسالة/,
  /We received this message/i,
  /guest message(s)?\s+(is|are)?\s*waiting/i,
  /\d+\s+guest message(s)?/i,
  /رسالة واحدة من الضيوف/,
  /\d+\s*رسائل من الضيوف/,
  /رسائل من الضيوف بانتظارك/,
  /^ET\s*Global:?\s*Confirmed Booking/i,
  /Reservations with today's or tomorrow's arrival/i,
  /يخضع طلب .* إلى التوافر/,
  /Regarding cancellation for/i,
];

function shouldSkip({ fromAddr = '', subject = '' }) {
  if (SKIP_SENDER_PATTERNS.some((re) => re.test(fromAddr))) {
    return { skip: true, reason: 'sender_blacklist' };
  }
  if (SKIP_SUBJECT_PATTERNS.some((re) => re.test(subject))) {
    return { skip: true, reason: 'subject_pattern' };
  }
  return { skip: false };
}

module.exports = { shouldSkip };
