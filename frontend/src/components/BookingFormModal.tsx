import { useEffect, useMemo, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import Modal from './Modal';
import { bookingsApi, clientsApi, hotelsApi, contractsApi } from '../services/api';
import { Booking, Client, Hotel, Contract } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (booking: Booking) => void;
  clientId?: number;          // pre-filled when opened from ClientDetail
  editing?: Booking | null;   // present in edit mode
}

const RATE_PACKAGES = [
  { value: 'Bed and Breakfast', ar: 'إفطار' },
  { value: 'Half Board', ar: 'نصف إقامة' },
  { value: 'Full Board', ar: 'إقامة كاملة' },
  { value: 'Room Only', ar: 'غرفة فقط' },
  { value: 'All Inclusive', ar: 'شامل' },
];

const PAYMENT_METHODS = [
  { value: 'City Ledger', ar: 'حساب آجل' },
  { value: 'Credit Card', ar: 'بطاقة ائتمان' },
  { value: 'Cash', ar: 'كاش' },
  { value: 'Bank Transfer', ar: 'تحويل بنكي' },
  { value: 'Prepaid', ar: 'مسبق الدفع' },
];

const SOURCES = [
  { value: 'outlook', ar: 'إيميل (Outlook)', en: 'Email (Outlook)' },
  { value: 'phone', ar: 'هاتف', en: 'Phone' },
  { value: 'walk_in', ar: 'حضور مباشر', en: 'Walk-in' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

const initialState = {
  clientId: '',
  hotelId: '',
  contractId: '',
  operaConfirmationNo: '',
  guestName: '',
  reservationMadeBy: '',
  arrivalDate: '',
  departureDate: '',
  roomsCount: '1',
  adultsCount: '1',
  childrenCount: '0',
  roomType: '',
  ratePerNight: '',
  ratePackage: 'Bed and Breakfast',
  totalAmount: '',
  currency: 'SAR',
  vatPercent: '15',
  municipalityFeePercent: '2.5',
  paymentMethod: '',
  source: 'outlook',
  notes: '',
};

export default function BookingFormModal({ open, onClose, onSaved, clientId, editing }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const [form, setForm] = useState(initialState);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  // Load supporting data when modal opens
  useEffect(() => {
    if (!open) return;
    hotelsApi.getAll().then(r => setHotels(r.data)).catch(() => setHotels([]));
    if (!clientId) {
      clientsApi.getAll().then(r => setClients(r.data)).catch(() => setClients([]));
    } else {
      clientsApi.getOne(clientId).then(r => setClients([r.data])).catch(() => setClients([]));
    }
  }, [open, clientId]);

  // Reset form when opened
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        clientId: String(editing.clientId),
        hotelId: String(editing.hotelId),
        contractId: editing.contractId ? String(editing.contractId) : '',
        operaConfirmationNo: editing.operaConfirmationNo,
        guestName: editing.guestName,
        reservationMadeBy: editing.reservationMadeBy || '',
        arrivalDate: editing.arrivalDate.slice(0, 10),
        departureDate: editing.departureDate.slice(0, 10),
        roomsCount: String(editing.roomsCount),
        adultsCount: String(editing.adultsCount),
        childrenCount: String(editing.childrenCount),
        roomType: editing.roomType || '',
        ratePerNight: editing.ratePerNight != null ? String(editing.ratePerNight) : '',
        ratePackage: editing.ratePackage || 'Bed and Breakfast',
        totalAmount: editing.totalAmount != null ? String(editing.totalAmount) : '',
        currency: editing.currency || 'SAR',
        vatPercent: String(editing.vatPercent),
        municipalityFeePercent: String(editing.municipalityFeePercent),
        paymentMethod: editing.paymentMethod || '',
        source: editing.source,
        notes: editing.notes || '',
      });
      setClientSearch(editing.client?.companyName || '');
    } else {
      setForm({ ...initialState, clientId: clientId ? String(clientId) : '' });
      setClientSearch('');
    }
    setFile(null);
    setError('');
  }, [open, editing, clientId]);

  // Load contracts for the selected client
  useEffect(() => {
    if (!form.clientId) { setContracts([]); return; }
    contractsApi.getAll({ clientId: parseInt(form.clientId), status: 'approved' })
      .then(r => setContracts(r.data))
      .catch(() => setContracts([]));
  }, [form.clientId]);

  // Auto-calc nights & total
  const nights = useMemo(() => {
    if (!form.arrivalDate || !form.departureDate) return 0;
    const a = new Date(form.arrivalDate).getTime();
    const d = new Date(form.departureDate).getTime();
    if (isNaN(a) || isNaN(d) || d <= a) return 0;
    return Math.round((d - a) / (1000 * 60 * 60 * 24));
  }, [form.arrivalDate, form.departureDate]);

  const computedTotal = useMemo(() => {
    const rate = parseFloat(form.ratePerNight);
    const rooms = parseInt(form.roomsCount) || 1;
    if (!isNaN(rate) && nights > 0) return (rate * nights * rooms).toFixed(2);
    return '';
  }, [form.ratePerNight, nights, form.roomsCount]);

  const filteredClients = useMemo(() => {
    if (clientId) return clients;
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 10);
    return clients.filter(c =>
      c.companyName.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [clients, clientSearch, clientId]);

  const selectedClient = clients.find(c => c.id === parseInt(form.clientId));

  const update = (k: keyof typeof initialState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setError('');
    if (!form.clientId) return setError(isAr ? 'اختر العميل' : 'Select client');
    if (!form.hotelId) return setError(isAr ? 'اختر الفندق' : 'Select hotel');
    if (!form.operaConfirmationNo.trim()) return setError(isAr ? 'رقم تأكيد اوبرا مطلوب' : 'Opera confirmation no is required');
    if (!form.guestName.trim()) return setError(isAr ? 'اسم الضيف مطلوب' : 'Guest name is required');
    if (!form.arrivalDate || !form.departureDate) return setError(isAr ? 'تاريخ الوصول والمغادرة مطلوبان' : 'Arrival and departure dates required');
    if (nights <= 0) return setError(isAr ? 'تاريخ المغادرة لازم يكون بعد الوصول' : 'Departure must be after arrival');

    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId,
        hotelId: form.hotelId,
        contractId: form.contractId || undefined,
        operaConfirmationNo: form.operaConfirmationNo.trim(),
        guestName: form.guestName.trim(),
        reservationMadeBy: form.reservationMadeBy.trim() || undefined,
        arrivalDate: form.arrivalDate,
        departureDate: form.departureDate,
        roomsCount: form.roomsCount,
        adultsCount: form.adultsCount,
        childrenCount: form.childrenCount,
        roomType: form.roomType.trim() || undefined,
        ratePerNight: form.ratePerNight || undefined,
        ratePackage: form.ratePackage || undefined,
        totalAmount: form.totalAmount || computedTotal || undefined,
        currency: form.currency,
        vatPercent: form.vatPercent,
        municipalityFeePercent: form.municipalityFeePercent,
        paymentMethod: form.paymentMethod || undefined,
        source: form.source,
        notes: form.notes.trim() || undefined,
      };

      const res = editing
        ? await bookingsApi.update(editing.id, payload, file || undefined)
        : await bookingsApi.create(payload, file || undefined);

      const booking = res.data.booking || res.data;
      const dup = res.data.duplicate;

      if (dup && !editing) {
        const msg = dup.sameClient
          ? (isAr ? 'تنبيه: رقم الحجز ده موجود قبل كده لنفس العميل. تم الحفظ بأي حال.' : 'Note: This Opera confirmation number already exists for this client. Saved anyway.')
          : (isAr ? 'تنبيه: رقم الحجز ده مستخدم لعميل آخر. تأكد من الرقم. تم الحفظ بأي حال.' : 'Note: This Opera confirmation number is used by another client. Verify and saved anyway.');
        alert(msg);
      }

      onSaved(booking);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? (isAr ? 'تعديل الحجز' : 'Edit Booking') : (isAr ? 'حجز جديد' : 'New Booking')}
      size="xl"
    >
      <div className="space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg border border-red-200">{error}</div>}

        {/* Client + Hotel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client */}
          <div className="relative">
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'العميل' : 'Client'} <span className="text-red-500">*</span>
            </label>
            {clientId ? (
              <input
                type="text"
                value={selectedClient?.companyName || clientSearch || '...'}
                disabled
                className="input bg-brand-50 text-brand-700"
              />
            ) : (
              <>
                <input
                  type="text"
                  className="input"
                  placeholder={isAr ? 'ابحث بالاسم أو الهاتف' : 'Search by name or phone'}
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
                  onFocus={() => setShowClientList(true)}
                  onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                />
                {showClientList && filteredClients.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-brand-200 rounded-lg shadow-elevated">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { update('clientId', String(c.id)); setClientSearch(c.companyName); setShowClientList(false); }}
                        className="w-full px-3 py-2 text-start hover:bg-brand-50 text-sm border-b border-brand-100 last:border-0"
                      >
                        <div className="font-medium text-brand-900">{c.companyName}</div>
                        <div className="text-xs text-brand-500">{c.contactPerson} · {c.phone || '-'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hotel */}
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'الفندق' : 'Hotel'} <span className="text-red-500">*</span>
            </label>
            <select className="input" value={form.hotelId} onChange={e => update('hotelId', e.target.value)}>
              <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
              {hotels.filter(h => h.isActive).map(h => (
                <option key={h.id} value={h.id}>{isAr ? h.name : (h.nameEn || h.name)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linked Contract — auto-fills the nightly rate from the contract's ratePerRoom */}
        {contracts.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'العقد المرتبط' : 'Linked Contract'}
              <span className="text-brand-400 font-normal ms-1">{isAr ? '(اختياري — سعر الليلة من العقد)' : '(optional — pulls nightly rate from contract)'}</span>
            </label>
            <select
              className="input"
              value={form.contractId}
              onChange={e => {
                const v = e.target.value;
                const c = contracts.find(x => String(x.id) === v);
                setForm(prev => ({
                  ...prev,
                  contractId: v,
                  ratePerNight: c?.ratePerRoom != null ? String(c.ratePerRoom) : prev.ratePerNight,
                }));
              }}
            >
              <option value="">{isAr ? 'بدون عقد' : 'No contract'}</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.contractRef || `#${c.id}`}
                  {c.ratePerRoom ? ` · ${isAr ? 'سعر الليلة' : 'Rate'}: ${c.ratePerRoom.toLocaleString()} SAR` : ''}
                  {c.totalValue ? ` · ${isAr ? 'الإجمالي' : 'Total'}: ${c.totalValue.toLocaleString()} SAR` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Opera Confirmation + Guest Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'رقم تأكيد اوبرا' : 'Opera Confirmation No'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={form.operaConfirmationNo}
              onChange={e => update('operaConfirmationNo', e.target.value)}
              placeholder="574184126"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'اسم الضيف' : 'Guest Name'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={form.guestName}
              onChange={e => update('guestName', e.target.value)}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'تاريخ الوصول' : 'Arrival Date'} <span className="text-red-500">*</span>
            </label>
            <input type="date" className="input" value={form.arrivalDate} onChange={e => update('arrivalDate', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'تاريخ المغادرة' : 'Departure Date'} <span className="text-red-500">*</span>
            </label>
            <input type="date" className="input" value={form.departureDate} onChange={e => update('departureDate', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'عدد الليالي' : 'Nights'}
            </label>
            <input type="text" className="input bg-brand-50" value={nights || ''} disabled />
          </div>
        </div>

        {/* Rooms / Adults / Children / Room type */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'عدد الغرف' : 'Rooms'}</label>
            <input type="number" min="1" className="input" value={form.roomsCount} onChange={e => update('roomsCount', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'عدد الكبار' : 'Adults'}</label>
            <input type="number" min="0" className="input" value={form.adultsCount} onChange={e => update('adultsCount', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'عدد الأطفال' : 'Children'}</label>
            <input type="number" min="0" className="input" value={form.childrenCount} onChange={e => update('childrenCount', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'نوع الغرفة' : 'Room Type'}</label>
            <input type="text" className="input" value={form.roomType} onChange={e => update('roomType', e.target.value)} placeholder="ST KING" />
          </div>
        </div>

        {/* Rate / Package / Total */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'سعر الليلة' : 'Rate/Night'}</label>
            <input type="number" step="0.01" className="input" value={form.ratePerNight} onChange={e => update('ratePerNight', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'الباقة' : 'Package'}</label>
            <select className="input" value={form.ratePackage} onChange={e => update('ratePackage', e.target.value)}>
              {RATE_PACKAGES.map(p => <option key={p.value} value={p.value}>{isAr ? p.ar : p.value}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">
              {isAr ? 'الإجمالي' : 'Total'}
              <span className="text-brand-400 font-normal"> {computedTotal && !form.totalAmount ? (isAr ? '(محسوب)' : '(computed)') : ''}</span>
            </label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.totalAmount || computedTotal}
              onChange={e => update('totalAmount', e.target.value)}
              placeholder={computedTotal}
            />
          </div>
        </div>

        {/* VAT / Municipality / Currency */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'ضريبة القيمة المضافة %' : 'VAT %'}</label>
            <input type="number" step="0.01" className="input" value={form.vatPercent} onChange={e => update('vatPercent', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'رسوم البلدية %' : 'Municipality %'}</label>
            <input type="number" step="0.01" className="input" value={form.municipalityFeePercent} onChange={e => update('municipalityFeePercent', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'العملة' : 'Currency'}</label>
            <select className="input" value={form.currency} onChange={e => update('currency', e.target.value)}>
              <option value="SAR">SAR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        {/* Payment / Source / Reservation made by */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
            <select className="input" value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)}>
              <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
              {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{isAr ? p.ar : p.value}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'مصدر الحجز' : 'Source'}</label>
            <select className="input" value={form.source} onChange={e => update('source', e.target.value)}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{isAr ? s.ar : s.en}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'منشئ الحجز في اوبرا' : 'Reservation Made By'}</label>
            <input type="text" className="input" value={form.reservationMadeBy} onChange={e => update('reservationMadeBy', e.target.value)} placeholder="M.EZZ@EWAA" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'ملاحظات' : 'Notes'}</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} />
        </div>

        {/* Confirmation letter */}
        <div>
          <label className="text-xs font-semibold text-brand-600 mb-1 block">{isAr ? 'خطاب التأكيد (PDF / صورة)' : 'Confirmation Letter (PDF / image)'}</label>
          <div className="flex items-center gap-3">
            <label className="btn-secondary text-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              {isAr ? 'اختر ملف' : 'Choose file'}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {file && (
              <span className="text-sm text-brand-600 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {file.name}
              </span>
            )}
            {!file && editing?.confirmationLetterName && (
              <span className="text-sm text-brand-500 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {editing.confirmationLetterName}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-brand-100">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editing ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء الحجز' : 'Create Booking'))}
          </button>
        </div>
      </div>
    </Modal>
  );
}
