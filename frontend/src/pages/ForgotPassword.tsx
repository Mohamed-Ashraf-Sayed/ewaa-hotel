import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { authApi } from '../services/api';

type Step = 'email' | 'code' | 'password' | 'done';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startResendTimer = () => {
    setResendIn(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn(t => {
        if (t <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(email);
      setInfo(data.message || 'تم إرسال كود التحقق');
      setStep('code');
      startResendTimer();
    } catch (err: any) {
      setError(err.response?.data?.message || 'حدث خطأ، حاول مرة أخرى');
    } finally { setLoading(false); }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await authApi.verifyResetCode(email, code);
      setResetToken(data.resetToken);
      setStep('password');
    } catch (err: any) {
      setError(err.response?.data?.message || 'الكود غير صحيح');
    } finally { setLoading(false); }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (newPassword.length < 6) return setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    if (newPassword !== confirmPassword) return setError('كلمتا المرور غير متطابقتين');
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تغيير كلمة المرور');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setError(''); setInfo(''); setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setInfo('تم إرسال كود جديد');
      startResendTimer();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل إرسال الكود');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-16 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-white">Ewaa Hotels CRM</h1>
        </div>

        <div className="bg-white rounded-xl shadow-elevated p-8">
          {step === 'email' && (
            <>
              <h2 className="text-xl font-bold text-brand-900 mb-1 text-right">نسيت كلمة المرور؟</h2>
              <p className="text-sm text-brand-400 mb-6 text-right">
                أدخل بريدك الإلكتروني المسجل وسنرسل لك كود تحقق
              </p>
              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-right">{error}</div>}
              <form onSubmit={submitEmail} className="space-y-5">
                <div>
                  <label className="label">البريد الإلكتروني</label>
                  <div className="relative">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="input pr-10" placeholder="example@ewaahotels.com" required dir="ltr" autoFocus />
                    <Mail className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                  {loading ? 'جاري الإرسال...' : 'إرسال كود التحقق'}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <h2 className="text-xl font-bold text-brand-900 mb-1 text-right">أدخل كود التحقق</h2>
              <p className="text-sm text-brand-400 mb-6 text-right">
                أرسلنا كوداً مكوناً من 6 أرقام إلى <span className="font-semibold text-brand-700" dir="ltr">{email}</span>
              </p>
              {info && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm text-right">{info}</div>}
              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-right">{error}</div>}
              <form onSubmit={submitCode} className="space-y-5">
                <div>
                  <label className="label">كود التحقق</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      className="input pr-10 tracking-[0.5em] text-center font-mono text-lg"
                      placeholder="000000" required dir="ltr" autoFocus
                    />
                    <KeyRound className="absolute right-3 top-3.5 w-4 h-4 text-brand-400" />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading || code.length !== 6}>
                  {loading ? 'جاري التحقق...' : 'تأكيد الكود'}
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }} className="text-brand-500 hover:text-brand-700 underline">
                    تغيير البريد
                  </button>
                  <button type="button" onClick={resend} disabled={resendIn > 0 || loading} className="text-brand-500 hover:text-brand-700 underline disabled:opacity-50 disabled:no-underline">
                    {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn}s` : 'إعادة إرسال الكود'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 'password' && (
            <>
              <h2 className="text-xl font-bold text-brand-900 mb-1 text-right">كلمة مرور جديدة</h2>
              <p className="text-sm text-brand-400 mb-6 text-right">اختر كلمة مرور قوية (6 أحرف على الأقل)</p>
              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-right">{error}</div>}
              <form onSubmit={submitPassword} className="space-y-5">
                <div>
                  <label className="label">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="input pr-10 pl-10" placeholder="••••••••" required dir="ltr" autoFocus
                    />
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute left-3 top-3 text-brand-400 hover:text-brand-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">تأكيد كلمة المرور</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="input pr-10" placeholder="••••••••" required dir="ltr"
                    />
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                  {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-brand-900 mb-2">تم تغيير كلمة المرور</h2>
              <p className="text-sm text-brand-500 mb-6">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center py-3">
                العودة لتسجيل الدخول
              </button>
            </div>
          )}

          {step !== 'done' && (
            <div className="mt-6 pt-5 border-t border-brand-100 text-center">
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-700">
                <ArrowLeft className="w-4 h-4" /> العودة لتسجيل الدخول
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
