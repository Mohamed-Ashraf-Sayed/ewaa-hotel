import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { visitsApi } from '../services/api';
import { Visit } from '../types';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

const VISIT_TYPES_AR: Record<string, string> = {
  in_person: 'زيارة شخصية', phone: 'هاتف', online: 'أونلاين', site_visit: 'زيارة الموقع'
};
const VISIT_TYPES_EN: Record<string, string> = {
  in_person: 'In Person', phone: 'Phone', online: 'Online', site_visit: 'Site Visit'
};
const visitEmoji: Record<string, string> = {
  in_person: '🤝', phone: '📞', online: '💻', site_visit: '🏨'
};

export default function Visits() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const VISIT_TYPES = isAr ? VISIT_TYPES_AR : VISIT_TYPES_EN;

  const [visits, setVisits] = useState<Visit[]>([]);
  const [followUps, setFollowUps] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([visitsApi.getAll(), visitsApi.getFollowUps(14)])
      .then(([v, f]) => { setVisits(v.data); setFollowUps(f.data); })
      .finally(() => setLoading(false));
  }, []);

  const getFollowUpLabel = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return { label: isAr ? 'اليوم' : 'Today', color: 'text-red-600 bg-red-50' };
    if (isTomorrow(d)) return { label: isAr ? 'غداً' : 'Tomorrow', color: 'text-orange-600 bg-orange-50' };
    return { label: format(d, 'dd MMM', { locale }), color: 'text-brand-600 bg-brand-50' };
  };

  return (
    <div className="space-y-5">
      <div className={isAr ? 'text-right' : 'text-left'}>
        <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'الزيارات' : 'Visits'}</h1>
        <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'إجمالي الزيارات: ' : 'Total visits: '}{visits.length}</p>
      </div>

      {followUps.length > 0 && (
        <div className={`card p-4 ${isAr ? 'border-r-4' : 'border-l-4'} border-brand-500`}>
          <div className={`flex items-center gap-2 mb-3 ${isAr ? 'justify-end' : 'justify-start'}`}>
            {!isAr && <Clock className="w-5 h-5 text-brand-500" />}
            <h2 className="font-bold text-brand-900">{isAr ? 'المتابعات القادمة' : 'Upcoming Follow-ups'} ({followUps.length})</h2>
            {isAr && <Clock className="w-5 h-5 text-brand-500" />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUps.map(v => {
              const fl = v.nextFollowUp ? getFollowUpLabel(v.nextFollowUp) : null;
              return (
                <Link key={v.id} to={`/clients/${v.client?.id}`}
                  className={`flex items-center justify-between p-3 rounded-lg bg-brand-50/50 hover:bg-brand-50 transition-colors ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={isAr ? 'text-right' : 'text-left'}>
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

      <div className="space-y-3">
        {loading ? (
          <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : visits.length === 0 ? (
          <div className="card py-12 text-center text-brand-400">{isAr ? 'لا توجد زيارات مسجلة' : 'No visits recorded'}</div>
        ) : visits.map(v => (
          <div key={v.id} className="card p-4 hover:border-brand-200 transition-colors">
            <div className={`flex items-start justify-between gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-start gap-3 flex-1 min-w-0 ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className="text-2xl mt-0.5">{visitEmoji[v.visitType || 'in_person'] || '🗺️'}</div>
                <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                    <Link to={`/clients/${v.client?.id}`} className="font-bold text-brand-900 hover:text-brand-600">{v.client?.companyName}</Link>
                    <span className="text-xs bg-gray-100 text-brand-500 px-2 py-0.5 rounded-full">{VISIT_TYPES[v.visitType || ''] || v.visitType}</span>
                  </div>
                  {v.purpose && <p className="text-sm text-brand-700 mt-1">{v.purpose}</p>}
                  {v.outcome && (
                    <p className="text-sm text-brand-400 mt-1">
                      <span className="font-medium text-brand-700">{isAr ? 'النتيجة: ' : 'Outcome: '}</span>{v.outcome}
                    </p>
                  )}
                  {v.notes && <p className="text-xs text-brand-400 mt-1">{v.notes}</p>}
                  <div className={`flex items-center gap-3 mt-2 text-xs text-brand-400 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <span>👤 {v.salesRep?.name}</span>
                    <span>📅 {v.visitDate ? format(parseISO(v.visitDate), 'dd MMM yyyy', { locale }) : '—'}</span>
                  </div>
                </div>
              </div>
              {v.nextFollowUp && (
                <div className={`flex-shrink-0 ${isAr ? 'text-left' : 'text-right'}`}>
                  <p className="text-xs text-brand-400 mb-1">{isAr ? 'متابعة' : 'Follow-up'}</p>
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
