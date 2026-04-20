import { useEffect, useState } from 'react';
import { Users as UsersIcon, ChevronDown, ChevronLeft, ChevronRight, Crown, Briefcase, User as UserIcon, Building2 } from 'lucide-react';
import { usersApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

interface OrgUser {
  id: number; name: string; role: string; managerId: number | null;
  _count?: { assignedClients: number };
}

const ROLE_AR: Record<string, string> = {
  admin: 'مدير النظام',
  general_manager: 'مدير عام',
  vice_gm: 'نائب المدير العام',
  sales_director: 'مدير مبيعات',
  assistant_sales: 'مساعد مدير المبيعات',
  sales_rep: 'مندوب مبيعات',
  contract_officer: 'مسئول العقود',
  reservations: 'قسم الحجوزات',
  credit_manager: 'مدير الائتمان',
  credit_officer: 'موظف ائتمان',
};
const ROLE_EN: Record<string, string> = {
  admin: 'IT Admin',
  general_manager: 'General Manager',
  vice_gm: 'Vice GM',
  sales_director: 'Sales Director',
  assistant_sales: 'Assistant Sales Manager',
  sales_rep: 'Sales Rep',
  contract_officer: 'Contract Officer',
  reservations: 'Reservations',
  credit_manager: 'Credit Manager',
  credit_officer: 'Credit Officer',
};

const roleColor: Record<string, { bg: string; text: string; ring: string; icon: any }> = {
  admin: { bg: 'bg-slate-900', text: 'text-white', ring: 'ring-slate-700', icon: Crown },
  general_manager: { bg: 'bg-purple-600', text: 'text-white', ring: 'ring-purple-300', icon: Crown },
  vice_gm: { bg: 'bg-indigo-600', text: 'text-white', ring: 'ring-indigo-300', icon: Briefcase },
  sales_director: { bg: 'bg-blue-600', text: 'text-white', ring: 'ring-blue-300', icon: Briefcase },
  assistant_sales: { bg: 'bg-cyan-500', text: 'text-white', ring: 'ring-cyan-200', icon: Briefcase },
  sales_rep: { bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-200', icon: UserIcon },
  contract_officer: { bg: 'bg-amber-500', text: 'text-white', ring: 'ring-amber-200', icon: Briefcase },
  credit_manager: { bg: 'bg-rose-500', text: 'text-white', ring: 'ring-rose-200', icon: Briefcase },
  credit_officer: { bg: 'bg-pink-500', text: 'text-white', ring: 'ring-pink-200', icon: UserIcon },
  reservations: { bg: 'bg-teal-500', text: 'text-white', ring: 'ring-teal-200', icon: Building2 },
};

interface NodeProps { user: OrgUser; users: OrgUser[]; isAr: boolean; level?: number; }

function OrgNode({ user, users, isAr, level = 0 }: NodeProps) {
  const [expanded, setExpanded] = useState(true);
  const children = users.filter(u => u.managerId === user.id);
  const ROLE = isAr ? ROLE_AR : ROLE_EN;
  const c = roleColor[user.role] || roleColor.sales_rep;
  const Icon = c.icon;

  // Total team size (recursive count)
  const countTeam = (u: OrgUser): number => {
    const direct = users.filter(x => x.managerId === u.id);
    return direct.length + direct.reduce((sum, child) => sum + countTeam(child), 0);
  };
  const teamSize = countTeam(user);

  // Horizontal layout: parent on (right for AR / left for EN), children expand outward stacked vertically
  return (
    <div className={`flex items-center ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Node */}
      <div className="relative group flex-shrink-0">
        <div className={`${c.bg} ${c.text} rounded-lg shadow-md ring-2 ${c.ring} px-3 py-1.5 min-w-[160px] transition-all hover:scale-105`}>
          <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className={`min-w-0 flex-1 ${isAr ? 'text-right' : 'text-left'}`}>
              <p className="font-bold text-[11px] truncate leading-tight">{user.name}</p>
              <div className={`flex items-center gap-1 text-[9px] opacity-90 ${isAr ? 'flex-row-reverse' : ''}`}>
                <Icon className="w-2.5 h-2.5" />
                <span className="truncate">{ROLE[user.role] || user.role}</span>
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-2 mt-1 pt-1 border-t border-white/20 text-[9px] ${isAr ? 'flex-row-reverse' : ''}`}>
            {user._count && (
              <span className="flex items-center gap-0.5">
                <Building2 className="w-2.5 h-2.5" /> {user._count.assignedClients}
              </span>
            )}
            {teamSize > 0 && (
              <span className="flex items-center gap-0.5">
                <UsersIcon className="w-2.5 h-2.5" /> {teamSize}
              </span>
            )}
          </div>
          {/* Expand toggle (horizontal arrow) */}
          {children.length > 0 && (
            <button onClick={() => setExpanded(!expanded)}
              className={`absolute top-1/2 -translate-y-1/2 ${isAr ? '-left-2.5' : '-right-2.5'} w-5 h-5 rounded-full bg-white shadow-md border border-brand-200 flex items-center justify-center hover:bg-brand-50 z-10`}>
              {isAr ? (
                <ChevronLeft className={`w-3 h-3 text-brand-700 transition-transform ${expanded ? '' : 'rotate-180'}`} />
              ) : (
                <ChevronRight className={`w-3 h-3 text-brand-700 transition-transform ${expanded ? '' : '-rotate-180'}`} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Children (horizontal expansion) */}
      {children.length > 0 && expanded && (
        <>
          {/* Horizontal connector from parent */}
          <div className="w-6 h-0.5 bg-brand-300 flex-shrink-0" />

          {/* Children stack vertically */}
          <div className="flex flex-col gap-2 relative">
            {/* Vertical line connecting all children if more than 1 */}
            {children.length > 1 && (
              <div
                className={`absolute top-0 bottom-0 w-0.5 bg-brand-300 ${isAr ? 'right-0' : 'left-0'}`}
                style={{ [isAr ? 'right' : 'left']: '-1px' } as any}
              />
            )}
            {children.map(child => (
              <div key={child.id} className={`flex items-center ${isAr ? 'flex-row-reverse' : 'flex-row'} relative`}>
                {/* Short horizontal stub from vertical line to child */}
                {children.length > 1 && (
                  <div className={`w-3 h-0.5 bg-brand-300 flex-shrink-0`} />
                )}
                <OrgNode user={child} users={users} isAr={isAr} level={level + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChart() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getOrgChart().then(r => setUsers(r.data)).finally(() => setLoading(false));
  }, []);

  // Find root nodes (no manager)
  const roots = users.filter(u => !u.managerId);

  // Group by role for stats
  const stats = {
    total: users.length,
    directors: users.filter(u => u.role === 'sales_director').length,
    reps: users.filter(u => u.role === 'sales_rep').length,
    others: users.filter(u => !['sales_director', 'sales_rep', 'assistant_sales'].includes(u.role)).length,
  };

  return (
    <div className="space-y-5">
      <div className={isAr ? 'text-right' : 'text-left'}>
        <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'الهيكل التنظيمي' : 'Organization Chart'}</h1>
        <p className="text-brand-400 text-sm mt-0.5">
          {isAr ? 'شجرة تفاعلية للمستخدمين والإدارات' : 'Interactive tree of users and departments'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: isAr ? 'إجمالي الموظفين' : 'Total Staff', value: stats.total, icon: UsersIcon, color: 'bg-brand-50 text-brand-700' },
          { label: isAr ? 'مديري المبيعات' : 'Sales Directors', value: stats.directors, icon: Briefcase, color: 'bg-blue-50 text-blue-700' },
          { label: isAr ? 'مندوبي المبيعات' : 'Sales Reps', value: stats.reps, icon: UserIcon, color: 'bg-emerald-50 text-emerald-700' },
          { label: isAr ? 'وظائف أخرى' : 'Other Roles', value: stats.others, icon: Building2, color: 'bg-amber-50 text-amber-700' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className={isAr ? 'text-right' : 'text-left'}>
                <p className="text-xl font-bold text-brand-900">{s.value}</p>
                <p className="text-[11px] text-brand-400">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Org Chart */}
      <div className="card p-6 overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : roots.length === 0 ? (
          <div className="py-12 text-center text-brand-400">{isAr ? 'لا يوجد موظفين' : 'No users'}</div>
        ) : (
          <div className={`min-w-max flex flex-col gap-6 py-3 px-4 ${isAr ? 'items-end' : 'items-start'}`}>
            {roots.map(root => (
              <OrgNode key={root.id} user={root} users={users} isAr={isAr} />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4">
        <h3 className={`font-bold text-brand-900 text-sm mb-3 ${isAr ? 'text-right' : 'text-left'}`}>
          {isAr ? 'الألوان والأدوار' : 'Roles & Colors'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(roleColor).map(([role, c]) => {
            const ROLE = isAr ? ROLE_AR : ROLE_EN;
            return (
              <span key={role} className={`${c.bg} ${c.text} px-3 py-1 rounded-full text-xs font-semibold`}>
                {ROLE[role] || role}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
