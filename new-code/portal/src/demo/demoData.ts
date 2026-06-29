/**
 * DEMO MODE data — a self-contained, realistic dataset so the Amplior Client
 * Portal renders fully (premium leadership view) WITHOUT any backend / Supabase /
 * CRM access. Enabled by the build flag VITE_PORTAL_DEMO=1. This lets us showcase
 * the product direction with zero CRM touch. None of this is real client data.
 */
import { PortalMeeting, PortalNotification, PortalUser } from '../types/portal'

export const DEMO = import.meta.env.VITE_PORTAL_DEMO === '1' || import.meta.env.VITE_PORTAL_DEMO === 'true'

/** The client whose portal this is (Company-Admin view). */
export const demoClient = {
  companyName: 'HungerBox',
  adminName: 'Ravi Menon',
  adminEmail: 'ravi.menon@hungerbox.com',
  adminRole: 'Company Admin',
  projects: ['HungerBox India', 'Market Mapping'],
  engagementSince: 'Apr 2024',
}

export const demoPortalUser: PortalUser = {
  client_portal_user_id: 1,
  auth_uid: 'demo-company-admin',
  user_id: 1001,
  client_assoc_id: 501,
  portal_role: 'COMPANY_ADMIN',
  enabled: true,
}

export const demoSession = {
  user: {
    id: 'demo-company-admin',
    email: demoClient.adminEmail,
    user_metadata: { full_name: demoClient.adminName },
  },
} as unknown as import('@supabase/supabase-js').Session

/* ---- date helpers (relative to "now" so the demo always looks current) ---- */
function iso(d: Date): string {
  return d.toISOString().split('T')[0]
}
function shift(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return iso(d)
}
const TODAY = iso(new Date())

/* ---- meeting factory ---- */
let _id = 1000
function mk(p: Partial<PortalMeeting>): PortalMeeting {
  _id += 1
  return {
    meeting_id: _id,
    project_id: 9001,
    client_assoc_id: 501,
    assigned_user_id: 2001,
    started_at: null,
    company_name: 'Acme Corp',
    company_industry: 'Manufacturing',
    company_city: 'Bangalore',
    company_turnover: '₹500–1000 Cr',
    company_size: '1000–5000',
    company_sector: 'Industrials',
    company_sub_industry: null,
    company_web_url: 'https://example.com',
    company_linkedin_url: 'https://linkedin.com/company/example',
    company_description: null,
    address_line_one: 'Tech Park, Outer Ring Road',
    address_line_two: null,
    address_city: 'Bangalore',
    address_state: 'Karnataka',
    address_country: 'India',
    lead_name: 'A. Sharma',
    lead_designation: 'VP — Admin & Facilities',
    lead_email: 'contact@example.com',
    lead_mobile_no: '+91 98XXX XXX01',
    lead_alt_mobile_no: null,
    lead_linkedin_url: 'https://linkedin.com/in/example',
    lead_role_and_resp: 'Owns facilities, cafeteria & employee experience for South India offices.',
    lead_area_of_interest: 'Corporate cafeteria automation, smart food courts',
    opportunity_title: 'Cafeteria digitization — South campus',
    opportunity_value: '₹42,00,000 / yr',
    opportunity_description: 'Roll out cashless smart-cafeteria across 3 campuses (~6,500 employees).',
    sales_intelligence:
      'Currently on a legacy vendor; contract renewal in Q3. Pain: long queues, manual subsidy reconciliation. Warm to a pilot.',
    meeting_name: 'Discovery call',
    meeting_date: TODAY,
    meeting_time: '11:00',
    meeting_duration: '0.5',
    meeting_mode: 'Online',
    meeting_status: 'Scheduled',
    meeting_url: 'https://meet.google.com/demo',
    meeting_description: 'Intro + understand current cafeteria setup, scale, and pain points.',
    meeting_reason: null,
    scheduled_by_name: 'Amplior Desk',
    assigned_rep_name: 'Priya Nair',
    pre_sales_qa: [
      { question: 'Current vendor / setup?', short_question: 'Current setup', answer: 'In-house + 1 legacy vendor across 3 sites.' },
      { question: 'Approx. headcount served?', short_question: 'Headcount', answer: '~6,500 employees, 3 campuses.' },
      { question: 'Decision timeline?', short_question: 'Timeline', answer: 'Evaluating now; renewal in Q3.' },
    ],
    agenda_discussion: null,
    snapshot_taken_at: new Date().toISOString(),
    snapshot_refreshed_at: null,
    snapshot_source: 'live',
    ...p,
  }
}

