import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PortalMeeting } from '../types/portal'
import MeetingCard from '../components/MeetingCard'

const STATUS_TABS = ['All', 'Scheduled', 'Completed', 'Rescheduled', 'Dropped', 'Missed'] as const
type TabLabel = (typeof STATUS_TABS)[number]

/** UI label → actual meeting_status value(s) in DB */
function tabToStatus(tab: TabLabel): string[] {
  if (tab === 'All') return []
  if (tab === 'Dropped') return ['Cancelled']
  if (tab === 'Scheduled') return ['Scheduled', 'Confirmed']
  return [tab]
}

/** DB status → nearest tab label */
function statusToTab(status: string | null): TabLabel {
  if (!status) return 'All'
  if (status === 'Cancelled') return 'Dropped'
  if (status === 'Confirmed') return 'Scheduled'
  if (STATUS_TABS.includes(status as TabLabel)) return status as TabLabel
  return 'All'
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

export default function Meetings() {
  const { portalUser } = usePortalAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialStatusParam = searchParams.get('status') ?? ''
  const initialTab = statusToTab(initialStatusParam)

  const [meetings, setMeetings] = useState<PortalMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabLabel>(initialTab)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!portalUser) return
    async function fetchMeetings() {
      setLoading(true)
      const { data, error } = await supabase
        .schema('portal')
        .from('portal_meetings')
        .select('*')
        .order('meeting_date', { ascending: false })

      if (!error && data) {
        setMeetings(data as PortalMeeting[])
      }
      setLoading(false)
    }
    fetchMeetings()
  }, [portalUser])

  // Sync tab → URL param
  function handleTabChange(tab: TabLabel) {
    setActiveTab(tab)
    if (tab === 'All') {
      setSearchParams({})
    } else {
      setSearchParams({ status: tab === 'Dropped' ? 'Cancelled' : tab })
    }
  }

  const filtered = useMemo(() => {
    let list = meetings

    // Status filter
    const statuses = tabToStatus(activeTab)
    if (statuses.length > 0) {
      list = list.filter((m) => statuses.includes(m.meeting_status ?? ''))
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (m) =>
          (m.company_name ?? '').toLowerCase().includes(q) ||
          (m.meeting_name ?? '').toLowerCase().includes(q) ||
          (m.lead_name ?? '').toLowerCase().includes(q)
      )
    }

    // Date range filter
    if (dateFrom) {
      list = list.filter((m) => m.meeting_date && m.meeting_date >= dateFrom)
    }
    if (dateTo) {
      list = list.filter((m) => m.meeting_date && m.meeting_date <= dateTo)
    }

    return list
  }, [meetings, activeTab, searchQuery, dateFrom, dateTo])

  return (
    <div className="min-h-screen bg-[#EEF2FF] p-4 sm:p-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Meetings</h1>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by company, meeting name, lead..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        />
      </div>

      {/* Date range */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
        {(dateFrom || dateTo) && (
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg bg-white"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 hide-scrollbar">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activeTab === tab
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Result count */}
      {!loading && (
        <p className="text-sm text-gray-500 mb-3">
          Showing <span className="font-semibold text-gray-700">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'meeting' : 'meetings'}
        </p>
      )}

      {/* Meeting grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-700 font-medium">No meetings found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting filters or search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((m) => (
            <MeetingCard
              key={m.meeting_id}
              meeting={m}
              onClick={() => navigate(`/meetings/${m.meeting_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
