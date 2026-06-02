// Minimal audit middleware. Captures every successful mutating request and
// writes a single short Arabic line to the AuditLog table. Skip rules:
//   - non-mutating methods (GET / HEAD / OPTIONS)
//   - failed responses (4xx / 5xx)
//   - unauthenticated requests (no req.user)
// Logging is fire-and-forget so a DB write failure can never break the API
// response.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Action describer. Each entry: { method, pattern (regex on req.path),
// label (Arabic). The first match wins, so put specific routes before
// generic ones (e.g. POST /quotes/:id/approve must come before POST /quotes).
const ACTIONS = [
  // Clients
  { m: 'POST',   p: /^\/clients\/?$/,                       a: 'إضافة عميل جديد' },
  { m: 'POST',   p: /^\/clients\/import\/?$/,               a: 'استيراد عملاء من ملف' },
  { m: 'PUT',    p: /^\/clients\/\d+\/?$/,                  a: 'تعديل بيانات عميل' },
  { m: 'DELETE', p: /^\/clients\/\d+\/?$/,                  a: 'أرشفة عميل' },

  // Visits
  { m: 'POST',   p: /^\/visits\/?$/,                        a: 'تسجيل زيارة جديدة' },
  { m: 'PUT',    p: /^\/visits\/\d+\/?$/,                   a: 'تعديل زيارة' },

  // Contracts
  { m: 'POST',   p: /^\/contracts\/?$/,                     a: 'إنشاء عقد جديد' },
  { m: 'PUT',    p: /^\/contracts\/\d+\/status\/?$/,        a: 'تغيير حالة عقد (اعتماد / رفض)' },
  { m: 'PUT',    p: /^\/contracts\/\d+\/?$/,                a: 'تعديل عقد' },
  { m: 'DELETE', p: /^\/contracts\/\d+\/?$/,                a: 'حذف عقد' },

  // Quotes
  { m: 'POST',   p: /^\/quotes\/\d+\/approve\/?$/,          a: 'اعتماد عرض سعر' },
  { m: 'POST',   p: /^\/quotes\/\d+\/reject\/?$/,           a: 'رفض عرض سعر' },
  { m: 'POST',   p: /^\/pdf\/quote\/?$/,                    a: 'إنشاء عرض سعر' },

  // Payments
  { m: 'POST',   p: /^\/payments\/?$/,                      a: 'تسجيل دفعة' },
  { m: 'PUT',    p: /^\/payments\/\d+\/approve\/?$/,        a: 'اعتماد دفعة' },
  { m: 'PUT',    p: /^\/payments\/\d+\/reject\/?$/,         a: 'رفض دفعة' },
  { m: 'PUT',    p: /^\/payments\/\d+\/?$/,                 a: 'تعديل دفعة' },

  // Bookings
  { m: 'POST',   p: /^\/bookings\/?$/,                      a: 'إنشاء حجز جديد' },
  { m: 'PUT',    p: /^\/bookings\/\d+\/status\/?$/,         a: 'تغيير حالة حجز' },
  { m: 'PUT',    p: /^\/bookings\/\d+\/?$/,                 a: 'تعديل حجز' },
  { m: 'DELETE', p: /^\/bookings\/\d+\/?$/,                 a: 'إلغاء حجز' },

  // Users / Admin
  { m: 'POST',   p: /^\/users\/?$/,                         a: 'إضافة موظف جديد' },
  { m: 'POST',   p: /^\/users\/\d+\/transfer-clients\/?$/,  a: 'نقل عملاء بين المناديب' },
  { m: 'PUT',    p: /^\/users\/\d+\/reset-password\/?$/,    a: 'إعادة تعيين كلمة مرور موظف' },
  { m: 'PUT',    p: /^\/users\/\d+\/commission\/?$/,        a: 'تعديل نسبة عمولة موظف' },
  { m: 'PUT',    p: /^\/users\/\d+\/?$/,                    a: 'تعديل بيانات موظف' },

  // Hotels
  { m: 'POST',   p: /^\/hotels\/?$/,                        a: 'إضافة فندق جديد' },
  { m: 'PUT',    p: /^\/hotels\/\d+\/?$/,                   a: 'تعديل بيانات فندق' },

  // Tasks
  { m: 'POST',   p: /^\/tasks\/?$/,                         a: 'إنشاء مهمة' },
  { m: 'PUT',    p: /^\/tasks\/\d+\/?$/,                    a: 'تعديل / إنهاء مهمة' },
  { m: 'DELETE', p: /^\/tasks\/\d+\/?$/,                    a: 'حذف مهمة' },

  // Targets
  { m: 'POST',   p: /^\/targets\/?$/,                       a: 'تحديث تارجت' },
  { m: 'DELETE', p: /^\/targets\/\d+\/?$/,                  a: 'حذف تارجت' },

  // Promotions
  { m: 'POST',   p: /^\/promotions\/?$/,                    a: 'إنشاء عرض تسويقي' },
  { m: 'PUT',    p: /^\/promotions\/\d+\/?$/,               a: 'تعديل عرض تسويقي' },
  { m: 'DELETE', p: /^\/promotions\/\d+\/?$/,               a: 'حذف عرض تسويقي' },

  // Auth / password
  { m: 'POST',   p: /^\/auth\/login\/?$/,                   a: 'تسجيل دخول' },
  { m: 'POST',   p: /^\/auth\/change-password\/?$/,         a: 'تغيير كلمة المرور' },

  // Messages (broadcast is the noteworthy one — DMs are too noisy)
  { m: 'POST',   p: /^\/messages\/broadcast\/?$/,           a: 'إرسال إعلان للفريق' },
];

// Routes we never want to log — too chatty or already covered elsewhere.
const SKIP = [
  /^\/messages(\/|$)/,            // DM noise
  /^\/notifications\/.+\/read/,   // mark-as-read pings
  /^\/inbox\//,                   // poller-driven
];

const describeAction = (method, path) => {
  if (SKIP.some(re => re.test(path))) return null;
  for (const e of ACTIONS) {
    if (e.m === method && e.p.test(path)) return e.a;
  }
  return null; // unmapped → don't log (keeps the feed clean)
};

const auditMiddleware = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // path on the router is req.path (without /api). On app-level it's
  // req.originalUrl. Strip the /api prefix so the regex table stays simple.
  const path = (req.originalUrl || req.url).replace(/^\/api/, '').split('?')[0];
  const action = describeAction(req.method, path);
  if (!action) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    if (!req.user?.id) return;
    prisma.auditLog.create({
      data: { userId: req.user.id, action },
    }).catch(err => console.error('[audit] log failed:', err.message));
  });

  next();
};

module.exports = { auditMiddleware };
