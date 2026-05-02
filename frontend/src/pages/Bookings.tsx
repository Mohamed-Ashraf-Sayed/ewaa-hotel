import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, Pencil, XCircle, CheckCircle, LogIn, LogOut, Calendar, Building2, BedDouble } from 'lucide-react';
import { bookingsApi, hotelsApi } from '../services/api';
import { Booking, Hotel, BookingStatus } from '../types';
import BookingFormModal from '../components/BookingFormModal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

type Tab = 'all' | 'upcoming' | 'today' | 'in_house' | 'cancelled';

export default function Bookings() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;

  const canManage = hasRole('reservations', 'admin', 'general_manager', 'vice_gm');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [hotelFilter, setHotelFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, hRes] = await Promise.all([
        bookingsApi.getAll({
          search: search || undefined,
          hotelId: hotelFilter ? parseInt(hotelFilter) : undefined,
        }),
        hotelsApi.getAll(),
      ]);
      setBookings(bRes.data);
      setHotels(hRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, hotelFilter]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const counts = useMemo(() => {
    const all = bookings.length;
    const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.arrivalDate) >= tomorrow).length;
    const todayCount = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'checked_out' && new Date(b.arrivalDate).toDateString() === today.toDateString()).length;
    const inHouse = bookings.filter(b => b.status === 'checked_in').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    return { all, upcoming, today: todayCount, in_house: inHouse, cancelled };
  }, [bookings]);

  const visible = useMemo(() => {
    let list = bookings;
    if (tab === 'upcoming') list = list.filter(b => b.status === 'confirmed' && new Date(b.arrivalDate) >= tomorrow);
    else if (tab === 'today') list = list.filter(b => b.status !== 'cancelled' && b.status !== 'checked_out' && new Date(b.arrivalDate).toDateString() === today.toDateString());
    else if (tab === 'in_house') list = list.filter(b => b.status === 'checked_in');
    else if (tab === 'cancelled') list = list.filter(b => b.status === 'cancelled');
    return list;
  }, [bookings, tab]);

  const StatusBadge = ({ status }: { status: BookingStatus }) => {
    const map: Record<BookingStatus, { ar: string; en: string; cls: string }> = {
      confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      checked_in: { ar: 'داخل الفندق', en: 'Checked-in', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      checked_out: { ar: 'خرج', en: 'Checked-out', cls: 'bg-brand-100 text-brand-600 border-brand-200' },
      cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
      no_show: { ar: 'لم يحضر', en: 'No-show', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    };
    const m = map[status];
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${m.cls}`}>{isAr ? m.ar : m.en}</span>;
  };

  const TabBtn = ({ id, label, count }: { id: Tab; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        tab === id ? 'border-brand-500 text-brand-700' : 'border-transparent text-brand-400 hover:text-brand-600'
      }`}
    >
      {label} {count > 0 && <span className="ms-1.5 inline-flex items-center justify-center text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">{count}</span>}
    </button>
  );

  const updateStatus = async (b: Booking, status: BookingStatus) => {
    let reason: string | undefined;
    if (status === 'cancelled') {
      const r = prompt(isAr ? 'سبب الإلغاء (اختياري):' : 'Cancellation reason (optional):') ?? null;
      if (r === null) return;
      reason = r || undefined;
    }
    setBusy(b.id);
    try {
      await bookingsApi.updateStatus(b.id, status, reason);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'فشل التحديث' : 'Failed'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'الحجوزات' : 'Bookings'}</h1>
          <p className="text-sm text-brand-500 mt-1">{isAr ? 'متابعة حجوزات اوبرا للعملاء' : 'Track Opera reservations for clients'}</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> {isAr ? 'حجز جديد' : 'New Booking'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className={`flex flex-wrap gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-[240px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3' : 'left-3'} w-4 h-4 text-brand-400`} />
          <input
            type="text"
            className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
            placeholder={isAr ? 'بحث برقم اوبرا، اسم الضيف، الشركة' : 'Search Opera no, guest name, company'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={hotelFilter} onChange={e => setHotelFilter(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="">{isAr ? 'كل الفنادق' : 'All hotels'}</option>
          {hotels.filter(h => h.isActive).map(h => (
            <option key={h.id} value={h.id}>{isAr ? h.name : (h.nameEn || h.name)}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-200 flex gap-2 overflow-x-auto">
        <TabBtn id="all" label={isAr ? 'الكل' : 'All'} count={counts.all} />
        <TabBtn id="upcoming" label={isAr ? 'القادمة' : 'Upcoming'} count={counts.upcoming} />
        <TabBtn id="today" label={isAr ? 'وصول اليوم' : 'Arriving Today'} count={counts.today} />
        <TabBtn id="in_house" label={isAr ? 'داخل الفندق' : 'In-house'} count={counts.in_house} />
        <TabBtn id="cancelled" label={isAr ? 'ملغية' : 'Cancelled'} count={counts.cancelled} />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="card p-10 text-center text-brand-400">
          <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{isAr ? 'لا توجد حجوزات' : 'No bookings'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(b => (
            <div key={b.id} className="card p-4 hover:shadow-elevated transition-shadow">
              <div className={`flex flex-wrap items-start justify-between gap-3 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
                <div className="flex-1 min-w-[280px]">
                  <div className={`flex items-center gap-2 mb-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                    <StatusBadge status={b.status} />
                    <span className="text-xs text-brand-400 font-mono">#{b.operaConfirmationNo}</span>
                    {b.contract?.contractRef && (
                      <Link to={`/contracts`} className="text-[11px] text-brand-500 underline">{b.contract.contractRef}</Link>
                    )}
                  </div>
                  <div className="font-semibold text-brand-900">{b.guestName}</div>
                  <div className="text-sm text-brand-500 mt-0.5">
                    <Link to={`/clients/${b.clientId}`} className="hover:text-brand-700">{b.client?.companyName}</Link>
                    {b.assignedRep && (
                      <span className="text-brand-400"> · {isAr ? 'المندوب:' : 'Rep:'} {b.assignedRep.name}</span>
                    )}
                  </div>
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm ${isAr ? 'text-right' : ''}`}>
                    <div>
                      <div className="text-[11px] text-brand-400">{isAr ? 'الفندق' : 'Hotel'}</div>
                      <div className="text-brand-700 flex items-center gap-1"><Building2 className="w-3 h-3" /> {b.hotel?.name}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-brand-400">{isAr ? 'الوصول' : 'Arrival'}</div>
                      <div className="text-brand-700 flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(parseISO(b.arrivalDate), 'dd MMM yyyy', { locale })}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-brand-400">{isAr ? 'المغادرة' : 'Departure'}</div>
                      <div className="text-brand-700">{format(parseISO(b.departureDate), 'dd MMM yyyy', { locale })} · <span className="text-brand-400">{b.nights} {isAr ? 'ليلة' : 'nts'}</span></div>
                    </div>
                    <div>
                      <div className="text-[11px] text-brand-400">{isAr ? 'الغرف' : 'Rooms'}</div>
                      <div className="text-brand-700">{b.roomsCount} × {b.roomType || '-'}</div>
                    </div>
                  </div>
                  {(b.totalAmount || b.ratePerNight) && (
                    <div className={`mt-2 text-sm ${isAr ? 'text-right' : ''}`}>
                      {b.totalAmount && <span className="font-medium text-brand-700">{b.totalAmount.toLocaleString()} {b.currency}</span>}
                      {b.ratePackage && <span className="text-brand-500 text-xs"> · {b.ratePackage}</span>}
                      {b.paymentMethod && <span className="text-brand-500 text-xs"> · {b.paymentMethod}</span>}
                    </div>
                  )}
                  {b.status === 'cancelled' && b.cancellationReason && (
                    <p className="text-xs text-red-600 mt-2">{isAr ? 'سبب الإلغاء:' : 'Reason:'} {b.cancellationReason}</p>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className={`flex items-center gap-1.5 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                    {b.confirmationLetterUrl && (
                      <a href={b.confirmationLetterUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1.5" title={isAr ? 'الخطاب' : 'Letter'}>
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {b.status === 'confirmed' && (
                      <button className="btn-secondary text-xs py-1.5" disabled={busy === b.id} onClick={() => updateStatus(b, 'checked_in')} title={isAr ? 'تسجيل وصول' : 'Check-in'}>
                        <LogIn className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {b.status === 'checked_in' && (
                      <button className="btn-secondary text-xs py-1.5" disabled={busy === b.id} onClick={() => updateStatus(b, 'checked_out')} title={isAr ? 'تسجيل مغادرة' : 'Check-out'}>
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {b.status !== 'cancelled' && b.status !== 'checked_out' && (
                      <>
                        <button className="btn-secondary text-xs py-1.5" onClick={() => { setEditing(b); setShowForm(true); }} title={isAr ? 'تعديل' : 'Edit'}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-secondary text-xs py-1.5 text-red-600 hover:bg-red-50" disabled={busy === b.id} onClick={() => updateStatus(b, 'cancelled')} title={isAr ? 'إلغاء' : 'Cancel'}>
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <BookingFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={() => load()}
        editing={editing}
      />
    </div>
  );
}
