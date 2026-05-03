import { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import Modal from './Modal';
import { bookingsApi } from '../services/api';
import { Booking } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onCancelled: () => void;
}

export default function CancelBookingModal({ open, booking, onClose, onCancelled }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setReason(''); setError(''); }
  }, [open]);

  const handleConfirm = async () => {
    if (!booking) return;
    if (!reason.trim()) {
      setError(isAr ? 'سبب الإلغاء مطلوب' : 'Cancellation reason is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await bookingsApi.updateStatus(booking.id, 'cancelled', { cancellationReason: reason.trim() });
      onCancelled();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || (isAr ? 'فشل الإلغاء' : 'Failed to cancel'));
    } finally {
      setBusy(false);
    }
  };

  if (!booking) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'إلغاء الحجز' : 'Cancel Booking'}
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <XCircle className="w-4 h-4" />
            {isAr ? 'تنبيه' : 'Warning'}
          </div>
          {isAr
            ? `هتلغي حجز رقم ${booking.operaConfirmationNo} للضيف ${booking.guestName}. الإجراء ده هيتسجل في سجل التغييرات وهيوصل إشعار للمندوب.`
            : `You're about to cancel booking #${booking.operaConfirmationNo} for ${booking.guestName}. This will be logged and the sales rep will be notified.`}
        </div>

        <div>
          <label className="text-xs font-semibold text-brand-600 mb-1 block">
            {isAr ? 'سبب الإلغاء' : 'Cancellation Reason'} <span className="text-red-500">*</span>
          </label>
          <textarea
            className="input"
            rows={3}
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={isAr ? 'مثلاً: العميل ألغى الحجز، أو تغيير الخطة، أو No-show من الضيف...' : 'e.g. Guest cancelled, plan changed, no-show...'}
          />
        </div>

        {error && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-brand-100">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {isAr ? 'تراجع' : 'Back'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-2"
            onClick={handleConfirm}
            disabled={busy}
          >
            <XCircle className="w-4 h-4" />
            {busy ? (isAr ? 'جاري الإلغاء...' : 'Cancelling...') : (isAr ? 'تأكيد الإلغاء' : 'Confirm Cancellation')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
