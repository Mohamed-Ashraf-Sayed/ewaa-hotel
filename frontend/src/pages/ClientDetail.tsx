import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, FileText, Plus, Clock, MapPin, CreditCard, Receipt, Mail } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { clientsApi, visitsApi, activitiesApi, contractsApi, hotelsApi, paymentsApi, pdfApi, emailApi } from '../services/api';
import { Client, Visit, Activity, Contract, Hotel, Payment } from '../types';
import Modal from '../components/Modal';

import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

const activityIcons: Record<string, string> = {
  note: '📝', call: '📞', email: '✉️', meeting: '🤝',
  visit: '🗺️', whatsapp: '💬', contract_upload: '📄', contract_approval: '✅'
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? arSA : enUS;
  const isAr = lang === 'ar';
  const [client, setClient] = useState<Client | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'contracts' | 'activities' | 'payments' | 'emails'>('overview');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', subject: '', body: '' });
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [quoteItems, setQuoteItems] = useState([{ description: '', roomType: '', nights: '', rooms: '', ratePerNight: '' }]);
  const [quoteForm, setQuoteForm] = useState({ validDays: '30', notes: '' });
  const [saving, setSaving] = useState(false);
  const { hasRole } = useAuth();

  const ACTIVITY_TYPES = [
    { value: 'note', label: lang === 'ar' ? 'ملاحظة' : 'Note' },
    { value: 'call', label: lang === 'ar' ? 'مكالمة هاتفية' : 'Phone Call' },
    { value: 'email', label: lang === 'ar' ? 'بريد إلكتروني' : 'Email' },
    { value: 'meeting', label: lang === 'ar' ? 'اجتماع' : 'Meeting' },
    { value: 'whatsapp', label: 'WhatsApp' },
  ];

  const VISIT_TYPES = [
    { value: 'in_person', label: lang === 'ar' ? 'زيارة شخصية' : 'In Person' },
    { value: 'phone', label: lang === 'ar' ? 'هاتف' : 'Phone' },
    { value: 'online', label: lang === 'ar' ? 'أونلاين' : 'Online' },
    { value: 'site_visit', label: lang === 'ar' ? 'زيارة الموقع' : 'Site Visit' },
  ];

  const PAYMENT_TYPES = [
    { value: 'bank_transfer', label: t('payment_bank') },
    { value: 'cash', label: t('payment_cash') },
    { value: 'check', label: t('payment_check') },
    { value: 'online', label: t('payment_online') },
  ];

  const CLIENT_TYPE_LABEL: Record<string, string> = {
    active: t('active'),
    lead: lang === 'ar' ? 'محتمل' : 'Lead',
    inactive: t('inactive'),
  };

  const [visitForm, setVisitForm] = useState({ visitDate: '', visitType: 'in_person', purpose: '', outcome: '', nextFollowUp: '', notes: '' });
  const [actForm, setActForm] = useState({ type: 'note', description: '' });
  const [contractForm, setContractForm] = useState({ hotelId: '', roomsCount: '', ratePerRoom: '', startDate: '', endDate: '', notes: '', contractRef: '' });
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [paymentForm, setPaymentForm] = useState({ contractId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'bank_transfer', reference: '', notes: '' });

  const load = async () => {
    const [clientRes, paymentsRes, emailRes] = await Promise.all([
      clientsApi.getOne(parseInt(id!)),
      paymentsApi.getAll({ clientId: parseInt(id!) }),
      emailApi.getLogs({ clientId: id }),
    ]);
    setClient(clientRes.data);
    setPayments(paymentsRes.data);
    setEmailLogs(emailRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); hotelsApi.getAll().then(r => setHotels(r.data)); }, [id]);

  const submitVisit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await visitsApi.create({ ...visitForm, clientId: id });
      setShowVisitModal(false);
      setVisitForm({ visitDate: '', visitType: 'in_person', purpose: '', outcome: '', nextFollowUp: '', notes: '' });
      load();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const submitActivity = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await activitiesApi.create({ ...actForm, clientId: id });
      setShowActivityModal(false);
      setActForm({ type: 'note', description: '' });
      load();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const submitContract = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      Object.entries({ ...contractForm, clientId: id! }).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (contractFile) fd.append('file', contractFile);
      await contractsApi.upload(fd);
      setShowContractModal(false);
      load();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await paymentsApi.create({ ...paymentForm, clientId: id });
      setShowPaymentModal(false);
      setPaymentForm({ contractId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'bank_transfer', reference: '', notes: '' });
      load();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!client) return <div className="text-center py-20 text-brand-400">{t('no_data')}</div>;

  const clientData = client as any;
  const totalValue = clientData.contracts?.reduce((s: number, c: Contract) => s + (c.totalValue || 0), 0) || 0;
  const totalCollected = clientData.contracts?.reduce((s: number, c: Contract) => s + (c.collectedAmount || 0), 0) || 0;
  const totalRemaining = Math.max(totalValue - totalCollected, 0);
  const collectionPct = totalValue > 0 ? Math.round((totalCollected / totalValue) * 100) : 0;

  const tabs = [
    { key: 'overview', label: t('tab_overview') },
    { key: 'visits', label: `${t('tab_visits')} (${clientData.visits?.length || 0})` },
    { key: 'contracts', label: `${t('tab_contracts')} (${clientData.contracts?.length || 0})` },
    { key: 'activities', label: `${t('tab_activities')} (${clientData.activities?.length || 0})` },
    { key: 'payments', label: `${t('tab_payments')} (${payments.length})` },
    { key: 'emails', label: `${isAr ? 'الإيميلات' : 'Emails'} (${emailLogs.length})` },
  ];

  const approvedContracts = clientData.contracts?.filter((c: Contract) => c.status === 'approved') || [];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className={`flex items-start gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className="flex-1">
          <div className={`flex items-start justify-between flex-wrap gap-3 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
            <div className={isAr ? 'text-right' : 'text-left'}>
              <h1 className="text-2xl font-bold text-brand-900">{client.companyName}</h1>
              {(client as any).companyNameEn && isAr && (
                <p className="text-sm text-brand-400 mt-0.5">{(client as any).companyNameEn}</p>
              )}
              <div className={`flex items-center gap-3 mt-1 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                <span className={client.clientType === 'active' ? 'badge-active' : 'badge-lead'}>
                  {CLIENT_TYPE_LABEL[client.clientType]}
                </span>
                {client.industry && <span className="text-sm text-brand-400">{client.industry}</span>}
                {client.hotel && <span className="text-sm text-brand-400">📍 {client.hotel.name}</span>}
              </div>
            </div>
          </div>
        </div>
        <Link to="/clients" className="p-2 rounded-lg hover:bg-brand-100 text-brand-400 mt-0.5 flex-shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>


      {/* Collection Summary Bar */}
      {totalValue > 0 && (
        <div className="card p-4">
          <div className={`flex items-center justify-between mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-medium text-brand-700">{t('payment_collection_pct')}</span>
            <span className={`font-bold text-lg ${collectionPct >= 80 ? 'text-green-600' : collectionPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{collectionPct}%</span>
          </div>
          <div className="h-2 bg-brand-100 rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full ${collectionPct >= 80 ? 'bg-green-500' : collectionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${collectionPct}%` }} />
          </div>
          <div className={`grid grid-cols-3 gap-4 text-center text-xs`}>
            <div>
              <p className="text-brand-400">{t('contract_total')}</p>
              <p className="font-bold text-brand-700">{(totalValue / 1000).toFixed(0)}K {t('sar')}</p>
            </div>
            <div>
              <p className="text-brand-400">{t('contract_collected')}</p>
              <p className="font-bold text-green-600">{(totalCollected / 1000).toFixed(0)}K {t('sar')}</p>
            </div>
            <div>
              <p className="text-brand-400">{t('contract_remaining')}</p>
              <p className="font-bold text-red-600">{(totalRemaining / 1000).toFixed(0)}K {t('sar')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Contact Info */}
      <div className="card p-5">
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${isAr ? 'text-right' : 'text-left'}`}>
          <div><p className="text-xs text-brand-400 mb-1">{t('client_contact')}</p><p className="font-medium text-brand-900">{client.contactPerson}</p></div>
          {client.phone && <div><p className="text-xs text-brand-400 mb-1">{t('client_phone')}</p><a href={`tel:${client.phone}`} className="font-medium text-brand-600 dir-ltr">{client.phone}</a></div>}
          {client.email && <div><p className="text-xs text-brand-400 mb-1">{t('client_email')}</p><a href={`mailto:${client.email}`} className="font-medium text-brand-600 truncate block text-xs">{client.email}</a></div>}
          {client.estimatedRooms && <div><p className="text-xs text-brand-400 mb-1">{t('client_estimated_rooms')}</p><p className="font-medium text-brand-900">{client.estimatedRooms}</p></div>}
          {client.annualBudget && <div><p className="text-xs text-brand-400 mb-1">{t('client_budget')}</p><p className="font-medium text-brand-900">{client.annualBudget.toLocaleString()} {t('sar')}</p></div>}
          {client.salesRep && <div><p className="text-xs text-brand-400 mb-1">{t('contract_rep')}</p><p className="font-medium text-brand-900">{client.salesRep.name}</p></div>}
          {client.address && <div className="col-span-2"><p className="text-xs text-brand-400 mb-1">{lang === 'ar' ? 'العنوان' : 'Address'}</p><p className="font-medium text-brand-900">{client.address}</p></div>}
        </div>
        {client.notes && (
          <div className={`mt-4 pt-4 border-t border-brand-100 ${isAr ? 'text-right' : 'text-left'}`}>
            <p className="text-xs text-brand-400 mb-1">{t('client_notes')}</p>
            <p className="text-sm text-brand-700">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {hasRole('sales_rep', 'sales_director') && (
        <div className={`flex gap-3 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          <button className="btn-primary text-sm" onClick={() => setShowContractModal(true)}>
            <FileText className="w-4 h-4" /> {t('upload_contract')}
          </button>
          <button className="btn-secondary text-sm" onClick={() => setShowActivityModal(true)}>
            <Plus className="w-4 h-4" /> {t('add_note')}
          </button>
          <button className="btn-secondary text-sm" onClick={() => setShowVisitModal(true)}>
            <MapPin className="w-4 h-4" /> {t('log_visit')}
          </button>
          {approvedContracts.length > 0 && (
            <button className="btn-secondary text-sm" onClick={() => setShowPaymentModal(true)}>
              <CreditCard className="w-4 h-4" /> {t('add_payment')}
            </button>
          )}
          <button className="btn-secondary text-sm" onClick={() => setShowQuoteModal(true)}>
            <Receipt className="w-4 h-4" /> {isAr ? 'عرض سعر' : 'Price Quote'}
          </button>
          <button className="btn-secondary text-sm" onClick={() => {
            setEmailForm({ to: client?.email || '', cc: '', subject: '', body: '' });
            setEmailFiles([]);
            setShowEmailModal(true);
          }}>
            <Mail className="w-4 h-4" /> {isAr ? 'إرسال إيميل' : 'Send Email'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-brand-200">
        <div className={`flex gap-6 ${isAr ? 'flex-row-reverse' : ''}`}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-brand-400 hover:text-brand-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: t('tab_visits'), value: clientData.visits?.length || 0, icon: '🗺️', color: 'bg-blue-50' },
            { label: t('tab_contracts'), value: clientData.contracts?.length || 0, icon: '📄', color: 'bg-green-50' },
            { label: t('tab_activities'), value: clientData.activities?.length || 0, icon: '📌', color: 'bg-amber-50' },
          ].map(item => (
            <div key={item.label} className={`card p-5 ${item.color}`}>
              <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <span className="text-3xl">{item.icon}</span>
                <div className={isAr ? 'text-right' : ''}>
                  <p className="text-2xl font-bold text-brand-900">{item.value}</p>
                  <p className="text-sm text-brand-400">{item.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visits Tab */}
      {activeTab === 'visits' && (
        <div className="space-y-3">
          {clientData.visits?.length === 0 && <p className="text-brand-400 text-sm text-center py-8">{t('no_visits')}</p>}
          {clientData.visits?.map((v: Visit) => (
            <div key={v.id} className="card p-4">
              <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className={isAr ? 'text-right' : 'text-left'}>
                  <div className={`flex items-center gap-2 mb-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs bg-brand-100 text-brand-500 px-2 py-0.5 rounded-full">
                      {VISIT_TYPES.find(vt => vt.value === v.visitType)?.label || v.visitType}
                    </span>
                    <span className="text-xs text-brand-400">{v.visitDate ? format(parseISO(v.visitDate), 'dd MMM yyyy', { locale }) : '-'}</span>
                  </div>
                  {v.purpose && <p className="text-sm font-medium text-brand-900">{v.purpose}</p>}
                  {v.outcome && <p className="text-sm text-brand-500 mt-1">{lang === 'ar' ? 'النتيجة: ' : 'Outcome: '}{v.outcome}</p>}
                </div>
                {v.nextFollowUp && (
                  <div className="text-xs text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(v.nextFollowUp), 'dd MMM', { locale })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <div className="space-y-3">
          {clientData.contracts?.length === 0 && <p className="text-brand-400 text-sm text-center py-8">{t('no_contracts')}</p>}
          {clientData.contracts?.map((c: Contract) => {
            const collected = c.collectedAmount || 0;
            const total = c.totalValue || 0;
            const remaining = Math.max(total - collected, 0);
            const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
            return (
              <div key={c.id} className="card p-4">
                <div className={`flex items-start justify-between gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className="flex-1">
                    <div className={`flex items-center gap-2 mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                      <span className={c.status === 'approved' ? 'badge-approved' : c.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}>
                        {c.status === 'approved' ? t('contract_approved') : c.status === 'rejected' ? t('contract_rejected') : t('contract_pending')}
                      </span>
                      {c.contractRef && <span className="text-xs text-brand-400 font-mono">{c.contractRef}</span>}
                    </div>
                    <div className={`grid grid-cols-3 gap-3 text-sm ${isAr ? 'text-right' : 'text-left'}`}>
                      {c.roomsCount && <div><span className="text-brand-400">{t('contract_rooms')}: </span><span className="font-medium">{c.roomsCount}</span></div>}
                      {c.ratePerRoom && <div><span className="text-brand-400">{t('contract_rate')}: </span><span className="font-medium">{c.ratePerRoom} {t('sar')}</span></div>}
                      {c.totalValue && <div><span className="text-brand-400">{t('contract_total')}: </span><span className="font-medium">{(c.totalValue / 1000).toFixed(0)}K</span></div>}
                    </div>
                    {c.status === 'approved' && total > 0 && (
                      <div className="mt-3">
                        <div className={`flex text-xs gap-3 mb-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                          <span className="text-green-600">{t('contract_collected')}: {collected.toLocaleString()}</span>
                          <span className="text-red-500">{t('contract_remaining')}: {remaining.toLocaleString()} {t('sar')}</span>
                          <span className="font-bold">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  {c.fileUrl && (
                    <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1.5">
                      <FileText className="w-3 h-3" /> {lang === 'ar' ? 'عرض' : 'View'}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="space-y-2">
          {clientData.activities?.length === 0 && <p className="text-brand-400 text-sm text-center py-8">{t('no_activities')}</p>}
          {clientData.activities?.map((a: Activity) => (
            <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg hover:bg-brand-50/50 ${isAr ? 'flex-row-reverse' : ''}`}>
              <span className="text-xl">{activityIcons[a.type] || '📌'}</span>
              <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : 'text-left'}`}>
                <p className="text-sm text-gray-800">{a.description}</p>
                <p className="text-xs text-brand-400 mt-0.5">
                  {a.user?.name} · {a.createdAt ? format(parseISO(a.createdAt), 'dd MMM yyyy HH:mm', { locale }) : ''}
                </p>
              </div>
              <span className="text-xs text-brand-400 bg-brand-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                {ACTIVITY_TYPES.find(at => at.value === a.type)?.label || a.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {payments.length === 0 && <p className="text-brand-400 text-sm text-center py-8">{t('no_payments')}</p>}
          {payments.map((p: Payment) => (
            <div key={p.id} className={`card p-4 flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={isAr ? 'text-right' : 'text-left'}>
                <p className="font-bold text-green-600 text-lg">{p.amount.toLocaleString()} {t('sar')}</p>
                <p className="text-xs text-brand-400 mt-0.5">
                  {p.contract?.contractRef} · {p.paymentType ? t(`payment_${p.paymentType}` as any) : ''}
                  {p.reference ? ` · ${p.reference}` : ''}
                </p>
                {p.notes && <p className="text-xs text-brand-400 mt-1">{p.notes}</p>}
              </div>
              <div className={`text-xs text-brand-400 ${isAr ? 'text-left' : 'text-right'}`}>
                <p>{p.paymentDate ? format(parseISO(p.paymentDate), 'dd MMM yyyy', { locale }) : ''}</p>
                <p className="mt-1">{p.collector?.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emails Tab */}
      {activeTab === 'emails' && (
        <div className="space-y-3">
          {emailLogs.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-10 h-10 text-brand-200 mx-auto mb-3" />
              <p className="text-brand-400 text-sm">{isAr ? 'لا توجد إيميلات مرسلة لهذا العميل' : 'No emails sent to this client'}</p>
            </div>
          ) : (
            emailLogs.map((log: any) => (
              <div key={log.id} className={`card p-4 ${log.status === 'failed' ? 'border-l-4 border-l-red-400' : ''}`}>
                <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                      <p className="font-bold text-brand-900 text-sm">{log.subject}</p>
                      {log.status === 'failed' && (
                        <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{isAr ? 'فشل' : 'Failed'}</span>
                      )}
                    </div>
                    <p className="text-xs text-brand-400 mt-1 dir-ltr">{isAr ? 'إلى: ' : 'To: '}{log.to}</p>
                    <p className="text-sm text-brand-600 mt-2 whitespace-pre-line leading-relaxed">{log.body.slice(0, 200)}{log.body.length > 200 ? '...' : ''}</p>
                  </div>
                  <div className={`text-xs text-brand-400 flex-shrink-0 ${isAr ? 'text-left ml-0 mr-4' : 'text-right mr-0 ml-4'}`}>
                    <p>{format(parseISO(log.createdAt), 'dd MMM yyyy', { locale })}</p>
                    <p className="mt-0.5">{format(parseISO(log.createdAt), 'hh:mm a')}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Visit Modal */}
      <Modal open={showVisitModal} onClose={() => setShowVisitModal(false)} title={t('log_visit')}>
        <form onSubmit={submitVisit} className="space-y-4">
          <div><label className="label">{t('visit_date')} *</label><input className="input" type="datetime-local" required value={visitForm.visitDate} onChange={e => setVisitForm(p => ({ ...p, visitDate: e.target.value }))} /></div>
          <div><label className="label">{t('visit_type')}</label>
            <select className="input" value={visitForm.visitType} onChange={e => setVisitForm(p => ({ ...p, visitType: e.target.value }))}>
              {VISIT_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
            </select>
          </div>
          <div><label className="label">{t('visit_purpose')}</label><input className="input" value={visitForm.purpose} onChange={e => setVisitForm(p => ({ ...p, purpose: e.target.value }))} /></div>
          <div><label className="label">{t('visit_outcome')}</label><textarea className="input resize-none" rows={2} value={visitForm.outcome} onChange={e => setVisitForm(p => ({ ...p, outcome: e.target.value }))} /></div>
          <div><label className="label">{t('visit_followup')}</label><input className="input" type="datetime-local" value={visitForm.nextFollowUp} onChange={e => setVisitForm(p => ({ ...p, nextFollowUp: e.target.value }))} /></div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowVisitModal(false)}>{t('cancel')}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>{saving ? t('saving') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* Activity Modal */}
      <Modal open={showActivityModal} onClose={() => setShowActivityModal(false)} title={t('add_note')}>
        <form onSubmit={submitActivity} className="space-y-4">
          <div><label className="label">{lang === 'ar' ? 'النوع' : 'Type'}</label>
            <select className="input" value={actForm.type} onChange={e => setActForm(p => ({ ...p, type: e.target.value }))}>
              {ACTIVITY_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
            </select>
          </div>
          <div><label className="label">{lang === 'ar' ? 'التفاصيل *' : 'Details *'}</label><textarea className="input resize-none" rows={4} required value={actForm.description} onChange={e => setActForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowActivityModal(false)}>{t('cancel')}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>{saving ? t('saving') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* Contract Modal */}
      <Modal open={showContractModal} onClose={() => setShowContractModal(false)} title={t('upload_contract')} size="lg">
        <form onSubmit={submitContract} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">{t('contract_hotel')} *</label>
              <select className="input" required value={contractForm.hotelId} onChange={e => setContractForm(p => ({ ...p, hotelId: e.target.value }))}>
                <option value="">{lang === 'ar' ? 'اختر الفندق...' : 'Select hotel...'}</option>
                {[
                  { group: 'muhaidib_serviced', label: 'المهيدب للشقق المخدومة' },
                  { group: 'awa_hotels', label: 'فنادق إيواء اكسبريس' },
                  { group: 'grand_plaza', label: 'فنادق جراند بلازا' },
                ].map(g => {
                  const first = hotels.find(h => (h as any).group === g.group);
                  if (!first) return null;
                  return <option key={g.group} value={first.id}>{g.label}</option>;
                })}
              </select>
            </div>
            <div><label className="label">{t('contract_ref')}</label><input className="input" value={contractForm.contractRef} onChange={e => setContractForm(p => ({ ...p, contractRef: e.target.value }))} placeholder="CTR-SA-..." dir="ltr" /></div>
            <div><label className="label">{t('contract_rooms')}</label><input className="input" type="number" value={contractForm.roomsCount} onChange={e => setContractForm(p => ({ ...p, roomsCount: e.target.value }))} /></div>
            <div><label className="label">{t('contract_rate')} ({t('sar')})</label><input className="input" type="number" value={contractForm.ratePerRoom} onChange={e => setContractForm(p => ({ ...p, ratePerRoom: e.target.value }))} /></div>
            <div><label className="label">{t('contract_start')}</label><input className="input" type="date" value={contractForm.startDate} onChange={e => setContractForm(p => ({ ...p, startDate: e.target.value }))} /></div>
            <div><label className="label">{t('contract_end')}</label><input className="input" type="date" value={contractForm.endDate} onChange={e => setContractForm(p => ({ ...p, endDate: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">{t('contract_notes')}</label><textarea className="input resize-none" rows={2} value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="col-span-2">
              <label className="label">{lang === 'ar' ? 'ملف العقد (PDF / Word / صورة)' : 'Contract File (PDF / Word / Image)'}</label>
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="input" onChange={e => setContractFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowContractModal(false)}>{t('cancel')}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>{saving ? t('saving') : t('upload_contract')}</button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title={t('add_payment')}>
        <form onSubmit={submitPayment} className="space-y-4">
          <div><label className="label">{t('tab_contracts')} *</label>
            <select className="input" required value={paymentForm.contractId} onChange={e => setPaymentForm(p => ({ ...p, contractId: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر العقد...' : 'Select contract...'}</option>
              {approvedContracts.map((c: Contract) => (
                <option key={c.id} value={c.id}>
                  {c.contractRef || `#${c.id}`} — {(c.totalValue || 0).toLocaleString()} {t('sar')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">{t('payment_amount')} ({t('sar')}) *</label>
              <input className="input" type="number" required min="1" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} dir="ltr" />
            </div>
            <div><label className="label">{t('payment_date')} *</label>
              <input className="input" type="date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))} />
            </div>
          </div>
          <div><label className="label">{t('payment_type')}</label>
            <select className="input" value={paymentForm.paymentType} onChange={e => setPaymentForm(p => ({ ...p, paymentType: e.target.value }))}>
              {PAYMENT_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
          </div>
          <div><label className="label">{t('payment_reference')}</label>
            <input className="input" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} dir="ltr" />
          </div>
          <div><label className="label">{t('client_notes')}</label>
            <textarea className="input resize-none" rows={2} value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowPaymentModal(false)}>{t('cancel')}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>{saving ? t('saving') : t('add_payment')}</button>
          </div>
        </form>
      </Modal>

      {/* Quote Modal */}
      <Modal open={showQuoteModal} onClose={() => setShowQuoteModal(false)} title={isAr ? 'إنشاء عرض سعر' : 'Create Price Quote'} size="xl">
        <form onSubmit={async (e) => {
          e.preventDefault(); setSaving(true);
          try {
            const res = await pdfApi.generateQuote({
              clientId: id, hotelId: client?.hotelId,
              companyName: client?.companyName, contactPerson: client?.contactPerson,
              items: quoteItems.filter(i => i.description),
              validDays: quoteForm.validDays, notes: quoteForm.notes,
            });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a = document.createElement('a'); a.href = url;
            a.download = `Quote_${client?.companyName || 'client'}.pdf`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setShowQuoteModal(false);
          } catch { alert(isAr ? 'حدث خطأ' : 'Error generating quote'); }
          finally { setSaving(false); }
        }} className="space-y-4">
          {/* Items */}
          <div>
            <div className={`flex items-center justify-between mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
              <label className="label mb-0">{isAr ? 'البنود' : 'Items'}</label>
              <button type="button" className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                onClick={() => setQuoteItems(p => [...p, { description: '', roomType: '', nights: '', rooms: '', ratePerNight: '' }])}>
                + {isAr ? 'إضافة بند' : 'Add Item'}
              </button>
            </div>
            <div className="space-y-3">
              {quoteItems.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-brand-50/50 border border-brand-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input text-sm" placeholder={isAr ? 'الوصف *' : 'Description *'}
                      value={item.description} onChange={e => { const n = [...quoteItems]; n[i].description = e.target.value; setQuoteItems(n); }} />
                    <input className="input text-sm" placeholder={isAr ? 'نوع الغرفة' : 'Room Type'}
                      value={item.roomType} onChange={e => { const n = [...quoteItems]; n[i].roomType = e.target.value; setQuoteItems(n); }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input text-sm" type="number" min="0" placeholder={isAr ? 'عدد الغرف' : 'Rooms'}
                      value={item.rooms} onChange={e => { const n = [...quoteItems]; n[i].rooms = e.target.value; setQuoteItems(n); }} />
                    <input className="input text-sm" type="number" min="0" placeholder={isAr ? 'عدد الليالي' : 'Nights'}
                      value={item.nights} onChange={e => { const n = [...quoteItems]; n[i].nights = e.target.value; setQuoteItems(n); }} />
                    <input className="input text-sm" type="number" min="0" placeholder={isAr ? 'السعر/ليلة' : 'Rate/Night'}
                      value={item.ratePerNight} onChange={e => { const n = [...quoteItems]; n[i].ratePerNight = e.target.value; setQuoteItems(n); }} />
                  </div>
                  {quoteItems.length > 1 && (
                    <button type="button" className="text-xs text-red-500 hover:text-red-700"
                      onClick={() => setQuoteItems(p => p.filter((_, j) => j !== i))}>
                      {isAr ? 'حذف' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'صلاحية العرض (أيام)' : 'Valid for (days)'}</label>
              <input className="input" type="number" min="1" value={quoteForm.validDays}
                onChange={e => setQuoteForm(p => ({ ...p, validDays: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{isAr ? 'ملاحظات وشروط إضافية' : 'Additional Notes & Terms'}</label>
            <textarea className="input resize-none" rows={3} value={quoteForm.notes}
              onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowQuoteModal(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? (isAr ? 'جاري الإنشاء...' : 'Generating...') : (isAr ? 'إنشاء وتحميل PDF' : 'Generate & Download PDF')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Email Modal */}
      <Modal open={showEmailModal} onClose={() => setShowEmailModal(false)} title={isAr ? 'إرسال إيميل' : 'Send Email'} size="xl">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!emailForm.body || emailForm.body === '<p><br></p>') { alert(isAr ? 'اكتب نص الرسالة' : 'Write message body'); return; }
          setEmailSending(true);
          try {
            await emailApi.send({ ...emailForm, clientId: id }, emailFiles.length > 0 ? emailFiles : undefined);
            alert(isAr ? 'تم إرسال الإيميل بنجاح' : 'Email sent successfully');
            setShowEmailModal(false); load();
          } catch (err: any) {
            alert(err.response?.data?.message || (isAr ? 'فشل الإرسال' : 'Failed to send'));
          } finally { setEmailSending(false); }
        }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{isAr ? 'إلى' : 'To'} *</label>
              <input className="input" type="email" required dir="ltr" value={emailForm.to}
                onChange={e => setEmailForm(p => ({ ...p, to: e.target.value }))} placeholder="client@company.com" />
            </div>
            <div>
              <label className="label">{isAr ? 'نسخة (CC)' : 'CC'}</label>
              <input className="input" dir="ltr" value={emailForm.cc}
                onChange={e => setEmailForm(p => ({ ...p, cc: e.target.value }))} placeholder="person1@email.com, person2@email.com" />
            </div>
          </div>
          <div>
            <label className="label">{isAr ? 'الموضوع' : 'Subject'} *</label>
            <input className="input" required value={emailForm.subject}
              onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))} />
          </div>
          <div>
            <label className="label">{isAr ? 'نص الرسالة' : 'Message'} *</label>
            <div className="border border-brand-200 rounded-lg overflow-hidden" dir="ltr">
              <ReactQuill
                theme="snow"
                value={emailForm.body}
                onChange={(val: string) => setEmailForm(p => ({ ...p, body: val }))}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'direction': 'rtl' }],
                    ['link'],
                    ['clean'],
                  ],
                }}
                style={{ minHeight: 200 }}
                placeholder={isAr ? 'اكتب نص الرسالة هنا...' : 'Write your message here...'}
              />
            </div>
          </div>
          {/* Attachments */}
          <div>
            <label className="label">{isAr ? 'مرفقات' : 'Attachments'}</label>
            <input type="file" multiple
              onChange={e => setEmailFiles(Array.from(e.target.files || []))}
              className="w-full text-sm text-brand-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-brand-200 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer file:transition-colors" />
            {emailFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {emailFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-brand-50 px-3 py-1.5 rounded-lg">
                    <button type="button" onClick={() => setEmailFiles(p => p.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                    <span className="text-brand-700">{f.name} <span className="text-brand-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowEmailModal(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={emailSending}>
              <Mail className="w-4 h-4" />
              {emailSending ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال' : 'Send')}
              {emailFiles.length > 0 && <span className="text-xs opacity-70">({emailFiles.length} {isAr ? 'مرفق' : 'files'})</span>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
