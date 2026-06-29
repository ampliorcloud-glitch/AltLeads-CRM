import {
  demoClient, demoKpis, demoFunnel, demoCoverageByVertical,
  demoCoverageByCity, demoMonthlyMeetings,
} from '../demo/demoData'
import { TrendingUp, ArrowUpRight, Building2, MapPin, Target } from 'lucide-react'

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub: string; trend: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="flex items-end justify-between mt-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <ArrowUpRight size={12} /> {trend}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function Funnel() {
  const max = demoFunnel[0].value
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <Target size={18} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Outreach funnel</h3>
        <span className="text-xs text-gray-400 ml-auto">since {demoClient.engagementSince}</span>
      </div>
      <div className="space-y-3">
        {demoFunnel.map((s, i) => {
          const pct = Math.round((s.value / max) * 100)
          const conv = i > 0 ? Math.round((s.value / demoFunnel[i - 1].value) * 100) : 100
          return (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">{s.stage}</span>
                <span className="font-semibold text-gray-900">
                  {s.value.toLocaleString('en-IN')}
                  {i > 0 && <span className="text-gray-400 font-normal ml-2 text-xs">{conv}%</span>}
                </span>
              </div>
              <div className="h-7 rounded-lg bg-gray-50 overflow-hidden">
                <div
                  className="h-full rounded-lg flex items-center transition-all"
                  style={{ width: `${Math.max(pct, 6)}%`, background: s.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BarList({ title, icon, data, accent }: {
  title: string; icon: React.ReactNode; data: { label: string; value: number }[]; accent: string
}) {
  const max = Math.max(...data.map((d) => d.value))
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-28 flex-shrink-0 truncate">{d.label}</span>
            <div className="flex-1 h-3 rounded-full bg-gray-50 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: accent }} />
            </div>
            <span className="text-sm font-semibold text-gray-700 w-8 text-right">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlyTrend() {
  const max = Math.max(...demoMonthlyMeetings.map((m) => m.value))
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp size={18} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Meetings delivered — last 6 months</h3>
      </div>
      <div className="flex items-end justify-between gap-3 h-40">
        {demoMonthlyMeetings.map((m) => (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">{m.value}</span>
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-indigo-400 transition-all"
              style={{ height: `${(m.value / max) * 100}%`, minHeight: 8 }}
            />
            <span className="text-xs text-gray-400">{m.month}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#EEF2FF] p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Building2 size={14} /> {demoClient.companyName}
          <span className="text-gray-300">•</span>
          {demoClient.projects.join(' · ')}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Partnership Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          How Amplior is performing for {demoClient.companyName} — live across your projects.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {demoKpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Funnel + monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Funnel />
        <MonthlyTrend />
      </div>

      {/* Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarList
          title="Coverage by vertical"
          icon={<Building2 size={18} className="text-indigo-600" />}
          data={demoCoverageByVertical}
          accent="#6366F1"
        />
        <BarList
          title="Coverage by city"
          icon={<MapPin size={18} className="text-violet-600" />}
          data={demoCoverageByCity}
          accent="#8B5CF6"
        />
      </div>
    </div>
  )
}
