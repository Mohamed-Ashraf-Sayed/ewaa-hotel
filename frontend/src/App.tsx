import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PortalAuthProvider, usePortalAuth } from './contexts/PortalAuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import PortalLogin from './pages/portal/Login';
import PortalDashboard from './pages/portal/Dashboard';
import PortalMyBookings from './pages/portal/MyBookings';
import PortalBookingRequest from './pages/portal/BookingRequest';
import PortalBookingDetail from './pages/portal/BookingDetail';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Contracts from './pages/Contracts';
import Visits from './pages/Visits';
import Users from './pages/Users';

import Hotels from './pages/Hotels';
import Payments from './pages/Payments';
import CreditPayments from './pages/CreditPayments';
import Targets from './pages/Targets';
import Tasks from './pages/Tasks';
import Leaderboard from './pages/Leaderboard';
import Calendar from './pages/Calendar';
import Reports from './pages/Reports';
import OrgChart from './pages/OrgChart';
import Chat from './pages/Chat';
import Inbox from './pages/Inbox';
import Bookings from './pages/Bookings';
import Quotes from './pages/Quotes';
import Marketing from './pages/Marketing';
import Permissions from './pages/Permissions';
import AuditLog from './pages/AuditLog';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50/50">
      <div className="w-8 h-8 border-3 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  // Force users with a fresh / admin-reset password to set their own before going anywhere else.
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { client, isLoading } = usePortalAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50/50">
      <div className="w-8 h-8 border-3 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!client) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

function PortalLoginGuard() {
  const { client } = usePortalAuth();
  if (client) return <Navigate to="/portal" replace />;
  return <PortalLogin />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* === Internal CRM === */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/change-password" element={
        !user ? <Navigate to="/login" replace />
          : !user.mustChangePassword ? <Navigate to="/" replace />
          : <ChangePassword />
      } />

      {/* === Client Portal (separate auth) === */}
      <Route path="/portal/login" element={<PortalLoginGuard />} />
      <Route path="/portal" element={<PortalProtectedRoute><PortalLayout /></PortalProtectedRoute>}>
        <Route index element={<PortalDashboard />} />
        <Route path="bookings" element={<PortalMyBookings />} />
        <Route path="book" element={<PortalBookingRequest />} />
        <Route path="booking/:id" element={<PortalBookingDetail />} />
      </Route>

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="visits" element={<Visits />} />

        <Route path="users" element={<Users />} />
        <Route path="hotels" element={<Hotels />} />
        <Route path="payments" element={<Payments />} />
        <Route path="credit-payments" element={<CreditPayments />} />
        <Route path="targets" element={<Targets />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="reports" element={<Reports />} />
        <Route path="org-chart" element={<OrgChart />} />
        <Route path="chat" element={<Chat />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="permissions" element={<Permissions />} />
        <Route path="audit-log" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <PortalAuthProvider>
            <AppRoutes />
          </PortalAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
