import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Minus, BedDouble, Moon, DoorOpen, Wallet,
  CreditCard, AlertCircle, FileDown, Calendar, Building2, ChevronLeft, ChevronRight,
  ArrowRight, Hourglass, CheckCircle, XCircle, LogIn, Plus, Sparkles,
} from 'lucide-react';
import { portalDataApi } from '../../services/portalApi';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface AccountSummary {
  period: { month: string; year: number };
  thisMonth: { count: number; nights: number; rooms: number; spent: number };
  lastMonth: { count: number; nights: number; rooms: number; spent: number };
  thisYear: { count: number; nights: number; rooms: number; spent: number };
  statusCounts: Record<string, number>;
  trend: { month: string; bookings: number; nights: number; spent: number }[];
  credit: {
    creditLimit: number | null;
    outstanding: number;
    availableCredit: number | null;
    utilizationPct: number | null;
    totalCharged: number;
    totalPaid: number;
  };
  contracts: {
    id: number; contractRef: string | null; ratePerRoom: number | null;
    startDate: string | null; endDate: string | null;
    totalValue: number | null; collectedAmount: number | null;
    daysUntilExpiry: number | null;
    hotel: { id: number; name: string; nameEn?: string };
  }[];
  recentBookings: any[];
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
};

const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { month: 'short' });
};

const delta = (a: number, b: number) => {
  if (b === 0) return a > 0 ? { dir: 'up' as const, pct: 100 } : { dir: 'flat' as const, pct: 0 };
  const pct = Math.round(((a - b) / b) * 100);
  return { dir: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const, pct: Math.abs(pct) };
};

const statusInfo: Record<string, { label: string; cls: string; ring: string; Icon: any }> = {
  pending_reservations: { label: 'قيد المراجعة', cls: 'text-amber-700 bg-amber-50',     ring: 'ring-amber-200',    Icon: Hourglass },
  confirmed:            { label: 'مؤكد',         cls: 'text-blue-700 bg-blue-50',       ring: 'ring-blue-200',     Icon: CheckCircle },
  checked_in:           { label: 'داخل الفندق',  cls: 'text-emerald-700 bg-emerald-50', ring: 'ring-emerald-200',  Icon: LogIn },
  checked_out:          { label: 'مكتمل',        cls: 'text-slate-700 bg-slate-100',    ring: 'ring-slate-200',    Icon: CheckCircle },
  cancelled:            { label: 'ملغي',          cls: 'text-red-700 bg-red-50',         ring: 'ring-red-200',      Icon: XCircle },
  no_show:              { label: 'لم يحضر',      cls: 'text-orange-700 bg-orange-50',   ring: 'ring-orange-200',   Icon: XCircle },
};

