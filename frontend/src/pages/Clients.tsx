import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, User, Download, FileSearch } from 'lucide-react';
import { clientsApi, hotelsApi, pdfApi } from '../services/api';
import { Client, Hotel } from '../types';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const SOURCE_OPTS_AR = [
  { value: 'cold_call', label: 'اتصال بارد' },
  { value: 'referral', label: 'إحالة' },
  { value: 'exhibition', label: 'معرض' },
  { value: 'website', label: 'الموقع الإلكتروني' },
  { value: 'social_media', label: 'وسائل التواصل الاجتماعي' },
  { value: 'walk_in', label: 'زيارة مباشرة' },
  { value: 'other', label: 'أخرى' },
];
const SOURCE_OPTS_EN = [
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'referral', label: 'Referral' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'website', label: 'Website' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
];

const INDUSTRY_OPTS_AR = ['تكنولوجيا', 'نفط وغاز', 'هندسة', 'طيران', 'رعاية صحية', 'سياحة', 'تجارة', 'شحن بحري', 'أدوية', 'عقارات', 'تمويل', 'حكومي', 'تعليم', 'أخرى'];
const INDUSTRY_OPTS_EN = ['Technology', 'Oil & Gas', 'Engineering', 'Aviation', 'Healthcare', 'Tourism', 'Trading', 'Shipping', 'Pharmaceutical', 'Real Estate', 'Finance', 'Government', 'Education', 'Other'];

