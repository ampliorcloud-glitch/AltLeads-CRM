import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { SalesShellProvider } from './contexts/SalesShellContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CommandPalette } from './components/ui/CommandPalette';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SalesLoginPage } from './pages/sales/SalesLoginPage';
import { SalesPlaceholderPage } from './pages/sales/SalesPlaceholderPage';
import { SalesMeetingDetailPage } from './pages/sales/SalesMeetingDetailPage';
import { SalesWishlistPage } from './pages/sales/SalesWishlistPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadsKanbanPage } from './pages/LeadsKanbanPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadFormPage } from './pages/LeadFormPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { MyTasksPage } from './pages/MyTasksPage';
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
import { PortalRoutes } from './portal/PortalRoutes';

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
 * Guards the Lead Report Approvals queue (/approvals). Builds on ProtectedRoute
 * (session + internal-only), then narrows access to approvers — Admin, Team Lead,
 * or QC (role 6), which mirrors the Team Lead's approvals access since QC has no
 * other screen today (AMBIG B1/A5). Non-approver internal users (e.g. plain
 * agents) are bounced to the dashboard.
 */
function ApproverRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, isApprover } = useAuth();

  // Narrow to approvers only once auth/roles have hydrated and a session exists.
  // ProtectedRoute owns the loading spinner + no-session / pure-sales redirects;
  // here we only bounce a logged-in internal non-approver (e.g. a plain agent).
  if (!loading && session && !isApprover) return <Navigate to="/dashboard" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
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
      {/* Self-service password recovery (ALT-197). Forgot = request a link; Reset =
         the recovery landing page. Reset is NOT session-gated: users arrive there in
         a temporary Supabase recovery session and must be able to set a new password. */}
      <Route
        path="/forgot-password"
        element={session ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

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
      {/* Sales Meetings list — reuses the internal MeetingsPage under the sales
         shell (it self-detects the shell and links rows to /sales/meetings/:id). */}
      <Route
        path="/sales/meetings"
        element={
          <SalesProtectedRoute>
            <MeetingsPage />
          </SalesProtectedRoute>
        }
      />
      {/* Sales Meeting record — the "mobile-ditto" screen (ALT-275). */}
      <Route
        path="/sales/meetings/:id"
        element={
          <SalesProtectedRoute>
            <SalesMeetingDetailPage />
          </SalesProtectedRoute>
        }
      />
      {/* Sales Wishlist — prospect capture (ALT-276). Sales/portal users add a
         wishlist entry (Company + Prospect + Location) via WishlistCreateModal. */}
      <Route
        path="/sales/wishlist"
        element={
          <SalesProtectedRoute>
            <SalesWishlistPage />
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
        path="/leads/board"
        element={
          <ProtectedRoute>
            <LeadsKanbanPage />
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
        path="/tasks"
        element={
          <ProtectedRoute>
            <MyTasksPage />
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
          <ApproverRoute>
            <ApprovalsPage />
          </ApproverRoute>
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
      {/* ───────────────────────── Client Portal (/portal/*) ─────────────────────────
         White-label (Amplior) client-facing portal. Net-new, fully isolated module:
         it owns its OWN login + guard (PortalProtectedRoute via usePortalSession) and
         reads ONLY the portal.* snapshot views — never CRM live-data pages. Sits OUTSIDE
         the CRM/sales guards. Inert until the portal schema is applied + exposed (ALT-229). */}
      <Route path="/portal/*" element={<PortalRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      {/* Global project scope (ALT-273 / owner #8): reads the signed-in user's
         accessible projects and exposes the selected scope app-wide. Inside
         AuthProvider (needs profile/isAdmin); above the router so every page +
         the TopBar switcher share one scope. Inert "All projects" outside it. */}
      <ProjectProvider>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              {/* Top-level boundary (ALT-196): an uncaught render error in any route
                 shows a calm fallback instead of white-screening the whole SPA. */}
              <ErrorBoundary>
                <AppRoutes />
                {/* Global Cmd-K search (ALT-188); self-gates to logged-in internal users. */}
                <CommandPalette />
              </ErrorBoundary>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
