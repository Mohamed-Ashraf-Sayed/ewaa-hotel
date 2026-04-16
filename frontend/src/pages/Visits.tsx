import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { visitsApi } from '../services/api';
import { Visit } from '../types';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { arSA } from 'date-fns/locale';

const VISIT_TYPES: Record<string, string> = {
  in_person: 'زيارة شخصية', phone: 'هاتف', online: 'أونلاين', site_visit: 'زيارة الموقع'
};
const visitEmoji: Record<string, string> = {
  in_person: '🤝', phone: '📞', online: '💻', site_visit: '🏨'
};

export default function Visits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [followUps, setFollowUps] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      visitsApi.getAll(),
      visitsApi.getFollowUps(14)
    ]).then(([v, f]) => {
      setVisits(v.data);
      setFollowUps(f.data);
    }).finally(() => setLoading(false));
  }, []);

  const getFollowUpLabel = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return { label: 'اليوم', color: 'text-red-600 bg-red-50' };
    if (isTomorrow(d)) return { label: 'غداً', color: 'text-orange-600 bg-orange-50' };
    return { label: format(d, 'dd MMM', { locale: arSA }), color: 'text-brand-600 bg-brand-50' };
  };

  return (
    <div className="space-y-5">
      <div className="text-right">
        <h1 className="text-2xl font-bold text-brand-900">الزيارات</h1>
        <p className="text-brand-400 text-sm mt-0.5">إجمالي الزيارات: {visits.length}</p>
      </div>

      {/* Upcoming Follow-ups Banner */}
      {followUps.length > 0 && (
        <div className="card p-4 border-r-4 border-brand-500">
          <div className="flex items-center justify-end gap-2 mb-3">
            <h2 className="font-bold text-brand-900">المتابعات القادمة ({followUps.length})</h2>
            <Clock className="w-5 h-5 text-brand-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUps.map(v => {
              const fl = v.nextFollowUp ? getFollowUpLabel(v.nextFollowUp) : null;
              return (
                <Link key={v.id} to={`/clients/${v.client?.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-brand-50/50 hover:bg-brand-50 transition-colors flex-row-reverse">
                  <div className="text-right">
                    <p className="font-medium text-sm text-brand-900">{v.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{v.client?.contactPerson}</p>
                  </div>
                  {fl && <span className={`text-xs font-bold px-2 py-1 rounded-full ${fl.color}`}>{fl.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Visit List */}
      <div className="space-y-3">
        {loading ? (
          <div className="card py-12 text-center text-brand-400">جاري التحميل...</div>
        ) : visits.length === 0 ? (
          <div className="card py-12 text-center text-brand-400">لا توجد زيارات مسجلة</div>
        ) : visits.map(v => (
          <div key={v.id} className="card p-4 hover:border-brand-200 transition-colors">
            <div className="flex items-start justify-between gap-4 flex-row-reverse">
              <div className="flex items-start gap-3 flex-1 min-w-0 flex-row-reverse">
                <div className="text-2xl mt-0.5">{visitEmoji[v.visitType || 'in_person'] || '🗺️'}</div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-2 flex-wrap flex-row-reverse">
                    <Link to={`/clients/${v.client?.id}`} className="font-bold text-brand-900 hover:text-brand-600">
                      {v.client?.companyName}
                    </Link>
                    <span className="text-xs bg-gray-100 text-brand-500 px-2 py-0.5 rounded-full">
                      {VISIT_TYPES[v.visitType || ''] || v.visitType}
                    </span>
                  </div>
                  {v.purpose && <p className="text-sm text-brand-700 mt-1">{v.purpose}</p>}
                  {v.outcome && (
                    <p className="text-sm text-brand-400 mt-1">
                      <span className="font-medium text-brand-700">النتيجة: </span>{v.outcome}
                    </p>
                  )}
                  {v.notes && <p className="text-xs text-brand-400 mt-1">{v.notes}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-brand-400 flex-row-reverse">
                    <span>👤 {v.salesRep?.name}</span>
                    <span>📅 {v.visitDate ? format(parseISO(v.visitDate), 'dd MMM yyyy', { locale: arSA }) : '—'}</span>
                  </div>
                </div>
              </div>
              {v.nextFollowUp && (
                <div className="flex-shrink-0 text-left">
                  <p className="text-xs text-brand-400 mb-1">متابعة</p>
                  {(() => {
                    const fl = getFollowUpLabel(v.nextFollowUp);
                    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${fl.color}`}>{fl.label}</span>;
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
