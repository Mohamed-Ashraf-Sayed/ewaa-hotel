import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, MapPin, Clock, AlertTriangle, TrendingUp, Users, ArrowLeft } from 'lucide-react';
import { dashboardApi, contractsApi } from '../services/api';
import { DashboardData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';

const ROLE_LABELS: Record<string, string> = {
  general_manager: 'مدير عام',
  vice_gm: 'نائب المدير العام',
  sales_director: 'مدير مبيعات',
  sales_rep: 'مندوب مبيعات',
  contract_officer: 'مسئول العقود',
  reservations: 'قسم الحجوزات',
  credit_manager: 'مدير الائتمان',
  credit_officer: 'موظف ائتمان'
};

const CHART_COLORS = ['#1a2f44', '#2d6a4f', '#e9c46a', '#e76f51', '#457b9d', '#6d6875'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    dashboardApi.get().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;
  const { stats } = data;

  // Reservations role — simple dedicated dashboard
  if (user?.role === 'reservations') {
    return <ReservationsDashboard />;
  }

  // Chart data
  const clientTypeData = [
    { name: 'نشط', value: stats.activeClients, color: '#2d6a4f' },
    { name: 'محتمل', value: stats.leads, color: '#e9c46a' },
    { name: 'غير نشط', value: Math.max(stats.totalClients - stats.activeClients - stats.leads, 0), color: '#bcccdc' },
  ].filter(d => d.value > 0);

  const contractStatusData = [
    { name: 'موافق عليها', value: stats.approvedContracts, color: '#2d6a4f' },
    { name: 'في الانتظار', value: stats.pendingContracts, color: '#e9c46a' },
    { name: 'أخرى', value: Math.max(stats.totalContracts - stats.approvedContracts - stats.pendingContracts, 0), color: '#e76f51' },
  ].filter(d => d.value > 0);

  const teamData = data.teamPerformance.map(m => ({
    name: m.name.split(' ')[0],
    عملاء: m._count.assignedClients,
    عقود: m._count.contracts,
    زيارات: m._count.visits,
  }));

  return (
    <div className="space-y-5">
      {/* Welcome Header */}
      <div className="card p-6 bg-gradient-to-l from-brand-800 to-brand-900 border-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.04]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}
        />
        <div className="relative z-10 flex items-center justify-between flex-row-reverse">
          <div className="text-right">
            <h1 className="text-2xl font-bold text-white">مرحباً، {user?.name?.split(' ')[0]}</h1>
            <p className="text-brand-200 text-sm mt-1">
              {user && ROLE_LABELS[user.role]} · {' '}
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-white/80">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
              <p className="text-xs text-brand-200">عميل</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.totalContracts}</p>
              <p className="text-xs text-brand-200">عقد</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.visitsThisMonth}</p>
              <p className="text-xs text-brand-200">زيارة هذا الشهر</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'العملاء', value: stats.totalClients, sub: `${stats.activeClients} نشط`, icon: Building2, iconColor: 'text-sky-600', iconBg: 'bg-sky-50', accent: 'border-l-sky-500' },
          { label: 'العقود', value: stats.totalContracts, sub: `${stats.contractsThisMonth} هذا الشهر`, icon: FileText, iconColor: 'text-brand-600', iconBg: 'bg-brand-50', accent: 'border-l-brand-600' },
          { label: 'الزيارات', value: stats.totalVisits, sub: `${stats.visitsThisMonth} هذا الشهر`, icon: MapPin, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
          { label: 'بانتظار الموافقة', value: stats.pendingContracts, sub: 'عقود تحتاج مراجعة', icon: Clock, iconColor: 'text-amber-600', iconBg: 'bg-amber-50', accent: 'border-l-amber-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`card p-4 border-l-4 ${kpi.accent}`}>
            <div className="flex items-start justify-between flex-row-reverse">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase">{kpi.label}</p>
                <p className="text-2xl font-bold text-brand-900 mt-0.5">{kpi.value}</p>
                <p className="text-[11px] text-brand-400 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Team Performance Bar Chart */}
        {teamData.length > 0 && (
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-end gap-2 mb-4">
              <h2 className="font-bold text-brand-900">أداء الفريق</h2>
              <TrendingUp className="w-4 h-4 text-brand-500" />
            </div>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#486581', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#486581', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #d9e2ec', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'rgba(26,47,68,0.04)' }}
                  />
                  <Bar dataKey="عملاء" fill="#457b9d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="عقود" fill="#1a2f44" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="زيارات" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-5 mt-2 text-xs text-brand-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#457b9d]" />عملاء</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1a2f44]" />عقود</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2d6a4f]" />زيارات</span>
            </div>
          </div>
        )}

        {/* Client Type Pie Chart */}
        <div className="card p-5">
          <h2 className="font-bold text-brand-900 text-right mb-2">توزيع العملاء</h2>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={clientTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {clientTypeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #d9e2ec' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-brand-500">
            {clientTypeData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />{d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Contract Status + Expiring Contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contract Status Donut */}
        <div className="card p-5">
          <h2 className="font-bold text-brand-900 text-right mb-2">حالة العقود</h2>
          <div className="h-48" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={contractStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                  paddingAngle={4} dataKey="value" stroke="none">
                  {contractStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #d9e2ec' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-brand-500 flex-wrap">
            {contractStatusData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />{d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        {/* Expiring Contracts */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <Link to="/contracts?status=approved" className="text-xs font-semibold text-brand-500 hover:text-brand-700 flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-brand-900">عقود تنتهي خلال 30 يوم</h2>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          {data.expiringIn30.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-brand-400 text-sm">لا توجد عقود تنتهي قريباً</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.expiringIn30.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50/40 border border-amber-100/60 hover:bg-amber-50 transition-colors">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${(c.daysUntilExpiry || 0) <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.daysUntilExpiry} يوم
                  </span>
                  <div className="text-right">
                    <p className="font-semibold text-sm text-brand-900">{c.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{c.hotel?.name} · {c.salesRep?.name} · {c.endDate ? format(parseISO(c.endDate), 'dd MMM', { locale: arSA }) : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-ups + At Risk + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming Follow-ups */}
        <div className="card p-5">
          <div className="flex items-center justify-end gap-2 mb-4">
            <h2 className="font-bold text-brand-900">المتابعات القادمة</h2>
            <Clock className="w-4 h-4 text-brand-500" />
          </div>
          {data.upcomingFollowUps.length === 0 ? (
            <p className="text-brand-400 text-sm text-center py-8">لا توجد متابعات</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingFollowUps.map(v => (
                <Link key={v.id} to={`/clients/${v.clientId}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-brand-50/40 border border-brand-100/60 hover:bg-brand-50 transition-colors flex-row-reverse">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <div className="min-w-0 text-right flex-1">
                    <p className="font-semibold text-sm text-brand-900 truncate">{v.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{v.nextFollowUp ? format(parseISO(v.nextFollowUp), 'dd MMM', { locale: arSA }) : '-'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* At Risk */}
        <div className="card p-5">
          <div className="flex items-center justify-end gap-2 mb-4">
            <h2 className="font-bold text-brand-900">عملاء في خطر</h2>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          {data.atRiskClients.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-brand-400 text-sm">لا يوجد عملاء في خطر</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.atRiskClients.slice(0, 5).map((p: any) => (
                <Link key={p.id} to={`/clients/${p.client?.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-red-50/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-1.5 bg-brand-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${p.engagementScore}%` }} />
                    </div>
                    <span className="text-xs font-bold text-red-600">{p.engagementScore}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-900">{p.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{p.daysSinceLastVisit} يوم منذ آخر زيارة</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <h2 className="font-bold text-brand-900 mb-4 text-right">النشاط الأخير</h2>
          {data.recentActivities.length === 0 ? (
            <p className="text-brand-400 text-sm text-center py-8">لا يوجد نشاط</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentActivities.slice(0, 6).map(a => {
                const icons: Record<string, string> = {
                  note: '📝', call: '📞', email: '✉️', meeting: '🤝',
                  visit: '🗺️', whatsapp: '💬', contract_upload: '📄', contract_approval: '✅'
                };
                return (
                  <div key={a.id} className="flex items-start gap-2.5 flex-row-reverse">
                    <span className="text-sm mt-0.5 w-6 text-center flex-shrink-0">{icons[a.type] || '📌'}</span>
                    <div className="min-w-0 text-right flex-1 border-r-2 border-brand-100 pr-3">
                      <p className="text-xs text-brand-700 leading-relaxed">{a.description.slice(0, 60)}{a.description.length > 60 ? '...' : ''}</p>
                      <p className="text-[10px] text-brand-400 mt-0.5">{a.client?.companyName} · {a.user?.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team Table (compact) */}
      {data.teamPerformance.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 pb-3 flex items-center justify-end gap-2">
            <h2 className="font-bold text-brand-900">تفاصيل أداء الفريق</h2>
            <Users className="w-4 h-4 text-brand-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-50/50">
                  <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">الأداء</th>
                  <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">الزيارات</th>
                  <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">العقود</th>
                  <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">العملاء</th>
                  <th className="px-5 py-3 text-right font-semibold text-brand-500 text-xs">المندوب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {data.teamPerformance.map(member => {
                  const total = member._count.assignedClients + member._count.contracts + member._count.visits;
                  const maxTotal = Math.max(...data.teamPerformance.map(m => m._count.assignedClients + m._count.contracts + m._count.visits), 1);
                  const pct = Math.round((total / maxTotal) * 100);
                  return (
                    <tr key={member.id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="w-20 mx-auto">
                          <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-700 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center font-semibold text-brand-700">{member._count.visits}</td>
                      <td className="px-5 py-3.5 text-center font-semibold text-brand-700">{member._count.contracts}</td>
                      <td className="px-5 py-3.5 text-center font-semibold text-brand-700">{member._count.assignedClients}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-2.5 justify-end">
                          <span className="font-bold text-brand-900">{member.name}</span>
                          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {member.name.charAt(0)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== RESERVATIONS DASHBOARD ====================
function ReservationsDashboard() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contractsApi.getAll({ status: 'approved' }).then(r => {
      // Sort by newest first
      const sorted = r.data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setContracts(sorted);
    }).finally(() => setLoading(false));
  }, []);

  // Contracts from last 7 days = "new"
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newContracts = contracts.filter(c => new Date(c.createdAt) >= sevenDaysAgo);
  const olderContracts = contracts.filter(c => new Date(c.createdAt) < sevenDaysAgo);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const ContractCard = ({ c, isNew }: { c: any; isNew: boolean }) => (
    <div className={`card p-5 ${isNew ? 'border-r-4 border-r-emerald-500' : ''}`}>
      <div className="flex items-start justify-between flex-row-reverse">
        <div className="text-right flex-1">
          <div className="flex items-center gap-2 justify-end">
            {isNew && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">جديد</span>
            )}
            <p className="font-bold text-brand-900">{c.client?.companyName}</p>
          </div>
          <p className="text-xs text-brand-400 mt-1">{c.hotel?.name} · {c.contractRef || `#${c.id}`}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center p-3 rounded-lg bg-brand-50/50">
          <p className="text-xs text-brand-400">عدد الغرف</p>
          <p className="text-xl font-bold text-brand-900 mt-1">{c.roomsCount || '—'}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-amber-50/50">
          <p className="text-xs text-brand-400">سعر الغرفة/ليلة</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{c.ratePerRoom ? `${c.ratePerRoom} ر.س` : '—'}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-emerald-50/50">
          <p className="text-xs text-brand-400">القيمة الإجمالية</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{c.totalValue ? `${(c.totalValue / 1000).toFixed(0)}K` : '—'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-brand-400 flex-row-reverse">
        <span>📅 {c.startDate ? format(parseISO(c.startDate), 'dd MMM yyyy', { locale: arSA }) : '—'} → {c.endDate ? format(parseISO(c.endDate), 'dd MMM yyyy', { locale: arSA }) : '—'}</span>
        <span>👤 {c.salesRep?.name}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-l from-brand-800 to-brand-900 border-0">
        <div className="flex items-center justify-between flex-row-reverse">
          <div className="text-right">
            <h1 className="text-2xl font-bold text-white">قسم الحجوزات</h1>
            <p className="text-brand-200 text-sm mt-1">العقود المعتمدة وأسعار الغرف</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center text-white">
              <p className="text-2xl font-bold">{newContracts.length}</p>
              <p className="text-xs text-brand-200">عقد جديد</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center text-white">
              <p className="text-2xl font-bold">{contracts.length}</p>
              <p className="text-xs text-brand-200">إجمالي العقود</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Contracts */}
      {newContracts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 flex-row-reverse">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-bold text-brand-900">عقود جديدة (آخر 7 أيام)</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">{newContracts.length}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {newContracts.map(c => <ContractCard key={c.id} c={c} isNew={true} />)}
          </div>
        </div>
      )}

      {/* All Approved Contracts */}
      <div>
        <h2 className="font-bold text-brand-900 mb-3 text-right">كل العقود المعتمدة</h2>
        {contracts.length === 0 ? (
          <div className="card py-16 text-center">
            <FileText className="w-12 h-12 text-brand-200 mx-auto mb-3" />
            <p className="text-brand-400">لا توجد عقود معتمدة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {olderContracts.map(c => <ContractCard key={c.id} c={c} isNew={false} />)}
          </div>
        )}
      </div>
    </div>
  );
}
