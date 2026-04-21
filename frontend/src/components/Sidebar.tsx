import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, FileText, MapPin,
  Hotel, CreditCard, Target, CheckSquare, Trophy, CalendarDays, X, BarChart3, Network, MessageCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { messagesApi } from '../services/api';

interface NavItem { to: string; icon: any; labelKey: TranslationKey; badge?: string; roles?: string[] }

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav_dashboard' },
  { to: '/clients', icon: Building2, labelKey: 'nav_clients', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep', 'contract_officer'] },
  { to: '/contracts', icon: FileText, labelKey: 'nav_contracts' },
  { to: '/visits', icon: MapPin, labelKey: 'nav_visits', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep', 'contract_officer'] },
  { to: '/payments', icon: CreditCard, labelKey: 'nav_payments', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep', 'contract_officer'] },
  { to: '/targets', icon: Target, labelKey: 'nav_targets', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep'] },
  { to: '/calendar', icon: CalendarDays, labelKey: 'nav_calendar' },
  { to: '/chat', icon: MessageCircle, labelKey: 'nav_chat' },
  { to: '/tasks', icon: CheckSquare, labelKey: 'nav_tasks', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep'] },
  { to: '/leaderboard', icon: Trophy, labelKey: 'nav_leaderboard', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep'] },
  { to: '/reports', icon: BarChart3, labelKey: 'nav_reports', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales'] },
  { to: '/users', icon: Users, labelKey: 'nav_users', roles: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales'] },
  { to: '/org-chart', icon: Network, labelKey: 'nav_org_chart', roles: ['admin', 'general_manager', 'vice_gm'] },
  { to: '/hotels', icon: Hotel, labelKey: 'nav_hotels', roles: ['admin', 'general_manager', 'vice_gm'] },
];

interface SidebarProps { open: boolean; isMobile?: boolean; onClose?: () => void }

export default function Sidebar({ open, isMobile, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [unreadChat, setUnreadChat] = useState(0);

  useEffect(() => {
    const load = () => {
      messagesApi.getUnreadCount().then(r => setUnreadChat(r.data.count || 0)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const visible = navItems.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  const roleKey = user?.role as any;
  const roleLabel = user ? t(`role_${roleKey}` as any) : '';

  const handleNavClick = () => { if (isMobile && onClose) onClose(); };

  return (
    <aside className={`
      ${isMobile ? 'fixed inset-y-0 right-0 z-50' : 'relative'}
      ${open ? 'w-64' : 'w-0'}
      transition-all duration-300 overflow-hidden bg-brand-900 flex flex-col flex-shrink-0
    `}>
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-8 flex-shrink-0 object-contain" />
          <div>
            <div className="text-white font-bold text-sm leading-tight tracking-wide">Ewaa Hotels</div>
            <div className="text-brand-400 text-[10px] font-medium">Sales & Contracts</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider px-3 mb-2">
          {isAr ? 'القائمة الرئيسية' : 'Main Menu'}
        </p>
        {visible.map(({ to, icon: Icon, labelKey, badge }) => {
          const showChatBadge = to === '/chat' && unreadChat > 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="whitespace-nowrap flex-1">{t(labelKey)}{badge ? ` ${badge}` : ''}</span>
              {showChatBadge && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.04]">
          <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center text-accent-400 font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-brand-400 text-[11px] truncate">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
