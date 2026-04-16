import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, FileText, MapPin,
  Hotel, CreditCard, Target, CheckSquare, Trophy, CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface NavItem { to: string; icon: any; labelKey: TranslationKey; badge?: string; roles?: string[] }

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav_dashboard' },
  { to: '/clients', icon: Building2, labelKey: 'nav_clients', roles: ['general_manager', 'vice_gm', 'sales_director', 'sales_rep', 'contract_officer'] },
  { to: '/contracts', icon: FileText, labelKey: 'nav_contracts' },
  { to: '/visits', icon: MapPin, labelKey: 'nav_visits', roles: ['general_manager', 'vice_gm', 'sales_director', 'sales_rep', 'contract_officer'] },
  { to: '/payments', icon: CreditCard, labelKey: 'nav_payments', roles: ['general_manager', 'vice_gm', 'sales_director', 'sales_rep', 'contract_officer'] },
  { to: '/targets', icon: Target, labelKey: 'nav_targets', roles: ['general_manager', 'vice_gm', 'sales_director', 'sales_rep'] },
  { to: '/calendar', icon: CalendarDays, labelKey: 'nav_calendar' },
  { to: '/tasks', icon: CheckSquare, labelKey: 'nav_tasks', roles: ['general_manager', 'vice_gm', 'sales_director', 'sales_rep'] },
  { to: '/leaderboard', icon: Trophy, labelKey: 'nav_leaderboard', roles: ['general_manager', 'vice_gm', 'sales_director', 'sales_rep'] },
  { to: '/users', icon: Users, labelKey: 'nav_users', roles: ['general_manager', 'vice_gm', 'sales_director'] },
  { to: '/hotels', icon: Hotel, labelKey: 'nav_hotels', roles: ['general_manager', 'vice_gm'] },
];

export default function Sidebar({ open }: { open: boolean }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const visible = navItems.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  const roleKey = user?.role as any;
  const roleLabel = user ? t(`role_${roleKey}` as any) : '';

  return (
    <aside className={`${open ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-brand-900 flex flex-col flex-shrink-0`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-9 flex-shrink-0 object-contain" />
          <div>
            <div className="text-white font-bold text-sm leading-tight tracking-wide">Ewaa Hotels</div>
            <div className="text-brand-400 text-[10px] font-medium">Sales & Contracts</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider px-3 mb-3">القائمة الرئيسية</p>
        {visible.map(({ to, icon: Icon, labelKey, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="whitespace-nowrap">{t(labelKey)}{badge ? ` ${badge}` : ''}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.04]">
          <div className="w-9 h-9 rounded-lg bg-accent-500/20 flex items-center justify-center text-accent-400 font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-brand-400 text-xs truncate">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
