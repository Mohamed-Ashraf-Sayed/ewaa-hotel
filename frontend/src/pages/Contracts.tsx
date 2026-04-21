import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, Search, CheckCircle, XCircle, Clock, Download, Percent, Eye, GitBranch } from 'lucide-react';
import { contractsApi, hotelsApi, usersApi } from '../services/api';
import { Contract, Hotel } from '../types';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

export default function Contracts() {
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? arSA : enUS;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [allReps, setAllReps] = useState<{ id: number; name: string }[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [salesRepFilter, setSalesRepFilter] = useState('');
  const [search, setSearch] = useState('');
  const [approvalModal, setApprovalModal] = useState<Contract | null>(null);
  const [timelineModal, setTimelineModal] = useState<Contract | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [previewModal, setPreviewModal] = useState<Contract | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const { hasRole, user } = useAuth();
  const isAr = lang === 'ar';

  useEffect(() => { setStatusFilter(searchParams.get('status') || ''); }, [searchParams]);

  const load = () => {
    setLoading(true);
    contractsApi.getAll({
      status: statusFilter || undefined,
      salesRepId: salesRepFilter ? parseInt(salesRepFilter) : undefined,
      search: search || undefined,
    })
      .then(r => setContracts(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, salesRepFilter, search]);
  useEffect(() => { hotelsApi.getAll().then(r => setHotels(r.data)); }, []);

  // Load all sales-eligible users so dropdown shows reps even if they have no contracts yet
  useEffect(() => {
    usersApi.getAll().then(r => {
      const reps = (r.data as { id: number; name: string; role: string; isActive: boolean }[])
        .filter(u => u.isActive && ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role))
        .map(u => ({ id: u.id, name: u.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setAllReps(reps);
    }).catch(() => setAllReps([]));
  }, []);

  const handleApprove = async (status: 'approved' | 'rejected') => {
    if (!approvalModal) return;
    setSaving(true);
    try {
      await contractsApi.approve(approvalModal.id, status, approvalNote);
      setApprovalModal(null); setApprovalNote(''); load();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const handleDownload = async (c: Contract) => {
    try {
      const res = await contractsApi.download(c.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = c.fileName || 'contract';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { alert(t('error_occurred')); }
  };

  const handlePreview = async (c: Contract) => {
    try {
      const res = await contractsApi.download(c.id);
      const ext = c.fileName?.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'pdf' ? 'application/pdf'
        : ['png', 'jpg', 'jpeg'].includes(ext || '') ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
        : 'application/octet-stream';
      const url = URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      window.open(url, '_blank');
    } catch { alert(t('error_occurred')); }
  };

  const openTimeline = async (c: Contract) => {
    setTimelineModal(c);
    try {
      const res = await contractsApi.getOne(c.id);
      setTimelineData(res.data.approvals || []);
    } catch { setTimelineData([]); }
  };

  const statusBadge = (s: string) =>
    s === 'approved' ? <span className="badge-approved">{lang === 'ar' ? 'معتمد نهائي' : 'Fully Approved'}</span> :
    s === 'contract_approved' ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">{lang === 'ar' ? 'بانتظار نائب المدير' : 'Awaiting VGM'}</span> :
    s === 'credit_approved' ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">{lang === 'ar' ? 'بانتظار العقود' : 'Awaiting Contracts'}</span> :
    s === 'sales_approved' ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200/60">{lang === 'ar' ? 'بانتظار الائتمان' : 'Awaiting Credit'}</span> :
    s === 'rejected' ? <span className="badge-rejected">{t('contract_rejected')}</span> :
    <span className="badge-pending">{t('contract_pending')}</span>;

  const canApprove = hasRole('sales_director', 'credit_manager', 'contract_officer', 'vice_gm', 'general_manager');
  const isCreditManager = user?.role === 'credit_manager';
  const isContractOfficer = user?.role === 'contract_officer';
  const isSalesDirector = user?.role === 'sales_director';
  const isViceGM = user?.role === 'vice_gm';
  const isSalesRep = user?.role === 'sales_rep';
  const pendingCount = contracts.filter(c =>
    c.status === 'pending' || c.status === 'sales_approved' || c.status === 'credit_approved' || c.status === 'contract_approved'
  ).length;

  // Commission calculation for sales reps
  const myContracts = isSalesRep ? contracts.filter(c => c.salesRepId === user?.id && c.status === 'approved') : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{t('contracts_title')}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{t('all')}: {contracts.length}</p>
        </div>
      </div>

      {/* Sales Rep Commission Summary */}
      {isSalesRep && myContracts.length > 0 && (user as any)?.commissionRate > 0 && (
        <div className="card p-4 bg-gradient-to-r from-brand-50 to-green-50 border-brand-200">
          <div className={`flex items-center gap-2 mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
            <Percent className="w-5 h-5 text-brand-500" />
            <h3 className="font-bold text-brand-900">{t('contract_commission')}</h3>
          </div>
          <div className={`grid grid-cols-3 gap-4 text-center`}>
            {(() => {
              const totalCollected = myContracts.reduce((s, c) => s + (c.collectedAmount || 0), 0);
              const commissionRate = (user as any)?.commissionRate || 0;
              const commissionAmount = Math.round(totalCollected * commissionRate / 100);
              return (
                <>
                  <div>
                    <p className="text-xs text-brand-400">{t('contract_collected')}</p>
                    <p className="font-bold text-green-700">{totalCollected.toLocaleString()} {t('sar')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-400">{t('commission_rate')}</p>
                    <p className="font-bold text-brand-600">{commissionRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-400">{t('contract_commission')}</p>
                    <p className="font-bold text-brand-700">{commissionAmount.toLocaleString()} {t('sar')}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`card p-4 flex flex-wrap gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        {canApprove && pendingCount > 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-700 text-sm ${isAr ? 'flex-row-reverse' : ''}`}>
            <Clock className="w-4 h-4" />
            <span>{pendingCount} {lang === 'ar' ? 'عقد في انتظار مراجعتك' : 'contracts awaiting review'}</span>
          </div>
        )}
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('all')}</option>
          <option value="pending">{t('contract_pending')}</option>
          <option value="sales_approved">{lang === 'ar' ? 'بانتظار الائتمان' : 'Awaiting Credit'}</option>
          <option value="credit_approved">{lang === 'ar' ? 'بانتظار العقود' : 'Awaiting Contracts'}</option>
          <option value="contract_approved">{lang === 'ar' ? 'بانتظار نائب المدير' : 'Awaiting VGM'}</option>
          <option value="approved">{lang === 'ar' ? 'معتمد نهائي' : 'Fully Approved'}</option>
          <option value="rejected">{t('contract_rejected')}</option>
        </select>
        {allReps.length > 1 && (
          <select className="input w-48" value={salesRepFilter} onChange={e => setSalesRepFilter(e.target.value)}>
            <option value="">{lang === 'ar' ? 'كل المندوبين' : 'All Sales Reps'}</option>
            {allReps.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 min-w-48">
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-brand-400`} />
          <input className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
            placeholder={lang === 'ar' ? 'ابحث عن شركة...' : 'Search company...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 bg-brand-50/50">
                <th className="px-4 py-3.5 text-center font-medium text-brand-400">{t('contract_actions')}</th>
                <th className="px-4 py-3.5 text-center font-medium text-brand-400">{t('contract_status')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('payment_collection_pct')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('contract_period')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{user?.role === 'reservations' ? (isAr ? 'سعر الغرفة' : 'Room Rate') : t('contract_value')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('contract_rep')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('contract_hotel')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('contract_company')}</th>
                <th className={`px-4 py-3.5 font-medium text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>{t('contract_ref')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-brand-400">{t('loading')}</td></tr>
              ) : contracts.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-brand-400">{t('no_data')}</td></tr>
              ) : contracts.map(c => {
                const collected = c.collectedAmount || 0;
                const total = c.totalValue || 0;
                const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
                return (
                  <tr key={c.id} className="hover:bg-brand-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {c.fileUrl && (
                          <button onClick={() => handlePreview(c)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-brand-400 hover:text-emerald-600" title={lang === 'ar' ? 'اطلاع' : 'Preview'}>
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {c.fileUrl && (
                          <button onClick={() => handleDownload(c)} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400 hover:text-brand-500" title={t('contract_download')}>
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openTimeline(c)} className="p-1.5 rounded-lg hover:bg-amber-50 text-brand-400 hover:text-amber-600" title={lang === 'ar' ? 'حالة الموافقة' : 'Approval Status'}>
                          <GitBranch className="w-4 h-4" />
                        </button>
                        {/* Sales director reviews pending */}
                        {(isSalesDirector || hasRole('general_manager')) && c.status === 'pending' && (
                          <button onClick={() => { setApprovalModal(c); setApprovalNote(''); }}
                            className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100">
                            {lang === 'ar' ? 'موافقة المبيعات' : 'Sales Approval'}
                          </button>
                        )}
                        {/* Credit manager reviews sales_approved */}
                        {(isCreditManager || hasRole('general_manager')) && c.status === 'sales_approved' && (
                          <button onClick={() => { setApprovalModal(c); setApprovalNote(''); }}
                            className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100">
                            {lang === 'ar' ? 'موافقة الائتمان' : 'Credit Approval'}
                          </button>
                        )}
                        {/* Contract officer reviews credit_approved */}
                        {(isContractOfficer || hasRole('general_manager')) && c.status === 'credit_approved' && (
                          <button onClick={() => { setApprovalModal(c); setApprovalNote(''); }}
                            className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-medium hover:bg-sky-100">
                            {lang === 'ar' ? 'مراجعة العقود' : 'Contract Review'}
                          </button>
                        )}
                        {/* Vice GM reviews contract_approved (final approval) */}
                        {(isViceGM || hasRole('general_manager')) && c.status === 'contract_approved' && (
                          <button onClick={() => { setApprovalModal(c); setApprovalNote(''); }}
                            className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100">
                            {lang === 'ar' ? 'الاعتماد النهائي' : 'Final Approval'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">{statusBadge(c.status)}</td>
                    <td className="px-4 py-4">
                      {c.status === 'approved' && total > 0 ? (
                        <div className="min-w-20">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={`font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-brand-400 mt-1">{collected.toLocaleString()} {t('sar')}</p>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-4 py-4 text-xs text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>
                      {c.startDate ? format(parseISO(c.startDate), 'MMM yy', { locale }) : '—'} →{' '}
                      {c.endDate ? format(parseISO(c.endDate), 'MMM yy', { locale }) : '—'}
                    </td>
                    <td className={`px-4 py-4 font-medium ${isAr ? 'text-right' : 'text-left'}`}>
                      {user?.role === 'reservations' ? (
                        <>
                          {c.ratePerRoom ? <span className="text-amber-700 font-bold">{c.ratePerRoom} {isAr ? 'ر.س' : 'SAR'}</span> : '—'}
                          {c.roomsCount && <div className="text-xs text-brand-400">{c.roomsCount} {isAr ? 'غرفة' : 'rooms'}</div>}
                        </>
                      ) : (
                        <>
                          {c.totalValue ? `${(c.totalValue / 1000).toFixed(0)}K` : '—'}
                          {c.roomsCount && <div className="text-xs text-brand-400">{c.roomsCount} {t('rooms')}</div>}
                        </>
                      )}
                    </td>
                    <td className={`px-4 py-4 text-brand-500 ${isAr ? 'text-right' : 'text-left'}`}>{c.salesRep?.name}</td>
                    <td className={`px-4 py-4 text-brand-500 text-xs ${isAr ? 'text-right' : 'text-left'}`}>{c.hotel?.name}</td>
                    <td className={`px-4 py-4 ${isAr ? 'text-right' : 'text-left'}`}>
                      <Link to={`/clients/${c.client?.id}`} className="font-medium text-brand-900 hover:text-brand-600">{c.client?.companyName}</Link>
                      {c.client?.contactPerson && <div className="text-xs text-brand-400">{c.client.contactPerson}</div>}
                    </td>
                    <td className={`px-4 py-4 ${isAr ? 'text-right' : 'text-left'}`}>
                      <span className="font-mono text-xs bg-brand-100 px-2 py-1 rounded text-brand-700">{c.contractRef || `#${c.id}`}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      <Modal open={!!approvalModal} onClose={() => setApprovalModal(null)}
        title={lang === 'ar' ? 'مراجعة العقد' : 'Contract Review'}>
        {approvalModal && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl bg-brand-50/50 space-y-2 text-sm ${isAr ? 'text-right' : 'text-left'}`}>
              {[
                [lang === 'ar' ? 'الشركة' : 'Company', approvalModal.client?.companyName],
                [lang === 'ar' ? 'رقم العقد' : 'Contract Ref', approvalModal.contractRef],
                [lang === 'ar' ? 'الفندق' : 'Hotel', approvalModal.hotel?.name],
                [lang === 'ar' ? 'المندوب' : 'Sales Rep', approvalModal.salesRep?.name],
              ].map(([label, val]) => val && (
                <div key={label} className={`flex justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="text-brand-400">{label}:</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
              {approvalModal.roomsCount && (
                <div className={`flex justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="text-brand-400">{t('contract_rooms')}:</span>
                  <span>{approvalModal.roomsCount} × {approvalModal.ratePerRoom} {t('sar')}</span>
                </div>
              )}
              {approvalModal.totalValue && (
                <div className={`flex justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="text-brand-400">{t('contract_total')}:</span>
                  <span className="font-bold text-green-700">{approvalModal.totalValue.toLocaleString()} {t('sar')}</span>
                </div>
              )}
              {approvalModal.startDate && (
                <div className={`flex justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="text-brand-400">{t('contract_period')}:</span>
                  <span>{format(parseISO(approvalModal.startDate), 'dd MMM yyyy', { locale })} → {approvalModal.endDate ? format(parseISO(approvalModal.endDate), 'dd MMM yyyy', { locale }) : '?'}</span>
                </div>
              )}
              {approvalModal.notes && (
                <div className={isAr ? 'text-right' : ''}>
                  <span className="text-brand-400">{t('contract_notes')}: </span>
                  <span>{approvalModal.notes}</span>
                </div>
              )}
            </div>
            {approvalModal.fileUrl && (
              <a href={approvalModal.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center text-sm">
                <FileText className="w-4 h-4" /> {lang === 'ar' ? 'عرض ملف العقد' : 'View Contract File'}
              </a>
            )}
            <div>
              <label className="label">{t('contract_notes')}</label>
              <textarea className="input resize-none" rows={3} value={approvalNote}
                onChange={e => setApprovalNote(e.target.value)}
                placeholder={lang === 'ar' ? 'أضف ملاحظات...' : 'Add review notes...'} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleApprove('rejected')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700" disabled={saving}>
                <XCircle className="w-4 h-4" /> {t('contract_reject')}
              </button>
              <button onClick={() => handleApprove('approved')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700" disabled={saving}>
                <CheckCircle className="w-4 h-4" /> {t('contract_approve')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approval Timeline Modal */}
      <Modal open={!!timelineModal} onClose={() => setTimelineModal(null)}
        title={lang === 'ar' ? `حالة موافقة العقد - ${timelineModal?.contractRef || `#${timelineModal?.id}`}` : `Approval Status - ${timelineModal?.contractRef || `#${timelineModal?.id}`}`}>
        {timelineModal && (() => {
          // Find approvals by approver role (most reliable)
          const findByRole = (role: string) => timelineData.find((a: any) => a.approver?.role === role && a.status === 'approved');
          const salesApproval = findByRole('sales_director');
          const creditApproval = findByRole('credit_manager');
          const contractApproval = findByRole('contract_officer');
          const finalApproval = findByRole('vice_gm') || findByRole('general_manager');
          const rejection = timelineData.find((a: any) => a.status === 'rejected');

          const currentStatus = timelineModal.status;
          const isRejected = currentStatus === 'rejected';

          const steps = [
            {
              key: 'upload',
              title: lang === 'ar' ? 'رفع العقد' : 'Contract Upload',
              who: lang === 'ar' ? 'مندوب المبيعات' : 'Sales Rep',
              done: true,
              user: timelineModal.salesRep?.name,
              date: timelineModal.createdAt,
              icon: '📄',
            },
            {
              key: 'sales_approved',
              title: lang === 'ar' ? 'موافقة مدير المبيعات' : 'Sales Director Approval',
              who: lang === 'ar' ? 'مدير المبيعات' : 'Sales Director',
              done: ['sales_approved', 'credit_approved', 'contract_approved', 'approved'].includes(currentStatus),
              user: salesApproval?.approver?.name,
              date: salesApproval?.createdAt,
              notes: salesApproval?.notes,
              icon: '👔',
            },
            {
              key: 'credit_approved',
              title: lang === 'ar' ? 'موافقة مدير الائتمان' : 'Credit Manager Approval',
              who: lang === 'ar' ? 'مدير الائتمان' : 'Credit Manager',
              done: ['credit_approved', 'contract_approved', 'approved'].includes(currentStatus),
              user: creditApproval?.approver?.name,
              date: creditApproval?.createdAt,
              notes: creditApproval?.notes,
              icon: '💳',
            },
            {
              key: 'contract_approved',
              title: lang === 'ar' ? 'موافقة مسئول العقود' : 'Contract Officer Approval',
              who: lang === 'ar' ? 'مسئول العقود' : 'Contract Officer',
              done: ['contract_approved', 'approved'].includes(currentStatus),
              user: contractApproval?.approver?.name,
              date: contractApproval?.createdAt,
              notes: contractApproval?.notes,
              icon: '📋',
            },
            {
              key: 'approved',
              title: lang === 'ar' ? 'الاعتماد النهائي - نائب المدير العام' : 'Final Approval - Vice GM',
              who: lang === 'ar' ? 'نائب المدير العام' : 'Vice GM',
              done: currentStatus === 'approved',
              user: finalApproval?.approver?.name,
              date: finalApproval?.createdAt,
              notes: finalApproval?.notes,
              icon: '✅',
            },
          ];

          return (
            <div className="space-y-3">
              {/* Status banner */}
              <div className={`p-3 rounded-lg text-center font-bold ${
                currentStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                isRejected ? 'bg-red-50 text-red-700' :
                'bg-amber-50 text-amber-700'
              }`}>
                {currentStatus === 'approved' ? (lang === 'ar' ? '✓ معتمد نهائي' : '✓ Fully Approved') :
                 isRejected ? (lang === 'ar' ? '✕ مرفوض' : '✕ Rejected') :
                 (lang === 'ar' ? `بانتظار: ${steps.find(s => !s.done)?.who}` : `Awaiting: ${steps.find(s => !s.done)?.who}`)}
              </div>

              {/* Timeline */}
              <div className="space-y-2 mt-4">
                {steps.map((step, i) => {
                  const isNext = !step.done && i > 0 && steps[i - 1].done;
                  return (
                    <div key={step.key} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      step.done ? 'bg-emerald-50/50 border-emerald-200' :
                      isNext && !isRejected ? 'bg-amber-50/50 border-amber-200 ring-2 ring-amber-300' :
                      'bg-brand-50/30 border-brand-100 opacity-60'
                    } flex-row-reverse`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${
                        step.done ? 'bg-emerald-500 text-white' :
                        isNext && !isRejected ? 'bg-amber-500 text-white animate-pulse' :
                        'bg-brand-100 text-brand-300'
                      }`}>
                        {step.done ? '✓' : step.icon}
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-bold text-brand-900 text-sm">{step.title}</p>
                        {step.done ? (
                          <>
                            <p className="text-xs text-emerald-700 font-semibold mt-0.5">{step.user}</p>
                            {step.date && (
                              <p className="text-[11px] text-brand-400 mt-0.5">
                                {format(parseISO(step.date), 'dd MMM yyyy - hh:mm a', { locale })}
                              </p>
                            )}
                            {step.notes && (
                              <p className="text-xs text-brand-500 mt-1 bg-white p-2 rounded">{step.notes}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-brand-400 mt-0.5">
                            {isNext && !isRejected ? (lang === 'ar' ? 'في الانتظار...' : 'Pending...') : (lang === 'ar' ? 'لم يبدأ بعد' : 'Not started')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Rejection */}
                {rejection && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-red-50/50 border-red-200 flex-row-reverse">
                    <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0 text-lg">✕</div>
                    <div className="flex-1 text-right">
                      <p className="font-bold text-red-700 text-sm">{lang === 'ar' ? 'تم الرفض' : 'Rejected'}</p>
                      <p className="text-xs text-red-600 font-semibold mt-0.5">{rejection.approver?.name}</p>
                      {rejection.notes && (
                        <p className="text-xs text-red-700 mt-1 bg-white p-2 rounded">{rejection.notes}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
