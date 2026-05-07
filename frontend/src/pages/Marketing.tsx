import { useEffect, useState } from 'react';
import { Plus, Megaphone, Pencil, Trash2, Image as ImageIcon, Calendar, ExternalLink, Hourglass, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { promotionsApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/Modal';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface PromotionRow {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  startsAt: string;
  endsAt: string;
  hotelIds?: string | null;
  brands?: string | null;
  isActive: boolean;
  status?: 'active' | 'upcoming' | 'expired' | 'inactive';
  createdAt: string;
  createdBy?: { id: number; name: string };
}

const BRAND_OPTS = [
  { value: 'muhaidib_serviced', label: 'المهيدب للشقق المخدومة' },
  { value: 'awa_hotels', label: 'فنادق إيواء اكسبريس' },
  { value: 'grand_plaza', label: 'فنادق جراند بلازا' },
];

const initialForm = {
  title: '', description: '',
  ctaLabel: '', ctaUrl: '',
  startsAt: '', endsAt: '',
  brands: [] as string[],
  isActive: true,
};

const STATUS_INFO: Record<string, { ar: string; en: string; cls: string; Icon: any }> = {
  active:    { ar: 'نشط',     en: 'Active',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  Icon: CheckCircle2 },
  upcoming:  { ar: 'قادم',    en: 'Upcoming', cls: 'bg-blue-50 text-blue-700 border-blue-200',           Icon: Hourglass },
  expired:   { ar: 'منتهي',   en: 'Expired',  cls: 'bg-slate-100 text-slate-600 border-slate-200',       Icon: XCircle },
  inactive:  { ar: 'موقوف',   en: 'Inactive', cls: 'bg-amber-50 text-amber-700 border-amber-200',        Icon: XCircle },
};

export default function Marketing() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;

  const [promos, setPromos] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState<PromotionRow | null>(null);

  const load = () => {
    setLoading(true);
    promotionsApi.getAll()
      .then(r => setPromos(r.data))
      .catch(() => setPromos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setImageFile(null);
    setImagePreview(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: PromotionRow) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description || '',
      ctaLabel: p.ctaLabel || '',
      ctaUrl: p.ctaUrl || '',
      startsAt: p.startsAt.slice(0, 10),
      endsAt: p.endsAt.slice(0, 10),
      brands: p.brands ? p.brands.split(',').filter(Boolean) : [],
      isActive: p.isActive,
    });
    setImageFile(null);
    setImagePreview(p.imageUrl || null);
    setError('');
    setShowForm(true);
  };

  const onImageChange = (f: File | null) => {
    setImageFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = e => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setImagePreview(editing?.imageUrl || null);
    }
  };

  const toggleBrand = (b: string) => setForm(p => ({
    ...p,
    brands: p.brands.includes(b) ? p.brands.filter(x => x !== b) : [...p.brands, b],
  }));

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) return setError(isAr ? 'العنوان مطلوب' : 'Title is required');
    if (!form.startsAt || !form.endsAt) return setError(isAr ? 'تاريخ البداية والنهاية مطلوبان' : 'Start and end dates required');
    if (new Date(form.endsAt) <= new Date(form.startsAt)) return setError(isAr ? 'تاريخ النهاية لازم يكون بعد البداية' : 'End must be after start');

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        ctaLabel: form.ctaLabel.trim() || undefined,
        ctaUrl: form.ctaUrl.trim() || undefined,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        brands: form.brands.length > 0 ? form.brands.join(',') : undefined,
        isActive: form.isActive,
      };
      if (editing) await promotionsApi.update(editing.id, payload, imageFile || undefined);
      else await promotionsApi.create(payload, imageFile || undefined);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: PromotionRow) => {
    if (!confirm(isAr ? `هل تريد حذف العرض "${p.title}"؟` : `Delete promotion "${p.title}"?`)) return;
    try {
      await promotionsApi.delete(p.id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const counts = {
    active: promos.filter(p => p.status === 'active').length,
    upcoming: promos.filter(p => p.status === 'upcoming').length,
    expired: promos.filter(p => p.status === 'expired').length,
  };

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2 flex-row-reverse">
            <Megaphone className="w-6 h-6 text-amber-500" />
            {isAr ? 'العروض التسويقية' : 'Marketing Promotions'}
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            {isAr ? 'انشر عروضك لتظهر كبانر على الصفحة الرئيسية لفريق المبيعات' : 'Publish promotions to display as a banner on the sales team home page'}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          {isAr ? 'عرض جديد' : 'New Promotion'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 bg-emerald-50/60 border-emerald-100 text-right">
          <div className="text-xs text-emerald-600 font-semibold">{isAr ? 'نشط' : 'Active'}</div>
          <div className="text-3xl font-bold text-emerald-800 mt-1">{counts.active}</div>
        </div>
        <div className="card p-4 bg-blue-50/60 border-blue-100 text-right">
          <div className="text-xs text-blue-600 font-semibold">{isAr ? 'قادم' : 'Upcoming'}</div>
          <div className="text-3xl font-bold text-blue-800 mt-1">{counts.upcoming}</div>
        </div>
        <div className="card p-4 bg-slate-50 border-slate-100 text-right">
          <div className="text-xs text-slate-500 font-semibold">{isAr ? 'منتهي' : 'Expired'}</div>
          <div className="text-3xl font-bold text-slate-700 mt-1">{counts.expired}</div>
        </div>
      </div>

      {/* List */}
      {promos.length === 0 ? (
        <div className="card p-12 text-center text-brand-400">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="mb-3">{isAr ? 'مفيش عروض لسه' : 'No promotions yet'}</p>
          <button onClick={openCreate} className="btn-primary text-sm inline-flex">
            <Plus className="w-4 h-4" /> {isAr ? 'أضف أول عرض' : 'Add first promotion'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map(p => {
            const info = STATUS_INFO[p.status || 'active'];
            return (
              <div key={p.id} className="card p-4 flex flex-col gap-3">
                {/* Image preview */}
                <div className="relative h-32 rounded-xl overflow-hidden bg-gradient-to-br from-amber-200 to-rose-300">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/80">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${info.cls}`}>
                    <info.Icon className="w-3 h-3" />
                    {isAr ? info.ar : info.en}
                  </span>
                </div>

                <div className="text-right">
                  <h3 className="font-bold text-brand-900">{p.title}</h3>
                  {p.description && <p className="text-xs text-brand-500 mt-1 line-clamp-2">{p.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-brand-600 text-right">
                  <div>
                    <div className="text-[11px] text-brand-400">{isAr ? 'يبدأ' : 'Starts'}</div>
                    <div className="font-medium flex items-center gap-1 flex-row-reverse">
                      <Calendar className="w-3 h-3" /> {format(parseISO(p.startsAt), 'dd MMM yyyy', { locale })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-brand-400">{isAr ? 'ينتهي' : 'Ends'}</div>
                    <div className="font-medium flex items-center gap-1 flex-row-reverse">
                      <Calendar className="w-3 h-3" /> {format(parseISO(p.endsAt), 'dd MMM yyyy', { locale })}
                    </div>
                  </div>
                </div>

                {p.brands && (
                  <div className="text-[11px] text-brand-500">
                    <span className="text-brand-400">{isAr ? 'البراندات: ' : 'Brands: '}</span>
                    {p.brands.split(',').map(b => BRAND_OPTS.find(o => o.value === b)?.label || b).join(' • ')}
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-2 border-t border-brand-100 flex-row-reverse">
                  <button onClick={() => setPreviewing(p)} className="btn-secondary text-xs py-1.5" title={isAr ? 'معاينة' : 'Preview'}>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit(p)} className="btn-secondary text-xs py-1.5" title={isAr ? 'تعديل' : 'Edit'}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p)} className="btn-secondary text-xs py-1.5 text-red-600 hover:bg-red-50" title={isAr ? 'حذف' : 'Delete'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-brand-400 ms-auto">
                    {p.createdBy?.name || ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? (isAr ? 'تعديل العرض' : 'Edit Promotion') : (isAr ? 'عرض جديد' : 'New Promotion')} size="xl">
        <div className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">{error}</div>}

          {/* Image upload */}
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1.5 block">{isAr ? 'صورة البانر' : 'Banner Image'}</label>
            <div className="rounded-xl border-2 border-dashed border-brand-200 overflow-hidden">
              {imagePreview ? (
                <div className="relative h-40 bg-brand-50">
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
                    {isAr ? 'تغيير الصورة' : 'Change image'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onImageChange(e.target.files?.[0] || null)} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-brand-50/40">
                  <ImageIcon className="w-8 h-8 text-brand-400 mb-1" />
                  <span className="text-xs text-brand-500">{isAr ? 'اضغط لرفع صورة' : 'Click to upload'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => onImageChange(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1.5 block">
              {isAr ? 'العنوان' : 'Title'} <span className="text-red-500">*</span>
            </label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={120} />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1.5 block">{isAr ? 'الوصف' : 'Description'}</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} maxLength={500} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-brand-600 mb-1.5 block">{isAr ? 'يبدأ في' : 'Starts At'} <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.startsAt} onChange={e => setForm(p => ({ ...p, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-600 mb-1.5 block">{isAr ? 'ينتهي في' : 'Ends At'} <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.endsAt} onChange={e => setForm(p => ({ ...p, endsAt: e.target.value }))} />
            </div>
          </div>

          {/* Brands */}
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1.5 block">
              {isAr ? 'البراندات المستهدفة' : 'Target Brands'}
              <span className="text-brand-400 font-normal ms-1">{isAr ? '(اتركها فارغة للظهور لكل البراندات)' : '(leave empty to show to all)'}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BRAND_OPTS.map(b => {
                const checked = form.brands.includes(b.value);
                return (
                  <label key={b.value}
                    className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition flex-row-reverse ${
                      checked ? 'bg-brand-50 border-brand-500 text-brand-900' : 'bg-white border-brand-100 text-brand-500 hover:border-brand-300'
                    }`}>
                    <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleBrand(b.value)} />
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-brand-500 border-brand-500' : 'border-brand-300'}`}>
                      {checked && <span className="text-white text-xs">✓</span>}
                    </span>
                    <span className="text-xs">{b.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-brand-600 mb-1.5 block">{isAr ? 'نص زر CTA' : 'CTA Button Text'}</label>
              <input className="input" value={form.ctaLabel} onChange={e => setForm(p => ({ ...p, ctaLabel: e.target.value }))} placeholder={isAr ? 'اعرف أكتر' : 'Learn more'} />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-600 mb-1.5 block">{isAr ? 'رابط CTA' : 'CTA URL'}</label>
              <input className="input" value={form.ctaUrl} onChange={e => setForm(p => ({ ...p, ctaUrl: e.target.value }))} placeholder="https://..." dir="ltr" />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 flex-row-reverse cursor-pointer">
            <input type="checkbox" className="hidden" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
            <span className={`w-9 h-5 rounded-full relative transition ${form.isActive ? 'bg-emerald-500' : 'bg-brand-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.isActive ? 'right-0.5' : 'right-[18px]'}`} />
            </span>
            <span className="text-sm text-brand-700">{isAr ? 'نشط' : 'Active'}</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-brand-100">
            <button className="btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editing ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'نشر العرض' : 'Publish'))}
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview modal — shows the live banner */}
      <Modal open={!!previewing} onClose={() => setPreviewing(null)} title={isAr ? 'معاينة البانر' : 'Banner Preview'} size="lg">
        {previewing && (
          <div className="relative overflow-hidden rounded-2xl shadow-lg">
            <div className="absolute inset-0">
              {previewing.imageUrl ? (
                <>
                  <img src={previewing.imageUrl} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-l from-brand-900/95 via-brand-900/75 to-brand-900/40" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-rose-500 to-purple-700" />
              )}
            </div>
            <div className="relative z-10 px-6 py-7 text-white text-right">
              <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400 text-brand-900 mb-2">{isAr ? 'عرض جديد' : 'New offer'}</span>
              <h3 className="text-2xl font-bold">{previewing.title}</h3>
              {previewing.description && <p className="text-sm text-white/85 mt-2">{previewing.description}</p>}
              {previewing.ctaUrl && previewing.ctaLabel && (
                <a href={previewing.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-white text-brand-900 px-4 py-1.5 rounded-lg text-sm font-bold mt-3">
                  {previewing.ctaLabel} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
