import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchReservations, fetchHotels, Reservation, Hotel } from '../api';

const SOURCES = ['Booking.com', 'Expedia', 'Agoda', 'Manual'];
const STATUSES = [
  { value: 'confirmed', label: 'مؤكدة' },
  { value: 'modified', label: 'معدلة' },
  { value: 'cancelled', label: 'ملغاة' },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    modified: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-rose-100 text-rose-700',
  };
  const labels: Record<string, string> = {
    confirmed: 'مؤكد',
    modified: 'معدل',
    cancelled: 'ملغى',
  };
  return <span className={`px-2 py-0.5 text-xs rounded ${styles[status] || 'bg-slate-100'}`}>{labels[status] || status}</span>;
}

export default function Reservations() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [items, setItems] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchHotels().then(setHotels); }, []);

  useEffect(() => {
    setLoading(true);
    fetchReservations({ ...filters, pageSize: 100 })
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const update = (k: string, v: string) => setFilters({ ...filters, [k]: v });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">الحجوزات</h1>
        <p className="text-sm text-slate-500 mt-1">إجمالي: {total.toLocaleString('ar-EG')} حجز</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-3">
        <select value={filters.hotelId || ''} onChange={(e) => update('hotelId', e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm">
          <option value="">كل الفنادق</option>
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.nameEn || h.name}</option>)}
        </select>
        <select value={filters.source || ''} onChange={(e) => update('source', e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm">
          <option value="">كل المصادر</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.status || ''} onChange={(e) => update('status', e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm">
          <option value="">كل الحالات</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setFilters({})} className="text-sm text-slate-600 hover:text-slate-900 px-2">إعادة تعيين</button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-right p-3 font-semibold">رقم الحجز</th>
              <th className="text-right p-3 font-semibold">المصدر</th>
              <th className="text-right p-3 font-semibold">الفندق</th>
              <th className="text-right p-3 font-semibold">الضيف</th>
              <th className="text-right p-3 font-semibold">Check-in</th>
              <th className="text-right p-3 font-semibold">الليالي</th>
              <th className="text-right p-3 font-semibold">السعر</th>
              <th className="text-right p-3 font-semibold">الحالة</th>
              <th className="text-right p-3 font-semibold">الأحداث</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-6 text-center text-slate-500">جاري التحميل...</td></tr>}
            {!loading && items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3"><Link to={`/reservations/${r.id}`} className="text-blue-600 hover:underline font-mono text-xs">{r.externalId.slice(0, 16)}{r.externalId.length > 16 ? '…' : ''}</Link></td>
                <td className="p-3">{r.source}</td>
                <td className="p-3">{r.hotel?.nameEn || r.hotel?.name}</td>
                <td className="p-3">{r.guestName || '—'}</td>
                <td className="p-3 text-slate-500">{r.checkIn ? new Date(r.checkIn).toLocaleDateString('ar-EG') : '—'}</td>
                <td className="p-3 tabular-nums">{r.nights || '—'}</td>
                <td className="p-3 tabular-nums">{r.totalPrice ? `${r.totalPrice} ${r.currency || ''}` : '—'}</td>
                <td className="p-3"><StatusBadge status={r.currentStatus} /></td>
                <td className="p-3 tabular-nums text-slate-600">{r._count?.events || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
