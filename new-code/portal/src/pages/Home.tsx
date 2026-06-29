import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PortalMeeting, DashboardMetrics } from '../types/portal'
import MeetingCard from '../components/MeetingCard'

interface SummedMetrics {
  scheduled: number
  completed: number
  rescheduled: number
  dropped: number
  missed: number
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  )
}

interface StatusCardProps {
  label: string
  count: number
  bg: string
  text: string
  border: string
  onClick: () => void
}

function StatusCard({ label, count, bg, text, border, onClick }: StatusCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-xl border p-4 text-left transition-transform hover:scale-105 active:scale-95 min-w-[130px]"
      style={{ background: bg, borderColor: border }}
    >
      <p className="text-3xl font-bold mb-1" style={{ color: text }}>{count}</p>
      <p className="text-sm font-medium" style={{ color: text }}>{label}</p>
    </button>
  )
}

export default function Home() {
  const { portalUser, session } = usePortalAuth()
  const navigate = useNavigate()

  const [metrics, setMetrics] = useState<SummedMetrics | null>(null)
  const [todayMeetings, setTodayMeetings] = useState<PortalMeeting[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingToday, setLoadingToday] = useState(true)

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0]
    ?? session?.user?.email?.split('@')[0]
    ?? 'there'

  useEffect(() => {
    if (!portalUser) return

    async function fetchMetrics() {
      setLoadingMetrics(true)
      const { data, error } = await supabase
        .schema('portal')
        .from('portal_dashboard_metrics')
        .select('*')

      if (!error && data) {
        const rows = data as DashboardMetrics[]
        setMetrics({
          scheduled: rows.reduce((s, r) => s + (r.scheduled_count ?? 0), 0),
          completed: rows.reduce((s, r) => s + (r.completed_count ?? 0), 0),
          rescheduled: rows.reduce((s, r) => s + (r.rescheduled_count ?? 0), 0),
          dropped: rows.reduce((s, r) => s + (r.dropped_count ?? 0), 0),
          missed: rows.reduce((s, r) => s + (r.missed_count ?? 0), 0),
        })
      }
      setLoadingMetrics(false)
    }

    async function fetchTodayMeetings() {
      setLoadingToday(true)
      const today = todayISO()
      const { data, error } = await supabase
        .schema('portal')
        .from('portal_meetings')
        .select('*')
        .eq('meeting_date', today)
        .order('meeting_time', { ascending: true })
        .limit(5)

      if (!error && data) {
        setTodayMeetings(data as PortalMeeting[])
      }
      setLoadingToday(false)
    }

    fetchMetrics()
    fetchTodayMeetings()
  }, [portalUser])

  const statusCards: Array<{
    label: string
    count: number
    statusParam: string
    bg: string
    text: string
    border: string
  }> = [
    { label: 'Scheduled',   count: metrics?.scheduled ?? 0,   statusParam: 'Scheduled',   bg: '#EFF6FF', text: '#3B82F6', border: '#3B82F6' },
    { label: 'Completed',   count: metrics?.completed ?? 0,   statusParam: 'Completed',   bg: '#F0FDF4', text: '#16A34A', border: '#22C55E' },
    { label: 'Rescheduled', count: metrics?.rescheduled ?? 0, statusParam: 'Rescheduled', bg: '#FFF7ED', text: '#EA580C', border: '#F57C1F' },
    { label: 'Dropped',     count: metrics?.dropped ?? 0,     statusParam: 'Cancelled',   bg: '#FFF1F2', text: '#B72025', border: '#EF4444' },
    { label: 'Missed',      count: metrics?.missed ?? 0,      statusParam: 'Missed',      bg: '#FFFBEB', text: '#D97706', border: '#FCC02A' },
  ]

  return (
    <div className="min-h-screen bg-[#EEF2FF] p-4 sm:p-6 pb-24">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Status cards */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Overview</h2>
        {loadingMetrics ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[130px] h-[90px] bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
            {statusCards.map((card) => (
              <StatusCard
                key={card.label}
                label={card.label}
                count={card.count}
                bg={card.bg}
                text={card.text}
                border={card.border}
                onClick={() => navigate(`/meetings?status=${card.statusParam}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Today's Meetings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Today's Meetings</h2>
          <button
            onClick={() => navigate('/meetings')}
            className="text-sm text-blue-500 hover:text-blue-700 font-medium"
          >
            View all →
          </button>
        </div>

        {loadingToday ? (
          <div className="flex flex-col gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : todayMeetings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-gray-700 font-medium">No meetings today</p>
            <p className="text-sm text-gray-400 mt-1">Check the meetings page for upcoming ones</p>
            <button
              onClick={() => navigate('/meetings')}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Browse all meetings
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {todayMeetings.map((m) => (
              <MeetingCard
                key={m.meeting_id}
                meeting={m}
                onClick={() => navigate(`/meetings/${m.meeting_id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
