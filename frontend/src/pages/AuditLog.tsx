import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { History, RefreshCw, Search } from 'lucide-react';
import { auditApi, usersApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface AuditEntry {
  id: number;
  action: string;
  createdAt: string;
  user: { id: number; name: string; role: string };
}

interface UserLite { id: number; name: string; role: string; isActive: boolean }

const ROLE_LABEL_AR: Record<string, string> = {
  admin: 'مدير النظام', general_manager: 'مدير عام', vice_gm: 'نائب', systems_info: 'نظم معلومات',
  sales_director: 'مدير مبيعات', assistant_sales: 'مساعد مدير', sales_rep: 'مندوب',
  credit_manager: 'مدير ائتمان', credit_officer: 'موظف ائتمان',
  contract_officer: 'مسؤول عقود', reservations: 'حجوزات',
};

export default function AuditLog() {
  const { hasRole } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;

  const isAdminLevel = hasRole('admin', 'general_manager', 'systems_info', 'vice_gm');

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 500 };
      if (userId) params.userId = parseInt(userId);
      if (from)   params.from = from;
      if (to)     params.to = to;
      if (search.trim()) params.search = search.trim();
      const r = await auditApi.getAll(params);
      setEntries(r.data as AuditEntry[]);
    } catch (err) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminLevel) return;
    usersApi.getAll().then(r => setUsers(r.data as UserLite[])).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLevel]);

  if (!isAdminLevel) {
    return <Navigate to="/" replace />;
  }

  const groupByDay = (rows: AuditEntry[]) => {
    const groups: Record<string, AuditEntry[]> = {};
    for (const e of rows) {
      const day = format(parseISO(e.createdAt), 'yyyy-MM-dd');
      (groups[day] = groups[day] || []).push(e);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-900 text-white flex items-center justify-center">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-900">{isAr ? 'سجل النشاط' : 'Audit Log'}</h1>
          <p className="text-xs text-brand-400">
            {isAr ? 'كل الإجراءات اللي اتعملت على السيستم — مين، إيه، إمتى' : 'Every system action — who, what, when'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className={`grid gap-3 md:grid-cols-4 ${isAr ? 'text-right' : ''}`}>
          <div>
            <label className="label">{isAr ? 'الموظف' : 'User'}</label>
            <select className="input" value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">{isAr ? 'كل الموظفين' : 'All users'}</option>
              {users
                .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.name}{!u.isActive ? (isAr ? ' (معطّل)' : ' (inactive)') : ''}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">{isAr ? 'من تاريخ' : 'From'}</label>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">{isAr ? 'إلى تاريخ' : 'To'}</label>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label">{isAr ? 'بحث في الإجراء' : 'Search action'}</label>
            <div className="relative">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-brand-400`} />
              <input className={`input ${isAr ? 'pr-10' : 'pl-10'}`}
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isAr ? 'مثال: عميل، عقد...' : 'e.g. client, contract...'} />
            </div>
          </div>
        </div>
        <div className={`flex gap-2 mt-3 ${isAr ? 'flex-row-reverse' : ''}`}>
          <button className="btn-primary inline-flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          {(userId || from || to || search) && (
            <button className="btn-secondary"
              onClick={() => { setUserId(''); setFrom(''); setTo(''); setSearch(''); setTimeout(load, 0); }}>
              {isAr ? '✕ مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
          <span className="ms-auto text-xs text-brand-500 self-center">
            {isAr ? `${entries.length} إجراء` : `${entries.length} entries`}
          </span>
        </div>
      </div>

      {/* Entries grouped by day */}
      {loading && entries.length === 0 ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : entries.length === 0 ? (
        <div className="card py-12 text-center text-brand-400">
          {isAr ? 'لا توجد إجراءات مطابقة' : 'No matching activity'}
        </div>
      ) : (
        <div className="space-y-4">
          {groupByDay(entries).map(([day, rows]) => (
            <div key={day} className="card overflow-hidden">
              <div className={`px-4 py-2 bg-brand-50 border-b border-brand-100 text-sm font-bold text-brand-700 ${isAr ? 'text-right' : ''}`}>
                {format(parseISO(day), isAr ? 'EEEE، dd MMMM yyyy' : 'EEEE, dd MMM yyyy', { locale })}
                <span className="text-xs text-brand-400 font-normal ms-2">
                  ({rows.length} {isAr ? 'إجراء' : 'entries'})
                </span>
              </div>
              <div className="divide-y divide-brand-50">
                {rows.map(e => (
                  <div key={e.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50/30 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
                    {/* Time */}
                    <div className="text-xs text-brand-400 font-mono w-14 flex-shrink-0">
                      {format(parseISO(e.createdAt), 'HH:mm')}
                    </div>
                    {/* User */}
                    <div className="min-w-0 flex-shrink-0 w-44">
                      <div className="text-sm font-semibold text-brand-900 truncate">{e.user?.name || (isAr ? 'غير معروف' : 'Unknown')}</div>
                      <div className="text-[10px] text-brand-400">{ROLE_LABEL_AR[e.user?.role] || e.user?.role}</div>
                    </div>
                    {/* Action */}
                    <div className="flex-1 text-sm text-brand-700 truncate">{e.action}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
