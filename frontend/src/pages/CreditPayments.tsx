import { useEffect, useState } from 'react';
import { CreditCard, Building2, Search, Plus, CheckCircle } from 'lucide-react';
import { clientsApi, contractsApi, paymentsApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/Modal';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface ClientLite {
  id: number;
  companyName: string;
  contactPerson?: string;
  phone?: string;
  salesRep?: { id: number; name: string };
}

interface ContractLite {
  id: number;
  contractRef?: string;
  status: string;
  totalValue?: number;
  collectedAmount?: number;
  hotel?: { id: number; name: string };
  startDate?: string;
  endDate?: string;
}

interface PaymentLite {
  id: number;
  amount: number;
  paymentDate: string;
  paymentType?: string;
  reference?: string;
  receiptUrl?: string;
  collector?: { name: string };
  contract?: { contractRef?: string };
}

export default function CreditPayments() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);
  const [contracts, setContracts] = useState<ContractLite[]>([]);
  const [payments, setPayments] = useState<PaymentLite[]>([]);
  const [loadingClient, setLoadingClient] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const todayIso = new Date().toISOString().split('T')[0];
  const emptyForm = { contractId: '', amount: '', paymentDate: todayIso, paymentType: 'bank_transfer', reference: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [receipt, setReceipt] = useState<File | null>(null);

  useEffect(() => {
    clientsApi.getAll().then(r => setClients(r.data)).catch(() => setClients([]));
  }, []);

  const filteredClients = clients.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.companyName?.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  const loadClientData = async (client: ClientLite) => {
    setSelectedClient(client);
    setLoadingClient(true);
    try {
      const [ctRes, pmRes] = await Promise.all([
        contractsApi.getAll({ clientId: client.id, status: 'approved' }),
        paymentsApi.getAll({ clientId: client.id }),
      ]);
      setContracts(ctRes.data);
      setPayments(pmRes.data);
    } finally {
      setLoadingClient(false);
    }
  };

  const openPaymentModal = (contractId?: number) => {
    setForm({ ...emptyForm, contractId: contractId ? String(contractId) : '' });
    setReceipt(null);
    setShowModal(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('clientId', String(selectedClient.id));
      Object.entries(form).forEach(([k, v]) => fd.append(k, v as string));
      if (receipt) fd.append('receipt', receipt);
      await paymentsApi.create(fd);
      setShowModal(false);
      setForm(emptyForm);
      setReceipt(null);
      await loadClientData(selectedClient);
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const totalValue = contracts.reduce((s, c) => s + (c.totalValue || 0), 0);
  const totalCollected = contracts.reduce((s, c) => s + (c.collectedAmount || 0), 0);
  const totalRemaining = Math.max(totalValue - totalCollected, 0);

  const PAYMENT_TYPES = [
    { value: 'bank_transfer', label: isAr ? 'تحويل بنكي' : 'Bank Transfer' },
    { value: 'cash', label: isAr ? 'نقدي' : 'Cash' },
    { value: 'cheque', label: isAr ? 'شيك' : 'Cheque' },
    { value: 'card', label: isAr ? 'بطاقة' : 'Card' },
  ];
  const paymentTypeLabel = (v?: string) => PAYMENT_TYPES.find(p => p.value === v)?.label || v || '-';

  return (
    <div className="space-y-5">
      <div className={`flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">
            {isAr ? 'تحصيل الائتمان' : 'Credit Collections'}
          </h1>
          <p className="text-brand-400 text-sm mt-0.5">
            {isAr ? 'تسجيل دفعات السداد للعملاء' : 'Record client payment collections'}
          </p>
        </div>
        <CreditCard className="w-8 h-8 text-brand-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Clients list */}
        <div className="card p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="relative mb-3">
            <Search className={`absolute top-3 w-4 h-4 text-brand-400 ${isAr ? 'right-3' : 'left-3'}`} />
            <input
              className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
              placeholder={isAr ? 'ابحث عن عميل...' : 'Search clients...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-brand-400 mb-2">
            {filteredClients.length} {isAr ? 'عميل' : 'clients'}
          </p>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filteredClients.map(c => (
              <button
                key={c.id}
                onClick={() => loadClientData(c)}
                className={`w-full text-start p-2.5 rounded-lg transition-colors ${
                  selectedClient?.id === c.id
                    ? 'bg-brand-100 text-brand-900'
                    : 'hover:bg-brand-50 text-brand-700'
                } ${isAr ? 'text-right' : ''}`}
              >
                <p className="font-semibold text-sm truncate">{c.companyName}</p>
                {c.salesRep && (
                  <p className="text-[11px] text-brand-400 truncate">👤 {c.salesRep.name}</p>
                )}
              </button>
            ))}
            {filteredClients.length === 0 && (
              <p className="text-center text-brand-400 text-xs py-8">
                {isAr ? 'لا يوجد عملاء' : 'No clients'}
              </p>
            )}
          </div>
        </div>

        {/* Client detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedClient ? (
            <div className="card py-20 text-center">
              <Building2 className="w-12 h-12 text-brand-200 mx-auto mb-3" />
              <p className="text-brand-400 font-semibold">
                {isAr ? 'اختر عميلاً لعرض العقود وتسجيل السداد' : 'Select a client to view contracts and record payment'}
              </p>
            </div>
          ) : loadingClient ? (
            <div className="card py-20 text-center">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Client header + totals */}
              <div className="card p-5">
                <div className={`flex items-start justify-between gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={isAr ? 'text-right' : ''}>
                    <h2 className="text-lg font-bold text-brand-900">{selectedClient.companyName}</h2>
                    {selectedClient.contactPerson && (
                      <p className="text-xs text-brand-400 mt-0.5">👤 {selectedClient.contactPerson}</p>
                    )}
                    {selectedClient.phone && (
                      <p className="text-xs text-brand-400">📞 {selectedClient.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => openPaymentModal()}
                    disabled={contracts.length === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {isAr ? 'تسجيل دفعة' : 'Record Payment'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="p-3 rounded-lg bg-blue-50">
                    <p className="text-[11px] text-brand-400">{isAr ? 'إجمالي العقود' : 'Total'}</p>
                    <p className="font-bold text-blue-700 mt-0.5">{totalValue.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50">
                    <p className="text-[11px] text-brand-400">{isAr ? 'المحصل' : 'Collected'}</p>
                    <p className="font-bold text-emerald-700 mt-0.5">{totalCollected.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50">
                    <p className="text-[11px] text-brand-400">{isAr ? 'المتبقي' : 'Remaining'}</p>
                    <p className="font-bold text-red-700 mt-0.5">{totalRemaining.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}</p>
                  </div>
                </div>
              </div>

              {/* Contracts */}
              <div className="card p-5">
                <h3 className={`font-bold text-brand-900 mb-3 ${isAr ? 'text-right' : ''}`}>
                  {isAr ? 'العقود المعتمدة' : 'Approved Contracts'}
                </h3>
                {contracts.length === 0 ? (
                  <p className="text-center text-brand-400 text-sm py-6">
                    {isAr ? 'لا توجد عقود معتمدة لهذا العميل' : 'No approved contracts for this client'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {contracts.map(c => {
                      const collected = c.collectedAmount || 0;
                      const total = c.totalValue || 0;
                      const remaining = Math.max(total - collected, 0);
                      const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
                      return (
                        <div key={c.id} className="p-3 rounded-lg bg-brand-50/50 border border-brand-100">
                          <div className={`flex items-center justify-between gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                            <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : ''}`}>
                              <p className="font-semibold text-brand-900 text-sm">
                                {c.contractRef || `#${c.id}`} · {c.hotel?.name}
                              </p>
                              <div className={`flex gap-3 text-[11px] text-brand-500 mt-1 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                                <span>{isAr ? 'إجمالي' : 'Total'}: {total.toLocaleString()}</span>
                                <span className="text-emerald-600">{isAr ? 'محصل' : 'Collected'}: {collected.toLocaleString()}</span>
                                <span className="text-red-600">{isAr ? 'متبقي' : 'Remaining'}: {remaining.toLocaleString()}</span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
                                <div
                                  className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => openPaymentModal(c.id)}
                              className="btn-secondary text-xs flex-shrink-0"
                            >
                              <Plus className="w-3 h-3" /> {isAr ? 'دفعة' : 'Payment'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent payments */}
              <div className="card p-5">
                <h3 className={`font-bold text-brand-900 mb-3 ${isAr ? 'text-right' : ''}`}>
                  {isAr ? 'سجل السداد' : 'Payment History'}
                </h3>
                {payments.length === 0 ? (
                  <p className="text-center text-brand-400 text-sm py-6">
                    {isAr ? 'لا توجد دفعات مسجلة' : 'No payments recorded'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.map(p => (
                      <div key={p.id} className={`p-3 rounded-lg border border-brand-100 flex items-start justify-between gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <div className={isAr ? 'text-right' : ''}>
                          <p className="font-bold text-emerald-600">
                            {p.amount.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                          </p>
                          <p className="text-[11px] text-brand-500 mt-0.5">
                            {p.contract?.contractRef} · {paymentTypeLabel(p.paymentType)}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </p>
                          {p.receiptUrl && (
                            <a href={`/uploads/${p.receiptUrl}`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-brand-600 hover:underline">
                              📎 {isAr ? 'إيصال' : 'Receipt'}
                            </a>
                          )}
                        </div>
                        <div className={`text-[11px] text-brand-400 ${isAr ? 'text-left' : 'text-right'}`}>
                          <p>{format(parseISO(p.paymentDate), 'dd MMM yyyy', { locale })}</p>
                          {p.collector?.name && <p className="mt-0.5">{p.collector.name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={isAr ? `تسجيل دفعة — ${selectedClient?.companyName || ''}` : `Record Payment — ${selectedClient?.companyName || ''}`}
        size="lg">
        <form onSubmit={submitPayment} className="space-y-4">
          <div>
            <label className="label">{isAr ? 'العقد' : 'Contract'} *</label>
            <select className="input" required value={form.contractId}
              onChange={e => setForm(p => ({ ...p, contractId: e.target.value }))}>
              <option value="">{isAr ? 'اختر العقد...' : 'Select contract...'}</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.contractRef || `#${c.id}`} — {(c.totalValue || 0).toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'المبلغ' : 'Amount'} *</label>
              <input className="input" type="number" required min="1" step="0.01" dir="ltr"
                value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'تاريخ السداد' : 'Payment Date'} *</label>
              <input className="input" type="date" required
                value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{isAr ? 'طريقة السداد' : 'Payment Method'} *</label>
            <select className="input" required value={form.paymentType}
              onChange={e => setForm(p => ({ ...p, paymentType: e.target.value }))}>
              {PAYMENT_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{isAr ? 'رقم المرجع' : 'Reference'} *</label>
            <input className="input" required maxLength={100} pattern="[A-Za-z0-9\-_/ ]+" dir="ltr"
              value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
          </div>
          <div>
            <label className="label">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea className="input resize-none" rows={2}
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div>
            <label className="label">{isAr ? 'صورة السداد / إيصال' : 'Payment Receipt / Image'}</label>
            <input type="file" accept="image/*,.pdf" className="input"
              onChange={e => setReceipt(e.target.files?.[0] || null)} />
            {receipt && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {receipt.name} ({(receipt.size / 1024).toFixed(0)} KB)
              </p>
            )}
            <p className="text-[11px] text-brand-400 mt-1">
              {isAr ? 'JPG / PNG / PDF — حتى 20 ميجا' : 'JPG / PNG / PDF — up to 20MB'}
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الدفعة' : 'Save Payment')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