export const demoMeetings: PortalMeeting[] = [
  mk({ company_name: 'Tata Steel', company_industry: 'Metals & Mining', company_city: 'Jamshedpur', lead_name: 'Anil Kapoor', lead_designation: 'GM — Admin', meeting_name: 'Discovery call', meeting_date: TODAY, meeting_time: '10:30', meeting_status: 'Scheduled', meeting_mode: 'Online', assigned_rep_name: 'Priya Nair', opportunity_value: '₹68,00,000 / yr' }),
  mk({ company_name: 'Infosys', company_industry: 'IT / ITES', company_city: 'Bangalore', lead_name: 'Meera Iyer', lead_designation: 'Head — Workplace', meeting_name: 'Solution walkthrough', meeting_date: TODAY, meeting_time: '15:00', meeting_status: 'Confirmed', meeting_mode: 'Online', assigned_rep_name: 'Arjun Rao', opportunity_value: '₹1,20,00,000 / yr' }),
  mk({ company_name: 'Wipro', company_industry: 'IT / ITES', company_city: 'Pune', lead_name: 'Rohit Sinha', lead_designation: 'AVP — Facilities', meeting_name: 'Commercial discussion', meeting_date: shift(1), meeting_time: '12:00', meeting_status: 'Scheduled', meeting_mode: 'Offline', assigned_rep_name: 'Priya Nair', opportunity_value: '₹54,00,000 / yr' }),
  mk({ company_name: 'HDFC Bank', company_industry: 'BFSI', company_city: 'Mumbai', lead_name: 'Sunita Rao', lead_designation: 'VP — Corp Services', meeting_name: 'Pilot scoping', meeting_date: shift(2), meeting_time: '11:30', meeting_status: 'Scheduled', meeting_mode: 'Online', assigned_rep_name: 'Arjun Rao', opportunity_value: '₹90,00,000 / yr' }),
  mk({ company_name: 'Larsen & Toubro', company_industry: 'Engineering', company_city: 'Mumbai', lead_name: 'Vikram Desai', lead_designation: 'Sr. Manager — Admin', meeting_name: 'Discovery call', meeting_date: shift(-1), meeting_time: '14:00', meeting_status: 'Completed', started_at: shift(-1) + 'T14:00:00Z', meeting_mode: 'Offline', assigned_rep_name: 'Priya Nair', opportunity_value: '₹76,00,000 / yr' }),
  mk({ company_name: 'Asian Paints', company_industry: 'Manufacturing', company_city: 'Mumbai', lead_name: 'Neha Gupta', lead_designation: 'Head — Employee Exp.', meeting_name: 'Follow-up', meeting_date: shift(-2), meeting_time: '16:00', meeting_status: 'Completed', started_at: shift(-2) + 'T16:00:00Z', meeting_mode: 'Online', assigned_rep_name: 'Arjun Rao', opportunity_value: '₹38,00,000 / yr' }),
  mk({ company_name: 'Mahindra & Mahindra', company_industry: 'Automotive', company_city: 'Chennai', lead_name: 'Karthik S', lead_designation: 'GM — Facilities', meeting_name: 'Discovery call', meeting_date: shift(-3), meeting_time: '10:00', meeting_status: 'Rescheduled', meeting_mode: 'Online', assigned_rep_name: 'Priya Nair', meeting_reason: 'Prospect travelling — moved to next week.', opportunity_value: '₹50,00,000 / yr' }),
  mk({ company_name: 'Reliance Retail', company_industry: 'Retail', company_city: 'Mumbai', lead_name: 'Pooja Mehta', lead_designation: 'DGM — Admin', meeting_name: 'Intro call', meeting_date: shift(-4), meeting_time: '13:30', meeting_status: 'Missed', meeting_mode: 'Online', assigned_rep_name: 'Arjun Rao', opportunity_value: '₹1,05,00,000 / yr' }),
  mk({ company_name: 'Biocon', company_industry: 'Pharma', company_city: 'Bangalore', lead_name: 'Dr. Anand Rao', lead_designation: 'Head — Operations', meeting_name: 'Discovery call', meeting_date: shift(-5), meeting_time: '11:00', meeting_status: 'Completed', started_at: shift(-5) + 'T11:00:00Z', meeting_mode: 'Offline', assigned_rep_name: 'Priya Nair', opportunity_value: '₹44,00,000 / yr' }),
  mk({ company_name: 'Flipkart', company_industry: 'IT / ITES', company_city: 'Bangalore', lead_name: 'Sanjay Verma', lead_designation: 'Lead — Workplace', meeting_name: 'Commercial discussion', meeting_date: shift(3), meeting_time: '15:30', meeting_status: 'Scheduled', meeting_mode: 'Online', assigned_rep_name: 'Arjun Rao', opportunity_value: '₹82,00,000 / yr' }),
  mk({ company_name: 'Hindustan Unilever', company_industry: 'FMCG', company_city: 'Mumbai', lead_name: 'Ritu Agarwal', lead_designation: 'VP — Admin', meeting_name: 'Pilot review', meeting_date: shift(-7), meeting_time: '12:30', meeting_status: 'Cancelled', meeting_mode: 'Online', assigned_rep_name: 'Priya Nair', meeting_reason: 'Budget freeze this quarter.', opportunity_value: '₹60,00,000 / yr' }),
  mk({ company_name: 'Tech Mahindra', company_industry: 'IT / ITES', company_city: 'Hyderabad', lead_name: 'Deepak Joshi', lead_designation: 'Head — Facilities', meeting_name: 'Discovery call', meeting_date: shift(4), meeting_time: '10:30', meeting_status: 'Scheduled', meeting_mode: 'Online', assigned_rep_name: 'Arjun Rao', opportunity_value: '₹48,00,000 / yr' }),
]

