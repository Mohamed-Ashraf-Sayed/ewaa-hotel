import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تسجيل الدخول. يرجى التحقق من بيانات الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e: string, p: string) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen bg-brand-900 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-bl from-brand-800 via-brand-900 to-brand-900" />
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative z-10 text-center px-12">
          <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-28 mx-auto mb-8 object-contain drop-shadow-2xl" />
          <div className="pl-16 pr-0">
            <h1 className="text-4xl font-bold text-white mb-3">Ewaa Hotels</h1>
            <div className="w-16 h-0.5 bg-accent-400 mx-auto mb-4" />
            <p className="text-brand-400 text-lg">نظام إدارة المبيعات والعقود</p>
          </div>
        </div>
        <div className="absolute bottom-6 left-0 right-0 text-center px-6">
          <p className="text-[11px] text-white leading-relaxed">
            الجهة المنفذة
            <span className="mx-1.5 text-white/70">•</span>
            إدارة تقنية المعلومات بمجموعة فنادق إيواء
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-16 mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-white">Ewaa Hotels</h1>
          </div>

          <div className="bg-white rounded-xl shadow-elevated p-8">
            <h2 className="text-xl font-bold text-brand-900 mb-1 text-right">تسجيل الدخول</h2>
            <p className="text-sm text-brand-400 mb-6 text-right">أدخل بياناتك للوصول إلى لوحة التحكم</p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-right">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">البريد الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input pr-10" placeholder="example@ewaahotels.com" required dir="ltr"
                    maxLength={150} title="يجب أن يحتوي على @"
                  />
                  <Mail className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                </div>
              </div>
              <div>
                <label className="label">كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10 pl-10" placeholder="••••••••" required dir="ltr"
                  />
                  <Lock className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute left-3 top-3 text-brand-400 hover:text-brand-600 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="text-left">
                <Link to="/forgot-password" className="text-xs text-brand-500 hover:text-brand-700 hover:underline">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-3 text-base" disabled={loading}>
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>

            {/* Quick Login Demo */}
            <div className="mt-6 pt-5 border-t border-brand-100">
              <p className="text-xs text-brand-400 mb-3 font-semibold text-right">دخول سريع للتجربة</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'مدير النظام (IT)', e: 'admin@hotelcrm.com', p: 'admin123' },
                  { label: 'مدير عام', e: 'gm@hotelcrm.com', p: 'gm123' },
                  { label: 'نائب المدير العام', e: 'vgm@hotelcrm.com', p: 'vgm123' },
                  { label: 'مدير مبيعات', e: 'dir1@hotelcrm.com', p: 'dir123' },
                  { label: 'مساعد مدير مبيعات', e: 'asst1@hotelcrm.com', p: 'asst123' },
                  { label: 'مندوب مبيعات', e: 'omar@hotelcrm.com', p: 'sales123' },
                  { label: 'مسئول العقود', e: 'contracts@hotelcrm.com', p: 'contracts123' },
                  { label: 'قسم الحجوزات', e: 'reservations@hotelcrm.com', p: 'res123' },
                  { label: 'مدير الائتمان', e: 'credit@hotelcrm.com', p: 'credit123' },
                  { label: 'موظف ائتمان', e: 'creditofficer@hotelcrm.com', p: 'credit123' },
                ].map(({ label, e, p }) => (
                  <button key={e} onClick={() => quickLogin(e, p)}
                    className="text-xs p-2.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 hover:text-brand-800 text-right transition-all duration-200 border border-brand-100 hover:border-brand-200 font-medium">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="lg:hidden text-center text-[11px] text-white/50 mt-6 leading-relaxed">
            الجهة المنفذة • إدارة تقنية المعلومات بمجموعة فنادق إيواء
          </p>
        </div>
      </div>
    </div>
  );
}
