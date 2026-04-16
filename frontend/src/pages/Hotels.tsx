import { useEffect, useState } from 'react';
import { Hotel, Plus, MapPin, Star } from 'lucide-react';
import { hotelsApi } from '../services/api';
import { Hotel as HotelType } from '../types';
import Modal from '../components/Modal';
import { useLanguage } from '../contexts/LanguageContext';

const HOTEL_GROUPS = [
  { value: 'muhaidib_serviced', labelKey: 'hotel_group_muhaidib' as const },
  { value: 'awa_hotels', labelKey: 'hotel_group_awa' as const },
  { value: 'grand_plaza', labelKey: 'hotel_group_grand_plaza' as const },
];

const HOTEL_TYPES = [
  { value: 'Business', ar: 'أعمال', en: 'Business' },
  { value: 'Resort', ar: 'منتجع', en: 'Resort' },
  { value: 'Beach', ar: 'شاطئ', en: 'Beach' },
  { value: 'City', ar: 'مدينة', en: 'City' },
  { value: 'Airport', ar: 'مطار', en: 'Airport' },
];

const GROUP_COLORS: Record<string, string> = {
  muhaidib_serviced: 'bg-blue-100 text-blue-700',
  awa_hotels: 'bg-green-100 text-green-700',
  grand_plaza: 'bg-purple-100 text-purple-700',
};

export default function Hotels() {
  const { t, lang } = useLanguage();
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editHotel, setEditHotel] = useState<HotelType | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [form, setForm] = useState({
    name: '', nameEn: '', location: '', city: '', stars: '5', type: '', group: ''
  });

  const load = () => hotelsApi.getAll().then(r => setHotels(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditHotel(null);
    setForm({ name: '', nameEn: '', location: '', city: '', stars: '5', type: '', group: '' });
    setShowModal(true);
  };
  const openEdit = (h: HotelType) => {
    setEditHotel(h);
    setForm({ name: h.name, nameEn: h.nameEn || '', location: h.location, city: h.city || '', stars: h.stars?.toString() || '5', type: h.type || '', group: h.group || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editHotel) await hotelsApi.update(editHotel.id, form);
      else await hotelsApi.create(form);
      setShowModal(false); load();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const filtered = filterGroup === 'all' ? hotels : hotels.filter(h => h.group === filterGroup);

  const grouped = HOTEL_GROUPS.reduce((acc, g) => {
    acc[g.value] = filtered.filter(h => h.group === g.value);
    return acc;
  }, {} as Record<string, HotelType[]>);
  const ungrouped = filtered.filter(h => !h.group);

  const isAr = lang === 'ar';

  return (
    <div className="space-y-5">
      <div className={`flex items-center justify-between`}>
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{t('hotels_title')}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{hotels.length} {t('hotels_title')}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> {t('hotel_add')}
        </button>
      </div>

      {/* Group Filter */}
      <div className={`flex gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
        <button
          onClick={() => setFilterGroup('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterGroup === 'all' ? 'bg-brand-600 text-white' : 'bg-white text-brand-500 border border-brand-200 hover:bg-brand-50'}`}
        >
          {t('all')} ({hotels.length})
        </button>
        {HOTEL_GROUPS.map(g => (
          <button
            key={g.value}
            onClick={() => setFilterGroup(g.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterGroup === g.value ? 'bg-brand-600 text-white' : 'bg-white text-brand-500 border border-brand-200 hover:bg-brand-50'}`}
          >
            {t(g.labelKey)} ({hotels.filter(h => h.group === g.value).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Grouped sections */}
          {HOTEL_GROUPS.map(g => {
            const groupHotels = grouped[g.value] || [];
            if (filterGroup !== 'all' && filterGroup !== g.value) return null;
            if (groupHotels.length === 0) return null;
            return (
              <div key={g.value}>
                <div className={`flex items-center gap-2 mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${GROUP_COLORS[g.value]}`}>
                    {t(g.labelKey)}
                  </span>
                  <span className="text-sm text-brand-400">{groupHotels.length} {t('hotels_title')}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupHotels.map(h => (
                    <div key={h.id} className="card p-4 hover:border-brand-200 transition-colors">
                      <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                          <Hotel className="w-5 h-5 text-brand-600" />
                        </div>
                        <button onClick={() => openEdit(h)} className="text-xs text-brand-600 hover:underline">{t('hotel_edit')}</button>
                      </div>
                      <div className={`mt-3 ${isAr ? 'text-right' : 'text-left'}`}>
                        <h2 className="font-bold text-brand-900 text-sm leading-snug">{isAr ? h.name : (h.nameEn || h.name)}</h2>
                        {h.nameEn && isAr && <p className="text-xs text-brand-400 mt-0.5">{h.nameEn}</p>}
                        <div className={`flex items-center gap-1 mt-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                          {Array.from({ length: h.stars || 0 }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                          ))}
                          {h.type && (
                            <span className="text-xs text-brand-400 mr-1">
                              · {HOTEL_TYPES.find(tp => tp.value === h.type)?.[lang] || h.type}
                            </span>
                          )}
                        </div>
                        {h.city && (
                          <div className={`flex items-center gap-1 mt-1.5 text-xs text-brand-400 ${isAr ? 'flex-row-reverse' : ''}`}>
                            <MapPin className="w-3 h-3" />
                            <span>{h.city}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ungrouped.map(h => (
                <div key={h.id} className="card p-5 hover:border-brand-200 transition-colors">
                  <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                    <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
                      <Hotel className="w-6 h-6 text-brand-600" />
                    </div>
                    <button onClick={() => openEdit(h)} className="text-xs text-brand-600 hover:underline">{t('hotel_edit')}</button>
                  </div>
                  <div className={`mt-3 ${isAr ? 'text-right' : 'text-left'}`}>
                    <h2 className="font-bold text-brand-900 text-lg">{isAr ? h.name : (h.nameEn || h.name)}</h2>
                    <div className={`flex items-center gap-1 mt-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                      {Array.from({ length: h.stars || 0 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <div className={`flex items-center gap-1.5 mt-2 text-sm text-brand-400 ${isAr ? 'flex-row-reverse' : ''}`}>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{h.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editHotel ? t('hotel_edit') : t('hotel_add')} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('hotel_name')} *</label>
            <input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الفندق بالعربية" />
          </div>
          <div>
            <label className="label">{t('hotel_name_en')}</label>
            <input className="input" value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="Hotel name in English" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('hotel_city')}</label>
              <input className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('hotel_location')} *</label>
              <input className="input" required value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{t('hotel_group')}</label>
            <select className="input" value={form.group} onChange={e => setForm(p => ({ ...p, group: e.target.value }))}>
              <option value="">— {t('optional')} —</option>
              {HOTEL_GROUPS.map(g => (
                <option key={g.value} value={g.value}>{t(g.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('hotel_stars')}</label>
              <select className="input" value={form.stars} onChange={e => setForm(p => ({ ...p, stars: e.target.value }))}>
                {[3, 4, 5].map(s => <option key={s} value={s}>{s} {t('stars_label')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('hotel_type')}</label>
              <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option value="">{t('optional')}...</option>
                {HOTEL_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp[lang]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? t('hotel_saving') : editHotel ? t('hotel_save') : t('hotel_create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
