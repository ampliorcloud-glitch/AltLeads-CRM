import React, { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import { fetchDashboardStats, type DashboardStats } from '../data/realLeads';
import { Users, CalendarDays, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
      }}
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

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardStats().then((s) => {
      if (!cancelled) {
        setStats(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const stageEntries = stats?.stageBreakdown ?? [];
  const maxCount = stageEntries.length > 0 ? Math.max(...stageEntries.map((e) => e.count)) : 1;

  return (
    <AppShell title="Dashboard">
      <div className="space-y-5">
        {/* Live data banner */}
        <div
          className="flex items-center px-4 rounded-lg"
          style={{ background: 'var(--color-gray-50)', border: '1px solid var(--border-color)', height: 36 }}
        >
          <p className="text-zinc-600" style={{ fontSize: 12 }}>
            Connected to live Supabase data — read-only preview.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Total Leads"
            value={String(stats?.totalLeads ?? 0)}
            sub="All time"
            loading={loading}
          />
          <StatCard
            icon={CalendarDays}
            label="Meetings This Week"
            value={String(stats?.meetingsThisWeek ?? 0)}
            sub="Scheduled (Mon–Sun)"
            loading={loading}
          />
          <StatCard
            icon={CheckCircle2}
            label="Meetings Successful"
            value={String(stats?.meetingsSuccessful ?? 0)}
            sub="Stage: Meeting Successful"
            loading={loading}
          />
          <StatCard
            icon={TrendingUp}
            label="Meetings Scheduled"
            value={String(stageEntries.find((e) => e.stage === 'Meeting Scheduled')?.count ?? 0)}
            sub="Currently at this stage"
            loading={loading}
          />
        </div>

        {/* Bar chart */}
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
            <div className="space-y-2.5">
              {stageEntries.map(({ stage, count }) => (
                <div key={stage} className="flex items-center gap-3">
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
                  <span
                    className="text-zinc-500 text-right shrink-0"
                    style={{ fontSize: 12, width: 32 }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
            <h3 className="font-medium text-zinc-700" style={{ fontSize: 13 }}>Recent Activity</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-400 py-8" style={{ fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />
              Loading...
            </div>
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
                  <tr key={item.leadId} style={{ borderBottom: '1px solid var(--color-gray-100)' }}
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
