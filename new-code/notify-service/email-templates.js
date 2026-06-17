/**
 * email-templates.js — branded HTML email builder for Amplior CRM notifications.
 *
 * Brand colours:
 *   "Alt" / accent  = #1A7EE8 (blue)
 *   "Leads" / text  = #111111
 *   Background      = #F4F6FA
 *   Card            = #FFFFFF
 */

'use strict';

/* ── Shared layout wrapper ─────────────────────────────────────── */

function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#F4F6FA; font-family:'Segoe UI',Arial,sans-serif; }
    .shell { max-width:600px; margin:32px auto; background:#FFFFFF; border-radius:10px;
             overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background:#1A7EE8; padding:24px 32px; }
    .logo   { font-size:22px; font-weight:700; color:#FFFFFF; letter-spacing:-0.5px; }
    .logo span { color:#DDEEFF; }
    .body   { padding:32px; color:#111111; }
    .label  { font-size:12px; font-weight:600; text-transform:uppercase;
              color:#1A7EE8; letter-spacing:.8px; margin-bottom:4px; }
    .value  { font-size:15px; color:#111111; margin-bottom:18px; }
    .badge  { display:inline-block; padding:4px 12px; border-radius:20px;
              font-size:12px; font-weight:600; }
    .badge-green  { background:#D1FAE5; color:#065F46; }
    .badge-red    { background:#FEE2E2; color:#991B1B; }
    .badge-blue   { background:#DBEAFE; color:#1E40AF; }
    .badge-yellow { background:#FEF9C3; color:#854D0E; }
    .reason-box { background:#FFF7ED; border-left:4px solid #F59E0B;
                  padding:12px 16px; border-radius:4px; margin-top:8px;
                  font-size:14px; color:#111; }
    .cta    { display:inline-block; margin-top:24px; padding:12px 28px;
              background:#1A7EE8; color:#FFFFFF; text-decoration:none;
              border-radius:6px; font-weight:600; font-size:14px; }
    .footer { padding:20px 32px; background:#F4F6FA; font-size:12px; color:#888;
              border-top:1px solid #E5E7EB; text-align:center; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <div class="logo"><span>Alt</span>Leads &nbsp;|&nbsp; Amplior CRM</div>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      This is an automated notification from Amplior CRM. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}

/* ── Template builders ─────────────────────────────────────────── */

function leadAssigned(data) {
  const { leadName = 'N/A', company = '', assignedByName = '' } = data;
  return wrap('New Lead Assigned — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">New Lead Assigned to You</h2>
    <div class="label">Lead Name</div>
    <div class="value">${esc(leadName)}</div>
    ${company ? `<div class="label">Company</div><div class="value">${esc(company)}</div>` : ''}
    ${assignedByName ? `<div class="label">Assigned By</div><div class="value">${esc(assignedByName)}</div>` : ''}
    <span class="badge badge-blue">New Assignment</span>
    <br/>
    <a class="cta" href="#">View Lead in AltLeads</a>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      Please review the lead details and begin the qualification process.
    </p>
  `);
}

function leadReassigned(data) {
  const { leadName = 'N/A', company = '', assignedByName = '' } = data;
  return wrap('Lead Reassigned — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">Lead Has Been Reassigned to You</h2>
    <div class="label">Lead Name</div>
    <div class="value">${esc(leadName)}</div>
    ${company ? `<div class="label">Company</div><div class="value">${esc(company)}</div>` : ''}
    ${assignedByName ? `<div class="label">Reassigned By</div><div class="value">${esc(assignedByName)}</div>` : ''}
    <span class="badge badge-yellow">Reassigned</span>
    <br/>
    <a class="cta" href="#">View Lead in AltLeads</a>
  `);
}

function meetingScheduled(data) {
  const { leadName = 'N/A', meetingDate = '', meetingTime = '', mode = '' } = data;
  return wrap('Meeting Scheduled — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">Meeting Scheduled</h2>
    <div class="label">Lead</div>
    <div class="value">${esc(leadName)}</div>
    ${meetingDate ? `<div class="label">Date</div><div class="value">${esc(meetingDate)}</div>` : ''}
    ${meetingTime ? `<div class="label">Time</div><div class="value">${esc(meetingTime)}</div>` : ''}
    ${mode ? `<div class="label">Mode</div><div class="value">${esc(mode)}</div>` : ''}
    <span class="badge badge-blue">Meeting Scheduled</span>
    <br/>
    <a class="cta" href="#">View Meeting Details</a>
  `);
}

function meetingRescheduled(data) {
  const {
    leadName = 'N/A',
    oldDate = '', oldTime = '',
    newDate = '', newTime = '',
    mode = '', reason = '', rescheduledBy = '',
  } = data;
  return wrap('Meeting Rescheduled — AltLeads', `
    <h2 style="margin-top:0;color:#D97706;font-size:20px;">Meeting Has Been Rescheduled</h2>
    <div class="label">Lead</div>
    <div class="value">${esc(leadName)}</div>
    ${(oldDate || oldTime) ? `
    <div class="label">Previous Date &amp; Time</div>
    <div class="value">${[esc(oldDate), esc(oldTime)].filter(Boolean).join(' · ')}</div>` : ''}
    ${(newDate || newTime) ? `
    <div class="label">New Date &amp; Time</div>
    <div class="value" style="font-weight:600;">${[esc(newDate), esc(newTime)].filter(Boolean).join(' · ')}</div>` : ''}
    ${mode ? `<div class="label">Mode</div><div class="value">${esc(mode)}</div>` : ''}
    ${rescheduledBy ? `<div class="label">Rescheduled By</div><div class="value">${esc(rescheduledBy)}</div>` : ''}
    ${reason ? `<div class="label">Reason</div><div class="reason-box">${esc(reason)}</div>` : ''}
    <br/><span class="badge badge-yellow">Rescheduled</span>
    <br/>
    <a class="cta" href="#">View Meeting Details</a>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      Please note the updated meeting time and prepare accordingly.
    </p>
  `);
}

function meetingCancelled(data) {
  const {
    leadName = 'N/A',
    meetingDate = '', meetingTime = '',
    mode = '', reason = '', cancelledBy = '',
  } = data;
  return wrap('Meeting Cancelled — AltLeads', `
    <h2 style="margin-top:0;color:#991B1B;font-size:20px;">Meeting Has Been Cancelled</h2>
    <div class="label">Lead</div>
    <div class="value">${esc(leadName)}</div>
    ${meetingDate ? `<div class="label">Original Date</div><div class="value">${esc(meetingDate)}</div>` : ''}
    ${meetingTime ? `<div class="label">Original Time</div><div class="value">${esc(meetingTime)}</div>` : ''}
    ${mode ? `<div class="label">Mode</div><div class="value">${esc(mode)}</div>` : ''}
    ${cancelledBy ? `<div class="label">Cancelled By</div><div class="value">${esc(cancelledBy)}</div>` : ''}
    ${reason ? `<div class="label">Reason</div><div class="reason-box">${esc(reason)}</div>` : ''}
    <br/><span class="badge badge-red">Cancelled</span>
    <br/>
    <a class="cta" href="#">View Meeting Details</a>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      This meeting has been cancelled. Please follow up with the lead as needed.
    </p>
  `);
}

function approvalRequested(data) {
  const { leadName = 'N/A', agentName = '', leadNumber = '' } = data;
  return wrap('Approval Required — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">Lead Report Awaiting Your Approval</h2>
    <div class="label">Lead</div>
    <div class="value">${esc(leadName)}${leadNumber ? ` <span style="color:#888;font-size:13px;">(${esc(leadNumber)})</span>` : ''}</div>
    ${agentName ? `<div class="label">Requested By</div><div class="value">${esc(agentName)}</div>` : ''}
    <span class="badge badge-yellow">Pending Approval</span>
    <br/>
    <a class="cta" href="#">Review &amp; Approve</a>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      Please review the lead report and take action at your earliest convenience.
    </p>
  `);
}

function approvalApproved(data) {
  const { leadName = 'N/A', leadNumber = '', approvedByName = '' } = data;
  return wrap('Lead Report Approved — AltLeads', `
    <h2 style="margin-top:0;color:#065F46;font-size:20px;">Your Lead Report Was Approved</h2>
    <div class="label">Lead</div>
    <div class="value">${esc(leadName)}${leadNumber ? ` <span style="color:#888;font-size:13px;">(${esc(leadNumber)})</span>` : ''}</div>
    ${approvedByName ? `<div class="label">Approved By</div><div class="value">${esc(approvedByName)}</div>` : ''}
    <span class="badge badge-green">Approved — Meeting Scheduled</span>
    <br/>
    <a class="cta" href="#">View Lead</a>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      Great work! The meeting has been scheduled. Please prepare accordingly.
    </p>
  `);
}

function approvalRejected(data) {
  const { leadName = 'N/A', leadNumber = '', reason = '', rejectedByName = '' } = data;
  return wrap('Lead Report Rejected — AltLeads', `
    <h2 style="margin-top:0;color:#991B1B;font-size:20px;">Your Lead Report Was Rejected</h2>
    <div class="label">Lead</div>
    <div class="value">${esc(leadName)}${leadNumber ? ` <span style="color:#888;font-size:13px;">(${esc(leadNumber)})</span>` : ''}</div>
    ${rejectedByName ? `<div class="label">Rejected By</div><div class="value">${esc(rejectedByName)}</div>` : ''}
    ${reason ? `<div class="label">Reason</div><div class="reason-box">${esc(reason)}</div>` : ''}
    <br/><span class="badge badge-red">Rejected</span>
    <br/>
    <a class="cta" href="#">Edit &amp; Resubmit</a>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      Please address the feedback above and resubmit the report for approval.
    </p>
  `);
}

/* ── HTML escape utility ───────────────────────────────────────── */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Subject lines ─────────────────────────────────────────────── */

function subject(event, data) {
  const lead = data.leadName || 'Lead';
  switch (event) {
    case 'lead_assigned':       return `[AltLeads] New lead assigned: ${lead}`;
    case 'lead_reassigned':     return `[AltLeads] Lead reassigned to you: ${lead}`;
    case 'meeting_scheduled':    return `[AltLeads] Meeting scheduled: ${lead}`;
    case 'meeting_rescheduled':  return `[AltLeads] Meeting rescheduled: ${lead}`;
    case 'meeting_cancelled':    return `[AltLeads] Meeting cancelled: ${lead}`;
    case 'approval_requested':  return `[AltLeads] Approval required: ${lead}`;
    case 'approval_approved':   return `[AltLeads] Report approved — Meeting Scheduled: ${lead}`;
    case 'approval_rejected':   return `[AltLeads] Report rejected: ${lead}`;
    default:                    return `[AltLeads] Notification`;
  }
}

/* ── Main export ───────────────────────────────────────────────── */

function buildEmail(event, data) {
  let html;
  switch (event) {
    case 'lead_assigned':       html = leadAssigned(data);       break;
    case 'lead_reassigned':     html = leadReassigned(data);     break;
    case 'meeting_scheduled':    html = meetingScheduled(data);    break;
    case 'meeting_rescheduled':  html = meetingRescheduled(data);  break;
    case 'meeting_cancelled':    html = meetingCancelled(data);    break;
    case 'approval_requested':  html = approvalRequested(data);  break;
    case 'approval_approved':   html = approvalApproved(data);   break;
    case 'approval_rejected':   html = approvalRejected(data);   break;
    default:
      html = wrap('AltLeads Notification', `<p>You have a new notification from AltLeads.</p>`);
  }
  return { subject: subject(event, data), html };
}

module.exports = { buildEmail };
