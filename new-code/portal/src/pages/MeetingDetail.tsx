import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PortalMeeting, STATUS_COLORS, PreSalesQA } from '../types/portal'
import { fetchRealMeetingDetail } from '../data/crm'
import { DEMO, getDemoMeeting } from '../demo/demoData'
import { format, parseISO, isAfter, isSameDay } from 'date-fns'
import {
  ChevronDown, ChevronUp, ArrowLeft, Building2, User, CalendarDays,
  Briefcase, Lightbulb, HelpCircle, MapPin, Phone, Mail, Globe,
  Linkedin, Clock, Video, Users, MessageSquare, ExternalLink
} from 'lucide-react'

function Accordion({ title, icon, children, defaultOpen = false }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 font-semibold text-gray-800">
          <span className="text-blue-600">{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-50">{children}</div>}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="py-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}

function Divider() {
  return <hr className="border-gray-100 my-1" />
}

export default function MeetingDetail() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { account } = usePortalAuth()
  const [meeting, setMeeting] = useState<PortalMeeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (DEMO) {
      const m = meetingId ? getDemoMeeting(Number(meetingId)) : undefined
      if (m) setMeeting(m)
      else setError('Meeting not found.')
      setLoading(false)
      return
    }
    if (!account || !meetingId) return
    fetchRealMeetingDetail(Number(meetingId)).then((m) => {
      if (m) setMeeting(m)
      else setError('Meeting not found.')
      setLoading(false)
    })
  }, [meetingId, account])

  const canLeaveFeedback = (m: PortalMeeting) => {
    if (!m.started_at) return false
    const start = parseISO(m.started_at)
    const now = new Date()
    return isAfter(now, start) || isSameDay(now, start)
  }

  const statusStyle = (status: string) =>
    STATUS_COLORS[status] ?? { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF' }

  const formatDate = (d?: string | null) => {
    if (!d) return null
    try { return format(parseISO(d), 'EEE, dd MMM yyyy') } catch { return d }
  }

  const formatTime = (t?: string | null) => {
    if (!t) return null
    try {
      const [h, m] = t.split(':').map(Number)
      const dt = new Date(); dt.setHours(h, m)
      return format(dt, 'h:mm a')
    } catch { return t }
  }

  const openMap = (m: PortalMeeting) => {
    const parts = [m.address_line_one, m.address_line_two, m.address_city, m.address_state, m.address_country].filter(Boolean)
    if (parts.length) window.open(`https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !meeting) return (
    <div className="p-6 text-center text-gray-500">{error ?? 'Meeting not found.'}</div>
  )

  const st = statusStyle(meeting.meeting_status ?? '')
  const preSalesQA: PreSalesQA[] = Array.isArray(meeting.pre_sales_qa) ? meeting.pre_sales_qa : []
  const agendaQA = preSalesQA.filter(q => q.short_question === 'Discussion')
  const otherQA = preSalesQA.filter(q => q.short_question !== 'Discussion')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-2">
        <ArrowLeft size={16} /> Back to Meetings
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{meeting.company_name ?? 'Unnamed Company'}</h1>
            {meeting.meeting_name && <p className="text-sm text-gray-500 mt-0.5">{meeting.meeting_name}</p>}
          </div>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ backgroundColor: st.bg, color: st.text, border: `1px solid ${st.border}` }}
          >
            {meeting.meeting_status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          {meeting.meeting_date && (
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-gray-400" />
              {formatDate(meeting.meeting_date)}
            </div>
          )}
          {meeting.meeting_time && (
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              {formatTime(meeting.meeting_time)}
              {meeting.meeting_duration && <span className="text-gray-400">· {meeting.meeting_duration}h</span>}
            </div>
          )}
          {meeting.meeting_mode && (
            <div className="flex items-center gap-2">
              {meeting.meeting_mode === 'Online' ? <Video size={14} className="text-gray-400" /> : <Users size={14} className="text-gray-400" />}
              {meeting.meeting_mode}
            </div>
          )}
          {meeting.assigned_rep_name && (
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              {meeting.assigned_rep_name}
            </div>
          )}
        </div>

        {meeting.meeting_url && (
          <a href={meeting.meeting_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <Video size={14} /> Join Meeting <ExternalLink size={12} />
          </a>
        )}

        {meeting.meeting_reason && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
            <span className="font-medium">Reason:</span> {meeting.meeting_reason}
          </div>
        )}

        {canLeaveFeedback(meeting) && (
          <Link
            to={`/meetings/${meetingId}/feedback`}
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Leave Feedback
          </Link>
        )}
      </div>

      {/* Pre-Sales Q&A */}
      {otherQA.length > 0 && (
        <Accordion title="Pre-Sales Questions" icon={<HelpCircle size={18} />} defaultOpen>
          <div className="space-y-3 pt-3">
            {otherQA.map((q, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{q.short_question || q.question}</p>
                <p className="text-sm text-gray-800">{q.answer || '—'}</p>
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* Company Details */}
      <Accordion title="Company Details" icon={<Building2 size={18} />} defaultOpen>
        <div className="pt-3 space-y-1">
          <Field label="Company" value={meeting.company_name} />
          <Divider />
          <Field label="Industry" value={meeting.company_industry} />
          <Field label="Sub-Industry" value={meeting.company_sub_industry} />
          <Field label="Sector" value={meeting.company_sector} />
          <Divider />
          <Field label="Turnover" value={meeting.company_turnover} />
          <Field label="Size" value={meeting.company_size} />
          <Divider />
          <Field label="Description" value={meeting.company_description} />
          <Divider />
          {/* Address */}
          {(meeting.address_line_one || meeting.address_city) && (
            <div className="py-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Address</p>
              <div className="flex items-start gap-2">
                <p className="text-sm text-gray-800 flex-1">
                  {[meeting.address_line_one, meeting.address_line_two, meeting.address_city, meeting.address_state, meeting.address_country].filter(Boolean).join(', ')}
                </p>
                <button onClick={() => openMap(meeting)}
                  className="text-blue-600 hover:text-blue-800 flex-shrink-0">
                  <MapPin size={18} />
                </button>
              </div>
            </div>
          )}
          {/* Links */}
          <div className="flex gap-3 pt-1">
            {meeting.company_web_url && (
              <a href={meeting.company_web_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <Globe size={14} /> Website
              </a>
            )}
            {meeting.company_linkedin_url && (
              <a href={meeting.company_linkedin_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <Linkedin size={14} /> LinkedIn
              </a>
            )}
          </div>
        </div>
      </Accordion>

      {/* Lead Details */}
      <Accordion title="Lead / Contact" icon={<User size={18} />} defaultOpen>
        <div className="pt-3 space-y-1">
          <Field label="Name" value={meeting.lead_name} />
          <Field label="Designation" value={meeting.lead_designation} />
          <Field label="Role & Responsibility" value={meeting.lead_role_and_resp} />
          <Field label="Area of Interest" value={meeting.lead_area_of_interest} />
          <Divider />
          {/* Action buttons */}
          <div className="flex gap-3 py-2">
            {meeting.lead_email && (
              <a href={`mailto:${meeting.lead_email}`}
                className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                <Mail size={15} /> Email
              </a>
            )}
            {meeting.lead_mobile_no && (
              <a href={`tel:${meeting.lead_mobile_no}`}
                className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
                <Phone size={15} /> Call
              </a>
            )}
            {meeting.lead_linkedin_url && (
              <a href={meeting.lead_linkedin_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-sky-50 text-sky-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-100 transition-colors">
                <Linkedin size={15} /> LinkedIn
              </a>
            )}
          </div>
          {meeting.lead_alt_mobile_no && <Field label="Alt. Mobile" value={meeting.lead_alt_mobile_no} />}
        </div>
      </Accordion>

      {/* Agenda & Notes */}
      <Accordion title="Agenda & Notes" icon={<MessageSquare size={18} />}>
        <div className="pt-3 space-y-3">
          {meeting.meeting_description && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Agenda</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{meeting.meeting_description}</p>
            </div>
          )}
          {agendaQA.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Discussion Notes</p>
              {agendaQA.map((q, i) => (
                <p key={i} className="text-sm text-gray-800 whitespace-pre-wrap">{q.answer || '—'}</p>
              ))}
            </div>
          )}
          {meeting.agenda_discussion && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Discussion</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{meeting.agenda_discussion}</p>
            </div>
          )}
          {!meeting.meeting_description && agendaQA.length === 0 && !meeting.agenda_discussion && (
            <p className="text-sm text-gray-400 italic">No notes recorded.</p>
          )}
        </div>
      </Accordion>

      {/* Opportunity */}
      {(meeting.opportunity_title || meeting.opportunity_value || meeting.opportunity_description) && (
        <Accordion title="Opportunity Details" icon={<Briefcase size={18} />}>
          <div className="pt-3 space-y-1">
            <Field label="Title" value={meeting.opportunity_title} />
            <Field label="Value" value={meeting.opportunity_value} />
            <Field label="Description" value={meeting.opportunity_description} />
          </div>
        </Accordion>
      )}

      {/* Sales Intelligence */}
      {meeting.sales_intelligence && (
        <Accordion title="Sales Intelligence" icon={<Lightbulb size={18} />}>
          <div className="pt-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{meeting.sales_intelligence}</p>
          </div>
        </Accordion>
      )}

      {/* Snapshot info */}
      <p className="text-center text-xs text-gray-400 pb-2">
        Data snapshot · {meeting.snapshot_refreshed_at
          ? format(parseISO(meeting.snapshot_refreshed_at), 'dd MMM yyyy, h:mm a')
          : meeting.snapshot_taken_at
            ? format(parseISO(meeting.snapshot_taken_at), 'dd MMM yyyy, h:mm a')
            : '—'}
      </p>
    </div>
  )
}
