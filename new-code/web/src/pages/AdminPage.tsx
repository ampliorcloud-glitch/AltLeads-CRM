import React, { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, Users, Briefcase, Building2, Tag, Globe, Layout, ListTree, HelpCircle, ShieldCheck } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { fetchLookups, type AdminLookups } from '../data/admin';
import { UsersTab } from '../components/admin/UsersTab';
import { ProjectsTab } from '../components/admin/ProjectsTab';
import { ClientsTab } from '../components/admin/ClientsTab';
import { ReferenceDataTab } from '../components/admin/ReferenceDataTab';
import { DropdownsTab } from '../components/admin/DropdownsTab';
import { PreSalesQuestionsTab } from '../components/admin/PreSalesQuestionsTab';
import { ProjectAccessTab } from '../components/admin/ProjectAccessTab';

type TabKey = 'users' | 'projects' | 'clients' | 'reference' | 'dropdowns' | 'presales' | 'access';

const NAV_ITEMS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'users',     label: 'User',              icon: <Users size={15} strokeWidth={1.6} /> },
  { key: 'clients',   label: 'Client',            icon: <Building2 size={15} strokeWidth={1.6} /> },
  { key: 'projects',  label: 'Project',           icon: <Briefcase size={15} strokeWidth={1.6} /> },
  { key: 'access',    label: 'Project Access',    icon: <ShieldCheck size={15} strokeWidth={1.6} /> },
  { key: 'reference', label: 'Reference Data',    icon: <Tag size={15} strokeWidth={1.6} /> },
  { key: 'dropdowns', label: 'Option Lists',      icon: <ListTree size={15} strokeWidth={1.6} /> },
  { key: 'presales',  label: 'Pre-Sales Questions', icon: <HelpCircle size={15} strokeWidth={1.6} /> },
];

const TAB_TITLES: Record<TabKey, string> = {
  users:     'User',
  projects:  'Project',
  clients:   'Client',
  access:    'Project Access',
  reference: 'Reference Data',
  dropdowns: 'Option Lists',
  presales:  'Pre-Sales Questions',
};

function Restricted() {
  return (
    <AppShell title="Admin">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            background: '#FFF7ED',
            border: '1px solid #FDE68A',
          }}
        >
          <ShieldAlert size={22} strokeWidth={1.5} className="text-amber-500" />
        </div>
        <div>
          <h2 className="font-semibold text-zinc-700 mb-1" style={{ fontSize: 15 }}>
            Restricted area
          </h2>
          <p className="text-zinc-400 max-w-xs" style={{ fontSize: 13 }}>
            The Admin panel is available to administrators only. Contact your administrator if you
            need access.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabKey>('users');
  const [lookups, setLookups] = useState<AdminLookups | null>(null);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  const isAdmin = profile?.role === 'ADMIN';
  const actorId = profile?.user_id != null ? String(profile.user_id) : '';

  useEffect(() => {
    if (!isAdmin) return;
    fetchLookups()
      .then(setLookups)
      .catch((e) => setLookupsError(e?.message ?? 'Failed to load reference data.'));
  }, [isAdmin]);

  if (!isAdmin) return <Restricted />;

  return (
    <AppShell title="Admin">
      {/* Page-level layout: left sub-nav + content */}
      <div style={{ display: 'flex', gap: 0, minHeight: '100%' }}>
        {/* ── Left sub-navigation (Figma sidebar pattern) ── */}
        <aside
          style={{
            width: 200,
            flexShrink: 0,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '12px 0',
            alignSelf: 'flex-start',
            marginRight: 20,
          }}
        >
          {/* "Super Admin" header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px 12px',
              borderBottom: '1px solid #F3F4F6',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#1A7EE8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layout size={14} color="#fff" strokeWidth={2} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A7EE8' }}>Super Admin</span>
          </div>

          {/* Nav items */}
          {NAV_ITEMS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? '#1A7EE8' : '#374151',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                {/* Left accent bar for active item */}
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      background: '#1A7EE8',
                      borderRadius: '0 2px 2px 0',
                    }}
                  />
                )}
                <span style={{ color: active ? '#1A7EE8' : '#6B7280' }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* ── Main content area ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Page heading */}
          <div style={{ marginBottom: 16 }}>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#111827',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {TAB_TITLES[tab]}
            </h1>
          </div>

          {/* Content */}
          {lookupsError ? (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{lookupsError}</p>
            </div>
          ) : !lookups ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                gap: 8,
                color: '#9CA3AF',
                fontSize: 13,
              }}
            >
              <Loader2 size={16} className="animate-spin" /> Loading admin data...
            </div>
          ) : (
            <>
              {tab === 'users'     && <UsersTab     lookups={lookups} actorId={actorId} />}
              {tab === 'projects'  && <ProjectsTab  lookups={lookups} actorId={actorId} />}
              {tab === 'clients'   && <ClientsTab   lookups={lookups} actorId={actorId} />}
              {tab === 'access'    && <ProjectAccessTab actorId={actorId} />}
              {tab === 'reference' && <ReferenceDataTab actorId={actorId} />}
              {tab === 'dropdowns' && <DropdownsTab actorId={actorId} />}
              {tab === 'presales'  && <PreSalesQuestionsTab actorId={actorId} />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
