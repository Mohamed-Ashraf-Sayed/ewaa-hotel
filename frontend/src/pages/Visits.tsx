import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Search, MapPin, Users, TrendingUp, Calendar, Filter } from 'lucide-react';
import { visitsApi, usersApi } from '../services/api';
import { Visit } from '../types';
import { format, parseISO, isToday, isTomorrow, isThisWeek, isThisMonth, subDays } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const VISIT_TYPES_AR: Record<string, string> = {
  in_person: 'زيارة شخصية', phone: 'هاتف', online: 'أونلاين', site_visit: 'زيارة الموقع'
};
const VISIT_TYPES_EN: Record<string, string> = {
  in_person: 'In Person', phone: 'Phone', online: 'Online', site_visit: 'Site Visit'
};
const visitEmoji: Record<string, string> = {
  in_person: '🤝', phone: '📞', online: '💻', site_visit: '🏨'
};

export default function Visits() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const VISIT_TYPES = isAr ? VISIT_TYPES_AR : VISIT_TYPES_EN;
  const isManager = hasRole('admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales');

  const [visits, setVisits] = useState<Visit[]>([]);
  const [followUps, setFollowUps] = useState<Visit[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'last7' | 'last30' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    Promise.all([visitsApi.getAll(), visitsApi.getFollowUps(14)])
      .then(([v, f]) => { setVisits(v.data); setFollowUps(f.data); })
      .finally(() => setLoading(false));
    if (isManager) {
      usersApi.getAll().then(r => setReps(
        r.data
          .filter((u: any) => u.isActive && ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role))
          .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ar'))
      ));
    }
  }, []);

  const getFollowUpLabel = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return { label: isAr ? 'اليوم' : 'Today', color: 'text-red-600 bg-red-50' };
    if (isTomorrow(d)) return { label: isAr ? 'غداً' : 'Tomorrow', color: 'text-orange-600 bg-orange-50' };
    return { label: format(d, 'dd MMM', { locale }), color: 'text-brand-600 bg-brand-50' };
  };

  // Apply filters
  const filtered = useMemo(() => {
    return visits.filter(v => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matches = (v.client?.companyName || '').toLowerCase().includes(q)
          || (v.client?.contactPerson || '').toLowerCase().includes(q)
          || (v.purpose || '').toLowerCase().includes(q)
          || (v.outcome || '').toLowerCase().includes(q)
          || (v.salesRep?.name || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Rep
      if (repFilter && v.salesRep?.id?.toString() !== repFilter) return false;
      // Type
      if (typeFilter && v.visitType !== typeFilter) return false;
      // Date
      if (dateFilter !== 'all' && v.visitDate) {
        const d = parseISO(v.visitDate);
        if (dateFilter === 'today' && !isToday(d)) return false;
        if (dateFilter === 'week' && !isThisWeek(d)) return false;
        if (dateFilter === 'month' && !isThisMonth(d)) return false;
        if (dateFilter === 'last7' && d < subDays(new Date(), 7)) return false;
        if (dateFilter === 'last30' && d < subDays(new Date(), 30)) return false;
        if (dateFilter === 'custom') {
          if (customFrom && d < new Date(customFrom)) return false;
          if (customTo && d > new Date(customTo + 'T23:59:59')) return false;
        }
      }
      return true;
    });
  }, [visits, search, repFilter, typeFilter, dateFilter, customFrom, customTo]);

  // Stats from filtered
  const stats = useMemo(() => {
    const total = filtered.length;
    const today = filtered.filter(v => v.visitDate && isToday(parseISO(v.visitDate))).length;
    const thisWeek = filtered.filter(v => v.visitDate && isThisWeek(parseISO(v.visitDate))).length;
    const withFollowUp = filtered.filter(v => v.nextFollowUp).length;
    return { total, today, thisWeek, withFollowUp };
  }, [filtered]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, Visit[]> = {};
    filtered.forEach(v => {
      const date = v.visitDate ? format(parseISO(v.visitDate), 'yyyy-MM-dd') : 'unknown';
      if (!groups[date]) groups[date] = [];
      groups[date].push(v);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const hasActiveFilters = search || repFilter || typeFilter || dateFilter !== 'all';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'الزيارات' : 'Visits'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">
            {isAr ? `عرض ${filtered.length} من ${visits.length} زيارة` : `Showing ${filtered.length} of ${visits.length} visits`}
          </p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary text-sm ${hasActiveFilters ? 'border-brand-500 text-brand-700' : ''}`}>
          <Filter className="w-4 h-4" />
          {isAr ? 'الفلاتر' : 'Filters'}
          {hasActiveFilters && <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">●</span>}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: isAr ? 'الإجمالي' : 'Total', value: stats.total, icon: MapPin, color: 'bg-brand-50 text-brand-700' },
          { label: isAr ? 'اليوم' : 'Today', value: stats.today, icon: Calendar, color: 'bg-emerald-50 text-emerald-700' },
          { label: isAr ? 'هذا الأسبوع' : 'This Week', value: stats.thisWeek, icon: TrendingUp, color: 'bg-amber-50 text-amber-700' },
          { label: isAr ? 'بمتابعة' : 'With Follow-up', value: stats.withFollowUp, icon: Clock, color: 'bg-violet-50 text-violet-700' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className={isAr ? 'text-right' : 'text-left'}>
                <p className="text-xl font-bold text-brand-900">{s.value}</p>
                <p className="text-[11px] text-brand-400">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-4 space-y-3">
          {/* Row 1: Search + Date filter */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-brand-400`} />
              <input className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
                placeholder={isAr ? 'بحث: شركة، مندوب، غرض، نتيجة...' : 'Search: company, rep, purpose, outcome...'}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-44" value={dateFilter} onChange={e => setDateFilter(e.target.value as any)}>
              <option value="all">{isAr ? 'كل التواريخ' : 'All dates'}</option>
              <option value="today">{isAr ? 'اليوم' : 'Today'}</option>
              <option value="week">{isAr ? 'هذا الأسبوع' : 'This week'}</option>
              <option value="month">{isAr ? 'هذا الشهر' : 'This month'}</option>
              <option value="last7">{isAr ? 'آخر 7 أيام' : 'Last 7 days'}</option>
              <option value="last30">{isAr ? 'آخر 30 يوم' : 'Last 30 days'}</option>
              <option value="custom">{isAr ? 'تاريخ مخصص' : 'Custom range'}</option>
            </select>
          </div>

          {/* Row 2: Custom date range */}
          {dateFilter === 'custom' && (
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-brand-500 font-semibold whitespace-nowrap">{isAr ? 'من:' : 'From:'}</label>
                <input type="date" className="input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-brand-500 font-semibold whitespace-nowrap">{isAr ? 'إلى:' : 'To:'}</label>
                <input type="date" className="input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Row 3: Sales rep + Type */}
          <div className="flex flex-wrap gap-3">
            {isManager && (
              <select className="input w-52" value={repFilter} onChange={e => setRepFilter(e.target.value)}>
                <option value="">{isAr ? '👥 كل المناديب' : '👥 All Reps'}</option>
                {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <select className="input w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">{isAr ? 'كل أنواع الزيارات' : 'All types'}</option>
              {Object.entries(VISIT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{visitEmoji[k] || ''} {v}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button className="btn-secondary text-xs"
                onClick={() => { setSearch(''); setRepFilter(''); setTypeFilter(''); setDateFilter('all'); setCustomFrom(''); setCustomTo(''); }}>
                {isAr ? '✕ مسح الفلاتر' : '✕ Clear filters'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Follow-ups (only when no filters) */}
      {!hasActiveFilters && followUps.length > 0 && (
        <div className={`card p-4 ${isAr ? 'border-r-4' : 'border-l-4'} border-brand-500`}>
          <div className={`flex items-center gap-2 mb-3 ${isAr ? 'justify-end' : 'justify-start'}`}>
            {!isAr && <Clock className="w-4 h-4 text-brand-500" />}
            <h2 className="font-bold text-brand-900 text-sm">{isAr ? 'المتابعات القادمة' : 'Upcoming Follow-ups'} ({followUps.length})</h2>
            {isAr && <Clock className="w-4 h-4 text-brand-500" />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {followUps.slice(0, 6).map(v => {
              const fl = v.nextFollowUp ? getFollowUpLabel(v.nextFollowUp) : null;
              return (
                <Link key={v.id} to={`/clients/${v.client?.id}`}
                  className={`flex items-center justify-between p-2.5 rounded-lg bg-brand-50/50 hover:bg-brand-50 transition-colors ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={isAr ? 'text-right' : 'text-left'}>
                    <p className="font-medium text-xs text-brand-900">{v.client?.companyName}</p>
                    <p className="text-[11px] text-brand-400">{v.client?.contactPerson}</p>
                  </div>
                  {fl && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fl.color}`}>{fl.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Visits List Grouped by Date */}
      {loading ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <MapPin className="w-12 h-12 text-brand-200 mx-auto mb-3" />
          <p className="text-brand-400 font-semibold">{isAr ? 'لا توجد زيارات' : 'No visits found'}</p>
          {hasActiveFilters && (
            <button className="btn-secondary text-xs mt-4"
              onClick={() => { setSearch(''); setRepFilter(''); setTypeFilter(''); setDateFilter('all'); }}>
              {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dateVisits]) => (
            <div key={date}>
              <div className={`flex items-center gap-2 mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className="h-px flex-1 bg-brand-100" />
                <span className="text-xs font-bold text-brand-500 px-3 py-1 bg-brand-50 rounded-full">
                  {date === 'unknown' ? (isAr ? 'بدون تاريخ' : 'No date') : (
                    <>
                      {format(parseISO(date), 'EEEE, dd MMM yyyy', { locale })}
                      <span className="mr-2 text-brand-400">({dateVisits.length})</span>
                    </>
                  )}
                </span>
                <div className="h-px flex-1 bg-brand-100" />
              </div>
              <div className="space-y-2">
                {dateVisits.map(v => (
                  <div key={v.id} className="card p-3.5 hover:border-brand-200 transition-colors">
                    <div className={`flex items-start justify-between gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-start gap-3 flex-1 min-w-0 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <div className="text-2xl mt-0.5 flex-shrink-0">{visitEmoji[v.visitType || 'in_person'] || '🗺️'}</div>
                        <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : 'text-left'}`}>
                          <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                            <Link to={`/clients/${v.client?.id}`} className="font-bold text-brand-900 hover:text-brand-600 text-sm">
                              {v.client?.companyName}
                            </Link>
                            <span className="text-[10px] bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full font-semibold">
                              {VISIT_TYPES[v.visitType || ''] || v.visitType}
                            </span>
                          </div>
                          {v.purpose && <p className="text-xs text-brand-700 mt-1">{v.purpose}</p>}
                          {v.outcome && (
                            <p className="text-xs text-brand-500 mt-1">
                              <span className="font-semibold text-brand-700">{isAr ? 'النتيجة: ' : 'Outcome: '}</span>{v.outcome}
                            </p>
                          )}
                          <div className={`flex items-center gap-2 mt-2 text-[11px] text-brand-400 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {v.salesRep?.name}
                            </span>
                            <span>·</span>
                            <span>{v.client?.contactPerson}</span>
                            {v.visitDate && (<>
                              <span>·</span>
                              <span>{format(parseISO(v.visitDate), 'hh:mm a', { locale })}</span>
                            </>)}
                          </div>
                        </div>
                      </div>
                      {v.nextFollowUp && (
                        <div className={`flex-shrink-0 ${isAr ? 'text-left' : 'text-right'}`}>
                          <p className="text-[10px] text-brand-400 mb-1">{isAr ? 'متابعة' : 'Follow-up'}</p>
                          {(() => {
                            const fl = getFollowUpLabel(v.nextFollowUp);
                            return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${fl.color}`}>{fl.label}</span>;
                          })()}
                        </div>
                      )}
                    </div>
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
