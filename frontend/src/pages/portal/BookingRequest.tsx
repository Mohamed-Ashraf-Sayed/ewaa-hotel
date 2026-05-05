import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Send, Building2, Calendar, BedDouble, Users, CreditCard, UserPlus, X, Utensils } from 'lucide-react';
import { portalDataApi } from '../../services/portalApi';

interface PortalHotel {
  id: number;
  name: string;
  nameEn?: string;
  city?: string;
  stars?: number;
  group?: string;
}

interface PortalContract {
  id: number;
  contractRef?: string;
  hotelId: number;
  ratePerRoom?: number;
  hotel?: { id: number; name: string };
}

interface GuestRow {
  name: string;
  nationality: string;
}

const BRAND_LABELS: Record<string, string> = {
  muhaidib_serviced: 'فنادق المهيدب',
  awa_hotels: 'فنادق إيواء',
  grand_plaza: 'جراند بلازا',
};
const BRAND_ORDER = ['muhaidib_serviced', 'awa_hotels', 'grand_plaza'];

const RATE_PACKAGES = [
  { value: 'Bed and Breakfast', label: 'إفطار' },
  { value: 'Half Board',        label: 'نصف إقامة (إفطار + عشاء)' },
  { value: 'Full Board',        label: 'إقامة كاملة (3 وجبات)' },
  { value: 'All Inclusive',     label: 'شامل' },
  { value: 'Room Only',         label: 'غرفة فقط' },
];

const PAYMENT_METHODS = [
  { value: 'City Ledger', label: 'على حساب الشركة (آجل / كرديت)' },
  { value: 'Cash',        label: 'كاش (الضيف يدفع في الفندق)' },
];

// Common nationalities for the GCC market — kept short for usability;
// the field falls back to free text via "أخرى".
const NATIONALITIES = [
  'سعودي', 'مصري', 'إماراتي', 'قطري', 'بحريني', 'كويتي', 'عماني',
  'أردني', 'لبناني', 'سوري', 'فلسطيني', 'عراقي', 'يمني', 'سوداني',
  'مغربي', 'تونسي', 'جزائري', 'ليبي',
  'باكستاني', 'هندي', 'بنغلاديشي', 'فلبيني', 'إندونيسي',
  'تركي', 'بريطاني', 'أمريكي', 'فرنسي', 'ألماني', 'إيطالي',
  'أخرى',
];

const initial = {
  hotelId: '',
  contractId: '',
  arrivalDate: '',
  departureDate: '',
  roomsCount: '1',
  adultsCount: '1',
  childrenCount: '0',
  roomType: '',
  ratePackage: 'Bed and Breakfast',
  paymentMethod: 'City Ledger',
  notes: '',
};

