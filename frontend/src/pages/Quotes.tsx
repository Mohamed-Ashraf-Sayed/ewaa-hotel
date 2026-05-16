import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Download, CheckCircle, XCircle, Building2, User as UserIcon } from 'lucide-react';
import { quotesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

type QuoteStatus = 'pending_manager_approval' | 'approved' | 'rejected' | 'closed';
type StatusFilter = 'all' | QuoteStatus;

interface QuoteRow {
  id: number;
  reference: string;
  clientId: number;
  clientName: string | null;
  hotelId: number | null;
  hotelName: string | null;
  salesRepId: number;
  salesRepName: string | null;
  grandTotal: number;
  validUntil: string;
  arrivalDate: string | null;
  status: QuoteStatus;
  approvalNote: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  closedAt: string | null;
  createdAt: string;
}

export default function Quotes() {
  const { hasRole } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;

  // Approve / reject buttons only render for roles that can act on
  // pending quotes. Everyone else sees the same list read-only.
  const canApprove = hasRole('sales_director', 'admin', 'general_manager', 'vice_gm');

  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [busy, setBusy] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QuoteRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await quotesApi.listAll();
      setRows(r.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const approve = async (q: QuoteRow) => {
    setBusy(q.id);
    try { await quotesApi.approve(q.id); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || (isAr ? 'فشل الاعتماد' : 'Failed to approve')); }
    finally { setBusy(null); }
  };
  const submitReject = async () => {
    if (!rejectTarget || !rejectNote.trim()) return;
    setBusy(rejectTarget.id);
    try {
      await quotesApi.reject(rejectTarget.id, rejectNote.trim());
      setRejectTarget(null); setRejectNote('');
      await load();
    } catch (e: any) { alert(e?.response?.data?.message || (isAr ? 'فشل الرفض' : 'Failed to reject')); }
    finally { setBusy(null); }
  };

  const downloadPdf = async (q: QuoteRow) => {
    try {
      const res = await quotesApi.downloadPdf(q.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Quote_${q.reference}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { alert(isAr ? 'تعذّر تحميل الملف' : 'Failed to download'); }
  };

  const statusInfo = useMemo(() => ({
    pending_manager_approval: { ar: 'بانتظار موافقة المدير', en: 'Awaiting Manager', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
    closed: { ar: 'مُغلق', en: 'Closed', cls: 'bg-brand-100 text-brand-600 border-brand-200' },
  }), []);

  const FILTER_OPTS: { key: StatusFilter; ar: string; en: string }[] = [
    { key: 'all',                      ar: 'الكل',     en: 'All' },
    { key: 'pending_manager_approval', ar: 'معلقة',    en: 'Pending' },
    { key: 'approved',                 ar: 'معتمدة',   en: 'Approved' },
    { key: 'rejected',                 ar: 'مرفوضة',   en: 'Rejected' },
    { key: 'closed',                   ar: 'مُغلقة',   en: 'Closed' },
  ];
  // Unique client/rep options sourced from the loaded rows, so the dropdowns
  // only show what the user can actually pick — empty values are dropped.
  const clientOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.clientName).filter((n): n is string => !!n)))
      .sort((a, b) => a.localeCompare(b, 'ar')),
    [rows],
  );
  const repOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.salesRepName).filter((n): n is string => !!n)))
      .sort((a, b) => a.localeCompare(b, 'ar')),
    [rows],
  );

  // Apply the dropdown filters first so the status chip counts reflect the
  // narrowed slice — picking a company and seeing "Approved (3)" tells you
  // how many of HIS quotes are approved.
  const narrowed = rows.filter(r =>
    (clientFilter === 'all' || r.clientName === clientFilter) &&
    (repFilter === 'all' || r.salesRepName === repFilter)
  );
  const countFor = (k: StatusFilter) =>
    k === 'all' ? narrowed.length : narrowed.filter(r => r.status === k).length;
  const filtered = statusFilter === 'all' ? narrowed : narrowed.filter(r => r.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className={`flex items-center justify-between gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'عروض الأسعار' : 'Quotes'}</h1>
          <p className="text-sm text-brand-500 mt-1">
            {isAr ? 'كل عروض الأسعار حسب صلاحياتك. فلتر بالحالة لإيجاد المعتمد أو المرفوض بسرعة.' : 'Every quote you can see. Filter by status to find approved, rejected, or pending fast.'}
          </p>
        </div>
      </div>

      {/* Client + sales rep dropdown filters. Populated from whatever quotes
          the user can see, so picking one narrows the list to a single
          company or rep without typing. */}
      <div className={`flex flex-wrap gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className="min-w-[200px]">
          <label className="block text-xs text-brand-500 mb-1">{isAr ? 'الشركة' : 'Client'}</label>
          <select
            className="input"
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
          >
            <option value="all">{isAr ? 'كل الشركات' : 'All clients'}</option>
            {clientOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs text-brand-500 mb-1">{isAr ? 'المندوب' : 'Sales Rep'}</label>
          <select
            className="input"
            value={repFilter}
            onChange={e => setRepFilter(e.target.value)}
          >
            <option value="all">{isAr ? 'كل المندوبين' : 'All reps'}</option>
            {repOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status filter chips — visible to every role; same labels as the
          per-client tab so the workflow is identical from anywhere. */}
      <div className={`flex flex-wrap gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
        {FILTER_OPTS.map(opt => {
          const active = statusFilter === opt.key;
          const n = countFor(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                active
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
              }`}>
              {isAr ? opt.ar : opt.en} ({n})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-brand-400">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{isAr ? 'لا توجد عروض بهذه الحالة.' : 'No quotes match this filter.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const s = statusInfo[q.status] || statusInfo.pending_manager_approval;
            const isPending = q.status === 'pending_manager_approval';
            return (
              <div key={q.id} className="card p-4">
                <div className={`flex flex-wrap items-start justify-between gap-3 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="flex-1 min-w-[280px]">
                    <div className={`flex items-center gap-2 mb-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${s.cls}`}>
                        {isAr ? s.ar : s.en}
                      </span>
                      <span className="text-xs text-brand-400 font-mono">#{q.reference}</span>
                      {q.approvedByName && !isPending && (
                        <span className="text-[11px] text-brand-400">
                          {isAr ? `${q.status === 'rejected' ? 'رفضه' : 'اعتمده'}: ${q.approvedByName}` : `${q.status === 'rejected' ? 'Rejected by' : 'Approved by'}: ${q.approvedByName}`}
                        </span>
                      )}
                    </div>
                    <Link to={`/clients/${q.clientId}`} className="text-base font-bold text-brand-900 hover:text-brand-700">
                      {q.clientName || '—'}
                    </Link>
                    {q.approvalNote && (
                      <div className="text-[11px] text-brand-500 mt-1 italic" title={q.approvalNote}>
                        {q.approvalNote}
                      </div>
                    )}
                    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm`}>
                      <div>
                        <div className="text-[11px] text-brand-400">{isAr ? 'المندوب' : 'Sales Rep'}</div>
                        <div className="text-brand-700 flex items-center gap-1"><UserIcon className="w-3 h-3" /> {q.salesRepName || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-brand-400">{isAr ? 'الفندق' : 'Hotel'}</div>
                        <div className="text-brand-700 flex items-center gap-1"><Building2 className="w-3 h-3" /> {q.hotelName || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-brand-400">{isAr ? 'الإجمالي' : 'Total'}</div>
                        <div className="text-brand-900 font-semibold">{q.grandTotal.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-brand-400">{isAr ? 'صالح حتى' : 'Valid Until'}</div>
                        <div className="text-brand-700">{q.validUntil ? format(parseISO(q.validUntil), 'dd MMM yyyy', { locale }) : '-'}</div>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                    <button className="btn-secondary text-xs py-1.5" onClick={() => downloadPdf(q)} title={isAr ? 'تحميل PDF' : 'Download PDF'}>
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    {canApprove && isPending && (
                      <>
                        <button
                          className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 disabled:opacity-60"
                          disabled={busy === q.id}
                          onClick={() => approve(q)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> {isAr ? 'اعتماد' : 'Approve'}
                        </button>
                        <button
                          className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-1 disabled:opacity-60"
                          disabled={busy === q.id}
                          onClick={() => { setRejectTarget(q); setRejectNote(''); }}
                        >
                          <XCircle className="w-3.5 h-3.5" /> {isAr ? 'رفض' : 'Reject'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRejectTarget(null)}>
          <div className="bg-white rounded-xl shadow-elevated w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brand-900 mb-2">{isAr ? 'رفض عرض السعر' : 'Reject Quote'}</h3>
            <p className="text-sm text-brand-500 mb-3">
              {isAr ? `سيتم رفض العرض ${rejectTarget.reference} وإبلاغ المندوب بالسبب.` : `Quote ${rejectTarget.reference} will be rejected and the rep notified.`}
            </p>
            <label className="label">{isAr ? 'سبب الرفض' : 'Reason'} *</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder={isAr ? 'اكتب سبب الرفض...' : 'Type the reason...'}
            />
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setRejectTarget(null)}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="px-4 py-2 rounded-md text-sm font-semibold bg-red-600 hover:bg-red-700 text-white flex-1 disabled:opacity-60"
                disabled={!rejectNote.trim() || busy === rejectTarget.id}
                onClick={submitReject}
              >
                {busy === rejectTarget.id ? (isAr ? 'جاري الرفض...' : 'Rejecting...') : (isAr ? 'تأكيد الرفض' : 'Confirm Reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
