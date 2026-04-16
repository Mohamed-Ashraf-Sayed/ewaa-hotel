import { useState, useEffect, useRef } from 'react';
import { Menu, LogOut, Bell, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, emailApi, remindersApi } from '../services/api';
import Modal from './Modal';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

interface Props { onMenuClick: () => void }

export default function Header({ onMenuClick }: Props) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSmtp, setShowSmtp] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ smtpHost: '', smtpPort: '587', smtpEmail: '', smtpPassword: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  const loadNotifs = () => {
    notificationsApi.getAll().then(r => {
      setNotifs(r.data.notifications);
      setUnread(r.data.unreadCount);
    }).catch(() => {});
  };

  useEffect(() => {
    loadNotifs();
    // Also generate notifications on load
    Promise.all([notificationsApi.generate(), remindersApi.check()]).then(() => loadNotifs()).catch(() => {});
    const interval = setInterval(loadNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAllRead = () => {
    notificationsApi.markAllRead().then(() => { setUnread(0); setNotifs(n => n.map(x => ({ ...x, isRead: true }))); });
  };

  const handleNotifClick = (n: Notification) => {
    if (!n.isRead) notificationsApi.markRead(n.id);
    setShowNotifs(false);
    if (n.link) navigate(n.link);
    loadNotifs();
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const roleKey = user?.role as any;
  const roleLabel = t(`role_${roleKey}` as any);

  const typeIcon: Record<string, string> = {
    contract_expiring: '⏰', target_missed: '📉', pending_approval: '📋',
    client_inactive: '😴', task_assigned: '📌', general: '🔔',
  };

  const timeAgo = (d: string) => {
    const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins} د`;
    if (mins < 1440) return `${Math.round(mins / 60)} س`;
    return `${Math.round(mins / 1440)} ي`;
  };

  return (
    <header className="h-14 bg-white border-b border-brand-100 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-all duration-200"
        >
          <span className="text-sm">{lang === 'ar' ? '🇬🇧' : '🇸🇦'}</span>
          <span>{lang === 'ar' ? 'EN' : 'عر'}</span>
        </button>

        <div className="h-6 w-px bg-brand-100" />

        {/* Notifications Bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-lg hover:bg-brand-50 text-brand-400 hover:text-brand-700 transition-all relative"
          >
            <Bell className="w-4.5 h-4.5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-elevated border border-brand-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-brand-100">
                <button onClick={handleMarkAllRead} className="text-xs text-brand-500 hover:text-brand-700 font-semibold">
                  {lang === 'ar' ? 'قراءة الكل' : 'Mark all read'}
                </button>
                <h3 className="font-bold text-brand-900 text-sm">{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-center text-brand-400 text-sm py-8">{lang === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</p>
                ) : (
                  notifs.slice(0, 20).map(n => (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      className={`w-full text-right p-3 flex items-start gap-2.5 flex-row-reverse hover:bg-brand-50/50 transition-colors border-b border-brand-50 ${!n.isRead ? 'bg-brand-50/30' : ''}`}>
                      <span className="text-base mt-0.5 flex-shrink-0">{typeIcon[n.type] || '🔔'}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs leading-relaxed ${!n.isRead ? 'text-brand-900 font-semibold' : 'text-brand-600'}`}>{n.message}</p>
                        <p className="text-[10px] text-brand-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0 mt-1.5" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-brand-100" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-white font-bold text-xs">
            {user?.name?.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-brand-800 leading-tight">{user?.name}</p>
            <p className="text-[11px] text-brand-400">{roleLabel}</p>
          </div>
        </div>

        <button onClick={() => {
            emailApi.getSmtpSettings().then(r => {
              setSmtpForm({ smtpHost: r.data.smtpHost, smtpPort: r.data.smtpPort?.toString() || '587', smtpEmail: r.data.smtpEmail, smtpPassword: '' });
              setSmtpMsg('');
              setShowSmtp(true);
            });
          }}
          className="p-2 rounded-lg hover:bg-brand-50 text-brand-400 hover:text-brand-700 transition-all"
          title={lang === 'ar' ? 'إعدادات البريد' : 'Email Settings'}>
          <Settings className="w-4 h-4" />
        </button>

        <button onClick={handleLogout}
          className="mr-1 p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 text-brand-400"
          title={t('logout')}>
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-brand-50 transition-all duration-200 text-brand-500">
        <Menu className="w-5 h-5" />
      </button>

      {/* SMTP Settings Modal */}
      <Modal open={showSmtp} onClose={() => setShowSmtp(false)} title={lang === 'ar' ? 'إعدادات البريد الإلكتروني' : 'Email Settings'}>
        <div className="space-y-4">
          <div className={`p-3 rounded-lg bg-brand-50 text-xs text-brand-600 ${lang === 'ar' ? 'text-right' : ''}`}>
            {lang === 'ar' ? 'أدخل بيانات SMTP لإرسال الإيميلات من حسابك. للـ Gmail استخدم App Password.' : 'Enter SMTP credentials to send emails from your account.'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{lang === 'ar' ? 'سيرفر SMTP' : 'SMTP Host'}</label>
              <input className="input" placeholder="smtp.gmail.com" value={smtpForm.smtpHost}
                onChange={e => setSmtpForm(p => ({ ...p, smtpHost: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className="label">{lang === 'ar' ? 'المنفذ' : 'Port'}</label>
              <input className="input" type="number" placeholder="587" value={smtpForm.smtpPort}
                onChange={e => setSmtpForm(p => ({ ...p, smtpPort: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div>
            <label className="label">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
            <input className="input" type="email" placeholder="you@company.com" value={smtpForm.smtpEmail}
              onChange={e => setSmtpForm(p => ({ ...p, smtpEmail: e.target.value }))} dir="ltr" />
          </div>
          <div>
            <label className="label">{lang === 'ar' ? 'كلمة المرور / App Password' : 'Password / App Password'}</label>
            <input className="input" type="password" placeholder="••••••••" value={smtpForm.smtpPassword}
              onChange={e => setSmtpForm(p => ({ ...p, smtpPassword: e.target.value }))} dir="ltr" />
          </div>
          {smtpMsg && (
            <div className={`p-3 rounded-lg text-sm ${smtpMsg.includes('success') || smtpMsg.includes('saved') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {smtpMsg}
            </div>
          )}
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={async () => {
              setSmtpMsg(''); setSmtpSaving(true);
              try {
                await emailApi.saveSmtpSettings(smtpForm);
                const res = await emailApi.testSmtp();
                setSmtpMsg(lang === 'ar' ? 'تم الاتصال بنجاح ✓' : 'Connection successful ✓');
              } catch (err: any) {
                setSmtpMsg(err.response?.data?.message || 'Connection failed');
              } finally { setSmtpSaving(false); }
            }} disabled={smtpSaving}>
              {smtpSaving ? '...' : (lang === 'ar' ? 'اختبار الاتصال' : 'Test Connection')}
            </button>
            <button className="btn-primary flex-1 justify-center" onClick={async () => {
              setSmtpSaving(true);
              try {
                await emailApi.saveSmtpSettings(smtpForm);
                setSmtpMsg(lang === 'ar' ? 'تم الحفظ بنجاح ✓ — saved' : 'Settings saved ✓');
              } catch { setSmtpMsg('Error saving'); }
              finally { setSmtpSaving(false); }
            }} disabled={smtpSaving}>
              {lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
            </button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