export default function Clients() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const SOURCE_OPTS = isAr ? SOURCE_OPTS_AR : SOURCE_OPTS_EN;
  const INDUSTRY_OPTS = isAr ? INDUSTRY_OPTS_AR : INDUSTRY_OPTS_EN;
  const CLIENT_TYPE_LABEL: Record<string, string> = isAr
    ? { active: 'نشط', lead: 'محتمل', inactive: 'غير نشط' }
    : { active: 'Active', lead: 'Lead', inactive: 'Inactive' };

  const [clients, setClients] = useState<Client[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupRegNo, setLookupRegNo] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<null | { exists: boolean; matches: { salesRepName: string; brandLabels: string[] }[] }>(null);
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();

  const emptyForm = {
    companyName: '', contactPerson: '', countryCode: '+966', phoneNumber: '', email: '', address: '',
    industry: '', clientType: 'lead', source: '', hotelId: '', brands: [] as string[],
    estimatedRooms: '', annualBudget: '', website: '',
    commercialRegNo: '', taxCardNo: '',
    notes: ''
  };
  const [form, setForm] = useState(emptyForm);

  const BRAND_OPTS = [
    { value: 'muhaidib_serviced', label_ar: 'شقق المهيدب المخدومة', label_en: 'Muhaidib Serviced Apartments' },
    { value: 'awa_hotels', label_ar: 'فنادق إيواء', label_en: 'Awa Hotels' },
    { value: 'grand_plaza', label_ar: 'جراند بلازا', label_en: 'Grand Plaza' },
  ];

  const toggleBrand = (value: string) => {
    setForm(p => ({
      ...p,
      brands: p.brands.includes(value) ? p.brands.filter(b => b !== value) : [...p.brands, value],
    }));
  };

  useEffect(() => {
    const t = searchParams.get('type') || '';
    setTypeFilter(t);
  }, [searchParams]);

  const loadClients = () => {
    setLoading(true);
    clientsApi.getAll({ type: typeFilter || undefined, search: search || undefined })
      .then(r => setClients(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClients(); }, [typeFilter, search]);
  useEffect(() => { hotelsApi.getAll().then(r => setHotels(r.data)); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.brands.length === 0) {
      alert(isAr ? 'اختر براند واحد على الأقل' : 'Select at least one brand');
      return;
    }
    setSaving(true);
    try {
      const { countryCode, phoneNumber, ...rest } = form;
      const payload = { ...rest, phone: `${countryCode}${phoneNumber.replace(/[^\d]/g, '')}` };
      await clientsApi.create(payload);
      setShowModal(false);
      setForm(emptyForm);
      loadClients();
    } catch (err: any) {
      alert(err.response?.data?.message || (isAr ? 'حدث خطأ أثناء إضافة العميل' : 'Error adding client'));
    } finally {
      setSaving(false);
    }
  };

  const badgeClass = (type: string) =>
    type === 'active' ? 'badge-active' : type === 'lead' ? 'badge-lead'
      : 'bg-brand-100 text-brand-500 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'العملاء والعملاء المحتملون' : 'Clients & Leads'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'الإجمالي: ' : 'Total: '}{clients.length}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => { setLookupResult(null); setLookupRegNo(''); setShowLookup(true); }}>
            <FileSearch className="w-4 h-4" /> {isAr ? 'استعلام بالسجل التجاري' : 'Lookup by Commercial Reg No'}
          </button>
          {hasRole('general_manager', 'vice_gm', 'sales_director') && (
            <button className="btn-secondary" onClick={async () => {
              try {
                const res = await pdfApi.clientReport({ type: typeFilter || undefined });
                const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                const a = document.createElement('a'); a.href = url; a.download = 'Client_Report.pdf';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              } catch { alert(isAr ? 'خطأ في إنشاء التقرير' : 'Error generating report'); }
            }}>
              <Download className="w-4 h-4" /> {isAr ? 'تقرير PDF' : 'PDF Report'}
            </button>
          )}
          {!hasRole('contract_officer') && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" /> {isAr ? 'إضافة عميل' : 'Add Client'}
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
          <option value="lead">{isAr ? 'محتمل' : 'Lead'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
        </select>
        <div className="relative flex-1 min-w-48">
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-brand-400`} />
          <input className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
            placeholder={isAr ? 'ابحث عن شركة أو جهة اتصال...' : 'Search company or contact...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 bg-brand-50/50">
                {isAr ? (
                  <>
                    <th className="px-4 py-3.5"></th>
                    <th className="px-4 py-3.5 text-center font-medium text-brand-400">النشاط</th>
                    <th className="px-4 py-3.5 text-center font-medium text-brand-400">النوع</th>
                    <th className="px-4 py-3.5 text-right font-medium text-brand-400">الفندق</th>
                    <th className="px-4 py-3.5 text-right font-medium text-brand-400">جهة الاتصال</th>
                    <th className="px-4 py-3.5 text-right font-medium text-brand-400">الشركة</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3.5 text-left font-medium text-brand-400">Company</th>
                    <th className="px-4 py-3.5 text-left font-medium text-brand-400">Contact</th>
                    <th className="px-4 py-3.5 text-left font-medium text-brand-400">Hotel</th>
                    <th className="px-4 py-3.5 text-center font-medium text-brand-400">Type</th>
                    <th className="px-4 py-3.5 text-center font-medium text-brand-400">Activity</th>
                    <th className="px-4 py-3.5"></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-brand-400">{isAr ? 'لا يوجد عملاء' : 'No clients found'}</td></tr>
              ) : clients.map(c => {
                const linkCell = (
                  <td className="px-3 py-4">
                    <Link to={`/clients/${c.id}`} className="p-1.5 rounded-lg hover:bg-brand-100 inline-flex items-center text-brand-400 hover:text-brand-500">
                      <Chevron className="w-4 h-4" />
                    </Link>
                  </td>
                );
                const activityCell = (
                  <td className="px-4 py-4 text-center text-xs text-brand-400">
                    <span title={isAr ? 'العقود' : 'Contracts'}>{c._count?.contracts || 0} 📄</span>{' '}
                    <span title={isAr ? 'الزيارات' : 'Visits'}>{c._count?.visits || 0} 🗺️</span>
                  </td>
                );
                const typeCell = (
                  <td className="px-4 py-4 text-center">
                    <span className={badgeClass(c.clientType)}>{CLIENT_TYPE_LABEL[c.clientType] || c.clientType}</span>
                  </td>
                );
                const hotelCell = (
                  <td className={`px-4 py-4 text-brand-500 ${isAr ? 'text-right' : 'text-left'}`}>{c.hotel?.name || <span className="text-brand-300">—</span>}</td>
                );
                const contactCell = (
                  <td className={`px-4 py-4 ${isAr ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-1 text-brand-700 ${isAr ? 'justify-end' : 'justify-start'}`}>
                      {!isAr && <User className="w-3 h-3 text-brand-400" />}
                      {c.contactPerson}
                      {isAr && <User className="w-3 h-3 text-brand-400" />}
                    </div>
                    {c.phone && <div className="text-xs text-brand-400" dir="ltr" style={{ unicodeBidi: 'plaintext' }}>{c.phone}</div>}
                  </td>
                );
                const companyCell = (
                  <td className={`px-4 py-4 ${isAr ? 'text-right' : 'text-left'}`}>
                    <div className="font-medium text-brand-900">{c.companyName}</div>
                    {c.industry && <div className="text-xs text-brand-400">{c.industry}</div>}
                  </td>
                );
                return (
                  <tr key={c.id} className="hover:bg-brand-50/50 transition-colors">
                    {isAr ? (
                      <>{linkCell}{activityCell}{typeCell}{hotelCell}{contactCell}{companyCell}</>
                    ) : (
                      <>{companyCell}{contactCell}{hotelCell}{typeCell}{activityCell}{linkCell}</>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={isAr ? 'إضافة عميل جديد' : 'Add New Client'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">{isAr ? 'اسم الشركة' : 'Company Name'} *</label>
              <input className="input" required minLength={2} maxLength={200} pattern="[^<>{}\[\]\\]+"
                title={isAr ? 'لا يجب أن يحتوي على رموز خاصة < > { } [ ] \\' : 'No special characters allowed'}
                value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'جهة الاتصال' : 'Contact Person'} *</label>
              <input className="input" required minLength={2} maxLength={100} pattern="[^<>{}\[\]\\]+"
                title={isAr ? 'لا يجب أن يحتوي على رموز خاصة' : 'No special characters'}
                value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'رقم الهاتف' : 'Phone Number'} *</label>
              <div className="flex gap-2" dir="ltr">
                <select className="input w-28" value={form.countryCode}
                  onChange={e => setForm(p => ({ ...p, countryCode: e.target.value }))}>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+20">🇪🇬 +20</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+965">🇰🇼 +965</option>
                  <option value="+974">🇶🇦 +974</option>
                  <option value="+973">🇧🇭 +973</option>
                  <option value="+968">🇴🇲 +968</option>
                </select>
                <input className="input flex-1" type="tel" required pattern="[\d\s\-]{6,15}"
                  placeholder="5XXXXXXXX"
                  title={isAr ? 'أرقام فقط (بدون كود الدولة)' : 'Numbers only (no country code)'}
                  value={form.phoneNumber}
                  onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value.replace(/[^\d\s\-]/g, '') }))} />
              </div>
            </div>
            <div>
              <label className="label">{isAr ? 'البريد الإلكتروني' : 'Email'} *</label>
              <input className="input" type="email" required
                title={isAr ? 'يجب أن يحتوي على @' : 'Must contain @'}
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className="label">{isAr ? 'القطاع' : 'Industry'} *</label>
              <select className="input" required value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}>
                <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                {INDUSTRY_OPTS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'النوع' : 'Type'} *</label>
              <select className="input" required value={form.clientType} onChange={e => setForm(p => ({ ...p, clientType: e.target.value }))}>
                <option value="lead">{isAr ? 'عميل محتمل' : 'Lead'}</option>
                <option value="active">{isAr ? 'عميل نشط' : 'Active'}</option>
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'مصدر العميل' : 'Lead Source'} *</label>
              <select className="input" required value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                {SOURCE_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'عدد الغرف التقديري / سنة' : 'Estimated rooms / year'} *</label>
              <input className="input" type="number" required min="1" max="100000"
                value={form.estimatedRooms} onChange={e => setForm(p => ({ ...p, estimatedRooms: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'الميزانية السنوية (ر.س)' : 'Annual Budget (SAR)'} *</label>
              <input className="input" type="number" required min="1"
                value={form.annualBudget} onChange={e => setForm(p => ({ ...p, annualBudget: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'رقم السجل التجاري' : 'Commercial Registration No.'} *</label>
              <input className="input" required minLength={4} maxLength={30} pattern="[A-Za-z0-9\-\/\s]+"
                title={isAr ? 'أرقام وحروف فقط' : 'Letters and numbers only'}
                value={form.commercialRegNo}
                onChange={e => setForm(p => ({ ...p, commercialRegNo: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className="label">{isAr ? 'رقم البطاقة الضريبية' : 'Tax Card No.'} *</label>
              <input className="input" required minLength={4} maxLength={30} pattern="[A-Za-z0-9\-\/\s]+"
                title={isAr ? 'أرقام وحروف فقط' : 'Letters and numbers only'}
                value={form.taxCardNo}
                onChange={e => setForm(p => ({ ...p, taxCardNo: e.target.value }))} dir="ltr" />
            </div>
            <div className="col-span-2">
              <label className="label">{isAr ? 'البراندات (يمكن اختيار أكثر من واحد)' : 'Brands (multi-select)'} *</label>
              <div className="grid grid-cols-3 gap-2">
                {BRAND_OPTS.map(b => {
                  const checked = form.brands.includes(b.value);
                  return (
                    <label key={b.value}
                      className={`cursor-pointer flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition ${
                        checked ? 'bg-brand-50 border-brand-500 text-brand-900' : 'bg-white border-brand-100 text-brand-500 hover:border-brand-300'
                      } ${isAr ? 'flex-row-reverse' : ''}`}>
                      <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleBrand(b.value)} />
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-brand-500 border-brand-500' : 'border-brand-300'}`}>
                        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="text-sm font-medium">{isAr ? b.label_ar : b.label_en}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">{isAr ? 'العنوان' : 'Address'} *</label>
              <input className="input" required minLength={2} maxLength={300} pattern="[^<>{}\[\]\\]+"
                value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">{isAr ? 'ملاحظات' : 'Notes'}</label>
              <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إضافة العميل' : 'Add Client')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showLookup} onClose={() => setShowLookup(false)} title={isAr ? 'استعلام عن عميل' : 'Client Lookup'} size="sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!lookupRegNo.trim()) return;
            setLookupLoading(true);
            setLookupResult(null);
            try {
              const res = await clientsApi.lookup({ regNo: lookupRegNo.trim() });
              setLookupResult(res.data);
            } catch {
              setLookupResult({ exists: false, matches: [] });
            } finally {
              setLookupLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">{isAr ? 'رقم السجل التجاري' : 'Commercial Registration No.'}</label>
            <input
              className="input"
              required
              minLength={3}
              maxLength={30}
              value={lookupRegNo}
              onChange={(e) => setLookupRegNo(e.target.value)}
              dir="ltr"
              placeholder="1010XXXXXX"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center" disabled={lookupLoading}>
            {lookupLoading ? (isAr ? 'جاري البحث...' : 'Searching...') : (isAr ? 'استعلام' : 'Search')}
          </button>

          {lookupResult && !lookupResult.exists && (
            <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm">
              {isAr ? 'العميل غير مسجّل في النظام — يمكنك إضافته.' : 'Client not registered — you can add them.'}
            </div>
          )}
          {lookupResult && lookupResult.exists && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm space-y-1.5">
              <div className="font-semibold">{isAr ? 'العميل مسجّل بالفعل:' : 'Client is already registered:'}</div>
              {lookupResult.matches.map((m, i) => (
                <div key={i} className={`flex ${isAr ? 'flex-row-reverse' : ''} items-center gap-2`}>
                  <span className="font-medium">{isAr ? 'المندوب:' : 'Sales Rep:'}</span>
                  <span>{m.salesRepName}</span>
                  {m.brandLabels.length > 0 && (
                    <>
                      <span className="text-amber-700">•</span>
                      <span>{isAr ? 'البراند: ' : 'Brand: '}{m.brandLabels.join('، ')}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
