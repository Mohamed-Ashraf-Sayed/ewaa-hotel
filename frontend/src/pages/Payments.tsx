import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, TrendingUp, Building2, CheckCircle, Clock, XCircle, Check, X,
  AlertTriangle, Sparkles, Search, ArrowUpRight, Wallet, Coins, Receipt, Hotel as HotelIcon,
} from 'lucide-react';
import { paymentsApi, contractsApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

type PaymentStatus = 'pending' | 'approved' | 'rejected';

interface PaymentWithDetails {
  id: number;
  amount: number;
  paymentDate: string;
  paymentType?: string;
  reference?: string;
  status: PaymentStatus;
  approvalNotes?: string;
  contract?: { id: number; contractRef?: string; totalValue?: number };
  client?: { id: number; companyName: string };
  collector?: { id: number; name: string };
  approver?: { id: number; name: string } | null;
}

interface ContractSummary {
  id: number;
  contractRef?: string;
  totalValue?: number;
  collectedAmount?: number;
  status: string;
  client?: { id: number; companyName: string };
  hotel?: { id: number; name: string };
  salesRep?: { id: number; name: string; commissionRate?: number };
}

type HealthBucket = 'at_risk' | 'in_progress' | 'almost' | 'done';
type ApprovalTab = 'all' | 'pending' | 'approved' | 'rejected';

// Compact number formatter — 12,345 → "12.3K", 1,234,567 → "1.23M"
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

// Donut chart — pure SVG, no library needed
const Donut = ({ pct, size = 140, stroke = 14, color }: { pct: number; size?: number; stroke?: number; color: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-brand-100" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={stroke} strokeLinecap="round"
        stroke={color}
        strokeDasharray={`${dash} ${c}`}
        style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
      />
    </svg>
  );
};

export default function Payments() {
  const { t, lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const canApprove = hasRole('credit_manager', 'admin', 'general_manager', 'vice_gm');
  const [tab, setTab] = useState<ApprovalTab>(canApprove ? 'pending' : 'all');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Filtering for the contracts board
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthBucket | 'all'>('all');

  const loadData = async () => {
    try {
      const [pmRes, ctRes] = await Promise.all([
        paymentsApi.getAll(),
        contractsApi.getAll({ status: 'approved' })
      ]);
      setPayments(pmRes.data);
      setContracts(ctRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalValue = contracts.reduce((s, c) => s + (c.totalValue || 0), 0);
  const totalCollected = contracts.reduce((s, c) => s + (c.collectedAmount || 0), 0);
  const totalRemaining = Math.max(totalValue - totalCollected, 0);
  const overallPct = totalValue > 0 ? Math.round((totalCollected / totalValue) * 100) : 0;

  const totalCommission = contracts.reduce((s, c) => {
    const collected = c.collectedAmount || 0;
    const rate = c.salesRep?.commissionRate || 0;
    return s + (collected * rate / 100);
  }, 0);

  const PAYMENT_TYPES: Record<string, string> = {
    cash: t('payment_cash'),
    bank_transfer: t('payment_bank'),
    check: t('payment_check'),
    online: t('payment_online'),
  };

  // Categorize each contract by collection health
  const bucketOf = (c: ContractSummary): HealthBucket => {
    const total = c.totalValue || 0;
    const collected = c.collectedAmount || 0;
    const pct = total > 0 ? (collected / total) * 100 : 0;
    if (pct >= 100) return 'done';
    if (pct >= 75) return 'almost';
    if (pct >= 30) return 'in_progress';
    return 'at_risk';
  };

  const bucketCounts = useMemo(() => {
    const acc: Record<HealthBucket, number> = { at_risk: 0, in_progress: 0, almost: 0, done: 0 };
    contracts.forEach(c => { acc[bucketOf(c)] += 1; });
    return acc;
  }, [contracts]);

  // Hotels breakdown — top 5 by total value
  const hotelBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number; collected: number }>();
    for (const c of contracts) {
      const name = c.hotel?.name || (isAr ? 'بدون فندق' : 'No hotel');
      const e = map.get(name) || { name, total: 0, collected: 0 };
      e.total += c.totalValue || 0;
      e.collected += c.collectedAmount || 0;
      map.set(name, e);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [contracts, isAr]);

  // Filter contracts board
  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter(c => {
      if (healthFilter !== 'all' && bucketOf(c) !== healthFilter) return false;
      if (!q) return true;
      return (
        c.client?.companyName?.toLowerCase().includes(q) ||
        c.hotel?.name?.toLowerCase().includes(q) ||
        c.contractRef?.toLowerCase().includes(q) ||
        c.salesRep?.name?.toLowerCase().includes(q)
      );
    });
  }, [contracts, search, healthFilter]);

  // Approval-tab payments
  const counts = useMemo(() => ({
    all: payments.length,
    pending: payments.filter(p => p.status === 'pending').length,
    approved: payments.filter(p => p.status === 'approved').length,
    rejected: payments.filter(p => p.status === 'rejected').length,
  }), [payments]);

  const visiblePayments = useMemo(() => {
    if (tab === 'all') return payments;
    return payments.filter(p => p.status === tab);
  }, [payments, tab]);

  const handleApprove = async (id: number) => {
    if (!confirm(isAr ? 'تأكيد الموافقة على الدفعة وإضافتها لحساب العميل؟' : 'Approve this payment and post to the client account?')) return;
    setBusyId(id);
    try { await paymentsApi.approve(id); await loadData(); }
    catch (err: any) { alert(err?.response?.data?.message || (isAr ? 'فشل الاعتماد' : 'Failed')); }
    finally { setBusyId(null); }
  };
  const handleReject = async (id: number) => {
    const note = prompt(isAr ? 'سبب الرفض (اختياري):' : 'Rejection reason (optional):') ?? null;
    if (note === null) return;
    setBusyId(id);
    try { await paymentsApi.reject(id, note || undefined); await loadData(); }
    catch (err: any) { alert(err?.response?.data?.message || (isAr ? 'فشل الرفض' : 'Failed')); }
    finally { setBusyId(null); }
  };

  const StatusBadge = ({ status }: { status: PaymentStatus }) => {
    const map: Record<PaymentStatus, { ar: string; en: string; cls: string; Icon: any }> = {
      pending: { ar: 'بانتظار الموافقة', en: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
      approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle },
      rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
    };
    const m = map[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${m.cls}`}>
        <m.Icon className="w-3 h-3" /> {isAr ? m.ar : m.en}
      </span>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Health bucket configs (icon + colors + labels)
  const healthCfg: Record<HealthBucket, { ar: string; en: string; ring: string; bar: string; text: string; bg: string; icon: any }> = {
    at_risk:    { ar: 'متعثّر',    en: 'At Risk',     ring: 'ring-red-200',    bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    icon: AlertTriangle },
    in_progress:{ ar: 'جاري التحصيل', en: 'In Progress', ring: 'ring-amber-200', bar: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50',  icon: TrendingUp },
    almost:     { ar: 'على وشك الإقفال', en: 'Almost Done', ring: 'ring-sky-200', bar: 'bg-sky-500',     text: 'text-sky-700',    bg: 'bg-sky-50',    icon: Sparkles },
    done:       { ar: 'مُحصّل بالكامل', en: 'Fully Paid',   ring: 'ring-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle },
  };

  const TabButton = ({ id, label, count, accent }: { id: ApprovalTab; label: string; count: number; accent?: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        tab === id ? 'border-brand-500 text-brand-700' : 'border-transparent text-brand-400 hover:text-brand-600'
      }`}
    >
      {label} {count > 0 && <span className={`ms-1.5 inline-flex items-center justify-center text-[11px] font-bold px-1.5 py-0.5 rounded-full ${accent || 'bg-brand-100 text-brand-700'}`}>{count}</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* === Hero Header === */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-6 lg:p-8 text-white">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/[0.04]" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 rounded-full bg-white/[0.03]" />
        <div className={`relative flex flex-col lg:flex-row items-start lg:items-center gap-6 ${isAr ? 'lg:flex-row-reverse' : ''}`}>
          <div className="flex-1">
            <p className="text-white/60 text-xs uppercase tracking-wider font-semibold inline-flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> {t('payments_title')}
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold mt-2">
              {fmtCompact(totalCollected)} <span className="text-white/50 text-2xl">/ {fmtCompact(totalValue)} {t('sar')}</span>
            </h1>
            <p className="text-white/70 text-sm mt-2">
              {isAr
                ? `تحصيل ${overallPct}% من إجمالي ${contracts.length} عقد · المتبقي ${fmtCompact(totalRemaining)} ر.س`
                : `${overallPct}% collected across ${contracts.length} contracts · ${fmtCompact(totalRemaining)} SAR remaining`}
            </p>
            <div className="mt-5 max-w-md">
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-200 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          </div>
          {/* Mini donut on the side */}
          <div className="relative inline-flex">
            <Donut pct={overallPct} color="#10b981" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{overallPct}%</span>
              <span className="text-[10px] uppercase tracking-wider text-white/60">{isAr ? 'محصّل' : 'Collected'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === KPI strip === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('contract_total'),     value: fmtCompact(totalValue),     icon: Wallet,  color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: t('contract_collected'), value: fmtCompact(totalCollected), icon: Coins,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('contract_remaining'), value: fmtCompact(totalRemaining), icon: Receipt, color: 'text-rose-600',    bg: 'bg-rose-50' },
          { label: isAr ? 'إجمالي العمولات المستحقة' : 'Total Commissions Earned', value: fmtCompact(Math.round(totalCommission)), icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(k => (
          <div key={k.label} className={`card p-4 hover:shadow-md transition-shadow ${isAr ? 'text-right' : ''}`}>
            <div className={`flex items-start justify-between gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
              <div>
                <p className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color} mt-1`}>{k.value} <span className="text-xs font-medium text-brand-400">{t('sar')}</span></p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center flex-shrink-0`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* === Health buckets + Hotel breakdown === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Buckets — clickable filters */}
        <div className="lg:col-span-2 card p-5">
          <div className={`flex items-center justify-between mb-4 ${isAr ? 'flex-row-reverse' : ''}`}>
            <h2 className="font-bold text-brand-900 inline-flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              {isAr ? 'نظرة على صحة العقود' : 'Contract Health'}
            </h2>
            <span className="text-xs text-brand-400">{isAr ? 'اضغط للفلترة' : 'Click to filter'}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(['at_risk', 'in_progress', 'almost', 'done'] as HealthBucket[]).map(b => {
              const cfg = healthCfg[b];
              const count = bucketCounts[b];
              const active = healthFilter === b;
              return (
                <button
                  key={b}
                  onClick={() => setHealthFilter(active ? 'all' : b)}
                  className={`p-4 rounded-xl border-2 transition-all text-start ${active ? `${cfg.bg} ${cfg.ring} ring-2 border-transparent shadow-sm` : 'bg-white border-brand-100 hover:border-brand-300'} ${isAr ? 'text-right' : ''}`}
                >
                  <cfg.icon className={`w-5 h-5 ${cfg.text} mb-2`} />
                  <p className="text-xs text-brand-500 font-medium">{isAr ? cfg.ar : cfg.en}</p>
                  <p className={`text-2xl font-bold ${cfg.text} mt-1`}>{count}</p>
                  <p className="text-[10px] text-brand-400 mt-0.5">{isAr ? 'عقد' : count === 1 ? 'contract' : 'contracts'}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hotel breakdown */}
        <div className="card p-5">
          <h2 className={`font-bold text-brand-900 mb-4 inline-flex items-center gap-2 ${isAr ? 'flex-row-reverse w-full justify-end' : ''}`}>
            <HotelIcon className="w-5 h-5 text-brand-500" />
            {isAr ? 'أعلى الفنادق' : 'Top Hotels'}
          </h2>
          <div className="space-y-3">
            {hotelBreakdown.length === 0 && (
              <p className="text-center text-brand-400 text-sm py-8">{t('no_data')}</p>
            )}
            {hotelBreakdown.map(h => {
              const pct = h.total > 0 ? Math.round((h.collected / h.total) * 100) : 0;
              return (
                <div key={h.name}>
                  <div className={`flex items-center justify-between text-xs mb-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <span className="font-medium text-brand-700 truncate">{h.name}</span>
                    <span className="text-brand-500 font-semibold flex-shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-brand-50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-brand-400 mt-0.5">
                    {fmtCompact(h.collected)} / {fmtCompact(h.total)} {t('sar')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === Filter bar === */}
      <div className={`card p-4 flex flex-wrap items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-48">
          <Search className={`absolute top-3 w-4 h-4 text-brand-400 ${isAr ? 'right-3' : 'left-3'}`} />
          <input
            className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
            placeholder={isAr ? 'ابحث: الشركة، الفندق، رقم العقد، المندوب...' : 'Search: company, hotel, ref, rep...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {healthFilter !== 'all' && (
          <button
            onClick={() => setHealthFilter('all')}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-brand-100 text-brand-700 inline-flex items-center gap-1 hover:bg-brand-200"
          >
            {isAr ? `الفلتر: ${healthCfg[healthFilter].ar}` : `Filter: ${healthCfg[healthFilter].en}`} <X className="w-3 h-3" />
          </button>
        )}
        <span className="text-xs text-brand-400">
          {filteredContracts.length} / {contracts.length} {isAr ? 'عقد' : 'contracts'}
        </span>
      </div>

      {/* === Contracts grid === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredContracts.map(c => {
          const collected = c.collectedAmount || 0;
          const total = c.totalValue || 0;
          const remaining = Math.max(total - collected, 0);
          const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
          const commissionAmt = c.salesRep?.commissionRate
            ? Math.round((collected * c.salesRep.commissionRate) / 100)
            : 0;
          const bucket = bucketOf(c);
          const cfg = healthCfg[bucket];

          return (
            <div key={c.id} className={`card p-5 hover:shadow-lg transition-shadow group ${isAr ? 'text-right' : ''}`}>
              {/* Top row: company link + bucket badge */}
              <div className={`flex items-start justify-between gap-3 mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1 min-w-0">
                  <Link to={`/clients/${c.client?.id}`} className="font-bold text-brand-900 hover:text-brand-600 truncate block">
                    {c.client?.companyName}
                  </Link>
                  <p className="text-xs text-brand-400 truncate mt-0.5">
                    {c.contractRef} · {c.hotel?.name}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${cfg.bg} ${cfg.text} text-[10px] font-bold flex-shrink-0`}>
                  <cfg.icon className="w-3 h-3" /> {isAr ? cfg.ar : cfg.en}
                </span>
              </div>

              {/* Big % */}
              <div className={`flex items-end justify-between mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                <span className={`text-3xl font-extrabold ${cfg.text}`}>{pct}%</span>
                <span className="text-xs text-brand-400 font-medium">{isAr ? 'تم تحصيله' : 'collected'}</span>
              </div>

              {/* Progress bar with marker for 30/75 thresholds */}
              <div className="relative h-2 bg-brand-50 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${pct}%` }} />
              </div>

              {/* Three small stats */}
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-brand-400">{isAr ? 'الإجمالي' : 'Total'}</p>
                  <p className="font-bold text-brand-900">{fmtCompact(total)}</p>
                </div>
                <div>
                  <p className="text-brand-400">{isAr ? 'محصّل' : 'Paid'}</p>
                  <p className="font-bold text-emerald-600">{fmtCompact(collected)}</p>
                </div>
                <div>
                  <p className="text-brand-400">{isAr ? 'متبقّي' : 'Left'}</p>
                  <p className="font-bold text-rose-600">{fmtCompact(remaining)}</p>
                </div>
              </div>

              {/* Footer: rep + commission */}
              {c.salesRep && (
                <div className={`mt-4 pt-3 border-t border-brand-50 flex items-center justify-between text-[11px] ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="text-brand-500 truncate">
                    👤 {c.salesRep.name}
                    {c.salesRep.commissionRate ? <span className="text-brand-400"> · {c.salesRep.commissionRate}%</span> : ''}
                  </span>
                  {commissionAmt > 0 && (
                    <span className="text-violet-600 font-semibold inline-flex items-center gap-1 flex-shrink-0">
                      <Sparkles className="w-3 h-3" /> {fmtCompact(commissionAmt)} {t('sar')}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredContracts.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 card py-16 text-center">
            <Building2 className="w-12 h-12 text-brand-200 mx-auto mb-3" />
            <p className="text-brand-400">{isAr ? 'لا توجد عقود مطابقة للفلتر' : 'No contracts match the filter'}</p>
          </div>
        )}
      </div>

      {/* === Payments table with status tabs === */}
      <div className="card p-5">
        <div className={`flex items-center justify-between mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
          <h2 className="font-bold text-brand-900 inline-flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
            {t('nav_payments')}
          </h2>
          <Link to="/credit-payments" className="text-xs text-brand-600 font-semibold hover:underline inline-flex items-center gap-1">
            {isAr ? 'تسجيل دفعة' : 'Record Payment'} <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <div className={`flex border-b border-brand-100 mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
          <TabButton id="all" label={isAr ? 'الكل' : 'All'} count={counts.all} />
          <TabButton id="pending" label={isAr ? 'بانتظار الموافقة' : 'Pending'} count={counts.pending} accent="bg-amber-100 text-amber-700" />
          <TabButton id="approved" label={isAr ? 'معتمد' : 'Approved'} count={counts.approved} accent="bg-green-100 text-green-700" />
          <TabButton id="rejected" label={isAr ? 'مرفوض' : 'Rejected'} count={counts.rejected} accent="bg-red-100 text-red-700" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('client_company')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('payment_amount')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('payment_type')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('payment_date')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('payment_collected_by')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'الحالة' : 'Status'}</th>
                {canApprove && (
                  <th className={`pb-3 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'إجراء' : 'Action'}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {visiblePayments.map(p => (
                <tr key={p.id} className="hover:bg-brand-50/50">
                  <td className={`py-3 font-medium text-brand-900 ${isAr ? 'text-right' : ''}`}>
                    <Link to={`/clients/${p.client?.id}`} className="hover:text-brand-600">
                      {p.client?.companyName}
                    </Link>
                    <p className="text-xs text-brand-400">{p.contract?.contractRef}</p>
                  </td>
                  <td className={`py-3 font-bold ${p.status === 'approved' ? 'text-green-600' : p.status === 'pending' ? 'text-amber-600' : 'text-brand-400'} ${isAr ? 'text-right' : ''}`}>
                    {p.amount.toLocaleString()} {t('sar')}
                  </td>
                  <td className={`py-3 text-brand-500 ${isAr ? 'text-right' : ''}`}>
                    {p.paymentType ? (PAYMENT_TYPES[p.paymentType] || p.paymentType) : '-'}
                  </td>
                  <td className={`py-3 text-brand-400 ${isAr ? 'text-right' : ''}`}>
                    {format(parseISO(p.paymentDate), 'dd MMM yyyy', { locale })}
                  </td>
                  <td className={`py-3 text-brand-400 ${isAr ? 'text-right' : ''}`}>
                    {p.collector?.name}
                  </td>
                  <td className={`py-3 ${isAr ? 'text-right' : ''}`}>
                    <StatusBadge status={p.status} />
                    {p.status === 'rejected' && p.approvalNotes && (
                      <p className="text-[10px] text-red-500 mt-0.5">{p.approvalNotes}</p>
                    )}
                  </td>
                  {canApprove && (
                    <td className={`py-3 ${isAr ? 'text-right' : ''}`}>
                      {p.status === 'pending' ? (
                        <div className="flex gap-1">
                          <button type="button" disabled={busyId === p.id} onClick={() => handleApprove(p.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium border border-green-200 disabled:opacity-50">
                            <Check className="w-3 h-3" /> {isAr ? 'موافقة' : 'Approve'}
                          </button>
                          <button type="button" disabled={busyId === p.id} onClick={() => handleReject(p.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium border border-red-200 disabled:opacity-50">
                            <X className="w-3 h-3" /> {isAr ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-400">{p.approver?.name || '-'}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {visiblePayments.length === 0 && (
                <tr>
                  <td colSpan={canApprove ? 7 : 6} className="py-8 text-center text-brand-400">{t('no_payments')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
