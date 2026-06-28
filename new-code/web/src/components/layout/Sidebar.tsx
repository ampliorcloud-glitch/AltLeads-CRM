import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Contact2,
  CalendarDays,
  CheckSquare,
  Star,
  Bell,
  ShieldCheck,
  Settings,
  LogOut,
  ClipboardCheck,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { fetchPendingCount } from '../../data/approvals';
import { fetchUnreadNotifCount } from '../../data/account';

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
  approverOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/companies', icon: Building2, label: 'Companies' },
  { to: '/contacts', icon: Contact2, label: 'Contacts' },
  { to: '/meetings', icon: CalendarDays, label: 'Meeting' },
  { to: '/tasks', icon: CheckSquare, label: 'My Tasks' },
  { to: '/wishlist', icon: Star, label: 'Wish List' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/approvals', icon: ClipboardCheck, label: 'Approvals', approverOnly: true },
  { to: '/import', icon: Upload, label: 'Import', adminOnly: true },
  { to: '/admin', icon: ShieldCheck, label: 'Super Admin', adminOnly: true },
];

const bottomItems: NavItem[] = [
  { to: '/settings', icon: Settings, label: 'Setting' },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'ADMIN';
  // QC (role 6) is a parallel approver to Team Lead (AMBIG B1/A5).
  const isApprover = profile?.role === 'ADMIN' || profile?.role === 'TEAM_LEAD' || profile?.role === 'QC';
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Fetch pending approvals count for the Approvals badge (non-blocking, best-effort)
  useEffect(() => {
    if (!isApprover) return;
    let cancelled = false;
    fetchPendingCount().then((c) => { if (!cancelled) setPendingCount(c); });
    // Refresh every 60 s while the sidebar is mounted
    const id = setInterval(() => {
      fetchPendingCount().then((c) => { if (!cancelled) setPendingCount(c); });
    }, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isApprover]);

  // Fetch unread notification count for the Bell badge (non-blocking, best-effort)
  // Polls every 60 s — same lightweight pattern as the Approvals pending-count badge above.
  useEffect(() => {
    const userId = profile?.user_id ?? null;
    if (userId == null) return;
    let cancelled = false;
    fetchUnreadNotifCount(userId).then((c) => { if (!cancelled) setUnreadNotifCount(c); });
    const id = setInterval(() => {
      fetchUnreadNotifCount(userId).then((c) => { if (!cancelled) setUnreadNotifCount(c); });
    }, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [profile?.user_id]);

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.approverOnly) return isApprover;
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        minHeight: '100vh',
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo / Wordmark */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 'var(--topbar-height)',
          flexShrink: 0,
        }}
      >
        <Logo size="md" />
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, padding: '12px 10px 8px' }}>
        {visibleNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 10px',
              height: 36,
              borderRadius: 'var(--radius-btn)',
              marginBottom: 2,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-brand)' : 'var(--color-gray-500)',
              background: isActive ? 'var(--color-brand-light)' : 'transparent',
              textDecoration: 'none',
              transition: 'background 0.12s, color 0.12s',
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'var(--color-gray-100)';
                el.style.color = 'var(--color-gray-700)';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'transparent';
                el.style.color = 'var(--color-gray-500)';
              }
            }}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'var(--color-brand)' : 'transparent',
                    flexShrink: 0,
                    transition: 'background 0.12s',
                  }}
                >
                  <Icon
                    size={15}
                    strokeWidth={isActive ? 2 : 1.75}
                    color={isActive ? '#fff' : 'currentColor'}
                  />
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {/* Pending count badge on Approvals link */}
                {to === '/approvals' && pendingCount > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      background: '#b91c1c',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
                {/* Unread count badge on Notifications link */}
                {to === '/notifications' && unreadNotifCount > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      background: '#b91c1c',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}
                  >
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: settings + logout */}
      <div style={{ padding: '8px 10px 16px', borderTop: '1px solid var(--border-color)' }}>
        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 10px',
              height: 36,
              borderRadius: 'var(--radius-btn)',
              marginBottom: 2,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-brand)' : 'var(--color-gray-500)',
              background: isActive ? 'var(--color-brand-light)' : 'transparent',
              textDecoration: 'none',
              transition: 'background 0.12s, color 0.12s',
            })}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'var(--color-brand)' : 'transparent',
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    size={15}
                    strokeWidth={isActive ? 2 : 1.75}
                    color={isActive ? '#fff' : 'currentColor'}
                  />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}

        {/* Log Out */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 10px',
            height: 36,
            borderRadius: 'var(--radius-btn)',
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-gray-500)',
            fontSize: 13,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'background 0.12s, color 0.12s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-100)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-700)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-500)';
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={15} strokeWidth={1.75} />
          </span>
          Log Out
        </button>
      </div>
    </aside>
  );
}
