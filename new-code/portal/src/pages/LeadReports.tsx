import { useState, useMemo, useEffect } from 'react'
import { Search, FileText, Download } from 'lucide-react'
import { PageHeader, PageBody, Table, Pill, Btn, EmptyState } from '../components/ui'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { fetchRealMeetings } from '../data/crm'
import { DEMO, demoLeadReports, DemoLeadReport } from '../demo/demoData'
import { format, parseISO } from 'date-fns'

function stageFromStatus(s: string | null): string {
  if (s === 'Completed') return 'Meeting done'
  if (s === 'Cancelled') return 'Dropped'
  if (s === 'Missed') return 'Follow-up'
  return 'Meeting scheduled'
}
function stagePill(stage: string): string {
  return stage === 'Meeting scheduled' ? 'Scheduled' : stage === 'Meeting done' ? 'Completed' : stage === 'Dropped' ? 'Dropped' : 'Pending'
}

export default function LeadReports() {
  const { account, scope } = usePortalAuth()
  const [rows, setRows] = useState<DemoLeadReport[]>(DEMO ? demoLeadReports : [])
  const [loading, setLoading] = useState(!DEMO)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (DEMO || !account) return
    setLoading(true)
    fetchRealMeetings(scope).then((ms) => {
      setRows(ms.map((m, i) => ({
        id: 7000 + i,
        company: m.company_name ?? '—',
        contact: m.lead_name ?? '—',
        designation: m.lead_designation ?? '—',
        city: m.company_city ?? '—',
        industry: m.company_industry ?? '—',
        stage: stageFromStatus(m.meeting_status),
        rep: m.assigned_rep_name ?? '—',
        value: m.opportunity_value ?? '—',
        updated: m.meeting_date ?? new Date().toISOString().slice(0, 10),
      })))
      setLoading(false)
    })
  }, [account])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const s = q.toLowerCase()
    return rows.filter((r) => r.company.toLowerCase().includes(s) || r.contact.toLowerCase().includes(s) || r.city.toLowerCase().includes(s))
  }, [q, rows])

  return (
    <>
      <PageHeader
        breadcrumb={['Engagement', 'Lead Reports']}
        title="Lead Reports"
        subtitle="Every lead Amplior generated for you, with its current stage."
        actions={<Btn variant="outline" size="sm"><Download size={14} /> Export</Btn>}
      />
      <PageBody>
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, contact, city…"
            className="w-full border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
        </div>

        {loading ? (
          <EmptyState title="Loading lead reports…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText size={36} strokeWidth={1.5} />} title="No lead reports found" sub={q ? 'Try a different search.' : 'No leads assigned yet.'} />
        ) : (
          <Table head={['Company', 'Contact', 'City', 'Industry', 'Stage', 'Rep', 'Opp. value', 'Updated']}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-mist/60 transition-colors">
                <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{r.company}</td>
                <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                  {r.contact}
                  {r.designation !== '—' && <span className="block text-xs text-ink-faint">{r.designation}</span>}
                </td>
                <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{r.city}</td>
                <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{r.industry}</td>
                <td className="px-4 py-3"><Pill>{stagePill(r.stage)}</Pill></td>
                <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{r.rep}</td>
                <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{r.value}</td>
                <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{(() => { try { return format(parseISO(r.updated), 'dd MMM') } catch { return r.updated } })()}</td>
              </tr>
            ))}
          </Table>
        )}
      </PageBody>
    </>
  )
}
