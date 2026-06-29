import {
  demoClient, demoKpis, demoFunnel, demoCoverageByVertical,
  demoCoverageByCity, demoMonthlyMeetings,
} from '../demo/demoData'
import { PageHeader, PageBody, Card, CardTitle, StatTile } from '../components/ui'
import { TrendingUp, Building2, MapPin, Target } from 'lucide-react'

function Funnel() {
  const max = demoFunnel[0].value
  return (
    <Card>
      <CardTitle icon={<Target size={18} />}>Outreach funnel</CardTitle>
      <div className="space-y-3">
        {demoFunnel.map((s, i) => {
          const pct = Math.round((s.value / max) * 100)
          const conv = i > 0 ? Math.round((s.value / demoFunnel[i - 1].value) * 100) : 100
          return (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-ink-mute">{s.stage}</span>
                <span className="font-semibold text-ink">
                  {s.value.toLocaleString('en-IN')}
                  {i > 0 && <span className="text-ink-faint font-normal ml-2 text-xs">{conv}%</span>}
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

function BarList({ title, icon, data, accent }: {
  title: string; icon: React.ReactNode; data: { label: string; value: number }[]; accent: string
}) {
  const max = Math.max(...data.map((d) => d.value))
  return (
    <Card>
      <CardTitle icon={icon}>{title}</CardTitle>
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
    </Card>
  )
}

function MonthlyTrend() {
  const max = Math.max(...demoMonthlyMeetings.map((m) => m.value))
  return (
    <Card>
      <CardTitle icon={<TrendingUp size={18} />}>Meetings delivered — last 6 months</CardTitle>
      <div className="flex items-end justify-between gap-3 h-40 pt-2">
        {demoMonthlyMeetings.map((m) => (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-ink-soft">{m.value}</span>
            <div className="w-full rounded-t-md bg-primary/85 transition-all" style={{ height: `${(m.value / max) * 100}%`, minHeight: 8 }} />
            <span className="text-xs text-ink-faint">{m.month}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  return (
    <>
      <PageHeader
        breadcrumb={[demoClient.companyName, 'Dashboard']}
        title="Partnership Dashboard"
        subtitle={`How Amplior is performing for ${demoClient.companyName} — across ${demoClient.projects.join(' · ')}.`}
      />
      <PageBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {demoKpis.map((k) => <StatTile key={k.label} {...k} />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <Funnel />
          <MonthlyTrend />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarList title="Coverage by vertical" icon={<Building2 size={18} />} data={demoCoverageByVertical} accent="#1A7EE8" />
          <BarList title="Coverage by city" icon={<MapPin size={18} />} data={demoCoverageByCity} accent="#6366F1" />
        </div>
      </PageBody>
    </>
  )
}