export default function PortalBookingRequest() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [guests, setGuests] = useState<GuestRow[]>([{ name: '', nationality: '' }]);
  const [hotels, setHotels] = useState<PortalHotel[]>([]);
  const [contracts, setContracts] = useState<PortalContract[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    portalDataApi.hotels().then(r => setHotels(r.data)).catch(() => setHotels([]));
    portalDataApi.contracts().then(r => setContracts(r.data)).catch(() => setContracts([]));
  }, []);

  const update = (k: keyof typeof initial, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Auto-pick contract when hotel changes
  useEffect(() => {
    if (!form.hotelId) { update('contractId', ''); return; }
    const match = contracts.find(c => String(c.hotelId) === form.hotelId);
    update('contractId', match ? String(match.id) : '');
  }, [form.hotelId, contracts]);

  const selectedContract = contracts.find(c => String(c.id) === form.contractId);

  // Group hotels by brand for the <optgroup> render
  const hotelsByBrand = useMemo(() => {
    const map: Record<string, PortalHotel[]> = {};
    for (const h of hotels) {
      const k = h.group || 'other';
      (map[k] ||= []).push(h);
    }
    // Sort within each brand alphabetically
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return map;
  }, [hotels]);

  const orderedBrands = useMemo(() => {
    const known = BRAND_ORDER.filter(b => hotelsByBrand[b]?.length > 0);
    const unknown = Object.keys(hotelsByBrand).filter(b => !BRAND_ORDER.includes(b));
    return [...known, ...unknown];
  }, [hotelsByBrand]);

  const nights = useMemo(() => {
    if (!form.arrivalDate || !form.departureDate) return 0;
    const a = new Date(form.arrivalDate).getTime();
    const d = new Date(form.departureDate).getTime();
    if (isNaN(a) || isNaN(d) || d <= a) return 0;
    return Math.round((d - a) / (1000 * 60 * 60 * 24));
  }, [form.arrivalDate, form.departureDate]);

  const computedTotal = useMemo(() => {
    if (!selectedContract?.ratePerRoom || !nights) return null;
    const rooms = parseInt(form.roomsCount) || 1;
    return selectedContract.ratePerRoom * nights * rooms;
  }, [selectedContract, nights, form.roomsCount]);

  // ---- Guest list handlers ----
  const addGuest = () => setGuests(g => [...g, { name: '', nationality: '' }]);
  const removeGuest = (i: number) => setGuests(g => g.filter((_, idx) => idx !== i));
  const updateGuest = (i: number, k: keyof GuestRow, v: string) =>
    setGuests(g => g.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.hotelId) return setError('اختر الفندق');
    const validGuests = guests.filter(g => g.name.trim());
    if (validGuests.length === 0) return setError('أدخل اسم ضيف واحد على الأقل');
    if (!form.arrivalDate || !form.departureDate) return setError('التواريخ مطلوبة');
    if (nights <= 0) return setError('تاريخ المغادرة لازم يكون بعد الوصول');

    setBusy(true);
    try {
      await portalDataApi.requestBooking({
        hotelId: parseInt(form.hotelId),
        contractId: form.contractId ? parseInt(form.contractId) : undefined,
        guests: validGuests.map(g => ({
          name: g.name.trim(),
          nationality: g.nationality.trim() || undefined,
        })),
        arrivalDate: form.arrivalDate,
        departureDate: form.departureDate,
        roomsCount: parseInt(form.roomsCount),
        adultsCount: parseInt(form.adultsCount),
        childrenCount: parseInt(form.childrenCount),
        roomType: form.roomType.trim() || undefined,
        ratePackage: form.ratePackage,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || undefined,
      });
      navigate('/portal');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'فشل إرسال الطلب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto" dir="rtl">
      <div className="text-right">
        <h2 className="text-xl font-bold text-brand-900">طلب حجز جديد</h2>
        <p className="text-sm text-brand-500 mt-1">قسم الحجوزات هيراجع طلبك ويأكد التوافر مع الفندق.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg border border-red-200">{error}</div>}

        {/* Hotel — grouped by brand */}
        <div>
          <label className="text-xs font-semibold text-brand-700 mb-1.5 block flex items-center gap-1 flex-row-reverse">
            <Building2 className="w-3.5 h-3.5" /> الفندق <span className="text-red-500">*</span>
          </label>
          <select className="input" value={form.hotelId} onChange={e => update('hotelId', e.target.value)} required>
            <option value="">-- اختر الفندق --</option>
            {orderedBrands.map(brand => (
              <optgroup key={brand} label={BRAND_LABELS[brand] || brand}>
                {hotelsByBrand[brand].map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name}{h.city ? ` · ${h.city}` : ''}{h.stars ? ` · ${h.stars}★` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedContract && (
            <p className="text-[11px] text-emerald-700 mt-1.5">
              ✓ سيتم تطبيق سعر العقد المتفق عليه: <b>{selectedContract.ratePerRoom?.toLocaleString()} ر.س / ليلة</b>
            </p>
          )}
          {form.hotelId && !selectedContract && (
            <p className="text-[11px] text-amber-700 mt-1.5">
              ⚠ مفيش عقد إطاري لهذا الفندق — قسم الحجوزات هيتواصل معاك بالسعر بعد المراجعة.
            </p>
          )}
        </div>

        {/* Guests — multi-row */}
        <div className="rounded-xl bg-brand-50/50 border border-brand-100 p-4">
          <div className="flex items-center justify-between mb-3 flex-row-reverse">
            <label className="text-xs font-bold text-brand-700 flex items-center gap-1 flex-row-reverse">
              <Users className="w-3.5 h-3.5" /> الضيوف <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addGuest}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 flex-row-reverse"
            >
              <UserPlus className="w-3.5 h-3.5" /> إضافة ضيف
            </button>
          </div>
          <div className="space-y-2">
            {guests.map((g, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-1 flex items-center justify-center mt-2">
                  <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-600'}`}>
                    {i === 0 ? '★' : i + 1}
                  </span>
                </div>
                <div className="col-span-6">
                  <input
                    type="text"
                    className="input"
                    placeholder={i === 0 ? 'اسم الضيف الرئيسي' : `ضيف رقم ${i + 1}`}
                    value={g.name}
                    onChange={e => updateGuest(i, 'name', e.target.value)}
                    required={i === 0}
                  />
                </div>
                <div className="col-span-4">
                  <select
                    className="input"
                    value={g.nationality}
                    onChange={e => updateGuest(i, 'nationality', e.target.value)}
                  >
                    <option value="">الجنسية</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex items-center mt-1.5">
                  {guests.length > 1 && i > 0 && (
                    <button
                      type="button"
                      onClick={() => removeGuest(i)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      aria-label="حذف ضيف"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-brand-500 mt-2">
            ★ الضيف الأول هو الضيف الرئيسي — سيتم استخدامه في تأكيد اوبرا والمراسلات.
          </p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block flex items-center gap-1 flex-row-reverse">
              <Calendar className="w-3.5 h-3.5" /> الوصول <span className="text-red-500">*</span>
            </label>
            <input type="date" className="input" value={form.arrivalDate} onChange={e => update('arrivalDate', e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">المغادرة <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.departureDate} onChange={e => update('departureDate', e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">الليالي</label>
            <input type="text" className="input bg-brand-50" value={nights || ''} disabled />
          </div>
        </div>

        {/* Rooms / Adults / Children / Room type */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block flex items-center gap-1 flex-row-reverse">
              <BedDouble className="w-3.5 h-3.5" /> الغرف
            </label>
            <input type="number" min="1" className="input" value={form.roomsCount} onChange={e => update('roomsCount', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">الكبار</label>
            <input type="number" min="1" className="input" value={form.adultsCount} onChange={e => update('adultsCount', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">الأطفال</label>
            <input type="number" min="0" className="input" value={form.childrenCount} onChange={e => update('childrenCount', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">نوع الغرفة (اختياري)</label>
            <input type="text" className="input" value={form.roomType} onChange={e => update('roomType', e.target.value)} placeholder="ST KING" />
          </div>
        </div>

        {/* Meals + Payment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block flex items-center gap-1 flex-row-reverse">
              <Utensils className="w-3.5 h-3.5" /> الوجبات / الباقة
            </label>
            <select className="input" value={form.ratePackage} onChange={e => update('ratePackage', e.target.value)}>
              {RATE_PACKAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block flex items-center gap-1 flex-row-reverse">
              <CreditCard className="w-3.5 h-3.5" /> طريقة الدفع <span className="text-red-500">*</span>
            </label>
            <select className="input" value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)} required>
              {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-brand-700 mb-1.5 block">ملاحظات / طلبات خاصة</label>
          <textarea
            className="input"
            rows={2}
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="مثلاً: غرفة في الدور الأرضي، إفطار حلال، إلخ"
          />
        </div>

        {computedTotal != null && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <div className="text-xs text-emerald-700">المبلغ التقديري (قبل الضرائب)</div>
            <div className="text-2xl font-bold text-emerald-800">{computedTotal.toLocaleString()} ر.س</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">{nights} ليلة × {form.roomsCount} غرفة × سعر العقد</div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-brand-100 flex-row-reverse">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'جاري الإرسال...' : 'إرسال طلب الحجز'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/portal')} disabled={busy}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
