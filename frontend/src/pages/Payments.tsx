import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, TrendingUp, Building2, CheckCircle } from 'lucide-react';
import { paymentsApi, contractsApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface PaymentWithDetails {
  id: number;
  amount: number;
  paymentDate: string;
  paymentType?: string;
  reference?: string;
  contract?: { id: number; contractRef?: string; totalValue?: number };
  client?: { id: number; companyName: string };
  collector?: { id: number; name: string };
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

export default function Payments() {
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? arSA : enUS;
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{t('payments_title')}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{contracts.length} {t('nav_contracts')}</p>
        </div>
        <CreditCard className="w-8 h-8 text-brand-500" />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-t-4 border-blue-500">
          <p className={`text-xs text-brand-400 mb-1 ${lang === 'ar' ? 'text-right' : ''}`}>{t('contract_total')}</p>
          <p className={`text-2xl font-bold text-blue-600 ${lang === 'ar' ? 'text-right' : ''}`}>
            {(totalValue / 1000000).toFixed(1)}M {t('sar')}
          </p>
        </div>
        <div className="card p-5 border-t-4 border-green-500">
          <p className={`text-xs text-brand-400 mb-1 ${lang === 'ar' ? 'text-right' : ''}`}>{t('contract_collected')}</p>
          <p className={`text-2xl font-bold text-green-600 ${lang === 'ar' ? 'text-right' : ''}`}>
            {(totalCollected / 1000000).toFixed(1)}M {t('sar')}
          </p>
        </div>
        <div className="card p-5 border-t-4 border-red-500">
          <p className={`text-xs text-brand-400 mb-1 ${lang === 'ar' ? 'text-right' : ''}`}>{t('contract_remaining')}</p>
          <p className={`text-2xl font-bold text-red-600 ${lang === 'ar' ? 'text-right' : ''}`}>
            {(totalRemaining / 1000000).toFixed(1)}M {t('sar')}
          </p>
        </div>
        <div className="card p-5 border-t-4 border-brand-500">
          <p className={`text-xs text-brand-400 mb-1 ${lang === 'ar' ? 'text-right' : ''}`}>{t('payment_collection_pct')}</p>
          <p className={`text-2xl font-bold text-brand-600 ${lang === 'ar' ? 'text-right' : ''}`}>{overallPct}%</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
          </div>
        </div>
      </div>

      {/* Contracts Collection Status */}
      <div className="card p-5">
        <h2 className={`font-bold text-brand-900 mb-4 flex items-center gap-2 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
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
                <div className={`flex items-start justify-between mb-3 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                    <Link to={`/clients/${c.client?.id}`} className="font-medium text-brand-900 hover:text-brand-600">
                      {c.client?.companyName}
                    </Link>
                    <p className="text-xs text-brand-400 mt-0.5">
                      {c.contractRef} · {c.hotel?.name}
                      {c.salesRep?.commissionRate ? ` · ${t('commission_rate')}: ${c.salesRep.commissionRate}%` : ''}
                    </p>
                  </div>
                  <div className={`text-${lang === 'ar' ? 'left' : 'right'}`}>
                    <span className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className={`flex gap-4 text-xs text-brand-500 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
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

      {/* Recent Payments */}
      <div className="card p-5">
        <h2 className={`font-bold text-brand-900 mb-4 flex items-center gap-2 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
          <Building2 className="w-5 h-5 text-green-500" />
          {t('nav_payments')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className={`pb-3 font-medium text-brand-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('client_company')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('payment_amount')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('payment_type')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('payment_date')}</th>
                <th className={`pb-3 font-medium text-brand-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('payment_collected_by')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-brand-50/50">
                  <td className={`py-3 font-medium text-brand-900 ${lang === 'ar' ? 'text-right' : ''}`}>
                    <Link to={`/clients/${p.client?.id}`} className="hover:text-brand-600">
                      {p.client?.companyName}
                    </Link>
                    <p className="text-xs text-brand-400">{p.contract?.contractRef}</p>
                  </td>
                  <td className={`py-3 font-bold text-green-600 ${lang === 'ar' ? 'text-right' : ''}`}>
                    {p.amount.toLocaleString()} {t('sar')}
                  </td>
                  <td className={`py-3 text-brand-500 ${lang === 'ar' ? 'text-right' : ''}`}>
                    {p.paymentType ? (PAYMENT_TYPES[p.paymentType] || p.paymentType) : '-'}
                  </td>
                  <td className={`py-3 text-brand-400 ${lang === 'ar' ? 'text-right' : ''}`}>
                    {format(parseISO(p.paymentDate), 'dd MMM yyyy', { locale })}
                  </td>
                  <td className={`py-3 text-brand-400 ${lang === 'ar' ? 'text-right' : ''}`}>
                    {p.collector?.name}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-400">{t('no_payments')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
