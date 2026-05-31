import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { fetchHotelPlatformDay, HotelPlatformDayRow } from '../api';

interface Props {
  from: Date;
  to: Date;
}

const PLATFORM_COLORS: Record<string, string> = {
  'Booking.com': 'bg-blue-50 text-blue-700 border-blue-200',
  'Agoda': 'bg-rose-50 text-rose-700 border-rose-200',
  'Expedia': 'bg-amber-50 text-amber-700 border-amber-200',
  'Almosafer': 'bg-purple-50 text-purple-700 border-purple-200',
  'Manual': 'bg-slate-50 text-slate-700 border-slate-200',
};

function PlatformBadge({ source }: { source: string }) {
  const cls = PLATFORM_COLORS[source] || 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`px-2 py-0.5 text-xs rounded border ${cls}`}>{source}</span>;
}

export default function HotelPlatformDayTable({ from, to }: Props) {
  const [rows, setRows] = useState<HotelPlatformDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(5);
  const [hotelFilter, setHotelFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [onlyOverThreshold, setOnlyOverThreshold] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchHotelPlatformDay(from, to)
      .then((d) => setRows(d.rows))
      .finally(() => setLoading(false));
  }, [from.getTime(), to.getTime()]);

  const platforms = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source))).sort(),
    [rows]
  );
  const hotels = useMemo(
    () => Array.from(new Set(rows.map((r) => r.hotelNameEn || r.hotelName || ''))).filter(Boolean).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (hotelFilter && (r.hotelNameEn || r.hotelName) !== hotelFilter) return false;
      if (platformFilter && r.source !== platformFilter) return false;
      if (onlyOverThreshold && r.newCount < threshold) return false;
      return true;
    });
  }, [rows, hotelFilter, platformFilter, onlyOverThreshold, threshold]);

  const totals = useMemo(() => ({
    rows: filtered.length,
    new: filtered.reduce((s, r) => s + r.newCount, 0),
    cancel: filtered.reduce((s, r) => s + r.cancelCount, 0),
    mod: filtered.reduce((s, r) => s + r.modCount, 0),
    overThreshold: filtered.filter((r) => r.newCount >= threshold).length,
  }), [filtered, threshold]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-900">تفاصيل يومية لكل فندق ومنصة</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              عرض كل حجز/إلغاء/تعديل لكل فندق على كل منصة في كل يوم — للمتابعة قبل ما تقفل منصة
            </p>
          </div>
          <div className="text-xs text-slate-500">
            {totals.rows.toLocaleString('ar-EG')} صف · {totals.new} جديد · {totals.cancel} إلغاء · {totals.mod} تعديل
            {totals.overThreshold > 0 && (
              <span className="text-rose-600 font-bold mr-2">
                · {totals.overThreshold} عدّت الحد ⚠️
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 items-end">
          <div>
            <div className="text-xs text-slate-600 mb-1">الفندق</div>
            <select value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm min-w-[200px]">
              <option value="">كل الفنادق</option>
              {hotels.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">المنصة</div>
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm">
              <option value="">كل المنصات</option>
              {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">حد التنبيه (حجوزات/يوم)</div>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 0)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm w-24 font-mono"
              dir="ltr"
              min={1}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1.5 cursor-pointer">
            <input type="checkbox" checked={onlyOverThreshold} onChange={(e) => setOnlyOverThreshold(e.target.checked)} className="w-4 h-4" />
            عرض الصفوف اللي عدّت الحد فقط
          </label>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="text-right p-3 font-semibold">التاريخ</th>
              <th className="text-right p-3 font-semibold">الفندق</th>
              <th className="text-right p-3 font-semibold">المنصة</th>
              <th className="text-right p-3 font-semibold">جديدة</th>
              <th className="text-right p-3 font-semibold">إلغاءات</th>
              <th className="text-right p-3 font-semibold">تعديلات</th>
              <th className="text-right p-3 font-semibold">الصافي</th>
              <th className="text-right p-3 font-semibold">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">جاري التحميل...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">
                لا توجد بيانات في الفترة المحددة. اضغط "اجلب الإيميلات الآن" في الإعدادات لتحميل الحجوزات.
              </td></tr>
            )}
            {!loading && filtered.map((r, i) => {
              const overThreshold = r.newCount >= threshold;
              return (
                <tr key={i} className={`border-t border-slate-100 ${overThreshold ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50'}`}>
                  <td className="p-3 font-mono text-xs whitespace-nowrap" dir="ltr">{r.day}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.hotelNameEn || r.hotelName || '— غير مطابق —'}</div>
                    {r.city && <div className="text-xs text-slate-500">{r.city}</div>}
                  </td>
                  <td className="p-3"><PlatformBadge source={r.source} /></td>
                  <td className={`p-3 font-bold tabular-nums ${overThreshold ? 'text-rose-700' : 'text-emerald-600'}`}>
                    {r.newCount}
                    {overThreshold && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                  </td>
                  <td className="p-3 font-bold text-rose-600 tabular-nums">{r.cancelCount}</td>
                  <td className="p-3 font-bold text-amber-600 tabular-nums">{r.modCount}</td>
                  <td className="p-3 font-bold text-slate-700 tabular-nums">{r.net}</td>
                  <td className="p-3">
                    {r.source === 'Booking.com' && r.bookingComId && (
                      <a
                        href={`https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/availability.html?hotel_id=${r.bookingComId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> اقفل في Extranet
                      </a>
                    )}
                    {r.source === 'Agoda' && r.agodaId && (
                      <a
                        href={`https://ycs.agoda.com/en-us/${r.agodaId}/kipp/property/${r.agodaId}/calendar`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-rose-600 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> اقفل في YCS
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