export default function PortalDashboard() {
  const { client } = usePortalAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = (m: string) => {
    setLoading(true);
    portalDataApi.accountSummary(m)
      .then(r => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(month); }, [month]);

  const shiftMonth = (d: number) => {
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await portalDataApi.statementPdf(month);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `statement-${month}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('فشل تحميل الكشف'); }
    finally { setDownloading(false); }
  };

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء الخير';

  const trendChartData = useMemo(() => {
    if (!summary) return [];
    return summary.trend.map(t => ({
      ...t,
      label: monthShort(t.month).replace('.', ''),
      isCurrent: t.month === summary.period.month,
    }));
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!summary) {
    return <div className="text-center py-20 text-brand-400">فشل تحميل البيانات</div>;
  }

  const tm = summary.thisMonth;
  const lm = summary.lastMonth;
  const dBook = delta(tm.count, lm.count);
  const dNights = delta(tm.nights, lm.nights);
  const dSpent = delta(tm.spent, lm.spent);
  const cur = monthLabel(summary.period.month);

  return (
    <div dir="rtl" className="space-y-5">
      {/* ════════════════ HERO ════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-slate-800 p-6 lg:p-8 text-white shadow-elevated">
        {/* Decorative blobs */}
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-gradient-to-br from-amber-400/10 to-transparent blur-3xl" />
        <div className="absolute -left-16 -bottom-24 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-400/10 to-transparent blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 flex flex-col lg:flex-row-reverse lg:items-end lg:justify-between gap-5">
          <div className="text-right">
            <p className="text-white/60 text-xs uppercase tracking-[0.2em] font-semibold mb-2">
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
              {greeting}،
              <br />
              <span className="bg-gradient-to-l from-amber-300 to-amber-100 bg-clip-text text-transparent">
                {client?.companyName}
              </span>
            </h1>
            <p className="text-white/60 text-sm mt-2 flex items-center gap-1.5 flex-row-reverse">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              نظرة شاملة لحسابك ومتابعة حجوزاتك
            </p>
          </div>

          {/* Quick stats inline */}
          <div className="grid grid-cols-2 gap-3 min-w-fit">
            <div className="bg-white/[0.07] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10 text-right">
              <div className="text-[11px] text-white/60 mb-0.5">حجوزات {cur.split(' ')[0]}</div>
              <div className="text-2xl font-bold">{tm.count}</div>
            </div>
            <div className="bg-white/[0.07] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10 text-right">
              <div className="text-[11px] text-white/60 mb-0.5">المتاح من الائتمان</div>
              <div className="text-2xl font-bold text-emerald-300">
                {summary.credit.availableCredit != null
                  ? `${(summary.credit.availableCredit / 1000).toFixed(0)}K`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-white/10">
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-white/[0.07] backdrop-blur-sm rounded-xl border border-white/10 p-1">
            <button onClick={() => shiftMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg" aria-label="شهر سابق">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="px-4 min-w-[140px] text-center">
              <div className="text-[10px] text-white/50">عرض فترة</div>
              <div className="font-bold text-sm">{cur}</div>
            </div>
            <button onClick={() => shiftMonth(1)} className="p-2 hover:bg-white/10 rounded-lg" aria-label="شهر تالي">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/portal/book" className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-brand-900 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:shadow-lg hover:shadow-amber-500/20">
              <Plus className="w-4 h-4" /> طلب حجز جديد
            </Link>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              {downloading ? 'جاري التحميل...' : 'تحميل كشف PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════ HEADLINE STATS ════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat icon={BedDouble} label="حجوزات الشهر"   value={tm.count}                  delta={dBook}   accent="from-blue-500 to-blue-600"     bgAccent="bg-blue-50/80" />
        <BigStat icon={Moon}      label="عدد الليالي"    value={tm.nights}                 delta={dNights} accent="from-violet-500 to-violet-600" bgAccent="bg-violet-50/80" />
        <BigStat icon={DoorOpen}  label="عدد الغرف"      value={tm.rooms}                  delta={null}    accent="from-amber-500 to-amber-600"   bgAccent="bg-amber-50/80" />
        <BigStat icon={Wallet}    label="الإجمالي (ر.س)" value={tm.spent.toLocaleString()} delta={dSpent}  accent="from-emerald-500 to-emerald-600" bgAccent="bg-emerald-50/80" />
      </div>

      {/* ════════════════ CHART + CREDIT ════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trend chart */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1 flex-row-reverse">
            <div className="flex items-center gap-2 flex-row-reverse">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <TrendingUp className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="text-right">
                <h3 className="text-base font-bold text-slate-900">حركة الحجوزات</h3>
                <p className="text-xs text-slate-500">آخر 6 شهور · إجمالي {summary.thisYear.count} حجز السنة</p>
              </div>
            </div>
            <div className="text-left">
              <div className="text-[11px] text-slate-400">إنفاق السنة</div>
              <div className="text-sm font-bold text-emerald-600">{summary.thisYear.spent.toLocaleString()} ر.س</div>
            </div>
          </div>

          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} reversed />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}
                  formatter={(_value: any, _name: any, props: any) => {
                    const p = props.payload;
                    return [
                      <div key="tt" className="space-y-0.5">
                        <div>{p.bookings} حجز · {p.nights} ليلة</div>
                        <div className="text-emerald-600 font-bold">{p.spent.toLocaleString()} ر.س</div>
                      </div>,
                      '',
                    ];
                  }}
                />
                <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2.5} fill="url(#trendFill)" dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Credit gauge */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-brand-900 text-white p-6 relative overflow-hidden shadow-elevated">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-amber-500/[0.08] blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1 flex-row-reverse">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                <CreditCard className="w-4.5 h-4.5 text-brand-900" />
              </div>
              <h3 className="text-base font-bold">الحد الائتماني</h3>
            </div>
            {summary.credit.creditLimit == null ? (
              <div className="mt-4 text-sm text-white/70 bg-white/[0.05] rounded-xl p-4 flex items-start gap-2 flex-row-reverse">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300" />
                <span>لم يتم تحديد حد ائتماني للحساب. تواصل مع مندوب المبيعات.</span>
              </div>
            ) : (
              <>
                <CreditGauge
                  pct={summary.credit.utilizationPct ?? 0}
                  available={summary.credit.availableCredit ?? 0}
                  limit={summary.credit.creditLimit}
                />
                <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                  <div className="text-right">
                    <div className="text-[10px] text-white/50">المستحق</div>
                    <div className="text-sm font-bold text-red-300">{summary.credit.outstanding.toLocaleString()} ر.س</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/50">المسدد</div>
                    <div className="text-sm font-bold text-emerald-300">{summary.credit.totalPaid.toLocaleString()} ر.س</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ CONTRACTS + STATUS ════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contracts */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 flex-row-reverse">
            <div className="flex items-center gap-2 flex-row-reverse">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Building2 className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="text-right">
                <h3 className="text-base font-bold text-slate-900">العقود الإطارية</h3>
                <p className="text-xs text-slate-500">{summary.contracts.length} عقد معتمد</p>
              </div>
            </div>
          </div>
          {summary.contracts.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">مفيش عقود إطارية معتمدة حاليًا</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {summary.contracts.map(c => {
                const expiringSoon = c.daysUntilExpiry != null && c.daysUntilExpiry <= 30 && c.daysUntilExpiry >= 0;
                const expired = c.daysUntilExpiry != null && c.daysUntilExpiry < 0;
                return (
                  <div key={c.id} className={`rounded-2xl p-4 transition-all hover:shadow-md ${
                    expired ? 'bg-red-50/40 border border-red-100' :
                    expiringSoon ? 'bg-amber-50/40 border border-amber-100' :
                    'bg-slate-50/60 border border-slate-100'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 flex-row-reverse mb-2">
                      <div className="text-right">
                        <div className="font-semibold text-slate-900 text-sm">{c.hotel.name}</div>
                        {c.contractRef && <div className="text-[10px] font-mono text-slate-500 mt-0.5">{c.contractRef}</div>}
                      </div>
                      {expired && <span className="text-[10px] bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold">منتهي</span>}
                      {expiringSoon && <span className="text-[10px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">ينتهي خلال {c.daysUntilExpiry} يوم</span>}
                      {!expired && !expiringSoon && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">ساري</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-slate-400">سعر الليلة</div>
                        <div className="font-bold text-slate-900 text-sm">{c.ratePerRoom?.toLocaleString() || '—'} <span className="text-[10px] text-slate-400 font-normal">ر.س</span></div>
                      </div>
                      <div>
                        <div className="text-slate-400">تنتهي في</div>
                        <div className="font-medium text-slate-700 text-sm">{c.endDate ? format(parseISO(c.endDate), 'dd MMM yyyy', { locale: arSA }) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">قيمة العقد</div>
                        <div className="font-medium text-slate-700 text-sm">{c.totalValue ? `${(c.totalValue / 1000).toFixed(0)}K` : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 flex-row-reverse">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/20">
              <Hourglass className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="text-right">
              <h3 className="text-base font-bold text-slate-900">توزيع الحالات</h3>
              <p className="text-xs text-slate-500">إجمالي {Object.values(summary.statusCounts).reduce((s, n) => s + n, 0)} حجز</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(summary.statusCounts).filter(([, c]) => c > 0).map(([status, count]) => {
              const info = statusInfo[status];
              if (!info) return null;
              const total = Object.values(summary.statusCounts).reduce((s, n) => s + n, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const Icon = info.Icon;
              return (
                <div key={status} className={`rounded-xl p-3 ring-1 ${info.cls} ${info.ring} flex-row-reverse`}>
                  <div className="flex items-center justify-between flex-row-reverse mb-1.5">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{info.label}</span>
                    </div>
                    <span className="text-base font-bold">{count}</span>
                  </div>
                  <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full bg-current opacity-70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.values(summary.statusCounts).every(c => c === 0) && (
              <div className="text-center py-8 text-slate-400 text-sm">مفيش حجوزات لسه</div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ RECENT ACTIVITY ════════════════ */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-row-reverse">
          <div className="flex items-center gap-2 flex-row-reverse">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-md">
              <Calendar className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="text-right">
              <h3 className="text-base font-bold text-slate-900">آخر النشاطات</h3>
              <p className="text-xs text-slate-500">أحدث 5 حجوزات</p>
            </div>
          </div>
          <Link to="/portal/bookings" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 flex-row-reverse hover:gap-1.5 transition-all">
            <ArrowRight className="w-3 h-3" /> عرض الكل
          </Link>
        </div>
        {summary.recentBookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm mb-3">مفيش نشاط لسه</p>
            <Link to="/portal/book" className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
              <Plus className="w-4 h-4" /> اطلب أول حجز
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.recentBookings.map((b: any) => {
              const info = statusInfo[b.status] || statusInfo.confirmed;
              return (
                <Link
                  key={b.id}
                  to={`/portal/booking/${b.id}`}
                  className="flex items-center justify-between py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors flex-row-reverse"
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${info.cls}`}>
                      <info.Icon className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{b.guestName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-row-reverse">
                        <span>{b.hotel?.name}</span>
                        <span className="text-slate-300">•</span>
                        <span>{format(parseISO(b.arrivalDate), 'dd MMM yyyy', { locale: arSA })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`text-[11px] font-bold inline-block px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</div>
                    {b.totalAmount != null && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{b.totalAmount.toLocaleString()} {b.currency}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =================== Components ===================

function BigStat({
  icon: Icon, label, value, delta, accent, bgAccent,
}: {
  icon: any; label: string; value: number | string;
  delta: { dir: 'up' | 'down' | 'flat'; pct: number } | null;
  accent: string; bgAccent: string;
}) {
  return (
    <div className={`relative rounded-3xl p-5 border border-slate-100 shadow-sm overflow-hidden ${bgAccent}`}>
      <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full bg-gradient-to-br ${accent} opacity-10 blur-2xl`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br ${accent} text-white shadow-md`}>
            <Icon className="w-5 h-5" />
          </div>
          {delta && (
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${
              delta.dir === 'up' ? 'bg-emerald-500/15 text-emerald-700' :
              delta.dir === 'down' ? 'bg-red-500/15 text-red-700' :
              'bg-slate-500/15 text-slate-600'
            }`}>
              {delta.dir === 'up' && <TrendingUp className="w-3 h-3" />}
              {delta.dir === 'down' && <TrendingDown className="w-3 h-3" />}
              {delta.dir === 'flat' && <Minus className="w-3 h-3" />}
              {delta.pct}%
            </span>
          )}
        </div>
        <div className="mt-4 text-right">
          <div className="text-3xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-600 mt-1 font-medium">{label}</div>
        </div>
      </div>
    </div>
  );
}

// SVG donut gauge for credit utilization
function CreditGauge({ pct, available, limit }: { pct: number; available: number; limit: number }) {
  const radius = 56;
  const stroke = 12;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const ringColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#34d399';

  return (
    <div className="relative flex items-center justify-center mt-4 mb-1">
      <svg width="160" height="160" viewBox="0 0 160 160" className="rotate-[-90deg]">
        <circle cx="80" cy="80" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx="80" cy="80" r={radius}
          stroke={ringColor} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] text-white/50 mb-0.5">المتاح</div>
        <div className="text-2xl font-bold leading-none">{(available / 1000).toFixed(0)}K</div>
        <div className="text-[10px] text-white/40 mt-1">من {(limit / 1000).toFixed(0)}K ر.س</div>
      </div>
    </div>
  );
}
