import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { fetchReservation, Reservation } from '../api';

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'حجز جديد', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  modification: { label: 'تعديل', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  cancellation: { label: 'إلغاء', color: 'bg-rose-100 text-rose-700 border-rose-300' },
};

export default function ReservationDetail() {
  const { id } = useParams();
  const [r, setR] = useState<Reservation | null>(null);

  useEffect(() => {
    if (id) fetchReservation(parseInt(id, 10)).then(setR);
  }, [id]);

  if (!r) return <div className="p-6 text-slate-500">جاري التحميل...</div>;

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <Link to="/reservations" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> العودة للحجوزات
      </Link>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-slate-500">رقم الحجز</div>
            <div className="font-mono font-bold text-lg text-slate-900">{r.externalId}</div>
          </div>
          <div className="text-left">
            <div className="text-xs text-slate-500">المصدر</div>
            <div className="font-bold text-slate-900">{r.source}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="الفندق" value={r.hotel?.nameEn || r.hotel?.name || '—'} />
          <Field label="الضيف" value={r.guestName || '—'} />
          <Field label="Check-in" value={r.checkIn ? new Date(r.checkIn).toLocaleDateString('ar-EG') : '—'} />
          <Field label="Check-out" value={r.checkOut ? new Date(r.checkOut).toLocaleDateString('ar-EG') : '—'} />
          <Field label="الليالي" value={r.nights?.toString() || '—'} />
          <Field label="نوع الغرفة" value={r.roomType || '—'} />
          <Field label="السعر" value={r.totalPrice ? `${r.totalPrice} ${r.currency || ''}` : '—'} />
          <Field label="الحالة" value={r.currentStatus} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-bold mb-4">الأحداث ({r.events?.length || 0})</h3>
        <div className="space-y-3">
          {r.events?.map((e) => {
            const meta = EVENT_LABELS[e.eventType] || { label: e.eventType, color: 'bg-slate-100' };
            return (
              <div key={e.id} className={`border ${meta.color} rounded p-3`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold">{meta.label}</span>
                  <span className="text-xs">{new Date(e.occurredAt).toLocaleString('ar-EG')}</span>
                </div>
                {e.email && (
                  <div className="text-xs mt-2 opacity-80">
                    <div>من: {e.email.fromAddr}</div>
                    <div>الموضوع: {e.email.subject}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}
