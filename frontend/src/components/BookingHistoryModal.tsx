import { useEffect, useState } from 'react';
import { Clock, Edit3, XCircle, CheckCircle, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import { bookingsApi } from '../services/api';
import { Booking } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface Props {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
}

interface ChangeLogEntry {
  id: number;
  bookingId: number;
  action: 'edit' | 'cancel' | 'status_change' | 'reactivate';
  reason: string;
  changesJson: string | null;
  fieldsList: string | null;
  createdAt: string;
  changedBy?: { id: number; name: string; role: string };
}

const FIELD_LABELS_AR: Record<string, string> = {
  operaConfirmationNo: 'رقم تأكيد اوبرا',
  guestName: 'اسم الضيف',
  reservationMadeBy: 'منشئ الحجز',
  arrivalDate: 'تاريخ الوصول',
  departureDate: 'تاريخ المغادرة',
  nights: 'عدد الليالي',
  roomsCount: 'عدد الغرف',
  adultsCount: 'عدد الكبار',
  childrenCount: 'عدد الأطفال',
  roomType: 'نوع الغرفة',
  ratePerNight: 'سعر الليلة',
  ratePackage: 'الباقة',
  totalAmount: 'الإجمالي',
  currency: 'العملة',
  vatPercent: 'الضريبة',
  municipalityFeePercent: 'رسوم البلدية',
  paymentMethod: 'طريقة الدفع',
  source: 'المصدر',
  hotelId: 'الفندق',
  contractId: 'العقد',
  notes: 'الملاحظات',
  status: 'الحالة',
};

const formatVal = (v: any, isDate?: boolean) => {
  if (v === null || v === undefined || v === '') return '—';
  if (isDate && typeof v === 'string' && v.includes('T')) {
    try { return format(parseISO(v), 'dd MMM yyyy'); } catch { return String(v); }
  }
  return String(v);
};

export default function BookingHistoryModal({ open, booking, onClose }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !booking) return;
    setLoading(true);
    bookingsApi.history(booking.id)
      .then(r => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, booking]);

  const actionIcon: Record<string, any> = {
    edit: Edit3,
    cancel: XCircle,
    status_change: RefreshCw,
    reactivate: CheckCircle,
  };

  const actionLabel: Record<string, { ar: string; en: string; cls: string }> = {
    edit: { ar: 'تعديل', en: 'Edit', cls: 'bg-amber-100 text-amber-700' },
    cancel: { ar: 'إلغاء', en: 'Cancel', cls: 'bg-red-100 text-red-700' },
    status_change: { ar: 'تغيير حالة', en: 'Status Change', cls: 'bg-blue-100 text-blue-700' },
    reactivate: { ar: 'إعادة تفعيل', en: 'Reactivate', cls: 'bg-emerald-100 text-emerald-700' },
  };

  if (!booking) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? `سجل تغييرات الحجز #${booking.operaConfirmationNo}` : `Booking History — #${booking.operaConfirmationNo}`}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-7 h-7 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-brand-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{isAr ? 'لا توجد تعديلات على هذا الحجز' : 'No changes recorded for this booking'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const Icon = actionIcon[log.action] || Edit3;
            const label = actionLabel[log.action] || actionLabel.edit;
            let changes: Record<string, { from: any; to: any }> = {};
            try { if (log.changesJson) changes = JSON.parse(log.changesJson); } catch {}
            const dateFields = ['arrivalDate', 'departureDate'];

            return (
              <div key={log.id} className="card p-4">
                <div className={`flex items-start justify-between gap-3 mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${label.cls}`}>
                      <Icon className="w-3 h-3" />
                      {isAr ? label.ar : label.en}
                    </span>
                    <span className="text-xs text-brand-500">
                      {log.changedBy?.name}
                    </span>
                  </div>
                  <span className="text-xs text-brand-400">
                    {format(parseISO(log.createdAt), 'dd MMM yyyy HH:mm', { locale })}
                  </span>
                </div>

                <div className={`bg-brand-50 rounded-lg px-3 py-2 mb-2 text-sm text-brand-800 ${isAr ? 'text-right' : ''}`}>
                  <span className="font-semibold">{isAr ? 'السبب: ' : 'Reason: '}</span>
                  {log.reason}
                </div>

                {Object.keys(changes).length > 0 && (
                  <div className={`space-y-1 ${isAr ? 'text-right' : ''}`}>
                    {Object.entries(changes).map(([field, { from, to }]) => {
                      const isDate = dateFields.includes(field);
                      return (
                        <div key={field} className="text-xs flex flex-wrap items-center gap-2">
                          <span className="font-medium text-brand-600 min-w-[100px]">
                            {isAr ? (FIELD_LABELS_AR[field] || field) : field}:
                          </span>
                          <span className="text-red-600 line-through">{formatVal(from, isDate)}</span>
                          <span className="text-brand-400">→</span>
                          <span className="text-emerald-700 font-medium">{formatVal(to, isDate)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
