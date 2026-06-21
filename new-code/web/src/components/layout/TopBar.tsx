import React, { useEffect, useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUnreadNotifCount } from '../../data/account';
import { ProjectSwitcher } from './ProjectSwitcher';

interface TopBarProps {
  title: string;
}

type Crumb = { label: string };

/**
 * Derive a page-aware breadcrumb trail from the current route.
 * Returns 1–2 segments, e.g. ["Leads"] or ["Leads", "Lead Detail"].
 * Layout/visual only — does not affect navigation or data.
 */
function useBreadcrumb(title: string): Crumb[] {
  const { pathname } = useLocation();
  const params = useParams();

  // Section label keyed by the first path segment.
  const SECTION_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    leads: 'Leads',
    meetings: 'Meetings',
    wishlist: 'Wish List',
    notifications: 'Notifications',
    approvals: 'Approvals',
    admin: 'Super Admin',
    settings: 'Settings',
  };

  const segments = pathname.split('/').filter(Boolean);
  const section = segments[0] ?? '';
  const sectionLabel = SECTION_LABELS[section] ?? title;

  // Single-level sections: just the section name.
  if (segments.length <= 1) {
    return [{ label: sectionLabel }];
  }

  // Determine the leaf label for nested routes.
  const tail = segments[segments.length - 1];
  let leaf: string;

  if (section === 'leads') {
    if (tail === 'new') leaf = 'New Lead';
    else if (tail === 'edit') leaf = 'Edit Lead';
    else if (params.id) leaf = 'Lead Detail';
    else leaf = title;
  } else if (section === 'meetings') {
    leaf = params.id ? 'Meeting Detail' : title;
  } else if (section === 'wishlist') {
    leaf = params.id ? 'Wish List Detail' : title;
  } else {
    leaf = title;
  }

  return [{ label: sectionLabel }, { label: leaf }];
}

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

export function TopBar({ title }: TopBarProps) {
  const { userEmail, profile, isInternalUser } = useAuth();
  const crumbs = useBreadcrumb(title);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Unread in-app notification count for the bell badge. Refetched on every route
  // change so it updates after the user visits /notifications and marks them read.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchUnreadNotifCount(profile?.user_id ?? null).then((n) => {
      if (!cancelled) setUnread(n);
    });
    return () => { cancelled = true; };
  }, [profile?.user_id, pathname]);

  const displayEmail = userEmail || profile?.email || '';
  const displayName = profile?.full_name || displayEmail.split('@')[0] || '';
  const displayRole = profile?.role ?? 'Agent';

  const initials = displayName
    ? displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : (displayEmail.substring(0, 2).toUpperCase() || 'AC');

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
      }}
    >
      {/* Left: page-aware breadcrumb (route-derived) */}
      <nav
        aria-label="Breadcrumb"
        style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  style={{ color: 'var(--color-gray-300)', fontSize: 13, lineHeight: 1 }}
                >
                  /
                </span>
              )}
              <span
                aria-current={isLast ? 'page' : undefined}
                style={{
                  fontSize: 13,
                  fontWeight: isLast ? 600 : 400,
                  color: isLast ? 'var(--color-gray-900)' : 'var(--color-gray-400)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {crumb.label}
              </span>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right: project scope + search + bell + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Global project scope selector (ALT-273 / owner #8). Self-hides for users
           with <2 accessible projects. Internal users only — sits left of search. */}
        {isInternalUser && <ProjectSwitcher />}

        {/* Global search affordance (opens the Cmd-K palette). Internal users only. */}
        {isInternalUser && (
          <button
            onClick={() => window.dispatchEvent(new Event('altleads:open-search'))}
            aria-label="Search leads, companies and contacts"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 32, padding: '0 10px 0 10px',
              borderRadius: 8, border: '1px solid var(--border-color)',
              background: 'var(--color-gray-50)', color: 'var(--color-gray-400)',
              cursor: 'pointer', fontSize: 12, transition: 'border-color 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
          >
            <Search size={14} strokeWidth={1.75} />
            <span className="hidden sm:inline">Search…</span>
            <kbd style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-gray-400)',
              border: '1px solid var(--border-color)', borderRadius: 4,
              padding: '1px 5px', background: 'var(--color-surface)',
            }}>
              {IS_MAC ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        )}

        {/* Bell notification icon → opens /notifications, with unread-count badge */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--border-color)',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-gray-500)',
            transition: 'background 0.12s',
          }}
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          title={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-100)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
        >
          <Bell size={15} strokeWidth={1.75} />
          {unread > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: -3, right: -3,
                minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 999, background: 'var(--color-danger)',
                color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--color-surface)', lineHeight: 1,
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* User section: avatar + name + role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Circular avatar */}
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--color-brand-light)',
              border: '2px solid var(--color-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand)',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
              userSelect: 'none',
            }}
            title={displayName}
          >
            {initials}
          </div>

          {/* Name + role stack */}
          <div style={{ lineHeight: 1.2 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-gray-900)',
              }}
            >
              {displayName || displayEmail}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--color-gray-400)',
                fontWeight: 400,
              }}
            >
              {displayRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
