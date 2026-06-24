import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, MessageSquare, Star, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../ui/Logo';

/**
 * Minimal sidebar for the Sales Portal (/sales/*). Mirrors the visual style of
 * the internal Sidebar but exposes only the sales-relevant entries. Meetings and
 * Feedback are placeholder ("Coming soon") routes for now — the shell ticket only
 * scaffolds navigation; their real pages land in later tickets.
 */
type SalesNavItem = { to: string; icon: typeof Users; label: string; end?: boolean };

const navItems: SalesNavItem[] = [
  { to: '/sales', icon: Users, label: 'Leads', end: true },
  { to: '/sales/meetings', icon: CalendarDays, label: 'Meetings' },
  { to: '/sales/wishlist', icon: Star, label: 'Wishlist' },
  { to: '/sales/feedback', icon: MessageSquare, label: 'Feedback' },
];

export function SalesSidebar() {
  const { signOut, isInternalUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/sales/login', { replace: true });
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
      {/* Logo / Wordmark + portal label */}
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
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--color-brand)',
            background: 'var(--color-brand-light)',
            borderRadius: 4,
            padding: '2px 6px',
            textTransform: 'uppercase',
          }}
        >
          Sales
        </span>
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, padding: '12px 10px 8px' }}>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
                  <Icon size={15} strokeWidth={isActive ? 2 : 1.75} color={isActive ? '#fff' : 'currentColor'} />
                </span>
                <span style={{ flex: 1 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: back-to-CRM (internal/admin users only) + logout */}
      <div style={{ padding: '8px 10px 16px', borderTop: '1px solid var(--border-color)' }}>
        {isInternalUser && (
          <button
            onClick={() => navigate('/dashboard')}
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
              marginBottom: 2,
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
              <ArrowLeft size={15} strokeWidth={1.75} />
            </span>
            Back to CRM
          </button>
        )}
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
