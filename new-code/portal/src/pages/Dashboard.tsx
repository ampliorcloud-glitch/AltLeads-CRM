import { useEffect, useState } from 'react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { fetchRealMeetings, countBy } from '../data/crm'
import { PortalMeeting } from '../types/portal'
import {
  DEMO, demoClient, demoKpis, demoFunnel, demoCoverageByVertical,
  demoCoverageByCity, demoMonthlyMeetings,
} from '../demo/demoData'
import { PageHeader, PageBody, Card, CardTitle, StatTile } from '../components/ui'
import { TrendingUp, Building2, MapPin, Target } from 'lucide-react'

interface Bar { stage: string; value: number; color: string }
interface DashData {
  kpis: { label: string; value: string | number; sub?: string; trend?: string }[]
  bars: Bar[]; barsTitle: string; showConv: boolean
  monthly: { month: string; value: number }[]
  byVertical: { label: string; value: number }[]
  byCity: { label: string; value: number }[]
}

const STATUS_COLOR: Record<string, string> = {
  Scheduled: '#1A7EE8', Confirmed: '#3B82F6', Completed: '#16A34A',
  Rescheduled: '#EA580C', Cancelled: '#B72025', Missed: '#D97706',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildReal(ms: PortalMeeting[]): DashData {
  const by = (s: string[]) => ms.filter((m) => s.includes(m.meeting_status ?? '')).length
  const total = ms.length
  const completed = by(['Completed'])
  const upcoming = by(['Scheduled', 'Confirmed'])
  const dropped = by(['Cancelled', 'Missed'])
  const bars: Bar[] = ['Scheduled', 'Confirmed', 'Completed', 'Rescheduled', 'Cancelled', 'Missed']
    .map((st) => ({ stage: st, value: ms.filter((m) => m.meeting_status === st).length, color: STATUS_COLOR[st] }))
    .filter((b) => b.value > 0)

  // monthly (last 6 months present in data)
  const mMap = new Map<string, number>()
  ms.forEach((m) => { if (m.meeting_date) { const k = m.meeting_date.slice(0, 7); mMap.set(k, (mMap.get(k) ?? 0) + 1) } })
  const monthly = [...mMap.entries()].sort().slice(-6).map(([k, value]) => {
    const mo = Number(k.slice(5, 7)) - 1
    return { month: MONTHS[mo] ?? k, value }
  })

  return {
    kpis: [
      { label: 'Meetings delivered', value: total, sub: 'all time' },
      { label: 'Completed', value: completed, sub: total ? `${Math.round((completed / total) * 100)}% of total` : '' },
      { label: 'Upcoming', value: upcoming, sub: 'scheduled + confirmed' },
      { label: 'Dropped / missed', value: dropped, sub: total ? `${Math.round((dropped / total) * 100)}% of total` : '' },
    ],
    bars, barsTitle: 'Meetings by status', showConv: false,
    monthly,
    byVertical: countBy(ms, (m) => m.company_industry),
    byCity: countBy(ms, (m) => m.company_city),
  }
}

const demoData: DashData = {
  kpis: demoKpis,
  bars: demoFunnel.map((f) => ({ stage: f.stage, value: f.value, color: f.color })),
  barsTitle: 'Outreach funnel', showConv: true,
  monthly: demoMonthlyMeetings,
  byVertical: demoCoverageByVertical,
  byCity: demoCoverageByCity,
}

function Bars({ title, bars, showConv }: { title: string; bars: Bar[]; showConv: boolean }) {
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <Card>
      <CardTitle icon={<Target size={18} />}>{title}</CardTitle>
      <div className="space-y-3">
        {bars.map((s, i) => {
          const pct = Math.round((s.value / max) * 100)
          const conv = showConv && i > 0 ? Math.round((s.value / bars[i - 1].value) * 100) : null
          return (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-ink-mute">{s.stage}</span>
                <span className="font-semibold text-ink">
                  {s.value.toLocaleString('en-IN')}
                  {conv != null && <span className="text-ink-faint font-normal ml-2 text-xs">{conv}%</span>}
                </span>
              </div>
              <div className="h-6 rounded-md bg-mist overflow-hidden">
                <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(pct, 5)}%`, background: s.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function BarList({ title, icon, data, accent }: { title: string; icon: React.ReactNode; data: { label: string; value: number }[]; accent: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <Card>
      <CardTitle icon={icon}>{title}</CardTitle>
      {data.length === 0 ? <p className="text-sm text-ink-faint">No data yet.</p> : (
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="text-sm text-ink-mute w-28 flex-shrink-0 truncate">{d.label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-mist overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: accent }} />
              </div>
              <span className="text-sm font-semibold text-ink-soft w-8 text-right">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function MonthlyTrend({ monthly }: { monthly: { month: string; value: number }[] }) {
  const max = Math.max(...monthly.map((m) => m.value), 1)
  return (
    <Card>
      <CardTitle icon={<TrendingUp size={18} />}>Meetings delivered — by month</CardTitle>
      {monthly.length === 0 ? <p className="text-sm text-ink-faint">No data yet.</p> : (
        <div className="flex items-end justify-between gap-3 h-40 pt-2">
          {monthly.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-ink-soft">{m.value}</span>
              <div className="w-full rounded-t-md bg-primary/85 transition-all" style={{ height: `${(m.value / max) * 100}%`, minHeight: 8 }} />
              <span className="text-xs text-ink-faint">{m.month}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { account, scope } = usePortalAuth()
  const [data, setData] = useState<DashData | null>(DEMO ? demoData : null)

  useEffect(() => {
    if (DEMO || !account) return
    fetchRealMeetings(scope).then((ms) => setData(buildReal(ms)))
  }, [account])

  return (
    <>
      <PageHeader
        breadcrumb={[DEMO ? demoClient.companyName : 'Amplior', 'Dashboard']}
        title="Partnership Dashboard"
        subtitle="How Amplior is performing — across your projects."
      />
      <PageBody>
        {!data ? (
          <p className="text-sm text-ink-faint">Loading dashboard…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              {data.kpis.map((k) => <StatTile key={k.label} {...k} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <Bars title={data.barsTitle} bars={data.bars} showConv={data.showConv} />
              <MonthlyTrend monthly={data.monthly} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BarList title="Coverage by vertical" icon={<Building2 size={18} />} data={data.byVertical} accent="#1A7EE8" />
              <BarList title="Coverage by city" icon={<MapPin size={18} />} data={data.byCity} accent="#6366F1" />
            </div>
          </>
        )}
      </PageBody>
    </>
  )
}
