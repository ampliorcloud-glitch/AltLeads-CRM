import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SalesShellProvider } from './contexts/SalesShellContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { LoginPage } from './pages/LoginPage';
import { SalesLoginPage } from './pages/sales/SalesLoginPage';
import { SalesPlaceholderPage } from './pages/sales/SalesPlaceholderPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadFormPage } from './pages/LeadFormPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { WishlistDetailPage } from './pages/WishlistDetailPage';
import AdminPage from './pages/AdminPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactFormPage } from './pages/ContactFormPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { CompanyFormPage } from './pages/CompanyFormPage';

/** Shared full-screen loading spinner used while auth/roles hydrate. */
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafafa' }}>
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Guards the internal CRM routes. Requires a session. Additionally, a PURE sales
 * user (has a sales role but no internal role) is bounced to the Sales Portal so
 * they never see internal pages. Internal users (incl. admins who may also hold a
 * sales role) keep full access.
 *
 * Note: we wait for `loading` to clear before evaluating roles — otherwise a sales
 * user could be momentarily mis-classified as internal (empty roles) and flash the
 * internal app, or vice-versa. `loading` only clears once the profile + roles resolve.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isSalesUser, isInternalUser } = useAuth();

  // While session/roles are being hydrated, show nothing (avoids flash redirect)
  if (loading) return <RouteLoader />;

  if (!session) return <Navigate to="/" replace />;

  // Pure sales user (sales role, no internal role) → send to the Sales Portal.
  if (isSalesUser && !isInternalUser) return <Navigate to="/sales" replace />;

  return <>{children}</>;
}

/**
 * Guards the Sales Portal routes (/sales/*). Requires a session AND that the user
 * is either a sales user OR an internal user — i.e. sales staff use it day-to-day,
 * and internal staff (e.g. admins) may also view it. Not logged in → /sales/login.
 */
function SalesProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isSalesUser, isInternalUser } = useAuth();

  if (loading) return <RouteLoader />;

  if (!session) return <Navigate to="/sales/login" replace />;

  // Logged in but neither sales nor internal — no portal access.
  if (!isSalesUser && !isInternalUser) return <Navigate to="/sales/login" replace />;

  // Wrap in the sales-shell provider so AppShell/Sidebar render the sales nav
  // for the reused LeadsPage / LeadDetailPage without touching those pages.
  return <SalesShellProvider>{children}</SalesShellProvider>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      {/* Internal login is also reachable at /login (footer link target from /sales/login) */}
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* ───────────────────────── Sales Portal (/sales/*) ─────────────────────────
         Additive shell behind its own route tree. Sales users land here; internal
         users may also view it. Data is NOT yet sales-scoped (RLS scoping is a
         later ticket) — the reused LeadsPage/LeadDetailPage currently show all
         leads the session can read. Meetings/Feedback are "Coming soon" stubs. */}
      <Route path="/sales/login" element={<SalesLoginPage />} />
      <Route
        path="/sales"
        element={
          <SalesProtectedRoute>
            {/* Reuses the internal LeadsPage as the sales home (not yet sales-scoped). */}
            <LeadsPage />
          </SalesProtectedRoute>
        }
      />
      <Route
        path="/sales/leads/:id"
        element={
          <SalesProtectedRoute>
            <LeadDetailPage />
          </SalesProtectedRoute>
        }
      />
      <Route
        path="/sales/meetings"
        element={
          <SalesProtectedRoute>
            <SalesPlaceholderPage title="Meetings" />
          </SalesProtectedRoute>
        }
      />
      <Route
        path="/sales/feedback"
        element={
          <SalesProtectedRoute>
            <SalesPlaceholderPage title="Feedback" />
          </SalesProtectedRoute>
        }
      />
      {/* Unknown /sales/* path → sales home (which guards/redirects as needed). */}
      <Route path="/sales/*" element={<Navigate to="/sales" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <ContactsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/new"
        element={
          <ProtectedRoute>
            <ContactFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/:id"
        element={
          <ProtectedRoute>
            <ContactDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <ProtectedRoute>
            <CompaniesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/new"
        element={
          <ProtectedRoute>
            <CompanyFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/:id"
        element={
          <ProtectedRoute>
            <CompanyDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/new"
        element={
          <ProtectedRoute>
            <LeadFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <LeadDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id/edit"
        element={
          <ProtectedRoute>
            <LeadFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings"
        element={
          <ProtectedRoute>
            <MeetingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings/:id"
        element={
          <ProtectedRoute>
            <MeetingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wishlist"
        element={
          <ProtectedRoute>
            <WishlistPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wishlist/:id"
        element={
          <ProtectedRoute>
            <WishlistDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
