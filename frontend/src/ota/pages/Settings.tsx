import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Mail, Download, Trash2, Database } from 'lucide-react';
import {
  fetchImapSettings, saveImapSettings, testImapConnection, runPollNow, resetData, fetchProgress,
  ImapAccount, TestResult, RunNowResult, PollProgress,
} from '../api';

const EMPTY: ImapAccount = {
  name: 'Booking Inbox',
  host: '',
  port: 993,
  secure: true,
  user: 'booking@ewaahotels.com',
  password: '',
  mailbox: 'INBOX',
  pollIntervalSec: 120,
  enabled: true,
};

export default function Settings() {
  const [form, setForm] = useState<ImapAccount>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [runResult, setRunResult] = useState<RunNowResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<PollProgress | null>(null);

  useEffect(() => {
    fetchImapSettings()
      .then((acc) => { if (acc) setForm(acc); })
      .finally(() => setLoading(false));
    fetchProgress().then(setProgress).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.id) return;
    const interval = setInterval(() => {
      fetchProgress().then(setProgress).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [form.id]);

  const update = (k: keyof ImapAccount, v: any) => setForm({ ...form, [k]: v });

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const saved = await saveImapSettings(form);
      setForm(saved);
      setSaveMessage('تم الحفظ بنجاح ✓');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: any) {
      setSaveMessage('خطأ: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testImapConnection(form);
    setTestResult(result);
    setTesting(false);
  };

  const handleRunNow = async () => {
    setPolling(true);
    setRunResult(null);
    const result = await runPollNow();
    setRunResult(result);
    setPolling(false);
    fetchImapSettings().then((acc) => { if (acc) setForm(acc); });
    fetchProgress().then(setProgress).catch(() => {});
  };

  const handleReset = async () => {
    if (!confirm('هتمسح كل الإيميلات والحجوزات اللي اتجابت. الإعدادات هتفضل. متأكد؟')) return;
    await resetData();
    setRunResult(null);
    fetchImapSettings().then((acc) => { if (acc) setForm(acc); });
    alert('تم مسح البيانات. اضغط "اجلب الإيميلات الآن" لإعادة المعالجة.');
  };

  if (loading) return <div className="p-6 text-slate-500">جاري التحميل...</div>;

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Mail className="w-6 h-6" /> إعدادات صندوق الحجوزات
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          ربط <span className="font-mono">{form.user || 'booking@ewaahotels.com'}</span> عشان النظام يقرأ الإيميلات تلقائيًا
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <Section title="معلومات الـ IMAP">
          <Row>
            <Field label="اسم الحساب (للعرض)">
              <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} />
            </Field>
            <Field label="البريد (Username)" hint="عادة هو الإيميل نفسه">
              <input type="email" value={form.user} onChange={(e) => update('user', e.target.value)} className={inputClass + ' font-mono'} dir="ltr" />
            </Field>
          </Row>
          <Row>
            <Field label="IMAP Host" hint="مثلاً imap.gmail.com أو imap.ewaahotels.com">
              <input type="text" value={form.host} onChange={(e) => update('host', e.target.value)} className={inputClass + ' font-mono'} dir="ltr" placeholder="imap.example.com" />
            </Field>
            <Field label="Port">
              <input type="number" value={form.port} onChange={(e) => update('port', parseInt(e.target.value, 10))} className={inputClass + ' font-mono'} dir="ltr" />
            </Field>
          </Row>
          <Row>
            <Field label="كلمة المرور" hint="App Password لو Gmail">
              <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} className={inputClass + ' font-mono'} dir="ltr" placeholder={form.id ? 'اتركها فاضية لو مش هتغيرها' : ''} />
            </Field>
            <Field label="المجلد (Mailbox)">
              <input type="text" value={form.mailbox} onChange={(e) => update('mailbox', e.target.value)} className={inputClass + ' font-mono'} dir="ltr" />
            </Field>
          </Row>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="secure" checked={form.secure} onChange={(e) => update('secure', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="secure" className="text-sm text-slate-700">استخدام SSL/TLS (موصى به للبورت 993)</label>
          </div>
        </Section>

        <Section title="إعدادات الجلب">
          <Row>
            <Field label="كل كام ثانية يفحص الإيميلات؟" hint="120 = كل دقيقتين">
              <input type="number" value={form.pollIntervalSec} onChange={(e) => update('pollIntervalSec', parseInt(e.target.value, 10))} className={inputClass + ' font-mono'} dir="ltr" />
            </Field>
            <Field label="الحالة">
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-slate-700">{form.enabled ? 'مُفعّل' : 'معطّل'}</span>
              </label>
            </Field>
          </Row>
        </Section>

        {testResult && (
          <div className={`rounded p-3 text-sm ${testResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
            {testResult.ok ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold">الاتصال نجح! ✓</div>
                  <div className="text-xs mt-1">المجلد: {testResult.mailbox} · إجمالي رسائل: {testResult.messages?.toLocaleString('ar-EG')} · غير مقروءة: {testResult.unseen?.toLocaleString('ar-EG')}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold">الاتصال فشل</div>
                  <div className="text-xs mt-1 font-mono" dir="ltr">{testResult.error}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {saveMessage && (
          <div className={`rounded p-3 text-sm ${saveMessage.includes('خطأ') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {saveMessage}
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
          <button onClick={handleTest} disabled={testing || !form.host || !form.user} className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-50 inline-flex items-center gap-2">
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            اختبار الاتصال
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            حفظ الإعدادات
          </button>
          {form.id && (
            <>
              <button onClick={handleRunNow} disabled={polling} className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50 inline-flex items-center gap-2 mr-auto">
                {polling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                اجلب الإيميلات الآن
              </button>
              <button onClick={handleReset} className="px-3 py-2 text-sm font-medium bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded inline-flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                مسح وإعادة معالجة
              </button>
            </>
          )}
        </div>
      </div>

      {runResult && (
        <div className={`rounded p-4 text-sm ${runResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {runResult.ok ? (
            <>
              <div className="font-bold">تم الجلب ✓</div>
              <div className="text-xs mt-1">عُولج {runResult.processed} إيميل جديد ({runResult.errors} خطأ)</div>
              {runResult.results && runResult.results.length > 0 && (
                <ul className="mt-2 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {runResult.results.map((r) => (
                    <li key={r.uid} className="font-mono">UID {r.uid} · {r.status} · {r.subject}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="font-bold">فشل الجلب</div>
              <div className="text-xs mt-1 font-mono" dir="ltr">{runResult.error}</div>
            </>
          )}
        </div>
      )}

      {progress && progress.hasAccount && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Database className="w-4 h-4" /> تقدم تحميل الإيميلات
            </div>
            <div className="text-xs text-slate-500">يتحدث كل 5 ثوان</div>
          </div>

          {progress.serverMessageCount > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>
                  {progress.backfillDone ? '✓ تم تحميل كل التاريخ' : 'جاري الـ backfill...'}
                </span>
                <span className="font-mono">
                  {progress.totalFetched.toLocaleString('ar-EG')} / {progress.serverMessageCount.toLocaleString('ar-EG')}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progress.backfillDone ? 'bg-emerald-500' : 'bg-blue-500'} transition-all`}
                  style={{ width: `${Math.min(100, (progress.totalFetched / progress.serverMessageCount) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <Stat label="إجمالي الإيميلات" value={progress.emailCount} color="slate" />
            <Stat label="تم تحليلها" value={progress.stats.parsed} color="emerald" />
            <Stat label="ضوضاء (مُتجاهَلة)" value={progress.stats.skipped} color="slate" />
            <Stat label="فشلت" value={progress.stats.failed} color="rose" />
            <Stat label="حجوزات" value={progress.reservations} color="blue" />
          </div>

          <div className="text-xs text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
            <div>آخر UID مجلوب: <span className="font-mono" dir="ltr">{progress.lastSeenUid ?? '—'}</span></div>
            <div>أقدم UID مجلوب: <span className="font-mono" dir="ltr">{progress.oldestSeenUid ?? '—'}</span></div>
            <div>آخر فحص: {progress.lastPollAt ? new Date(progress.lastPollAt).toLocaleString('ar-EG') : '—'}</div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-4 text-xs text-blue-900 space-y-2">
        <div className="font-bold">كيف يعمل الـ Worker:</div>
        <ul className="list-disc list-inside space-y-1">
          <li>بمجرد ما تحفظ الإعدادات، الـ worker بيشتغل تلقائيًا كل {form.pollIntervalSec} ثانية.</li>
          <li>أول مرة بيشتغل بيجيب آخر 50 إيميل من الـ INBOX، بعدها بيجيب الجديد فقط.</li>
          <li>كل إيميل بيتخزن raw + بيتـ parse بالـ regex (Booking.com) أو Gemini AI (الباقي).</li>
          <li>تقدر تضغط "اجلب الإيميلات الآن" عشان تشغل الجلب يدوي بدل ما تستنى الـ interval.</li>
        </ul>
      </div>
    </div>
  );
}

const inputClass = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

function Stat({ label, value, color }: { label: string; value: number; color: 'slate' | 'emerald' | 'rose' | 'blue' }) {
  const colors = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`${colors[color]} rounded p-2`}>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString('ar-EG')}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-700 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </label>
  );
}
