import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, MapPin, Clock, AlertTriangle, TrendingUp, Users, ArrowLeft, Eye, Download } from 'lucide-react';
import { dashboardApi, contractsApi } from '../services/api';
import Modal from '../components/Modal';
import { DashboardData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  CartesianGrid,
} from 'recharts';

const ROLE_LABELS_AR: Record<string, string> = {
  admin: 'مدير النظام',
  general_manager: 'مدير عام',
  vice_gm: 'نائب المدير العام',
  sales_director: 'مدير مبيعات',
  assistant_sales: 'مساعد مدير المبيعات',
  sales_rep: 'مندوب مبيعات',
  contract_officer: 'مسئول العقود',
  reservations: 'قسم الحجوزات',
  credit_manager: 'مدير الائتمان',
  credit_officer: 'موظف ائتمان'
};
const ROLE_LABELS_EN: Record<string, string> = {
  admin: 'System Admin',
  general_manager: 'General Manager',
  vice_gm: 'Vice GM',
  sales_director: 'Sales Director',
  assistant_sales: 'Assistant Sales',
  sales_rep: 'Sales Rep',
  contract_officer: 'Contract Officer',
  reservations: 'Reservations',
  credit_manager: 'Credit Manager',
  credit_officer: 'Credit Officer'
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const ROLE_LABELS = isAr ? ROLE_LABELS_AR : ROLE_LABELS_EN;

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

  // Reservations dedicated dashboard
  if (user?.role === 'reservations') {
    return <ReservationsDashboard />;
  }

  // Chart labels
  const L = {
    active: isAr ? 'نشط' : 'Active',
    lead: isAr ? 'محتمل' : 'Lead',
    inactive: isAr ? 'غير نشط' : 'Inactive',
    approved: isAr ? 'موافق عليها' : 'Approved',
    pending: isAr ? 'في الانتظار' : 'Pending',
    other: isAr ? 'أخرى' : 'Other',
    clients: isAr ? 'عملاء' : 'Clients',
    contracts: isAr ? 'عقود' : 'Contracts',
    visits: isAr ? 'زيارات' : 'Visits',
  };

  const clientTypeData = [
    { name: L.active, value: stats.activeClients, color: '#2d6a4f' },
    { name: L.lead, value: stats.leads, color: '#e9c46a' },
    { name: L.inactive, value: Math.max(stats.totalClients - stats.activeClients - stats.leads, 0), color: '#bcccdc' },
  ].filter(d => d.value > 0);

  const contractStatusData = [
    { name: L.approved, value: stats.approvedContracts, color: '#2d6a4f' },
    { name: L.pending, value: stats.pendingContracts, color: '#e9c46a' },
    { name: L.other, value: Math.max(stats.totalContracts - stats.approvedContracts - stats.pendingContracts, 0), color: '#e76f51' },
  ].filter(d => d.value > 0);

  const teamData = data.teamPerformance.map(m => ({
    name: m.name.split(' ')[0],
    [L.clients]: m._count.assignedClients,
    [L.contracts]: m._count.contracts,
    [L.visits]: m._count.visits,
  }));

  const dateLocale = isAr ? 'ar-EG' : 'en-US';

  return (
    <div className="space-y-5">
      {/* Welcome Header */}
      <div className="card p-6 bg-gradient-to-l from-brand-800 to-brand-900 border-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.04]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}
        />
        <div className={`relative z-10 flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
          <div className={isAr ? 'text-right' : 'text-left'}>
            <h1 className="text-2xl font-bold text-white">{isAr ? 'مرحباً، ' : 'Welcome, '}{user?.name?.split(' ')[0]}</h1>
            <p className="text-brand-200 text-sm mt-1">
              {user && ROLE_LABELS[user.role]} · {' '}
              {new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-white/80">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
              <p className="text-xs text-brand-200">{isAr ? 'عميل' : 'clients'}</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.totalContracts}</p>
              <p className="text-xs text-brand-200">{isAr ? 'عقد' : 'contracts'}</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.visitsThisMonth}</p>
              <p className="text-xs text-brand-200">{isAr ? 'زيارة هذا الشهر' : 'visits this month'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: isAr ? 'العملاء' : 'Clients', value: stats.totalClients, sub: `${stats.activeClients} ${isAr ? 'نشط' : 'active'}`, icon: Building2, iconColor: 'text-sky-600', iconBg: 'bg-sky-50', accent: 'border-l-sky-500' },
          { label: isAr ? 'العقود' : 'Contracts', value: stats.totalContracts, sub: `${stats.contractsThisMonth} ${isAr ? 'هذا الشهر' : 'this month'}`, icon: FileText, iconColor: 'text-brand-600', iconBg: 'bg-brand-50', accent: 'border-l-brand-600' },
          { label: isAr ? 'الزيارات' : 'Visits', value: stats.totalVisits, sub: `${stats.visitsThisMonth} ${isAr ? 'هذا الشهر' : 'this month'}`, icon: MapPin, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
          { label: isAr ? 'بانتظار الموافقة' : 'Pending Approval', value: stats.pendingContracts, sub: isAr ? 'عقود تحتاج مراجعة' : 'contracts to review', icon: Clock, iconColor: 'text-amber-600', iconBg: 'bg-amber-50', accent: 'border-l-amber-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`card p-4 border-l-4 ${kpi.accent}`}>
            <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
              </div>
              <div className={isAr ? 'text-right' : 'text-left'}>
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
        {teamData.length > 0 && (
          <div className="card p-5 lg:col-span-2">
            <div className={`flex items-center gap-2 mb-4 ${isAr ? 'justify-end' : 'justify-start'}`}>
              {!isAr && <TrendingUp className="w-4 h-4 text-brand-500" />}
              <h2 className="font-bold text-brand-900">{isAr ? 'أداء الفريق' : 'Team Performance'}</h2>
              {isAr && <TrendingUp className="w-4 h-4 text-brand-500" />}
            </div>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#486581', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#486581', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #d9e2ec', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(26,47,68,0.04)' }} />
                  <Bar dataKey={L.clients} fill="#457b9d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={L.contracts} fill="#1a2f44" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={L.visits} fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-5 mt-2 text-xs text-brand-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#457b9d]" />{L.clients}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1a2f44]" />{L.contracts}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2d6a4f]" />{L.visits}</span>
            </div>
          </div>
        )}

        <div className="card p-5">
          <h2 className={`font-bold text-brand-900 mb-2 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'توزيع العملاء' : 'Client Distribution'}</h2>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={clientTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {clientTypeData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
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

      {/* Contract Status + Expiring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <h2 className={`font-bold text-brand-900 mb-2 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'حالة العقود' : 'Contract Status'}</h2>
          <div className="h-48" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={contractStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                  {contractStatusData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
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

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <Link to="/contracts?status=approved" className="text-xs font-semibold text-brand-500 hover:text-brand-700 flex items-center gap-1">
              {isAr ? 'عرض الكل' : 'View all'} <ArrowLeft className="w-3 h-3" />
            </Link>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-brand-900">{isAr ? 'عقود تنتهي خلال 30 يوم' : 'Contracts expiring in 30 days'}</h2>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          {data.expiringIn30.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-brand-400 text-sm">{isAr ? 'لا توجد عقود تنتهي قريباً' : 'No contracts expiring soon'}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.expiringIn30.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50/40 border border-amber-100/60 hover:bg-amber-50 transition-colors">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${(c.daysUntilExpiry || 0) <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.daysUntilExpiry} {isAr ? 'يوم' : 'days'}
                  </span>
                  <div className={isAr ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-sm text-brand-900">{c.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{c.hotel?.name} · {c.salesRep?.name} · {c.endDate ? format(parseISO(c.endDate), 'dd MMM', { locale }) : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-ups + At Risk + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <div className={`flex items-center gap-2 mb-4 ${isAr ? 'justify-end' : 'justify-start'}`}>
            {!isAr && <Clock className="w-4 h-4 text-brand-500" />}
            <h2 className="font-bold text-brand-900">{isAr ? 'المتابعات القادمة' : 'Upcoming Follow-ups'}</h2>
            {isAr && <Clock className="w-4 h-4 text-brand-500" />}
          </div>
          {data.upcomingFollowUps.length === 0 ? (
            <p className="text-brand-400 text-sm text-center py-8">{isAr ? 'لا توجد متابعات' : 'No follow-ups'}</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingFollowUps.map(v => (
                <Link key={v.id} to={`/clients/${v.clientId}`}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-brand-50/40 border border-brand-100/60 hover:bg-brand-50 transition-colors ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <div className={`min-w-0 flex-1 ${isAr ? 'text-right' : 'text-left'}`}>
                    <p className="font-semibold text-sm text-brand-900 truncate">{v.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{v.nextFollowUp ? format(parseISO(v.nextFollowUp), 'dd MMM', { locale }) : '-'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className={`flex items-center gap-2 mb-4 ${isAr ? 'justify-end' : 'justify-start'}`}>
            {!isAr && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            <h2 className="font-bold text-brand-900">{isAr ? 'عملاء في خطر' : 'At-Risk Clients'}</h2>
            {isAr && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </div>
          {data.atRiskClients.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-brand-400 text-sm">{isAr ? 'لا يوجد عملاء في خطر' : 'No at-risk clients'}</p>
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
                  <div className={isAr ? 'text-right' : 'text-left'}>
                    <p className="text-sm font-semibold text-brand-900">{p.client?.companyName}</p>
                    <p className="text-xs text-brand-400">{p.daysSinceLastVisit} {isAr ? 'يوم منذ آخر زيارة' : 'days since last visit'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className={`font-bold text-brand-900 mb-4 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'النشاط الأخير' : 'Recent Activity'}</h2>
          {data.recentActivities.length === 0 ? (
            <p className="text-brand-400 text-sm text-center py-8">{isAr ? 'لا يوجد نشاط' : 'No activity'}</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentActivities.slice(0, 6).map(a => {
                const icons: Record<string, string> = {
                  note: '📝', call: '📞', email: '✉️', meeting: '🤝',
                  visit: '🗺️', whatsapp: '💬', contract_upload: '📄', contract_approval: '✅'
                };
                return (
                  <div key={a.id} className={`flex items-start gap-2.5 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <span className="text-sm mt-0.5 w-6 text-center flex-shrink-0">{icons[a.type] || '📌'}</span>
                    <div className={`min-w-0 flex-1 border-brand-100 ${isAr ? 'text-right border-r-2 pr-3' : 'text-left border-l-2 pl-3'}`}>
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

      {/* Team Table */}
      {data.teamPerformance.length > 0 && (
        <div className="card overflow-hidden">
          <div className={`p-5 pb-3 flex items-center gap-2 ${isAr ? 'justify-end' : 'justify-start'}`}>
            {!isAr && <Users className="w-4 h-4 text-brand-500" />}
            <h2 className="font-bold text-brand-900">{isAr ? 'تفاصيل أداء الفريق' : 'Team Performance Details'}</h2>
            {isAr && <Users className="w-4 h-4 text-brand-500" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-50/50">
                  {isAr ? (
                    <>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">الأداء</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">الزيارات</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">العقود</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">العملاء</th>
                      <th className="px-5 py-3 text-right font-semibold text-brand-500 text-xs">المندوب</th>
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-3 text-left font-semibold text-brand-500 text-xs">Sales Rep</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">Clients</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">Contracts</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">Visits</th>
                      <th className="px-5 py-3 text-center font-semibold text-brand-500 text-xs">Performance</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {data.teamPerformance.map(member => {
                  const total = member._count.assignedClients + member._count.contracts + member._count.visits;
                  const maxTotal = Math.max(...data.teamPerformance.map(m => m._count.assignedClients + m._count.contracts + m._count.visits), 1);
                  const pct = Math.round((total / maxTotal) * 100);
                  const nameCell = (
                    <td className={`px-5 py-3.5 ${isAr ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-center gap-2.5 ${isAr ? 'justify-end' : 'justify-start'}`}>
                        {!isAr && <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{member.name.charAt(0)}</div>}
                        <span className="font-bold text-brand-900">{member.name}</span>
                        {isAr && <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{member.name.charAt(0)}</div>}
                      </div>
                    </td>
                  );
                  const perfCell = (
                    <td className="px-5 py-3.5">
                      <div className="w-20 mx-auto">
                        <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-700 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                  );
                  return (
                    <tr key={member.id} className="hover:bg-brand-50/30 transition-colors">
                      {isAr && perfCell}
                      <td className="px-5 py-3.5 text-center font-semibold text-brand-700">{member._count.visits}</td>
                      <td className="px-5 py-3.5 text-center font-semibold text-brand-700">{member._count.contracts}</td>
                      <td className="px-5 py-3.5 text-center font-semibold text-brand-700">{member._count.assignedClients}</td>
                      {isAr ? nameCell : null}
                      {!isAr ? nameCell : null}
                      {!isAr && perfCell}
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
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [confirmationFile, setConfirmationFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [hotelFilter, setHotelFilter] = useState<string>('');

  const loadContracts = () => {
    contractsApi.getAll({ status: 'approved' }).then(r => {
      const sorted = r.data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setContracts(sorted);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { loadContracts(); }, []);

  // Apply filters
  const filtered = contracts.filter(c => {
    if (statusFilter === 'pending' && c.bookingConfirmed) return false;
    if (statusFilter === 'confirmed' && !c.bookingConfirmed) return false;
    if (hotelFilter && c.hotel?.name !== hotelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.client?.companyName || '').toLowerCase().includes(q)
        || (c.contractRef || '').toLowerCase().includes(q)
        || (c.hotel?.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueHotels = Array.from(new Set(contracts.map(c => c.hotel?.name).filter(Boolean)));

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setConfirming(confirmModal.id);
    try {
      await contractsApi.confirmBooking(confirmModal.id, bookingNotes, confirmationFile || undefined);
      setConfirmModal(null); setBookingNotes(''); setConfirmationFile(null); loadContracts();
    } catch { alert(isAr ? 'فشل التأكيد' : 'Failed'); }
    finally { setConfirming(null); }
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const pendingBooking = contracts.filter(c => !c.bookingConfirmed);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const ContractCard = ({ c, isNew }: { c: any; isNew: boolean }) => (
    <div className={`card p-5 ${c.bookingConfirmed ? (isAr ? 'border-r-4 border-r-emerald-500 bg-emerald-50/20' : 'border-l-4 border-l-emerald-500 bg-emerald-50/20') : isNew ? (isAr ? 'border-r-4 border-r-amber-500' : 'border-l-4 border-l-amber-500') : ''}`}>
      <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-1 ${isAr ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'justify-end' : 'justify-start'}`}>
            {c.bookingConfirmed ? (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">✓ {isAr ? 'تم تأكيد الحجز' : 'Booking Confirmed'}</span>
            ) : isNew ? (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">{isAr ? 'جديد - يحتاج حجز' : 'New - Needs Booking'}</span>
            ) : (
              <span className="text-[10px] font-bold bg-brand-50 text-brand-600 px-2 py-0.5 rounded-md">{isAr ? 'في انتظار الحجز' : 'Pending Booking'}</span>
            )}
            <p className="font-bold text-brand-900">{c.client?.companyName}</p>
          </div>
          <p className="text-xs text-brand-400 mt-1">{c.hotel?.name} · {c.contractRef || `#${c.id}`}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center p-3 rounded-lg bg-brand-50/50">
          <p className="text-xs text-brand-400">{isAr ? 'عدد الغرف' : 'Rooms'}</p>
          <p className="text-xl font-bold text-brand-900 mt-1">{c.roomsCount || '—'}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-amber-50/50">
          <p className="text-xs text-brand-400">{isAr ? 'سعر الغرفة/ليلة' : 'Rate/Night'}</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{c.ratePerRoom ? `${c.ratePerRoom} ${isAr ? 'ر.س' : 'SAR'}` : '—'}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-emerald-50/50">
          <p className="text-xs text-brand-400">{isAr ? 'القيمة الإجمالية' : 'Total Value'}</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{c.totalValue ? `${(c.totalValue / 1000).toFixed(0)}K` : '—'}</p>
        </div>
      </div>

      <div className={`flex items-center justify-between mt-3 text-xs text-brand-400 ${isAr ? 'flex-row-reverse' : ''}`}>
        <span>📅 {c.startDate ? format(parseISO(c.startDate), 'dd MMM yyyy', { locale }) : '—'} → {c.endDate ? format(parseISO(c.endDate), 'dd MMM yyyy', { locale }) : '—'}</span>
        <span>👤 {c.salesRep?.name}</span>
      </div>

      {c.bookingConfirmed ? (
        <div className={`mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs ${isAr ? 'text-right' : 'text-left'}`}>
          <p className="text-emerald-700 font-semibold">
            {isAr ? '✓ تم تأكيد الحجز في ' : '✓ Booking confirmed on '}
            {c.bookingConfirmedAt ? format(parseISO(c.bookingConfirmedAt), 'dd MMM yyyy', { locale }) : ''}
          </p>
          {c.bookingNotes && <p className="text-emerald-600 mt-1">{c.bookingNotes}</p>}
          {c.confirmationLetterUrl && (
            <a href={c.confirmationLetterUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-emerald-700 hover:text-emerald-900 font-semibold underline">
              📎 {c.confirmationLetterName || (isAr ? 'ملف التأكيد' : 'Confirmation Letter')}
            </a>
          )}
        </div>
      ) : (
        <button
          onClick={() => { setConfirmModal(c); setBookingNotes(''); setConfirmationFile(null); }}
          className="w-full mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
          ✓ {isAr ? 'تأكيد حجز الغرف' : 'Confirm Room Booking'}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card p-6 bg-gradient-to-l from-brand-800 to-brand-900 border-0">
        <div className={`flex items-center justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
          <div className={isAr ? 'text-right' : 'text-left'}>
            <h1 className="text-2xl font-bold text-white">{isAr ? 'قسم الحجوزات' : 'Reservations'}</h1>
            <p className="text-brand-200 text-sm mt-1">{isAr ? 'العقود المعتمدة وأسعار الغرف' : 'Approved contracts and room rates'}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center text-white">
              <p className="text-2xl font-bold text-amber-300">{pendingBooking.length}</p>
              <p className="text-xs text-brand-200">{isAr ? 'في انتظار الحجز' : 'Pending booking'}</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center text-white">
              <p className="text-2xl font-bold text-emerald-300">{contracts.filter(c => c.bookingConfirmed).length}</p>
              <p className="text-xs text-brand-200">{isAr ? 'تم حجزها' : 'Booked'}</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center text-white">
              <p className="text-2xl font-bold">{contracts.length}</p>
              <p className="text-xs text-brand-200">{isAr ? 'الإجمالي' : 'Total'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <input className={`input ${isAr ? 'pr-9 text-right' : 'pl-9'}`}
            placeholder={isAr ? 'ابحث باسم الشركة أو رقم العقد أو الفندق...' : 'Search by company, contract ref or hotel...'}
            value={search} onChange={e => setSearch(e.target.value)} />
          <span className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-brand-400`}>🔍</span>
        </div>
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="pending">{isAr ? '⏳ في انتظار الحجز' : '⏳ Pending booking'}</option>
          <option value="confirmed">{isAr ? '✓ تم تأكيد الحجز' : '✓ Booking confirmed'}</option>
        </select>
        <select className="input w-52" value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}>
          <option value="">{isAr ? 'كل الفنادق' : 'All hotels'}</option>
          {uniqueHotels.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        {(search || statusFilter !== 'all' || hotelFilter) && (
          <button className="btn-secondary text-xs" onClick={() => { setSearch(''); setStatusFilter('all'); setHotelFilter(''); }}>
            {isAr ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        )}
      </div>

      {/* Results */}
      <div>
        <h2 className={`font-bold text-brand-900 mb-3 ${isAr ? 'text-right' : 'text-left'}`}>
          {isAr ? `النتائج (${filtered.length})` : `Results (${filtered.length})`}
        </h2>
        {filtered.length === 0 ? (
          <div className="card py-16 text-center">
            <FileText className="w-12 h-12 text-brand-200 mx-auto mb-3" />
            <p className="text-brand-400">{isAr ? 'لا توجد نتائج' : 'No results'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(c => <ContractCard key={c.id} c={c} isNew={new Date(c.createdAt) >= sevenDaysAgo} />)}
          </div>
        )}
      </div>

      {/* Confirm Booking Modal */}
      <Modal open={!!confirmModal} onClose={() => setConfirmModal(null)} title={isAr ? 'تأكيد حجز الغرف' : 'Confirm Room Booking'}>
        {confirmModal && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm ${isAr ? 'text-right' : 'text-left'}`}>
              <p className="font-bold text-emerald-800">{confirmModal.client?.companyName}</p>
              <p className="text-xs text-emerald-700 mt-1">{confirmModal.hotel?.name} · {confirmModal.contractRef || `#${confirmModal.id}`}</p>
              <p className="text-xs text-emerald-600 mt-1">
                {confirmModal.roomsCount} {isAr ? 'غرفة' : 'rooms'} × {confirmModal.ratePerRoom} {isAr ? 'ر.س/ليلة' : 'SAR/night'}
              </p>
            </div>

            <div className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
              (confirmModal as any).fileUrl ? 'bg-brand-50/60 border-brand-200' : 'bg-gray-50 border-gray-200'
            } ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 min-w-0 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
                <FileText className={`w-4 h-4 flex-shrink-0 ${(confirmModal as any).fileUrl ? 'text-brand-600' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-brand-900">{isAr ? 'ملف العقد المرفوع' : 'Uploaded Contract File'}</p>
                  <p className="text-[11px] text-brand-400 truncate">
                    {(confirmModal as any).fileUrl
                      ? ((confirmModal as any).fileName || (isAr ? 'العقد.pdf' : 'contract.pdf'))
                      : (isAr ? 'لا يوجد ملف مرفوع' : 'No file uploaded')}
                  </p>
                </div>
              </div>
              <div className={`flex gap-1 flex-shrink-0 ${isAr ? 'flex-row-reverse' : ''}`}>
                <button type="button"
                  onClick={async () => {
                    if (!(confirmModal as any).fileUrl) return;
                    const res = await contractsApi.download(confirmModal.id);
                    const ext = (confirmModal as any).fileName?.split('.').pop()?.toLowerCase();
                    const mime = ext === 'pdf' ? 'application/pdf'
                      : ext === 'png' ? 'image/png'
                      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                      : 'application/octet-stream';
                    const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
                    window.open(url, '_blank');
                  }}
                  disabled={!(confirmModal as any).fileUrl}
                  className="p-1.5 rounded-lg text-brand-500 enabled:hover:bg-emerald-50 enabled:hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isAr ? 'اطلاع' : 'Preview'}>
                  <Eye className="w-4 h-4" />
                </button>
                <button type="button"
                  onClick={async () => {
                    if (!(confirmModal as any).fileUrl) return;
                    const res = await contractsApi.download(confirmModal.id);
                    const url = URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = (confirmModal as any).fileName || 'contract.pdf';
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!(confirmModal as any).fileUrl}
                  className="p-1.5 rounded-lg text-brand-500 enabled:hover:bg-brand-100 enabled:hover:text-brand-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isAr ? 'تنزيل' : 'Download'}>
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="label">{isAr ? 'ملاحظات الحجز (رقم الحجز، التواريخ، إلخ)' : 'Booking Notes (booking ref, dates, etc.)'}</label>
              <textarea className="input resize-none" rows={3} value={bookingNotes}
                onChange={e => setBookingNotes(e.target.value)}
                placeholder={isAr ? 'مثال: رقم الحجز BK-12345، تاريخ الوصول...' : 'e.g. Booking ref BK-12345, check-in date...'} />
            </div>
            <div>
              <label className="label">
                📎 {isAr ? 'ملف تأكيد الحجز (Confirmation Letter من Opera Cloud)' : 'Confirmation Letter (from Opera Cloud)'}
              </label>
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={e => setConfirmationFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-brand-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-emerald-200 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer" />
              {confirmationFile && (
                <p className="text-xs text-emerald-600 mt-1">✓ {confirmationFile.name} ({(confirmationFile.size / 1024).toFixed(0)} KB)</p>
              )}
              <p className="text-[11px] text-brand-400 mt-1">
                {isAr ? '💡 الملف ده هيتبعت كمرفق مع إيميل تأكيد الحجز للعميل' : '💡 This file will be attached to the booking confirmation email'}
              </p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button className="btn-primary flex-1 justify-center bg-emerald-600 hover:bg-emerald-700"
                onClick={handleConfirm} disabled={confirming === confirmModal.id}>
                {confirming === confirmModal.id ? (isAr ? 'جاري التأكيد...' : 'Confirming...') : `✓ ${isAr ? 'تأكيد الحجز' : 'Confirm Booking'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
