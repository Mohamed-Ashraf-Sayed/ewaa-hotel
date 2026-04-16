import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Building2, ChevronLeft, User, Download } from 'lucide-react';
import { clientsApi, hotelsApi, pdfApi } from '../services/api';
import { Client, Hotel } from '../types';
import Modal from '../components/Modal';

import { useAuth } from '../contexts/AuthContext';

const SOURCE_OPTS = [
  { value: 'cold_call', label: 'اتصال بارد' },
  { value: 'referral', label: 'إحالة' },
  { value: 'exhibition', label: 'معرض' },
  { value: 'website', label: 'الموقع الإلكتروني' },
  { value: 'social_media', label: 'وسائل التواصل الاجتماعي' },
  { value: 'walk_in', label: 'زيارة مباشرة' },
  { value: 'other', label: 'أخرى' },
];

const INDUSTRY_OPTS = [
  'تكنولوجيا', 'نفط وغاز', 'هندسة', 'طيران', 'رعاية صحية',
  'سياحة', 'تجارة', 'شحن بحري', 'أدوية', 'عقارات',
  'تمويل', 'حكومي', 'تعليم', 'أخرى'
];

const CLIENT_TYPE_LABEL: Record<string, string> = {
  active: 'نشط', lead: 'محتمل', inactive: 'غير نشط'
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();

  const emptyForm = {
    companyName: '', contactPerson: '', phone: '', email: '', address: '',
    industry: '', clientType: 'lead', source: '', hotelId: '',
    estimatedRooms: '', annualBudget: '', website: '', notes: ''
  };
  const [form, setForm] = useState(emptyForm);

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
    setSaving(true);
    try {
      await clientsApi.create(form);
      setShowModal(false);
      setForm(emptyForm);
      loadClients();
    } catch (err: any) {
      alert(err.response?.data?.message || 'حدث خطأ أثناء إضافة العميل');
    } finally {
      setSaving(false);
    }
  };

  const badgeClass = (type: string) =>
    type === 'active' ? 'badge-active' : type === 'lead' ? 'badge-lead'
      : 'bg-brand-100 text-brand-500 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-brand-900">العملاء والعملاء المحتملون</h1>
          <p className="text-brand-400 text-sm mt-0.5">الإجمالي: {clients.length}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={async () => {
            try {
              const res = await pdfApi.clientReport({ type: typeFilter || undefined });
              const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
              const a = document.createElement('a'); a.href = url; a.download = 'Client_Report.pdf';
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } catch { alert('خطأ في إنشاء التقرير'); }
          }}>
            <Download className="w-4 h-4" /> تقرير PDF
          </button>
          {!hasRole('contract_officer') && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" /> إضافة عميل
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="lead">محتمل</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-brand-400" />
          <input className="input pr-9" placeholder="ابحث عن شركة أو جهة اتصال..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 bg-brand-50/50">
                <th className="px-4 py-3.5"></th>
                <th className="px-4 py-3.5 text-center font-medium text-brand-400">النشاط</th>

                <th className="px-4 py-3.5 text-center font-medium text-brand-400">النوع</th>
                <th className="px-4 py-3.5 text-right font-medium text-brand-400">الفندق</th>
                <th className="px-4 py-3.5 text-right font-medium text-brand-400">جهة الاتصال</th>
                <th className="px-4 py-3.5 text-right font-medium text-brand-400">الشركة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-brand-400">جاري التحميل...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-brand-400">لا يوجد عملاء</td></tr>
              ) : clients.map(c => (
                <tr key={c.id} className="hover:bg-brand-50/50 transition-colors">
                  <td className="px-3 py-4">
                    <Link to={`/clients/${c.id}`} className="p-1.5 rounded-lg hover:bg-brand-100 flex items-center text-brand-400 hover:text-brand-500">
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center text-xs text-brand-400">
                    <span title="العقود">{c._count?.contracts || 0} 📄</span>{' '}
                    <span title="الزيارات">{c._count?.visits || 0} 🗺️</span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className={badgeClass(c.clientType)}>{CLIENT_TYPE_LABEL[c.clientType] || c.clientType}</span>
                  </td>
                  <td className="px-4 py-4 text-right text-brand-500">{c.hotel?.name || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-brand-700">
                      {c.contactPerson}
                      <User className="w-3 h-3 text-brand-400" />
                    </div>
                    {c.phone && <div className="text-xs text-brand-400">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-medium text-brand-900">{c.companyName}</div>
                    {c.industry && <div className="text-xs text-brand-400">{c.industry}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="إضافة عميل جديد" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">اسم الشركة *</label>
              <input className="input" required value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="label">جهة الاتصال *</label>
              <input className="input" required value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} />
            </div>
            <div>
              <label className="label">الهاتف</label>
              <input className="input" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className="label">القطاع</label>
              <select className="input" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}>
                <option value="">اختر...</option>
                {INDUSTRY_OPTS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">النوع</label>
              <select className="input" value={form.clientType} onChange={e => setForm(p => ({ ...p, clientType: e.target.value }))}>
                <option value="lead">عميل محتمل</option>
                <option value="active">عميل نشط</option>
              </select>
            </div>
            <div>
              <label className="label">مصدر العميل</label>
              <select className="input" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                <option value="">اختر...</option>
                {SOURCE_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">عدد الغرف التقديري / سنة</label>
              <input className="input" type="number" value={form.estimatedRooms} onChange={e => setForm(p => ({ ...p, estimatedRooms: e.target.value }))} />
            </div>
            <div>
              <label className="label">الميزانية السنوية (ج.م)</label>
              <input className="input" type="number" value={form.annualBudget} onChange={e => setForm(p => ({ ...p, annualBudget: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">العنوان</label>
              <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">ملاحظات</label>
              <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'إضافة العميل'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
