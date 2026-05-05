import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Building2, Plus, Hourglass, CheckCircle, XCircle, LogIn, LogOut, BedDouble } from 'lucide-react';
import { portalDataApi } from '../../services/portalApi';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface PortalBooking {
  id: number;
  hotelId: number;
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  roomsCount: number;
  status: string;
  operaConfirmationNo?: string | null;
  totalAmount?: number | null;
  currency: string;
  cancellationReason?: string | null;
  createdAt: string;
  hotel?: { id: number; name: string; nameEn?: string };
}

const statusMap: Record<string, { label: string; cls: string; Icon: any }> = {
  pending_reservations: { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Hourglass },
  confirmed: { label: 'مؤكد', cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: CheckCircle },
  checked_in: { label: 'داخل الفندق', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: LogIn },
  checked_out: { label: 'مكتمل', cls: 'bg-brand-100 text-brand-700 border-brand-200', Icon: LogOut },
  cancelled: { label: 'ملغي', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
  no_show: { label: 'لم يحضر', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: XCircle },
};

export default function PortalMyBookings() {
  const [bookings, setBookings] = useState<PortalBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalDataApi.bookings()
      .then(r => setBookings(r.data))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    pending: bookings.filter(b => b.status === 'pending_reservations').length,
    upcoming: bookings.filter(b => b.status === 'confirmed' && new Date(b.arrivalDate) >= new Date()).length,
    inHouse: bookings.filter(b => b.status === 'checked_in').length,
    total: bookings.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'قيد المراجعة', value: counts.pending, color: 'bg-amber-50 text-amber-700' },
          { label: 'قادمة', value: counts.upcoming, color: 'bg-blue-50 text-blue-700' },
          { label: 'داخل الفندق', value: counts.inHouse, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'إجمالي', value: counts.total, color: 'bg-brand-50 text-brand-700' },
        ].map(s => (
          <div key={s.label} className={`card p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-brand-900">حجوزاتي</h2>
        <Link to="/portal/book" className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> طلب حجز جديد
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="card p-12 text-center text-brand-400">
          <BedDouble className="w-14 h-14 mx-auto mb-3 opacity-40" />
          <p className="mb-3">مفيش حجوزات لسه</p>
          <Link to="/portal/book" className="btn-primary text-sm inline-flex">
            <Plus className="w-4 h-4" /> اطلب أول حجز
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const s = statusMap[b.status] || statusMap.confirmed;
            return (
              <Link
                key={b.id}
                to={`/portal/booking/${b.id}`}
                className="card p-4 block hover:shadow-elevated transition-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-[260px] text-right">
                    <div className="flex items-center gap-2 flex-wrap mb-2 flex-row-reverse">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${s.cls}`}>
                        <s.Icon className="w-3 h-3" />
                        {s.label}
                      </span>
                      {b.operaConfirmationNo && (
                        <span className="text-xs text-brand-400 font-mono">#{b.operaConfirmationNo}</span>
                      )}
                    </div>
                    <div className="font-semibold text-brand-900">{b.guestName}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
                      <div>
                        <div className="text-[11px] text-brand-400">الفندق</div>
                        <div className="text-brand-700 flex items-center gap-1 flex-row-reverse"><Building2 className="w-3 h-3" /> {b.hotel?.name}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-brand-400">الوصول</div>
                        <div className="text-brand-700 flex items-center gap-1 flex-row-reverse"><Calendar className="w-3 h-3" /> {format(parseISO(b.arrivalDate), 'dd MMM yyyy', { locale: arSA })}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-brand-400">الليالي</div>
                        <div className="text-brand-700">{b.nights}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-brand-400">الغرف</div>
                        <div className="text-brand-700">{b.roomsCount}</div>
                      </div>
                    </div>
                    {b.totalAmount && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-brand-700">{b.totalAmount.toLocaleString()} {b.currency}</span>
                      </div>
                    )}
                    {b.status === 'cancelled' && b.cancellationReason && (
                      <p className="text-xs text-red-600 mt-2">سبب الإلغاء: {b.cancellationReason}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
