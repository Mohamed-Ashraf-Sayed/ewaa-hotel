import { useState, useEffect } from 'react';
import { CheckCircle, Upload, FileText } from 'lucide-react';
import Modal from './Modal';
import { bookingsApi } from '../services/api';
import { Booking } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onConfirmed: () => void;
}

export default function ConfirmRequestModal({ open, booking, onClose, onConfirmed }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const [operaConfirmationNo, setOperaConfirmationNo] = useState('');
  const [reservationMadeBy, setReservationMadeBy] = useState('');
  const [ratePerNight, setRatePerNight] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !booking) return;
    setOperaConfirmationNo('');
    setReservationMadeBy('');
    setRatePerNight(booking.ratePerNight != null ? String(booking.ratePerNight) : '');
    setPaymentMethod(booking.paymentMethod || '');
    setFile(null);
    setError('');
  }, [open, booking]);

  const handleConfirm = async () => {
    if (!booking) return;
    setError('');
    if (!operaConfirmationNo.trim()) {
      setError(isAr ? 'رقم تأكيد اوبرا مطلوب' : 'Opera confirmation no is required');
      return;
    }
    setBusy(true);
    try {
      await bookingsApi.confirmRequest(booking.id, {
        operaConfirmationNo: operaConfirmationNo.trim(),
        reservationMadeBy: reservationMadeBy.trim() || undefined,
        ratePerNight: ratePerNight || undefined,
        paymentMethod: paymentMethod || undefined,
      }, file || undefined);
      onConfirmed();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || (isAr ? 'فشل التأكيد' : 'Failed to confirm'));
    } finally {
      setBusy(false);
    }
  };

  if (!booking) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'تأكيد طلب الحجز' : 'Confirm Booking Request'}
      size="lg"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <div className="font-semibold mb-1">{isAr ? 'بيانات الطلب' : 'Request details'}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-blue-700">{isAr ? 'العميل:' : 'Client:'}</span> {booking.client?.companyName}</div>
            <div><span className="text-blue-700">{isAr ? 'الفندق:' : 'Hotel:'}</span> {booking.hotel?.name}</div>
            <div><span className="text-blue-700">{isAr ? 'الضيف:' : 'Guest:'}</span> {booking.guestName}</div>
            <div><span className="text-blue-700">{isAr ? 'الليالي:' : 'Nights:'}</span> {booking.nights} × {booking.roomsCount} {isAr ? 'غرفة' : 'rooms'}</div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-brand-700 mb-1.5 block">
            {isAr ? 'رقم تأكيد اوبرا' : 'Opera Confirmation No'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input"
            autoFocus
            value={operaConfirmationNo}
            onChange={e => setOperaConfirmationNo(e.target.value)}
            placeholder="574184126"
          />
          <p className="text-[11px] text-brand-400 mt-1">
            {isAr ? 'بعد ما تعمل الحجز على اوبرا، حط الرقم هنا.' : 'Enter the number after creating the booking in Opera.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">{isAr ? 'منشئ الحجز في اوبرا' : 'Reservation Made By'}</label>
            <input type="text" className="input" value={reservationMadeBy} onChange={e => setReservationMadeBy(e.target.value)} placeholder="M.EZZ@EWAA" />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1.5 block">{isAr ? 'سعر الليلة' : 'Rate/Night'}</label>
            <input type="number" step="0.01" className="input" value={ratePerNight} onChange={e => setRatePerNight(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-brand-700 mb-1.5 block">{isAr ? 'طريقة الدفع المعتمدة' : 'Approved Payment Method'}</label>
          <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
            <option value="City Ledger">{isAr ? 'حساب الشركة (City Ledger)' : 'City Ledger'}</option>
            <option value="Cash">{isAr ? 'كاش' : 'Cash'}</option>
            <option value="Credit Card">{isAr ? 'بطاقة ائتمان' : 'Credit Card'}</option>
            <option value="Bank Transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-brand-700 mb-1.5 block">{isAr ? 'خطاب التأكيد (اختياري)' : 'Confirmation Letter (optional)'}</label>
          <div className="flex items-center gap-2">
            <label className="btn-secondary text-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              {isAr ? 'اختر ملف' : 'Choose file'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
            {file && <span className="text-xs text-brand-600 flex items-center gap-1"><FileText className="w-3 h-3" /> {file.name}</span>}
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-brand-100">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {isAr ? 'تراجع' : 'Cancel'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-2"
            onClick={handleConfirm}
            disabled={busy}
          >
            <CheckCircle className="w-4 h-4" />
            {busy ? (isAr ? 'جاري التأكيد...' : 'Confirming...') : (isAr ? 'تأكيد الحجز' : 'Confirm Booking')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
