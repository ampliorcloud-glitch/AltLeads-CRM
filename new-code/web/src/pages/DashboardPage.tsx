import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { fetchDashboardStats, type DashboardStats } from '../data/realLeads';
import { Users, CalendarDays, TrendingUp, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';

/** Friendly label for a raw role name (e.g. TEAM_LEAD -> Team Lead). */
function roleLabel(role?: string | null): string {
  if (!role) return '';
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
  /** When provided the card becomes a keyboard-operable button that drills down. */
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${label}: ${value}. View details` : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={
        clickable
          ? (e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(26,126,232,0.12)';
            }
          : undefined
      }
      onMouseLeave={
        clickable
          ? (e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between mb-2">
        <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: 0 }}>{label}</p>
        <div style={{ marginTop: 2 }}><Icon size={15} strokeWidth={1.75} className="text-gray-400" /></div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 mt-1">
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <p style={{ fontWeight: 600, fontSize: 24, lineHeight: 1.1, color: 'var(--color-gray-900)', margin: 0 }}>{value}</p>
      )}
      <p style={{ fontSize: 12, color: 'var(--color-gray-400)', marginTop: 4, marginBottom: 0 }}>{sub}</p>
    </div>
  );
}

// Muted bar fill colors for real stage names
const barColors: Record<string, string> = {
  'Meeting Successful':               '#86efac',
  'Meeting Scheduled':                '#c4b5fd',
  'Meeting Confirmed':                '#6ee7b7',
  'Meeting Follow-Up':                '#fcd34d',
  'New Meeting':                      '#a1a1aa',
  'Warm':                             '#93c5fd',
  'Hot Prospect':                     '#fdba74',
  'Meeting Cancelled':                '#fca5a5',
  'Meeting Droped By Amplior':        '#fca5a5',
  'Meeting Posponed by Lead':         '#fde68a',
  'Meeting postponed by Salesperson': '#fde68a',
  'Meeting postponed by lead':        '#fde68a',
  'Meeting cancelled by Altleads':    '#fca5a5',
  'Meeting cancelled by sales team':  '#fca5a5',
  'Meeting cancelled by Lead':        '#fca5a5',
};

function greetingFor(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  // Global project scope (owner #8): the dashboard's numbers track the selected
  // project so they match the project-scoped Leads/Meetings lists. null = All.
  const { selectedProjectId, projects, loading: scopeLoading } = useProjectScope();
  const scopedProjectName =
    selectedProjectId != null
      ? projects.find((p) => p.project_id === selectedProjectId)?.project_name ?? null
      : null;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for the scope to resolve so we don't fetch all-project stats first and
    // then re-fetch scoped (avoids a flash of wrong totals on the landing screen).
    if (scopeLoading) return;
    let cancelled = false;
    setLoading(true);
    fetchDashboardStats(selectedProjectId).then((s) => {
      if (!cancelled) {
        setStats(s);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedProjectId, scopeLoading]);

  const stageEntries = stats?.stageBreakdown ?? [];
  const maxCount = stageEntries.length > 0 ? Math.max(...stageEntries.map((e) => e.count)) : 1;

  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'there';
  const role = roleLabel(profile?.role);

  // Drill-down to the Leads list pre-filtered by stage. The stage facet is read
  // from the URL by the Leads list (URL-state pass), so this is forward-compatible.
  const goToStage = (stage: string) => navigate(`/leads?stage=${encodeURIComponent(stage)}`);

  return (
    <AppShell title="Dashboard">
      <div className="space-y-5">

        {/* Personalized header (ALT-192 framing) */}
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-gray-900)', letterSpacing: '-0.01em' }}>
              {greetingFor()}, {firstName}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-gray-500)' }}>
              {scopedProjectName
                ? <>Showing <strong style={{ color: 'var(--color-gray-700)' }}>{scopedProjectName}</strong> — leads and meetings for this project.</>
                : <>Here&rsquo;s what&rsquo;s happening across your leads and meetings.</>}
            </p>
          </div>
          {role && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--color-brand-light)',
                color: 'var(--color-brand)',
                border: '1px solid rgba(26,126,232,0.20)',
              }}
            >
              {role}
            </span>
          )}
        </div>

        {/* Stat cards — each drills into the relevant list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Total Leads"
            value={(stats?.totalLeads ?? 0).toLocaleString('en-IN')}
            sub="All time"
            loading={loading}
            onClick={() => navigate('/leads')}
          />
          <StatCard
            icon={CalendarDays}
            label="Meetings This Week"
            value={String(stats?.meetingsThisWeek ?? 0)}
            sub="Scheduled (Mon–Sun)"
            loading={loading}
            onClick={() => navigate('/meetings')}
          />
          <StatCard
            icon={CheckCircle2}
            label="Meetings Successful"
            value={String(stats?.meetingsSuccessful ?? 0)}
            sub="Stage: Meeting Successful"
            loading={loading}
            onClick={() => goToStage('Meeting Successful')}
          />
          <StatCard
            icon={TrendingUp}
            label="Meetings Scheduled"
            value={String(stageEntries.find((e) => e.stage === 'Meeting Scheduled')?.count ?? 0)}
            sub="Currently at this stage"
            loading={loading}
            onClick={() => goToStage('Meeting Scheduled')}
          />
        </div>

        {/* Bar chart — each stage row drills into the filtered Leads list */}
        <div className="rounded-lg p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <h3 className="font-medium text-zinc-700 mb-4" style={{ fontSize: 13 }}>Leads by Stage (from lead_report)</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-400 py-6 justify-center" style={{ fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />
              Loading stage data...
            </div>
          ) : stageEntries.length === 0 ? (
            <p className="text-zinc-400 text-center py-6" style={{ fontSize: 13 }}>No stage data available.</p>
          ) : (
            <div className="space-y-1">
              {stageEntries.map(({ stage, count }) => (
                <div
                  key={stage}
                  role="button"
                  tabIndex={0}
                  aria-label={`${stage}: ${count} leads. View in Leads`}
                  onClick={() => goToStage(stage)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToStage(stage); }
                  }}
                  className="flex items-center gap-3 rounded-md"
                  style={{ cursor: 'pointer', padding: '6px 8px', transition: 'background 0.12s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <span className="text-zinc-500 shrink-0" style={{ fontSize: 12, width: 220 }}>{stage}</span>
                  <div className="flex-1 rounded-sm overflow-hidden" style={{ height: 6, background: 'var(--color-gray-100)' }}>
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        background: barColors[stage] ?? '#a1a1aa',
                      }}
                    />
                  </div>
                  <span className="text-zinc-500 text-right shrink-0" style={{ fontSize: 12, width: 32 }}>
                    {count}
                  </span>
                  <ChevronRight size={13} className="text-zinc-300 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity — each row opens the lead */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
            <h3 className="font-medium text-zinc-700" style={{ fontSize: 13 }}>Recent Activity</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-400 py-8" style={{ fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />
              Loading...
            </div>
          ) : (stats?.recentActivity ?? []).length === 0 ? (
            <p className="text-zinc-400 text-center py-8" style={{ fontSize: 13 }}>No recent activity.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--color-gray-500)' }}>Company</th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--color-gray-500)' }}>Contact</th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--color-gray-500)' }}>Stage</th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--color-gray-500)' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentActivity ?? []).map((item) => (
                  <tr
                    key={item.leadId}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open lead ${item.leadName || item.companyName}`}
                    onClick={() => navigate(`/leads/${item.leadId}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/leads/${item.leadId}`); }
                    }}
                    style={{ borderBottom: '1px solid var(--color-gray-100)', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <td style={{ padding: '0 20px', height: 44, fontSize: 13, fontWeight: 500, color: 'var(--color-gray-900)' }}>
                      {item.companyName || <span style={{ color: 'var(--color-gray-400)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0 20px', fontSize: 13, color: 'var(--color-gray-600)' }}>{item.leadName}</td>
                    <td className="px-5">
                      <StageBadge stage={item.stage} />
                    </td>
                    <td style={{ padding: '0 20px', fontSize: 13, color: 'var(--color-gray-400)' }}>{item.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default DashboardPage;
