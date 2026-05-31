import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, Search, MapPin, Users, TrendingUp, Calendar, Phone, Video, Building2,
  Handshake, X, LayoutGrid, List, Trophy, ChevronDown,
} from 'lucide-react';
import { visitsApi, usersApi } from '../services/api';
import { Visit } from '../types';
import {
  format, parseISO, isToday, isTomorrow, isThisWeek, isThisMonth, subDays,
} from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const VISIT_TYPES_AR: Record<string, string> = {
  in_person: 'زيارة شخصية', phone: 'هاتف', online: 'أونلاين', site_visit: 'زيارة الموقع',
};
const VISIT_TYPES_EN: Record<string, string> = {
  in_person: 'In Person', phone: 'Phone', online: 'Online', site_visit: 'Site Visit',
};

const VISIT_META: Record<string, { Icon: any; accent: string; ring: string; chip: string }> = {
  in_person:  { Icon: Handshake, accent: 'bg-emerald-500', ring: 'bg-emerald-50 text-emerald-700', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  phone:      { Icon: Phone,     accent: 'bg-blue-500',    ring: 'bg-blue-50 text-blue-700',       chip: 'border-blue-200 bg-blue-50 text-blue-700' },
  online:     { Icon: Video,     accent: 'bg-violet-500',  ring: 'bg-violet-50 text-violet-700',   chip: 'border-violet-200 bg-violet-50 text-violet-700' },
  site_visit: { Icon: Building2, accent: 'bg-amber-500',   ring: 'bg-amber-50 text-amber-700',     chip: 'border-amber-200 bg-amber-50 text-amber-700' },
};

type ViewMode = 'cards' | 'table';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'last7' | 'last30' | 'custom';

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
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // View mode — table is denser/faster for managers, cards keep the full detail
  // for individual reps reviewing their own day. Default is table for manager
  // roles so they land in the dense view automatically; reps see cards.
  const [view, setView] = useState<ViewMode>(isManager ? 'table' : 'cards');
  const [showAllPerformers, setShowAllPerformers] = useState(false);

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

  const stats = useMemo(() => {
    const total = filtered.length;
    const today = filtered.filter(v => v.visitDate && isToday(parseISO(v.visitDate))).length;
    const thisWeek = filtered.filter(v => v.visitDate && isThisWeek(parseISO(v.visitDate))).length;
    const thisMonth = filtered.filter(v => v.visitDate && isThisMonth(parseISO(v.visitDate))).length;
    const withFollowUp = filtered.filter(v => v.nextFollowUp).length;
    return { total, today, thisWeek, thisMonth, withFollowUp };
  }, [filtered]);

  // Per-rep aggregations — only computed for managers, used by the
  // "Top Performers" strip + the rep dropdown counter. Keyed by rep id.
  const perRep = useMemo(() => {
    if (!isManager) return [] as { id: number; name: string; total: number; today: number; week: number; month: number }[];
    const map = new Map<number, { id: number; name: string; total: number; today: number; week: number; month: number }>();
    for (const v of filtered) {
      const r = v.salesRep;
      if (!r?.id) continue;
      if (!map.has(r.id)) map.set(r.id, { id: r.id, name: r.name || '-', total: 0, today: 0, week: 0, month: 0 });
      const row = map.get(r.id)!;
      row.total += 1;
      if (v.visitDate) {
        const d = parseISO(v.visitDate);
        if (isToday(d)) row.today += 1;
        if (isThisWeek(d)) row.week += 1;
        if (isThisMonth(d)) row.month += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, isManager]);

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

  const DATE_OPTS: { k: DateFilter; ar: string; en: string }[] = [
    { k: 'all',    ar: 'الكل',         en: 'All' },
    { k: 'today',  ar: 'اليوم',         en: 'Today' },
    { k: 'week',   ar: 'هذا الأسبوع',   en: 'This Week' },
    { k: 'month',  ar: 'هذا الشهر',     en: 'This Month' },
    { k: 'last7',  ar: 'آخر 7 أيام',    en: 'Last 7d' },
    { k: 'last30', ar: 'آخر 30 يوم',    en: 'Last 30d' },
    { k: 'custom', ar: 'مخصص',         en: 'Custom' },
  ];

  const clearFilters = () => { setSearch(''); setRepFilter(''); setTypeFilter(''); setDateFilter('all'); setCustomFrom(''); setCustomTo(''); };

  // Top performers — show 3 collapsed, all on expand. Each card filters the
  // list to that rep on click so manager can drill into one rep's day fast.
  const visiblePerformers = showAllPerformers ? perRep : perRep.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header — title + counter + view-mode toggle. Toggle moved into the
          header (was nowhere) so managers can flip between scan-friendly
          table and detail-friendly cards without scrolling. */}
      <div className={`flex items-center justify-between flex-wrap gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'الزيارات' : 'Visits'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">
            {isAr
              ? `${filtered.length.toLocaleString('ar-EG')} زيارة معروضة من ${visits.length.toLocaleString('ar-EG')}`
              : `Showing ${filtered.length} of ${visits.length} visits`}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 p-1 rounded-lg bg-brand-50 border border-brand-100`}>
          <button type="button" onClick={() => setView('table')}
            className={`text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition ${
              view === 'table' ? 'bg-white text-brand-700 shadow-sm font-semibold' : 'text-brand-500 hover:text-brand-700'
            }`}>
            <List className="w-3.5 h-3.5" />
            {isAr ? 'جدول' : 'Table'}
          </button>
          <button type="button" onClick={() => setView('cards')}
            className={`text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition ${
              view === 'cards' ? 'bg-white text-brand-700 shadow-sm font-semibold' : 'text-brand-500 hover:text-brand-700'
            }`}>
            <LayoutGrid className="w-3.5 h-3.5" />
            {isAr ? 'كروت' : 'Cards'}
          </button>
        </div>
      </div>

      {/* Stat cards — 5 KPIs now (added This Month) so the manager can see
          coverage across all the windows they care about. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: isAr ? 'الإجمالي' : 'Total',         value: stats.total,        Icon: MapPin,      gradient: 'from-brand-500 to-brand-600' },
          { label: isAr ? 'اليوم' : 'Today',            value: stats.today,        Icon: Calendar,    gradient: 'from-emerald-500 to-emerald-600' },
          { label: isAr ? 'هذا الأسبوع' : 'This Week',  value: stats.thisWeek,     Icon: TrendingUp,  gradient: 'from-sky-500 to-sky-600' },
          { label: isAr ? 'هذا الشهر' : 'This Month',   value: stats.thisMonth,    Icon: Calendar,    gradient: 'from-amber-500 to-amber-600' },
          { label: isAr ? 'بمتابعة' : 'With Follow-up', value: stats.withFollowUp, Icon: Clock,       gradient: 'from-violet-500 to-violet-600' },
        ].map(s => (
          <div key={s.label} className="relative card p-4 overflow-hidden hover:shadow-elevated transition-shadow">
            <div className={`absolute inset-y-0 ${isAr ? 'right-0' : 'left-0'} w-1 bg-gradient-to-b ${s.gradient}`} />
            <div className={`flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={isAr ? 'text-right' : 'text-left'}>
                <p className="text-3xl font-bold text-brand-900 tracking-tight leading-none">{s.value.toLocaleString(isAr ? 'ar-EG' : 'en')}</p>
                <p className="text-xs text-brand-500 mt-1.5">{s.label}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${s.gradient} text-white shadow-sm`}>
                <s.Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top performers — managers-only ranking strip. Click any rep to pin the
          list to their visits, click again to clear. Shows 3 by default with
          a "show all" expand. Skipped when there's only one rep in scope. */}
      {isManager && perRep.length > 1 && (
        <div className="card p-4 space-y-3">
          <div className={`flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-brand-900 text-sm">
                {isAr ? 'أداء المناديب' : 'Top Performers'}
                <span className="text-brand-400 font-normal ms-2">({perRep.length})</span>
              </h2>
            </div>
            {perRep.length > 3 && (
              <button type="button" onClick={() => setShowAllPerformers(!showAllPerformers)}
                className={`text-xs text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllPerformers ? 'rotate-180' : ''}`} />
                {showAllPerformers ? (isAr ? 'عرض الأعلى' : 'Show top') : (isAr ? 'عرض الكل' : 'Show all')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {visiblePerformers.map((p, i) => {
              const isPinned = repFilter === String(p.id);
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              return (
                <button key={p.id} type="button"
                  onClick={() => setRepFilter(isPinned ? '' : String(p.id))}
                  className={`p-3 rounded-lg border text-start transition ${
                    isPinned
                      ? 'bg-brand-50 border-brand-400 ring-2 ring-brand-100'
                      : 'bg-white border-brand-100 hover:border-brand-300 hover:shadow-sm'
                  }`}>
                  <div className={`flex items-center justify-between gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <div className={`min-w-0 ${isAr ? 'text-right' : 'text-left'}`}>
                      <p className="text-xs font-bold text-brand-900 truncate">
                        {medal && <span className="me-1">{medal}</span>}{p.name}
                      </p>
                      <p className="text-[11px] text-brand-400 mt-0.5">
                        {isAr ? 'هذا الشهر' : 'this month'}: <span className="font-semibold text-brand-700">{p.month}</span>
                        {' · '}
                        {isAr ? 'هذا الأسبوع' : 'this week'}: <span className="font-semibold text-brand-700">{p.week}</span>
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-2xl font-bold text-brand-900 leading-none tabular-nums">{p.total}</p>
                      <p className="text-[10px] text-brand-400 mt-1">{isAr ? 'زيارة' : 'visits'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters — compact single row with search + chips inline. Date and
          type chips are kept; rep selection now lives in the Top Performers
          strip (click a rep card) so we save vertical space here. */}
      <div className="card p-4 space-y-3">
        <div className={`flex items-stretch gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          <div className="relative flex-1 min-w-[240px]">
            <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-brand-400`} />
            <input className={`input ${isAr ? 'pr-10' : 'pl-10'}`}
              placeholder={isAr ? 'بحث: شركة، مندوب، غرض، نتيجة...' : 'Search: company, rep, purpose, outcome...'}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isManager && (
            <select className="input py-1.5 text-sm w-52"
              value={repFilter} onChange={e => setRepFilter(e.target.value)}>
              <option value="">{isAr ? 'كل المناديب' : 'All Reps'}</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5">
              <X className="w-3 h-3" /> {isAr ? 'مسح الفلاتر' : 'Clear'}
            </button>
          )}
        </div>

        <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mx-1">{isAr ? 'التاريخ' : 'Date'}</span>
          {DATE_OPTS.map(opt => {
            const active = dateFilter === opt.k;
            return (
              <button key={opt.k} type="button"
                onClick={() => setDateFilter(opt.k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
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

        <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mx-1">{isAr ? 'النوع' : 'Type'}</span>
          <button type="button" onClick={() => setTypeFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              typeFilter === '' ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                 : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
            }`}>
            {isAr ? 'كل الأنواع' : 'All Types'}
          </button>
          {Object.entries(VISIT_TYPES).map(([k, label]) => {
            const meta = VISIT_META[k];
            const Icon = meta?.Icon;
            const active = typeFilter === k;
            return (
              <button key={k} type="button" onClick={() => setTypeFilter(k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5 ${
                  active ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                         : `${meta?.chip || 'bg-white text-brand-600 border-brand-200'} hover:opacity-80`
                }`}>
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Follow-ups — unchanged behaviour, hidden when filters are
          active so the section doesn't compete with a filtered view. */}
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

      {/* Main list — table or cards based on the header toggle */}
      {loading ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-50 mx-auto mb-3 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-brand-300" />
          </div>
          <p className="text-brand-500 font-semibold">{isAr ? 'لا توجد زيارات' : 'No visits found'}</p>
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="text-xs px-3 py-1.5 mt-4 rounded-full border border-brand-200 text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1.5">
              <X className="w-3 h-3" /> {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : view === 'table' ? (
        // Dense table — meant for managers scanning many rows fast. Sticky
        // header so column labels stay visible while scrolling, row hover
        // highlights the line, click anywhere on a row to open the client.
        <div className="card overflow-hidden">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-brand-50/95 backdrop-blur text-brand-700 border-b border-brand-100">
                <tr>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'النوع' : 'Type'}</th>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'الشركة' : 'Company'}</th>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'جهة الاتصال' : 'Contact'}</th>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'المندوب' : 'Rep'}</th>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'الغرض / النتيجة' : 'Purpose / Outcome'}</th>
                  <th className={`p-3 text-xs font-bold ${isAr ? 'text-right' : 'text-left'} whitespace-nowrap`}>{isAr ? 'متابعة' : 'Follow-up'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const meta = VISIT_META[v.visitType || 'in_person'] || VISIT_META.in_person;
                  const Icon = meta.Icon;
                  const fl = v.nextFollowUp ? getFollowUpLabel(v.nextFollowUp) : null;
                  return (
                    <tr key={v.id} className="border-b border-brand-50 hover:bg-brand-50/40 transition-colors group">
                      <td className={`p-3 whitespace-nowrap text-xs ${isAr ? 'text-right' : 'text-left'}`}>
                        <div className="font-semibold text-brand-700">
                          {v.visitDate ? format(parseISO(v.visitDate), 'dd MMM yyyy', { locale }) : '-'}
                        </div>
                        <div className="text-brand-400 mt-0.5">
                          {v.visitDate ? format(parseISO(v.visitDate), 'hh:mm a', { locale }) : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-semibold ${meta.chip}`}>
                          <Icon className="w-3 h-3" />
                          {VISIT_TYPES[v.visitType || ''] || v.visitType}
                        </span>
                      </td>
                      <td className={`p-3 ${isAr ? 'text-right' : 'text-left'}`}>
                        <Link to={`/clients/${v.client?.id}`}
                          className="font-semibold text-brand-900 hover:text-brand-600 text-sm">
                          {v.client?.companyName || '-'}
                        </Link>
                      </td>
                      <td className={`p-3 text-xs text-brand-600 ${isAr ? 'text-right' : 'text-left'}`}>
                        {v.client?.contactPerson || '-'}
                      </td>
                      <td className={`p-3 text-xs text-brand-600 ${isAr ? 'text-right' : 'text-left'}`}>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3 opacity-60" />
                          {v.salesRep?.name || '-'}
                        </span>
                      </td>
                      <td className={`p-3 text-xs text-brand-600 max-w-md ${isAr ? 'text-right' : 'text-left'}`}>
                        {v.purpose && <div className="text-brand-700">{v.purpose}</div>}
                        {v.outcome && (
                          <div className="text-brand-500 mt-0.5">
                            <span className="font-semibold">{isAr ? 'نتيجة: ' : 'Outcome: '}</span>{v.outcome}
                          </div>
                        )}
                        {!v.purpose && !v.outcome && <span className="text-brand-300">—</span>}
                      </td>
                      <td className="p-3">
                        {fl ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fl.color} whitespace-nowrap`}>{fl.label}</span> : <span className="text-brand-300 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Card view — kept verbatim from the previous design for reps who want
        // the full detail layout grouped by date.
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
