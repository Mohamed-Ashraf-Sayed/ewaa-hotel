import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Search, MapPin, Users, TrendingUp, Calendar, Phone, Video, Building2, Handshake, X } from 'lucide-react';
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

// Per-type styling — each visit type gets its own icon + accent color so the
// list is scannable at a glance instead of every row looking identical.
const VISIT_META: Record<string, { Icon: any; accent: string; ring: string; chip: string }> = {
  in_person:  { Icon: Handshake, accent: 'bg-emerald-500', ring: 'bg-emerald-50 text-emerald-700', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  phone:      { Icon: Phone,     accent: 'bg-blue-500',    ring: 'bg-blue-50 text-blue-700',       chip: 'border-blue-200 bg-blue-50 text-blue-700' },
  online:     { Icon: Video,     accent: 'bg-violet-500',  ring: 'bg-violet-50 text-violet-700',   chip: 'border-violet-200 bg-violet-50 text-violet-700' },
  site_visit: { Icon: Building2, accent: 'bg-amber-500',   ring: 'bg-amber-50 text-amber-700',     chip: 'border-amber-200 bg-amber-50 text-amber-700' },
};

export default function Visits() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const VISIT_TYPES = isAr ? VISIT_TYPES_AR : VISIT_TYPES_EN;
  const isManager = hasRole('admin', 'general_manager', 'systems_info', 'vice_gm', 'sales_director', 'assistant_sales');

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
    if (isToday(d)) return { label: isAr ? 'اليوم' : 'Today', color: 'text-red-600 bg-red-50 border-red-200' };
    if (isTomorrow(d)) return { label: isAr ? 'غداً' : 'Tomorrow', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    return { label: format(d, 'dd MMM', { locale }), color: 'text-brand-600 bg-brand-50 border-brand-200' };
  };

  // Apply filters
  const filtered = useMemo(() => {
    return visits.filter(v => {
      if (search) {
        const q = search.toLowerCase();
        const matches = (v.client?.companyName || '').toLowerCase().includes(q)
          || (v.client?.contactPerson || '').toLowerCase().includes(q)
          || (v.purpose || '').toLowerCase().includes(q)
          || (v.outcome || '').toLowerCase().includes(q)
          || (v.salesRep?.name || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (repFilter && v.salesRep?.id?.toString() !== repFilter) return false;
      if (typeFilter && v.visitType !== typeFilter) return false;
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

  const hasActiveFilters = !!(search || repFilter || typeFilter || dateFilter !== 'all');

  const DATE_OPTS: { k: typeof dateFilter; ar: string; en: string }[] = [
    { k: 'all',    ar: 'الكل',         en: 'All' },
    { k: 'today',  ar: 'اليوم',         en: 'Today' },
    { k: 'week',   ar: 'هذا الأسبوع',   en: 'This Week' },
    { k: 'month',  ar: 'هذا الشهر',     en: 'This Month' },
    { k: 'last7',  ar: 'آخر 7 أيام',    en: 'Last 7d' },
    { k: 'last30', ar: 'آخر 30 يوم',    en: 'Last 30d' },
    { k: 'custom', ar: 'مخصص',         en: 'Custom' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`flex items-center justify-between flex-wrap gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'الزيارات' : 'Visits'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">
            {isAr ? `${filtered.length} زيارة معروضة من ${visits.length}` : `Showing ${filtered.length} of ${visits.length} visits`}
          </p>
        </div>
      </div>

      {/* Stat cards — colored gradient sidebar, big numeral, icon tile. Each
          card hovers gently to feel interactive even though they're not links. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: isAr ? 'الإجمالي' : 'Total',           value: stats.total,        Icon: MapPin,      gradient: 'from-brand-500 to-brand-600' },
          { label: isAr ? 'اليوم' : 'Today',              value: stats.today,        Icon: Calendar,    gradient: 'from-emerald-500 to-emerald-600' },
          { label: isAr ? 'هذا الأسبوع' : 'This Week',    value: stats.thisWeek,     Icon: TrendingUp,  gradient: 'from-amber-500 to-amber-600' },
          { label: isAr ? 'بمتابعة' : 'With Follow-up',   value: stats.withFollowUp, Icon: Clock,       gradient: 'from-violet-500 to-violet-600' },
        ].map(s => (
          <div key={s.label} className="relative card p-4 overflow-hidden hover:shadow-elevated transition-shadow">
            <div className={`absolute inset-y-0 ${isAr ? 'right-0' : 'left-0'} w-1 bg-gradient-to-b ${s.gradient}`} />
            <div className={`flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={isAr ? 'text-right' : 'text-left'}>
                <p className="text-3xl font-bold text-brand-900 tracking-tight leading-none">{s.value}</p>
                <p className="text-xs text-brand-500 mt-1.5">{s.label}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${s.gradient} text-white shadow-sm`}>
                <s.Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters — always visible. Search bar on top, then chip rows for date
          and visit type, then rep dropdown + clear button. Chip-style filters
          are easier to scan and one-click toggle than dropdowns. */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-brand-400`} />
          <input className={`input ${isAr ? 'pr-10' : 'pl-10'}`}
            placeholder={isAr ? 'بحث: شركة، مندوب، غرض، نتيجة...' : 'Search: company, rep, purpose, outcome...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Date chips */}
        <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mx-1">{isAr ? 'التاريخ' : 'Date'}</span>
          {DATE_OPTS.map(opt => {
            const active = dateFilter === opt.k;
            return (
              <button key={opt.k} type="button"
                onClick={() => setDateFilter(opt.k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
                }`}>
                {isAr ? opt.ar : opt.en}
              </button>
            );
          })}
        </div>

        {dateFilter === 'custom' && (
          <div className={`flex items-center gap-3 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-500 font-semibold whitespace-nowrap">{isAr ? 'من:' : 'From:'}</span>
              <input type="date" className="input py-1.5 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-500 font-semibold whitespace-nowrap">{isAr ? 'إلى:' : 'To:'}</span>
              <input type="date" className="input py-1.5 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Type chips — each with its own color so the active filter visually
            matches the colored accent on the matching visit cards below. */}
        <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mx-1">{isAr ? 'النوع' : 'Type'}</span>
          <button type="button"
            onClick={() => setTypeFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              typeFilter === ''
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
            }`}>
            {isAr ? 'كل الأنواع' : 'All Types'}
          </button>
          {Object.entries(VISIT_TYPES).map(([k, label]) => {
            const meta = VISIT_META[k];
            const Icon = meta?.Icon;
            const active = typeFilter === k;
            return (
              <button key={k} type="button"
                onClick={() => setTypeFilter(k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : `${meta?.chip || 'bg-white text-brand-600 border-brand-200'} hover:opacity-80`
                }`}>
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            );
          })}
        </div>

        {/* Rep dropdown + clear button — separated by a thin divider so it
            visually reads as a third filter row, not a continuation. */}
        {(isManager || hasActiveFilters) && (
          <div className={`flex items-center gap-3 flex-wrap pt-3 border-t border-brand-100 ${isAr ? 'flex-row-reverse' : ''}`}>
            {isManager && (
              <>
                <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mx-1">{isAr ? 'المندوب' : 'Rep'}</span>
                <select className="input py-1.5 text-sm w-52" value={repFilter} onChange={e => setRepFilter(e.target.value)}>
                  <option value="">{isAr ? 'كل المناديب' : 'All Reps'}</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>
            )}
            {hasActiveFilters && (
              <button
                className={`text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5 ${isAr ? 'mr-auto' : 'ml-auto'}`}
                onClick={() => { setSearch(''); setRepFilter(''); setTypeFilter(''); setDateFilter('all'); setCustomFrom(''); setCustomTo(''); }}>
                <X className="w-3 h-3" /> {isAr ? 'مسح الفلاتر' : 'Clear filters'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Follow-ups — only shown when no filters are active so the
          section doesn't compete with a filtered view. */}
      {!hasActiveFilters && followUps.length > 0 && (
        <div className={`card p-4 ${isAr ? 'border-r-4' : 'border-l-4'} border-brand-500 bg-gradient-to-br from-brand-50/40 to-transparent`}>
          <div className={`flex items-center gap-2 mb-3 ${isAr ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
            <Clock className="w-4 h-4 text-brand-500" />
            <h2 className="font-bold text-brand-900 text-sm">
              {isAr ? 'المتابعات القادمة' : 'Upcoming Follow-ups'} <span className="text-brand-400 font-normal">({followUps.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {followUps.slice(0, 6).map(v => {
              const fl = v.nextFollowUp ? getFollowUpLabel(v.nextFollowUp) : null;
              return (
                <Link key={v.id} to={`/clients/${v.client?.id}`}
                  className={`flex items-center justify-between p-2.5 rounded-lg bg-white border border-brand-100 hover:border-brand-300 hover:shadow-sm transition ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`min-w-0 ${isAr ? 'text-right' : 'text-left'}`}>
                    <p className="font-medium text-xs text-brand-900 truncate">{v.client?.companyName}</p>
                    <p className="text-[11px] text-brand-400 truncate">{v.client?.contactPerson}</p>
                  </div>
                  {fl && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fl.color} whitespace-nowrap`}>{fl.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Visits list */}
      {loading ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-50 mx-auto mb-3 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-brand-300" />
          </div>
          <p className="text-brand-500 font-semibold">{isAr ? 'لا توجد زيارات' : 'No visits found'}</p>
          {hasActiveFilters && (
            <button
              className="text-xs px-3 py-1.5 mt-4 rounded-full border border-brand-200 text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1.5"
              onClick={() => { setSearch(''); setRepFilter(''); setTypeFilter(''); setDateFilter('all'); setCustomFrom(''); setCustomTo(''); }}>
              <X className="w-3 h-3" /> {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dateVisits]) => (
            <div key={date}>
              <div className={`flex items-center gap-2 mb-2.5 ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className="h-px flex-1 bg-brand-100" />
                <span className="text-xs font-bold text-brand-600 px-3 py-1 bg-white border border-brand-200 rounded-full shadow-sm">
                  {date === 'unknown' ? (isAr ? 'بدون تاريخ' : 'No date') : (
                    <>
                      {format(parseISO(date), 'EEEE, dd MMM yyyy', { locale })}
                      <span className={`text-brand-400 font-normal ${isAr ? 'mr-2' : 'ml-2'}`}>({dateVisits.length})</span>
                    </>
                  )}
                </span>
                <div className="h-px flex-1 bg-brand-100" />
              </div>
              <div className="space-y-2">
                {dateVisits.map(v => {
                  const meta = VISIT_META[v.visitType || 'in_person'] || VISIT_META.in_person;
                  const Icon = meta.Icon;
                  return (
                    <div key={v.id} className="relative card p-4 pl-5 hover:shadow-elevated hover:border-brand-200 transition-all overflow-hidden">
                      {/* Colored accent strip matching the visit type — left in
                          LTR, right in RTL. Makes the list look like a Kanban
                          column with types coded by color. */}
                      <div className={`absolute inset-y-0 ${isAr ? 'right-0' : 'left-0'} w-1 ${meta.accent}`} />
                      <div className={`flex items-start justify-between gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-start gap-3 flex-1 min-w-0 ${isAr ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.ring}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : 'text-left'}`}>
                            <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                              <Link to={`/clients/${v.client?.id}`} className="font-bold text-brand-900 hover:text-brand-600 text-sm">
                                {v.client?.companyName}
                              </Link>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${meta.chip}`}>
                                {VISIT_TYPES[v.visitType || ''] || v.visitType}
                              </span>
                            </div>
                            {v.purpose && <p className="text-xs text-brand-700 mt-1.5">{v.purpose}</p>}
                            {v.outcome && (
                              <p className="text-xs text-brand-500 mt-1">
                                <span className="font-semibold text-brand-700">{isAr ? 'النتيجة: ' : 'Outcome: '}</span>{v.outcome}
                              </p>
                            )}
                            <div className={`flex items-center gap-2 mt-2.5 text-[11px] text-brand-400 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
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
                              return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${fl.color}`}>{fl.label}</span>;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
