import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import { usePortalAuth } from '../../contexts/PortalAuthContext';

export default function PortalLogin() {
  const { requestOtp, verifyOtp } = usePortalAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('من فضلك أدخل البريد الإلكتروني'); return; }
    setBusy(true);
    try {
      const r = await requestOtp(email.trim());
      setInfo(r.message || 'تم إرسال كود التحقق إلى بريدك');
      setStep('code');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'فشل إرسال الكود');
    } finally {
      setBusy(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 6) { setError('الكود من 6 أرقام'); return; }
    setBusy(true);
    try {
      await verifyOtp(email.trim(), code.trim());
      navigate('/portal');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'الكود غير صحيح');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-14 mx-auto object-contain mb-3" />
          <h1 className="text-white text-xl font-bold">بوابة العملاء</h1>
          <p className="text-brand-300 text-sm mt-1">سجّل دخول بريدك المسجل لطلب حجوزاتك</p>
        </div>

        <div className="bg-white rounded-2xl shadow-elevated p-6">
          {step === 'email' ? (
            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-700 mb-1.5 block">البريد الإلكتروني المسجل</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-brand-400" />
                  <input
                    type="email"
                    autoFocus
                    className="input pr-9"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="contact@yourcompany.com"
                  />
                </div>
                <p className="text-[11px] text-brand-400 mt-1.5">هنبعتلك كود تحقق من 6 أرقام صالح لمدة 10 دقائق</p>
              </div>

              {error && <div className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">{error}</div>}

              <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {busy ? 'جاري الإرسال...' : 'إرسال كود التحقق'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCode} className="space-y-4">
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); setInfo(''); }}
                className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> تغيير البريد
              </button>

              {info && <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg">{info}</div>}

              {email === 'demo@portal.test' && (
                <div className="text-xs bg-purple-50 border border-purple-200 text-purple-800 px-3 py-2 rounded-lg">
                  <span className="font-bold">حساب تجريبي:</span> استخدم الكود <code className="font-mono bg-white px-1.5 py-0.5 rounded mx-1">000000</code> لتجاوز رسالة البريد.
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-brand-700 mb-1.5 block">كود التحقق</label>
                <div className="relative">
                  <KeyRound className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-brand-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    className="input pr-9 text-center tracking-[6px] font-mono text-lg"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                  />
                </div>
                <p className="text-[11px] text-brand-400 mt-1.5">تم الإرسال إلى: <b>{email}</b></p>
              </div>

              {error && <div className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">{error}</div>}

              <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {busy ? 'جاري التحقق...' : 'تحقق ودخول'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setError(''); setBusy(true);
                  try {
                    const r = await requestOtp(email);
                    setInfo(r.message || 'تم إعادة إرسال الكود');
                  } catch (err: any) {
                    setError(err?.response?.data?.message || 'فشل إعادة الإرسال');
                  } finally { setBusy(false); }
                }}
                className="w-full text-xs text-brand-500 hover:text-brand-700"
                disabled={busy}
              >
                إعادة إرسال الكود
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-brand-300 text-xs mt-4">
          لست مسجلاً لدينا؟ يُرجى التواصل مع مندوب المبيعات لتفعيل حسابكم.
        </p>
      </div>
    </div>
  );
}
