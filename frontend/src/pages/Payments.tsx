import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, TrendingUp, Building2, CheckCircle, Clock, XCircle, Check, X } from 'lucide-react';
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

type Tab = 'all' | 'pending' | 'approved' | 'rejected';

export default function Payments() {
  const { t, lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const canApprove = hasRole('credit_manager', 'admin', 'general_manager', 'vice_gm');
  const [tab, setTab] = useState<Tab>(canApprove ? 'pending' : 'all');
  const [busyId, setBusyId] = useState<number | null>(null);

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

  const PAYMENT_TYPES: Record<string, string> = {
    cash: t('payment_cash'),
    bank_transfer: t('payment_bank'),
    check: t('payment_check'),
    online: t('payment_online'),
  };

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
    try {
      await paymentsApi.approve(id);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'فشل الاعتماد' : 'Failed to approve'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    const note = prompt(isAr ? 'سبب الرفض (اختياري):' : 'Rejection reason (optional):') ?? null;
    if (note === null) return; // user cancelled prompt
    setBusyId(id);
    try {
      await paymentsApi.reject(id, note || undefined);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'فشل الرفض' : 'Failed to reject'));
    } finally {
      setBusyId(null);
    }
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

  const TabButton = ({ id, label, count, accent }: { id: Tab; label: string; count: number; accent?: string }) => (
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
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{t('payments_title')}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{contracts.length} {t('nav_contracts')}</p>
        </div>
        <CreditCard className="w-8 h-8 text-brand-500" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-t-4 border-blue-500">
          <p className={`text-xs text-brand-400 mb-1 ${isAr ? 'text-right' : ''}`}>{t('contract_total')}</p>
          <p className={`text-2xl font-bold text-blue-600 ${isAr ? 'text-right' : ''}`}>
            {(totalValue / 1000000).toFixed(1)}M {t('sar')}
          </p>
        </div>
        <div className="card p-5 border-t-4 border-green-500">
          <p className={`text-xs text-brand-400 mb-1 ${isAr ? 'text-right' : ''}`}>{t('contract_collected')}</p>
          <p className={`text-2xl font-bold text-green-600 ${isAr ? 'text-right' : ''}`}>
            {(totalCollected / 1000000).toFixed(1)}M {t('sar')}
          </p>
        </div>
        <div className="card p-5 border-t-4 border-red-500">
          <p className={`text-xs text-brand-400 mb-1 ${isAr ? 'text-right' : ''}`}>{t('contract_remaining')}</p>
          <p className={`text-2xl font-bold text-red-600 ${isAr ? 'text-right' : ''}`}>
            {(totalRemaining / 1000000).toFixed(1)}M {t('sar')}
          </p>
        </div>
        <div className="card p-5 border-t-4 border-brand-500">
          <p className={`text-xs text-brand-400 mb-1 ${isAr ? 'text-right' : ''}`}>{t('payment_collection_pct')}</p>
          <p className={`text-2xl font-bold text-brand-600 ${isAr ? 'text-right' : ''}`}>{overallPct}%</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
          </div>
        </div>
      </div>

      {/* Contracts Collection Status */}
      <div className="card p-5">
        <h2 className={`font-bold text-brand-900 mb-4 flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
          <TrendingUp className="w-5 h-5 text-brand-500" />
          {t('nav_contracts')} — {t('payment_collection_pct')}
        </h2>
        <div className="space-y-3">
          {contracts.map(c => {
            const collected = c.collectedAmount || 0;
            const total = c.totalValue || 0;
            const remaining = Math.max(total - collected, 0);
            const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
            const commissionAmt = c.salesRep?.commissionRate
              ? Math.round((collected * c.salesRep.commissionRate) / 100)
              : 0;

            return (
              <div key={c.id} className="p-4 rounded-lg bg-brand-50/50 border border-brand-100">
                <div className={`flex items-start justify-between mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={isAr ? 'text-right' : 'text-left'}>
                    <Link to={`/clients/${c.client?.id}`} className="font-medium text-brand-900 hover:text-brand-600">
                      {c.client?.companyName}
                    </Link>
                    <p className="text-xs text-brand-400 mt-0.5">
                      {c.contractRef} · {c.hotel?.name}
                      {c.salesRep?.commissionRate ? ` · ${t('commission_rate')}: ${c.salesRep.commissionRate}%` : ''}
                    </p>
                  </div>
                  <div className={`text-${isAr ? 'left' : 'right'}`}>
                    <span className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className={`flex gap-4 text-xs text-brand-500 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    {t('contract_total')}: {total.toLocaleString()} {t('sar')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {t('contract_collected')}: {collected.toLocaleString()} {t('sar')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                    {t('contract_remaining')}: {remaining.toLocaleString()} {t('sar')}
                  </span>
                  {commissionAmt > 0 && (
                    <span className="flex items-center gap-1 text-brand-600 font-medium">
                      <CheckCircle className="w-3 h-3" />
                      {t('contract_commission')}: {commissionAmt.toLocaleString()} {t('sar')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {contracts.length === 0 && (
            <p className="text-center text-brand-400 py-8">{t('no_data')}</p>
          )}
        </div>
      </div>

      {/* Payments with status tabs */}
      <div className="card p-5">
        <h2 className={`font-bold text-brand-900 mb-3 flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
          <Building2 className="w-5 h-5 text-green-500" />
          {t('nav_payments')}
        </h2>

        <div className={`flex border-b border-brand-100 mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
          <TabButton id="all" label={isAr ? 'الكل' : 'All'} count={counts.all} />
          <TabButton id="pending" label={isAr ? 'بانتظار الموافقة' : 'Pending Approval'} count={counts.pending} accent="bg-amber-100 text-amber-700" />
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
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleApprove(p.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium border border-green-200 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> {isAr ? 'موافقة' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleReject(p.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium border border-red-200 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" /> {isAr ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-400">
                          {p.approver?.name ? (isAr ? `${p.approver.name}` : p.approver.name) : '-'}
                        </span>
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