/** Summed status counts for the Home overview cards. */
export const demoMetrics = {
  scheduled: demoMeetings.filter((m) => ['Scheduled', 'Confirmed'].includes(m.meeting_status ?? '')).length,
  completed: demoMeetings.filter((m) => m.meeting_status === 'Completed').length,
  rescheduled: demoMeetings.filter((m) => m.meeting_status === 'Rescheduled').length,
  dropped: demoMeetings.filter((m) => m.meeting_status === 'Cancelled').length,
  missed: demoMeetings.filter((m) => m.meeting_status === 'Missed').length,
}

/** Leadership dashboard — the outreach funnel (engagement-to-date). */
export const demoFunnel = [
  { stage: 'Dials', value: 4820, color: '#3B82F6' },
  { stage: 'Connects', value: 1642, color: '#6366F1' },
  { stage: 'Pitches', value: 611, color: '#8B5CF6' },
  { stage: 'Meetings scheduled', value: 188, color: '#A855F7' },
  { stage: 'Meetings done', value: 142, color: '#22C55E' },
  { stage: 'Qualified / successful', value: 64, color: '#16A34A' },
]

export const demoKpis = [
  { label: 'Meetings delivered', value: '188', sub: 'since ' + demoClient.engagementSince, trend: '+12% MoM' },
  { label: 'Connect rate', value: '34%', sub: 'dials → connects', trend: '+3 pts' },
  { label: 'Pitch → meeting', value: '31%', sub: 'conversion', trend: '+5 pts' },
  { label: 'Pipeline value', value: '₹8.6 Cr', sub: 'open opportunities', trend: '+18% QoQ' },
]

export const demoCoverageByVertical = [
  { label: 'IT / ITES', value: 52 },
  { label: 'Manufacturing', value: 38 },
  { label: 'BFSI', value: 29 },
  { label: 'Pharma', value: 21 },
  { label: 'Retail / FMCG', value: 26 },
  { label: 'Automotive', value: 17 },
]

export const demoCoverageByCity = [
  { label: 'Bangalore', value: 44 },
  { label: 'Mumbai', value: 41 },
  { label: 'Delhi NCR', value: 33 },
  { label: 'Pune', value: 22 },
  { label: 'Hyderabad', value: 19 },
  { label: 'Chennai', value: 16 },
]

export const demoMonthlyMeetings = [
  { month: 'Jan', value: 22 },
  { month: 'Feb', value: 26 },
  { month: 'Mar', value: 19 },
  { month: 'Apr', value: 31 },
  { month: 'May', value: 28 },
  { month: 'Jun', value: 34 },
]

export const demoNotifications: PortalNotification[] = [
  { notification_id: 1, recipient_auth_uid: 'demo-company-admin', client_assoc_id: 501, project_id: 9001, kind: 'meeting_scheduled', body: 'New meeting scheduled with Infosys — Solution walkthrough today at 3:00 PM.', route: '/meetings', is_read: false, read_at: null, created_date: new Date().toISOString() },
  { notification_id: 2, recipient_auth_uid: 'demo-company-admin', client_assoc_id: 501, project_id: 9001, kind: 'feedback', body: 'Feedback recorded for the L&T discovery call.', route: '/meetings', is_read: false, read_at: null, created_date: new Date(Date.now() - 3600_000).toISOString() },
  { notification_id: 3, recipient_auth_uid: 'demo-company-admin', client_assoc_id: 501, project_id: 9001, kind: 'meeting_rescheduled', body: 'Mahindra & Mahindra meeting was rescheduled to next week.', route: '/meetings', is_read: true, read_at: new Date().toISOString(), created_date: new Date(Date.now() - 86_400_000).toISOString() },
]

export function getDemoMeeting(id: number): PortalMeeting | undefined {
  return demoMeetings.find((m) => m.meeting_id === id)
}
