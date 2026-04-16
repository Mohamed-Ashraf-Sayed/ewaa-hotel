import { useEffect, useState } from 'react';
import { Trophy, Star, ChevronLeft, ChevronRight, Medal, TrendingUp, FileText, MapPin, Building2 } from 'lucide-react';
import { gamificationApi } from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface LeaderEntry {
  id: number; name: string; role: string; rank: number; points: number;
  commissionRate?: number; rating: number | null; ratingNotes: string | null;
  stats: { contracts: number; visits: number; clients: number; revenue: number };
}

const MONTHS_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function Leaderboard() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const canRate = hasRole('sales_director', 'general_manager', 'vice_gm');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateModal, setRateModal] = useState<LeaderEntry | null>(null);
  const [rateForm, setRateForm] = useState({ rating: '3', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    gamificationApi.getLeaderboard({ month, year }).then(r => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [month, year]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const handleRate = async () => {
    if (!rateModal) return; setSaving(true);
    try {
      await gamificationApi.rate({ userId: rateModal.id, month, year, rating: parseInt(rateForm.rating), notes: rateForm.notes });
      setRateModal(null); load();
    } catch { alert('Error'); }
    finally { setSaving(false); }
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><Trophy className="w-5 h-5 text-amber-600" /></div>;
    if (rank === 2) return <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><Medal className="w-5 h-5 text-gray-500" /></div>;
    if (rank === 3) return <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"><Medal className="w-5 h-5 text-amber-700" /></div>;
    return <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm">{rank}</div>;
  };

  const maxPoints = Math.max(...data.map(d => d.points), 1);

  return (
    <div className="space-y-5">
      <div className={`flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'لوحة الصدارة' : 'Leaderboard'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'تقييم وترتيب أداء المناديب' : 'Sales team ranking & performance'}</p>
        </div>
        <Trophy className="w-8 h-8 text-amber-500" />
      </div>

      {/* Month Navigator */}
      <div className="card p-4">
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-brand-50 text-brand-500"><ChevronRight className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold text-brand-900 min-w-[180px] text-center">{MONTHS_AR[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-brand-50 text-brand-500"><ChevronLeft className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Top 3 Podium */}
      {data.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[data[1], data[0], data[2]].map((u, idx) => {
            const isFirst = idx === 1;
            return (
              <div key={u.id} className={`card p-5 text-center ${isFirst ? 'ring-2 ring-amber-300 bg-amber-50/30 -mt-2' : ''}`}>
                <div className="mx-auto mb-3">{rankBadge(u.rank)}</div>
                <div className="w-12 h-12 rounded-full bg-brand-800 flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                  {u.name.charAt(0)}
                </div>
                <p className="font-bold text-brand-900">{u.name}</p>
                <p className={`text-2xl font-bold mt-1 ${isFirst ? 'text-amber-600' : 'text-brand-700'}`}>{u.points}</p>
                <p className="text-xs text-brand-400">{isAr ? 'نقطة' : 'points'}</p>
                {u.rating && (
                  <div className="flex items-center justify-center gap-0.5 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < u.rating! ? 'text-amber-400 fill-amber-400' : 'text-brand-200'}`} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      {loading ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : data.length === 0 ? (
        <div className="card py-16 text-center"><p className="text-brand-400">{isAr ? 'لا توجد بيانات' : 'No data'}</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50/50">
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500">{isAr ? 'إجراء' : 'Action'}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500">{isAr ? 'التقييم' : 'Rating'}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500">{isAr ? 'النقاط' : 'Points'}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500"><MapPin className="w-3.5 h-3.5 mx-auto" /></th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500"><FileText className="w-3.5 h-3.5 mx-auto" /></th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500"><Building2 className="w-3.5 h-3.5 mx-auto" /></th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-500">{isAr ? 'المندوب' : 'Rep'}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-500 w-12">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {data.map(u => (
                <tr key={u.id} className={`hover:bg-brand-50/30 transition-colors ${u.rank <= 3 ? 'bg-amber-50/20' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    {canRate && (
                      <button onClick={() => { setRateModal(u); setRateForm({ rating: (u.rating || 3).toString(), notes: u.ratingNotes || '' }); }}
                        className="text-xs text-brand-500 hover:text-brand-700 font-semibold">{isAr ? 'تقييم' : 'Rate'}</button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.rating ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < u.rating! ? 'text-amber-400 fill-amber-400' : 'text-brand-200'}`} />
                        ))}
                      </div>
                    ) : <span className="text-brand-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <span className="font-bold text-brand-900">{u.points}</span>
                      <div className="w-16 h-1.5 bg-brand-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(u.points / maxPoints) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-brand-700">{u.stats.visits}</td>
                  <td className="px-4 py-3 text-center font-semibold text-brand-700">{u.stats.contracts}</td>
                  <td className="px-4 py-3 text-center font-semibold text-brand-700">{u.stats.clients}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-brand-900">{u.name}</span>
                      <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-white font-bold text-xs">{u.name.charAt(0)}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{rankBadge(u.rank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Points Legend */}
      <div className="card p-4">
        <h3 className="font-bold text-brand-900 text-sm mb-3 text-right">{isAr ? 'كيف تُحسب النقاط؟' : 'How points are calculated'}</h3>
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs ${isAr ? 'flex-row-reverse' : ''}`}>
          {[
            { label: isAr ? 'كل عقد' : 'Per contract', pts: '50 نقطة', color: 'bg-brand-50 text-brand-700' },
            { label: isAr ? 'كل عميل جديد' : 'Per new client', pts: '30 نقطة', color: 'bg-sky-50 text-sky-700' },
            { label: isAr ? 'كل زيارة' : 'Per visit', pts: '10 نقاط', color: 'bg-emerald-50 text-emerald-700' },
            { label: isAr ? 'كل 10K إيرادات' : 'Per 10K revenue', pts: '1 نقطة', color: 'bg-amber-50 text-amber-700' },
          ].map(p => (
            <div key={p.label} className={`p-3 rounded-lg ${p.color}`}>
              <p className="font-bold">{p.pts}</p>
              <p className="mt-0.5 opacity-80">{p.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Modal */}
      <Modal open={!!rateModal} onClose={() => setRateModal(null)} title={`${isAr ? 'تقييم' : 'Rate'} — ${rateModal?.name}`} size="sm">
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-brand-400 mb-3">{isAr ? 'اختر التقييم' : 'Select rating'}</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => setRateForm(p => ({ ...p, rating: v.toString() }))}
                  className="p-1 hover:scale-110 transition-transform">
                  <Star className={`w-8 h-8 ${v <= parseInt(rateForm.rating) ? 'text-amber-400 fill-amber-400' : 'text-brand-200'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea className="input resize-none" rows={3} value={rateForm.notes} onChange={e => setRateForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setRateModal(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button className="btn-primary flex-1 justify-center" onClick={handleRate} disabled={saving}>
              {saving ? '...' : (isAr ? 'حفظ التقييم' : 'Save Rating')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
