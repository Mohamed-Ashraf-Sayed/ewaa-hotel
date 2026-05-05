import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';

export default function ChangePassword() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.mustChangePassword;

  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    if (currentPassword === newPassword) {
      setError('كلمة المرور الجديدة لا يمكن أن تكون نفس القديمة');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      await refreshUser();
      setSuccess('تم تحديث كلمة المرور بنجاح');
      setTimeout(() => navigate('/', { replace: true }), 800);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تحديث كلمة المرور، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-16 mx-auto mb-4 object-contain" />
        </div>
        <div className="bg-white rounded-xl shadow-elevated p-8">
          <div className="flex items-center gap-3 mb-2 text-right justify-end">
            <div>
              <h2 className="text-xl font-bold text-brand-900">
                {forced ? 'تغيير كلمة المرور — مطلوب' : 'تغيير كلمة المرور'}
              </h2>
              <p className="text-xs text-brand-400 mt-1">
                {forced
                  ? 'لتأمين حسابك، يجب اختيار كلمة مرور جديدة قبل المتابعة'
                  : 'يمكنك تحديث كلمة المرور الخاصة بك من هنا'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="my-5 h-px bg-brand-100" />

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-right">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-right">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">كلمة المرور الحالية</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'} value={currentPassword}
                  onChange={e => setCurrent(e.target.value)}
                  className="input pr-10 pl-10" placeholder="••••••••" required dir="ltr" autoFocus
                />
                <Lock className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                <button type="button" onClick={() => setShowCurrent(p => !p)}
                  className="absolute left-3 top-3 text-brand-400 hover:text-brand-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNew(e.target.value)}
                  className="input pr-10 pl-10" placeholder="••••••••" required dir="ltr" minLength={6}
                />
                <Lock className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
                <button type="button" onClick={() => setShowNew(p => !p)}
                  className="absolute left-3 top-3 text-brand-400 hover:text-brand-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-brand-400 mt-1 text-right">٦ أحرف على الأقل</p>
            </div>
            <div>
              <label className="label">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirm(e.target.value)}
                  className="input pr-10" placeholder="••••••••" required dir="ltr" minLength={6}
                />
                <Lock className="absolute right-3 top-3 w-4 h-4 text-brand-400" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-3 text-base mt-2" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
            </button>
            {forced && (
              <button type="button" onClick={logout}
                className="block w-full text-center text-xs text-brand-500 hover:text-brand-700 hover:underline mt-2">
                تسجيل الخروج
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
