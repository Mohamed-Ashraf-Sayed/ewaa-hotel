import { useEffect, useState } from 'react';
import { Target, Plus, ChevronLeft, ChevronRight, FileText, MapPin, Building2, TrendingUp } from 'lucide-react';
import { targetsApi, usersApi } from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface TargetReport {
  id: number;
  userId: number;
  period: string;
  month?: number;
  quarter?: number;
  year: number;
  targetContracts: number;
  targetRevenue: number;
  targetVisits: number;
  targetClients: number;
  notes?: string;
  user: { id: number; name: string; role: string };
  actual: { contracts: number; visits: number; clients: number; revenue: number };
  progress: { contracts: number; visits: number; clients: number; revenue: number };
}

interface TeamUser {
  id: number;
  name: string;
  role: string;
  managerId?: number;
}

const MONTHS_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Targets() {
  const { t, lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const isAr = lang === 'ar';
  const canManage = hasRole('sales_director', 'general_manager', 'vice_gm');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<TargetReport[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    userId: '', targetContracts: '', targetRevenue: '', targetVisits: '', targetClients: '', notes: ''
  };
  const [form, setForm] = useState(emptyForm);

  const loadReport = () => {
    setLoading(true);
    targetsApi.getReport({ year, month, period: 'monthly' })
      .then(r => setReport(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [year, month]);
  useEffect(() => {
    if (canManage) {
      usersApi.getAll().then(r => {
        const users = r.data.filter((u: TeamUser) =>
          ['sales_rep', 'sales_director'].includes(u.role)
        );
        setTeamUsers(users);
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await targetsApi.upsert({
        userId: parseInt(form.userId),
        period: 'monthly',
        month,
        year,
        targetContracts: parseInt(form.targetContracts) || 0,
        targetRevenue: parseFloat(form.targetRevenue) || 0,
        targetVisits: parseInt(form.targetVisits) || 0,
        targetClients: parseInt(form.targetClients) || 0,
        notes: form.notes,
      });
      setShowModal(false);
      setForm(emptyForm);
      loadReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isAr ? 'هل تريد حذف هذا التارجت؟' : 'Delete this target?')) return;
    await targetsApi.delete(id);
    loadReport();
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthName = isAr ? MONTHS_AR[month] : MONTHS_EN[month];

  const ProgressBar = ({ value, color }: { value: number; color: string }) => (
    <div className="h-2 bg-brand-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${value >= 100 ? 'bg-emerald-500' : value >= 70 ? color : value >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );

  const editTarget = (t: TargetReport) => {
    setForm({
      userId: t.userId.toString(),
      targetContracts: t.targetContracts.toString(),
      targetRevenue: t.targetRevenue.toString(),
      targetVisits: t.targetVisits.toString(),
      targetClients: t.targetClients.toString(),
      notes: t.notes || '',
    });
    setShowModal(true);
  };

  // Calculate team totals
  const totals = report.reduce((acc, r) => ({
    targetContracts: acc.targetContracts + r.targetContracts,
    targetVisits: acc.targetVisits + r.targetVisits,
    targetClients: acc.targetClients + r.targetClients,
    targetRevenue: acc.targetRevenue + r.targetRevenue,
    actualContracts: acc.actualContracts + r.actual.contracts,
    actualVisits: acc.actualVisits + r.actual.visits,
    actualClients: acc.actualClients + r.actual.clients,
    actualRevenue: acc.actualRevenue + r.actual.revenue,
  }), { targetContracts: 0, targetVisits: 0, targetClients: 0, targetRevenue: 0, actualContracts: 0, actualVisits: 0, actualClients: 0, actualRevenue: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'التارجت والمتابعة' : 'Sales Targets'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'تحديد ومتابعة أهداف فريق المبيعات' : 'Set and track sales team goals'}</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>
            <Plus className="w-4 h-4" /> {isAr ? 'تحديد تارجت' : 'Set Target'}
          </button>
        )}
      </div>

      {/* Month Navigator */}
      <div className="card p-4">
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[180px]">
            <h2 className="text-lg font-bold text-brand-900">{monthName} {year}</h2>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Team Summary KPIs */}
      {report.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: isAr ? 'العقود' : 'Contracts',
              icon: <FileText className="w-5 h-5 text-brand-600" />,
              actual: totals.actualContracts, target: totals.targetContracts,
              color: 'bg-brand-50', barColor: 'bg-brand-500'
            },
            {
              label: isAr ? 'الزيارات' : 'Visits',
              icon: <MapPin className="w-5 h-5 text-emerald-600" />,
              actual: totals.actualVisits, target: totals.targetVisits,
              color: 'bg-emerald-50', barColor: 'bg-emerald-500'
            },
            {
              label: isAr ? 'عملاء جدد' : 'New Clients',
              icon: <Building2 className="w-5 h-5 text-sky-600" />,
              actual: totals.actualClients, target: totals.targetClients,
              color: 'bg-sky-50', barColor: 'bg-sky-500'
            },
            {
              label: isAr ? 'الإيرادات' : 'Revenue',
              icon: <TrendingUp className="w-5 h-5 text-amber-600" />,
              actual: totals.actualRevenue, target: totals.targetRevenue,
              color: 'bg-amber-50', barColor: 'bg-amber-500'
            },
          ].map(kpi => {
            const pct = kpi.target > 0 ? Math.round((kpi.actual / kpi.target) * 100) : 0;
            return (
              <div key={kpi.label} className="card p-4">
                <div className={`flex items-center gap-2 mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
                  <span className="text-sm font-semibold text-brand-700">{kpi.label}</span>
                </div>
                <div className={`flex items-end justify-between mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-2xl font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-brand-900'}`}>{kpi.actual}</span>
                  <span className="text-sm text-brand-400">/ {kpi.label === (isAr ? 'الإيرادات' : 'Revenue') ? `${(kpi.target / 1000).toFixed(0)}K` : kpi.target}</span>
                </div>
                <ProgressBar value={pct} color={kpi.barColor} />
                <p className={`text-xs mt-1 font-semibold ${pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-brand-500' : 'text-red-500'}`}>{pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Individual Reports */}
      {loading ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : report.length === 0 ? (
        <div className="card py-16 text-center">
          <Target className="w-12 h-12 text-brand-200 mx-auto mb-3" />
          <p className="text-brand-400 font-semibold">{isAr ? 'لا يوجد تارجت لهذا الشهر' : 'No targets set for this month'}</p>
          {canManage && (
            <button className="btn-primary mt-4 mx-auto" onClick={() => { setForm(emptyForm); setShowModal(true); }}>
              <Plus className="w-4 h-4" /> {isAr ? 'تحديد تارجت' : 'Set Target'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {report.map(r => {
            const overallPct = Math.round(
              (r.progress.contracts + r.progress.visits + r.progress.clients + r.progress.revenue) / 4
            );
            return (
              <div key={r.id} className="card p-5">
                <div className={`flex items-start justify-between mb-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <div className="w-10 h-10 rounded-lg bg-brand-800 flex items-center justify-center text-white font-bold text-sm">
                      {r.user.name.charAt(0)}
                    </div>
                    <div className={isAr ? 'text-right' : 'text-left'}>
                      <p className="font-bold text-brand-900">{r.user.name}</p>
                      <p className="text-xs text-brand-400">
                        {r.user.role === 'sales_rep' ? (isAr ? 'مندوب مبيعات' : 'Sales Rep') : (isAr ? 'مدير مبيعات' : 'Sales Director')}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-2xl font-bold ${overallPct >= 100 ? 'text-emerald-600' : overallPct >= 70 ? 'text-brand-600' : overallPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {overallPct}%
                    </span>
                    {canManage && (
                      <div className="flex gap-1">
                        <button onClick={() => editTarget(r)} className="text-xs text-brand-500 hover:text-brand-700 px-2 py-1 rounded hover:bg-brand-50">
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                          {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: isAr ? 'العقود' : 'Contracts', actual: r.actual.contracts, target: r.targetContracts, pct: r.progress.contracts, color: 'bg-brand-500' },
                    { label: isAr ? 'الزيارات' : 'Visits', actual: r.actual.visits, target: r.targetVisits, pct: r.progress.visits, color: 'bg-emerald-500' },
                    { label: isAr ? 'عملاء جدد' : 'New Clients', actual: r.actual.clients, target: r.targetClients, pct: r.progress.clients, color: 'bg-sky-500' },
                    { label: isAr ? 'الإيرادات' : 'Revenue', actual: r.actual.revenue, target: r.targetRevenue, pct: r.progress.revenue, color: 'bg-amber-500', isRevenue: true },
                  ].map(metric => (
                    <div key={metric.label} className={`p-3 rounded-lg bg-brand-50/50 ${isAr ? 'text-right' : 'text-left'}`}>
                      <p className="text-xs font-semibold text-brand-400 mb-1">{metric.label}</p>
                      <div className={`flex items-end justify-between mb-1.5 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <span className="text-lg font-bold text-brand-900">
                          {(metric as any).isRevenue ? `${(metric.actual / 1000).toFixed(0)}K` : metric.actual}
                        </span>
                        <span className="text-xs text-brand-400">
                          / {(metric as any).isRevenue ? `${(metric.target / 1000).toFixed(0)}K` : metric.target}
                        </span>
                      </div>
                      <ProgressBar value={metric.pct} color={metric.color} />
                      <p className={`text-xs mt-1 font-bold ${metric.pct >= 100 ? 'text-emerald-600' : metric.pct >= 70 ? 'text-brand-500' : 'text-red-500'}`}>
                        {metric.pct}%
                      </p>
                    </div>
                  ))}
                </div>

                {r.notes && (
                  <p className={`mt-3 text-xs text-brand-400 ${isAr ? 'text-right' : ''}`}>
                    {isAr ? 'ملاحظات: ' : 'Notes: '}{r.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Set Target Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={isAr ? `تحديد تارجت — ${monthName} ${year}` : `Set Target — ${monthName} ${year}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{isAr ? 'المندوب' : 'Sales Rep'} *</label>
            <select className="input" required value={form.userId} onChange={e => setForm(p => ({ ...p, userId: e.target.value }))}>
              <option value="">{isAr ? 'اختر المندوب...' : 'Select rep...'}</option>
              {teamUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'تارجت العقود' : 'Contracts Target'}</label>
              <input className="input" type="number" min="0" value={form.targetContracts}
                onChange={e => setForm(p => ({ ...p, targetContracts: e.target.value }))}
                placeholder="0" />
            </div>
            <div>
              <label className="label">{isAr ? 'تارجت الزيارات' : 'Visits Target'}</label>
              <input className="input" type="number" min="0" value={form.targetVisits}
                onChange={e => setForm(p => ({ ...p, targetVisits: e.target.value }))}
                placeholder="0" />
            </div>
            <div>
              <label className="label">{isAr ? 'تارجت عملاء جدد' : 'New Clients Target'}</label>
              <input className="input" type="number" min="0" value={form.targetClients}
                onChange={e => setForm(p => ({ ...p, targetClients: e.target.value }))}
                placeholder="0" />
            </div>
            <div>
              <label className="label">{isAr ? 'تارجت الإيرادات' : 'Revenue Target'}</label>
              <input className="input" type="number" min="0" value={form.targetRevenue}
                onChange={e => setForm(p => ({ ...p, targetRevenue: e.target.value }))}
                placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التارجت' : 'Save Target')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
