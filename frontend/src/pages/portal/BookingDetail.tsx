import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, BedDouble, Users, CreditCard, Hourglass, CheckCircle, XCircle, LogIn, LogOut, FileText } from 'lucide-react';
import { portalDataApi } from '../../services/portalApi';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';

const statusMap: Record<string, { label: string; cls: string; Icon: any; description: string }> = {
  pending_reservations: {
    label: 'قيد المراجعة',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: Hourglass,
    description: 'طلبك تحت المراجعة من قسم الحجوزات. هيتم التواصل معاك بعد التأكد من توفر الغرف.',
  },
  confirmed: {
    label: 'مؤكد',
    cls: 'bg-blue-50 text-blue-800 border-blue-200',
    Icon: CheckCircle,
    description: 'الحجز اتأكد. الفندق في انتظار وصول الضيف.',
  },
  checked_in: {
    label: 'داخل الفندق',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: LogIn,
    description: 'الضيف داخل الفندق حاليًا.',
  },
  checked_out: {
    label: 'مكتمل',
    cls: 'bg-brand-100 text-brand-700 border-brand-200',
    Icon: LogOut,
    description: 'تم إكمال إقامة الضيف.',
  },
  cancelled: {
    label: 'ملغي',
    cls: 'bg-red-50 text-red-800 border-red-200',
    Icon: XCircle,
    description: 'تم إلغاء هذا الحجز.',
  },
  no_show: {
    label: 'لم يحضر',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: XCircle,
    description: 'الضيف لم يحضر في تاريخ الوصول.',
  },
};

export default function PortalBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    portalDataApi.booking(parseInt(id))
      .then(r => setBooking(r.data))
      .catch(() => navigate('/portal'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!booking) return null;

  const s = statusMap[booking.status] || statusMap.confirmed;

  const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: any }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-brand-100 last:border-0">
      <div className="text-sm text-brand-500 flex items-center gap-1.5 flex-row-reverse">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-sm font-medium text-brand-900">{value || '—'}</div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl mx-auto" dir="rtl">
      <Link to="/portal" className="text-sm text-brand-500 hover:text-brand-700 inline-flex items-center gap-1 flex-row-reverse">
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للحجوزات
      </Link>

      {/* Status banner */}
      <div className={`rounded-2xl border p-5 ${s.cls}`}>
        <div className="flex items-center gap-3 flex-row-reverse">
          <s.Icon className="w-6 h-6" />
          <div className="text-right">
            <div className="font-bold text-lg">{s.label}</div>
            <div className="text-sm opacity-80 mt-0.5">{s.description}</div>
          </div>
        </div>
        {booking.status === 'cancelled' && booking.cancellationReason && (
          <div className="mt-3 text-sm bg-white/60 rounded-lg px-3 py-2 text-right">
            <span className="font-semibold">سبب الإلغاء: </span>{booking.cancellationReason}
          </div>
        )}
      </div>

      {/* Guests list (when there are multiple) */}
      {Array.isArray(booking.guests) && booking.guests.length > 0 && (
        <div className="card p-5">
          <h3 className="text-base font-bold text-brand-900 mb-3 text-right flex items-center gap-2 flex-row-reverse">
            <Users className="w-4 h-4" /> الضيوف ({booking.guests.length})
          </h3>
          <div className="space-y-2">
            {booking.guests.map((g: any, i: number) => (
              <div key={g.id || i} className="flex items-center justify-between p-2.5 rounded-lg bg-brand-50/50 border border-brand-100 flex-row-reverse">
                <div className="flex items-center gap-2 flex-row-reverse">
                  <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${g.isPrimary ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-600'}`}>
                    {g.isPrimary ? '★' : i + 1}
                  </span>
                  <span className="text-sm font-medium text-brand-900">{g.name}</span>
                </div>
                {g.nationality && <span className="text-xs text-brand-500">{g.nationality}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="card p-5">
        <h3 className="text-base font-bold text-brand-900 mb-3 text-right">تفاصيل الحجز</h3>
        <Row icon={Building2} label="الفندق" value={booking.hotel?.name} />
        {(!Array.isArray(booking.guests) || booking.guests.length === 0) && (
          <Row icon={Users} label="اسم الضيف" value={booking.guestName} />
        )}
        <Row icon={Calendar} label="الوصول" value={format(parseISO(booking.arrivalDate), 'dd MMM yyyy', { locale: arSA })} />
        <Row icon={Calendar} label="المغادرة" value={format(parseISO(booking.departureDate), 'dd MMM yyyy', { locale: arSA })} />
        <Row icon={BedDouble} label="الليالي / الغرف" value={`${booking.nights} ليلة × ${booking.roomsCount} غرفة`} />
        <Row icon={Users} label="الكبار / الأطفال" value={`${booking.adultsCount} كبار / ${booking.childrenCount} أطفال`} />
        {booking.roomType && <Row icon={BedDouble} label="نوع الغرفة" value={booking.roomType} />}
        {booking.ratePackage && <Row icon={BedDouble} label="الباقة / الوجبات" value={
          booking.ratePackage === 'Bed and Breakfast' ? 'إفطار' :
          booking.ratePackage === 'Half Board' ? 'نصف إقامة' :
          booking.ratePackage === 'Full Board' ? 'إقامة كاملة' :
          booking.ratePackage === 'All Inclusive' ? 'شامل' :
          booking.ratePackage === 'Room Only' ? 'غرفة فقط' :
          booking.ratePackage
        } />}
        {booking.paymentMethod && <Row icon={CreditCard} label="طريقة الدفع" value={
          booking.paymentMethod === 'City Ledger' ? 'على حساب الشركة' :
          booking.paymentMethod === 'Cash' ? 'كاش' : booking.paymentMethod
        } />}
        {booking.operaConfirmationNo && <Row icon={FileText} label="رقم اوبرا" value={booking.operaConfirmationNo} />}
      </div>

      {/* Pricing */}
      {booking.totalAmount != null && (
        <div className="card p-5">
          <div className="flex items-center justify-between text-right flex-row-reverse">
            <div>
              <div className="text-xs text-brand-500">المبلغ الإجمالي</div>
              <div className="text-2xl font-bold text-brand-900 mt-0.5">{booking.totalAmount.toLocaleString()} {booking.currency}</div>
            </div>
            {booking.ratePerNight && (
              <div className="text-xs text-brand-400 text-left">
                {booking.ratePerNight.toLocaleString()} {booking.currency} / ليلة
              </div>
            )}
          </div>
        </div>
      )}

      {booking.notes && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-brand-900 mb-2 text-right">ملاحظات</h3>
          <p className="text-sm text-brand-700 text-right">{booking.notes}</p>
        </div>
      )}
    </div>
  );
}
