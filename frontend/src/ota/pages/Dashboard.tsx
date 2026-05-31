import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  fetchSummary, fetchByHotel, fetchTimeline, fetchBySource,
  Summary, HotelRow, TimelinePoint, SourceRow,
} from '../api';
import KpiCard from '../components/KpiCard';
import DateRangePicker from '../components/DateRangePicker';
import HotelPlatformDayTable from '../components/HotelPlatformDayTable';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [to, setTo] = useState(new Date());

  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSummary(from, to),
      fetchByHotel(from, to),
      fetchTimeline(from, to, 'day'),
      fetchBySource(from, to),
    ])
      .then(([s, h, t, src]) => {
        setSummary(s);
        setHotels(h.hotels);
        setTimeline(t.series);
        setSources(src.sources);
      })
      .finally(() => setLoading(false));
  }, [from.getTime(), to.getTime()]);

  const sourcePie = useMemo(
    () => sources.map((s) => ({ name: s.source, value: s.new })),
    [sources]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">لوحة تحليلات الحجوزات</h1>
          <p className="text-sm text-slate-500 mt-1">عرض شامل لكل فندق وكل OTA</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {loading && <div className="text-slate-500 text-sm">جاري التحميل...</div>}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="حجوزات جديدة" value={summary.totals.new} tone="positive" />
          <KpiCard label="إلغاءات" value={summary.totals.cancellation} tone="negative" />
          <KpiCard label="تعديلات" value={summary.totals.modification} tone="warning" />
          <KpiCard label="صافي الحجوزات" value={summary.totals.net} tone="neutral" hint="جديدة - إلغاءات" />
          <KpiCard label="نسبة الإلغاء" value={`${summary.totals.cancellationRate}%`} tone="warning" />
        </div>
      )}

      <HotelPlatformDayTable from={from} to={to} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="تطور الحجوزات بالوقت" subtitle="حسب اليوم" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }} />
              <Legend wrapperStyle={{ fontFamily: 'Cairo' }} />
              <Line type="monotone" dataKey="new" stroke="#10b981" strokeWidth={2} name="جديدة" />
              <Line type="monotone" dataKey="cancellation" stroke="#ef4444" strokeWidth={2} name="إلغاءات" />
              <Line type="monotone" dataKey="modification" stroke="#f59e0b" strokeWidth={2} name="تعديلات" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="توزيع المصادر (OTAs)" subtitle="حجوزات جديدة">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={sourcePie} dataKey="value" nameKey="name" outerRadius={90} label>
                {sourcePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }} />
              <Legend wrapperStyle={{ fontFamily: 'Cairo' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="مقارنة الفنادق" subtitle="حجوزات جديدة vs إلغاءات vs تعديلات">
        <ResponsiveContainer width="100%" height={Math.max(300, hotels.length * 36)}>
          <BarChart data={hotels} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" fontSize={11} />
            <YAxis type="category" dataKey="hotelNameEn" stroke="#64748b" fontSize={11} width={180} />
            <Tooltip contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }} />
            <Legend wrapperStyle={{ fontFamily: 'Cairo' }} />
            <Bar dataKey="new" fill="#10b981" name="جديدة" />
            <Bar dataKey="cancellation" fill="#ef4444" name="إلغاءات" />
            <Bar dataKey="modification" fill="#f59e0b" name="تعديلات" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="جدول الفنادق" subtitle="ترتيب حسب عدد الحجوزات الجديدة">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-right p-3 font-semibold">الفندق</th>
                <th className="text-right p-3 font-semibold">المدينة</th>
                <th className="text-right p-3 font-semibold">جديدة</th>
                <th className="text-right p-3 font-semibold">إلغاءات</th>
                <th className="text-right p-3 font-semibold">تعديلات</th>
                <th className="text-right p-3 font-semibold">الصافي</th>
                <th className="text-right p-3 font-semibold">نسبة الإلغاء</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((h) => (
                <tr key={h.hotelId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-medium">{h.hotelNameEn || h.hotelName}</td>
                  <td className="p-3 text-slate-500">{h.city || '—'}</td>
                  <td className="p-3 font-bold text-emerald-600 tabular-nums">{h.new}</td>
                  <td className="p-3 font-bold text-rose-600 tabular-nums">{h.cancellation}</td>
                  <td className="p-3 font-bold text-amber-600 tabular-nums">{h.modification}</td>
                  <td className="p-3 font-bold text-slate-700 tabular-nums">{h.net}</td>
                  <td className="p-3 tabular-nums">{h.cancellationRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-5 ${className}`}>
      <div className="mb-3">
        <h3 className="font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
