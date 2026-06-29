import { useState, useMemo } from 'react'
import { Search, FileText, Download } from 'lucide-react'
import { PageHeader, PageBody, Table, Pill, Btn, EmptyState } from '../components/ui'
import { demoLeadReports } from '../demo/demoData'
import { format, parseISO } from 'date-fns'

export default function LeadReports() {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    if (!q.trim()) return demoLeadReports
    const s = q.toLowerCase()
    return demoLeadReports.filter(
      (r) => r.company.toLowerCase().includes(s) || r.contact.toLowerCase().includes(s) || r.city.toLowerCase().includes(s)
    )
  }, [q])

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

        {rows.length === 0 ? (
          <EmptyState icon={<FileText size={36} strokeWidth={1.5} />} title="No lead reports found" sub="Try a different search." />
        ) : (
          <Table head={['Company', 'Contact', 'City', 'Industry', 'Stage', 'Rep', 'Opp. value', 'Updated']}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-mist/60 transition-colors">
                <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{r.company}</td>
                <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                  {r.contact}
                  <span className="block text-xs text-ink-faint">{r.designation}</span>
                </td>
                <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{r.city}</td>
                <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{r.industry}</td>
                <td className="px-4 py-3"><Pill>{r.stage === 'Meeting scheduled' ? 'Scheduled' : r.stage === 'Meeting done' ? 'Completed' : r.stage === 'Dropped' ? 'Dropped' : 'Pending'}</Pill></td>
                <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{r.rep}</td>
                <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{r.value}</td>
                <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{format(parseISO(r.updated), 'dd MMM')}</td>
              </tr>
            ))}
          </Table>
        )}
      </PageBody>
    </>
  )
}
