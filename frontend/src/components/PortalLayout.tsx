import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Hotel, ListChecks, Plus, LayoutDashboard } from 'lucide-react';
import { usePortalAuth } from '../contexts/PortalAuthContext';

export default function PortalLayout() {
  const { client, logout } = usePortalAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/portal/login'); };

  return (
    <div dir="rtl" className="min-h-screen bg-brand-50/40">
      {/* Header */}
      <header className="bg-brand-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-white.svg" alt="Ewaa Hotels" className="h-9 object-contain" />
            <div>
              <div className="font-bold text-base leading-tight">بوابة العملاء</div>
              <div className="text-brand-300 text-[11px]">Ewaa Hotels — Client Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{client?.companyName}</div>
              <div className="text-[11px] text-brand-300">{client?.contactPerson}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
            >
              <LogOut className="w-4 h-4" /> خروج
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 border-t border-white/[0.06]">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${isActive ? 'border-accent-400 text-white' : 'border-transparent text-brand-300 hover:text-white'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> نظرة عامة
          </NavLink>
          <NavLink
            to="/portal/bookings"
            className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${isActive ? 'border-accent-400 text-white' : 'border-transparent text-brand-300 hover:text-white'}`}
          >
            <ListChecks className="w-4 h-4" /> حجوزاتي
          </NavLink>
          <NavLink
            to="/portal/book"
            className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${isActive ? 'border-accent-400 text-white' : 'border-transparent text-brand-300 hover:text-white'}`}
          >
            <Plus className="w-4 h-4" /> طلب حجز جديد
          </NavLink>
        </nav>
      </header>

      {/* Sales rep banner */}
      {client?.salesRep && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-2 text-xs text-amber-900 flex items-center gap-2">
            <Hotel className="w-3.5 h-3.5" />
            <span>مندوب المبيعات: <b>{client.salesRep.name}</b></span>
            {client.salesRep.phone && <span>· {client.salesRep.phone}</span>}
            {client.salesRep.email && <span>· {client.salesRep.email}</span>}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
