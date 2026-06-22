/**
 * contact-viewer/src/sidepanel.ts  —  Side panel UI controller
 *
 * Manages the side panel lifecycle:
 *  - Check auth on load; show login form or contact view.
 *  - Handle login/sign-out.
 *  - Receive LinkedIn slug from background worker.
 *  - Look up contact via RPC and render the contact card.
 *
 * Phase 1 is READ-ONLY.  No writes to contact_master / contact_project_status /
 * interaction until ALT-152 is fixed and validated with a real non-admin agent login.
 *
 * This file uses plain DOM manipulation (no framework) to keep the bundle small
 * and the extension fast.
 */

import { getSupabaseClient } from '@shared/supabaseClient';
import { signIn, signOut, getSessionAndProfile, setSelectedProject, getSelectedProject } from '@shared/auth';
import { findContactForPanel } from '@shared/rpc';
import {
  fetchContactDetail,
  fetchContactLeads,
  fetchContactStatus,
  fetchActivityFeed,
  fetchTasks,
  fetchProjects,
} from '@shared/contactData';
import type { BgMessage, UserProfile, ContactPanelResult } from '@shared/types';

// Suppress unused import warning — getSupabaseClient is referenced indirectly via shared modules
void getSupabaseClient;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentProfile: UserProfile | null = null;
let currentSlug: string | null = null;
let currentProjectId: number | null = null;

// ---------------------------------------------------------------------------
// DOM refs (asserted non-null — HTML guarantees they exist)
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginForm     = $('login-form');
const emailInput    = $<HTMLInputElement>('email-input');
const passwordInput = $<HTMLInputElement>('password-input');
const loginBtn      = $<HTMLButtonElement>('login-btn');
const loginError    = $('login-error');

const idleState     = $('idle-state');
const loadingState  = $('loading-state');
const noMatchState  = $('no-match-state');
const contactCard   = $('contact-card');
const errorState    = $('error-state');

const authStatus    = $('auth-status');
const signoutBtn    = $('signout-btn');
const projectSel    = $<HTMLSelectElement>('project-selector');

// ---------------------------------------------------------------------------
// Show / hide helpers
// ---------------------------------------------------------------------------

type ContentView = 'login' | 'idle' | 'loading' | 'no-match' | 'contact' | 'error';

function showView(view: ContentView, msg?: string) {
  loginForm.classList.toggle('hidden', view !== 'login');
  idleState.classList.toggle('hidden', view !== 'idle');
  loadingState.classList.toggle('hidden', view !== 'loading');
  noMatchState.classList.toggle('hidden', view !== 'no-match');
  contactCard.classList.toggle('hidden', view !== 'contact');
  errorState.classList.toggle('hidden', view !== 'error');

  if (view === 'error' && msg) {
    errorState.textContent = msg;
  }
}

// ---------------------------------------------------------------------------
// Auth UI
// ---------------------------------------------------------------------------

function setAuthUI(profile: UserProfile | null) {
  if (profile) {
    authStatus.textContent = profile.full_name ?? profile.role;
    signoutBtn.classList.remove('hidden');
    projectSel.classList.remove('hidden');
  } else {
    authStatus.textContent = '';
    signoutBtn.classList.add('hidden');
    projectSel.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Project selector
// ---------------------------------------------------------------------------

async function loadProjects() {
  const projects = await fetchProjects();
  projectSel.innerHTML = '<option value="">Select project…</option>';
  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = String(p.project_id);
    opt.textContent = p.project_name;
    projectSel.appendChild(opt);
  });

  // Restore saved selection
  const saved = await getSelectedProject();
  if (saved) {
    projectSel.value = String(saved);
    currentProjectId = saved;
  } else if (projects.length === 1) {
    projectSel.value = String(projects[0].project_id);
    currentProjectId = projects[0].project_id;
    await setSelectedProject(projects[0].project_id);
  }
}

projectSel.addEventListener('change', async () => {
  const val = parseInt(projectSel.value, 10);
  if (!isNaN(val)) {
    currentProjectId = val;
    await setSelectedProject(val);
    // Re-render if we have a current slug
    if (currentSlug) await lookupAndRender(currentSlug);
  }
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  loginError.classList.add('hidden');

  const result = await signIn(email, password);

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign in';

  if (!result.ok || !result.profile) {
    showLoginError(result.error ?? 'Sign-in failed.');
    return;
  }

  currentProfile = result.profile;
  setAuthUI(currentProfile);
  await loadProjects();
  showView('idle');
  // Query the background for the current tab state
  queryCurrentTab();
});

// Allow Enter key to submit
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

function showLoginError(msg: string) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

signoutBtn.addEventListener('click', async () => {
  await signOut();
  currentProfile = null;
  currentSlug = null;
  setAuthUI(null);
  showView('login');
});

// ---------------------------------------------------------------------------
// Receive messages from the background worker
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: BgMessage) => {
  if (!currentProfile) return; // not logged in — ignore tab messages

  if (message.type === 'TAB_URL') {
    currentSlug = message.slug;
    lookupAndRender(message.slug);
  } else if (message.type === 'TAB_IDLE') {
    currentSlug = null;
    showView('idle');
  }
});

/** Ask the background for the current tab state (called on panel open). */
function queryCurrentTab() {
  chrome.runtime.sendMessage({ type: 'QUERY_CURRENT_TAB' }, (response: BgMessage | undefined) => {
    if (chrome.runtime.lastError || !response) return;
    if (response.type === 'TAB_URL') {
      currentSlug = response.slug;
      lookupAndRender(response.slug);
    } else {
      showView('idle');
    }
  });
}

// ---------------------------------------------------------------------------
// Contact lookup + render
// ---------------------------------------------------------------------------

async function lookupAndRender(slug: string) {
  if (!currentProfile) return;

  showView('loading');

  try {
    const result = await findContactForPanel(slug, currentProjectId);

    if (!result) {
      showView('no-match');
      return;
    }

    await renderContactCard(result);
    showView('contact');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AltLeads Panel] lookupAndRender error:', err);
    showView('error', `Could not reach the CRM — ${msg}. Check your connection or try again.`);
  }
}

// ---------------------------------------------------------------------------
// Contact card rendering
// ---------------------------------------------------------------------------

async function renderContactCard(result: ContactPanelResult) {
  // Load additional detail if the user can view it (owned/admin/QC)
  const detail = result.can_view_details
    ? await fetchContactDetail(result.contact_id)
    : null;

  const leads     = await fetchContactLeads(result.contact_id);
  const status    = currentProjectId
    ? await fetchContactStatus(result.contact_id, currentProjectId)
    : null;
  const activities = await fetchActivityFeed(result.contact_id, 3);
  const tasks     = await fetchTasks(result.contact_id);

  // Determine DNC from both contact_status and company_status
  const isDNC =
    result.contact_status === 'do_not_contact' ||
    result.company_status === 'do_not_contact' ||
    result.company_status === 'DNC' ||
    (result.company_status?.toLowerCase().includes('do not contact') ?? false);

  // ---- HEADER ----
  let html = `
    <div class="contact-card">
      <div class="name">
        ${esc(result.full_name)}
        ${isDNC
          ? '<span class="badge badge-red">DO NOT CONTACT</span>'
          : result.can_view_details
            ? '<span class="badge badge-green">In CRM</span>'
            : '<span class="badge badge-gray">In CRM</span>'
        }
      </div>
      ${detail?.designation ? `<div class="designation">${esc(detail.designation)}</div>` : ''}
      <div class="company">${esc(result.company_name ?? '—')}</div>
    </div>
  `;

  // ---- OWNED CARD (can_view_details = true) ----
  if (result.can_view_details) {
    html += renderOwnedCard(result, detail, status);
    html += renderLeads(leads);
    html += renderTasks(tasks);
    html += renderActivity(activities);
  }
  // ---- NON-OWNED CARD (can_view_details = false) ----
  else {
    html += renderNonOwnedCard(result, isDNC, status);
  }

  // ---- LINK TO FULL CRM ----
  html += `
    <div class="crm-link">
      <a href="https://crm.altleads.com/contacts/${result.contact_id}"
         target="_blank">
        Open full record in AltLeads CRM →
      </a>
    </div>
  `;

  contactCard.innerHTML = html;

  // Wire up click-to-reveal for masked PII fields (owned card only)
  if (result.can_view_details) {
    wireMaskReveal(contactCard);
  }
}

// ---------------------------------------------------------------------------
// Owned card renderer
// ---------------------------------------------------------------------------

function renderOwnedCard(
  result: ContactPanelResult,
  detail: Awaited<ReturnType<typeof fetchContactDetail>>,
  status: Awaited<ReturnType<typeof fetchContactStatus>>
): string {
  let html = '';

  // Contact PII — partial mask + click-to-reveal
  html += `<div class="section-title">Contact details</div>`;

  // Email
  const email = detail?.email ?? result.email;
  if (email) {
    html += maskedFieldRow('Email', email, maskEmail(email));
  } else {
    html += emptyFieldRow('Email');
  }

  // Mobile
  const mobile = detail?.mobile_no ?? result.mobile_no;
  if (mobile) {
    html += maskedFieldRow('Mobile', mobile, maskPhone(mobile));
  } else {
    html += emptyFieldRow('Mobile');
  }

  // Alt mobile (if present in detail)
  if (detail?.alt_mobile_no) {
    html += maskedFieldRow('Alt mobile', detail.alt_mobile_no, maskPhone(detail.alt_mobile_no));
  }

  // LinkedIn (show as link — not masked since it's a profile URL the agent used to get here)
  const linkedin = detail?.linkedin_url ?? result.linkedin_url;
  if (linkedin) {
    html += `
      <div class="field-row">
        <span class="label">LinkedIn</span>
        <span class="value">
          <a href="${esc(linkedin)}" target="_blank" style="color:#1d4ed8;word-break:break-all;">${esc(linkedin)}</a>
        </span>
      </div>
    `;
  }

  // Per-project status
  if (currentProjectId) {
    html += `<div class="section-title">Project status</div>`;
    const contactStatus = status?.contact_status ?? result.contact_status;
    if (contactStatus) {
      const isDNC2 = contactStatus === 'do_not_contact';
      const cls = isDNC2 ? 'badge-red' : 'badge-blue';
      html += `
        <div class="field-row">
          <span class="label">Status</span>
          <span class="value"><span class="badge ${cls}">${esc(contactStatus)}</span></span>
        </div>
      `;
    } else {
      html += `
        <div class="field-row">
          <span class="label">Status</span>
          <span class="value empty">—</span>
        </div>
      `;
    }
    if (status?.description) {
      html += `
        <div class="field-row">
          <span class="label">Notes</span>
          <span class="value">${esc(status.description)}</span>
        </div>
      `;
    }
    if (status?.comments) {
      html += `
        <div class="field-row">
          <span class="label">Comments</span>
          <span class="value">${esc(status.comments)}</span>
        </div>
      `;
    }
  }

  if (result.last_activity_at) {
    html += `
      <div class="field-row">
        <span class="label">Last activity</span>
        <span class="value">${esc(formatDate(result.last_activity_at))}</span>
      </div>
    `;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Non-owned card renderer
// ---------------------------------------------------------------------------

function renderNonOwnedCard(
  result: ContactPanelResult,
  isDNC: boolean,
  status: Awaited<ReturnType<typeof fetchContactStatus>>
): string {
  let html = `<div class="section-title">Account overview</div>`;

  // Owner info (who owns this contact in the selected project)
  html += `
    <div class="field-row">
      <span class="label">Owner</span>
      <span class="value">${esc(result.owner_name ?? 'Unknown')}</span>
    </div>
  `;

  // Company status — MUST show DNC clearly
  const companyStatus = result.company_status;
  if (companyStatus) {
    const cls = isDNC ? 'badge-red' : 'badge-blue';
    html += `
      <div class="field-row">
        <span class="label">Co. status</span>
        <span class="value"><span class="badge ${cls}">${esc(companyStatus)}</span></span>
      </div>
    `;
  }

  // Contact status (per project, if available from result)
  const contactStatus = status?.contact_status ?? result.contact_status;
  if (contactStatus) {
    const cls = contactStatus === 'do_not_contact' ? 'badge-red' : 'badge-gray';
    html += `
      <div class="field-row">
        <span class="label">Contact status</span>
        <span class="value"><span class="badge ${cls}">${esc(contactStatus)}</span></span>
      </div>
    `;
  }

  // Last activity date
  if (result.last_activity_at) {
    html += `
      <div class="field-row">
        <span class="label">Last activity</span>
        <span class="value">${esc(formatDate(result.last_activity_at))}</span>
      </div>
    `;
  }

  // Hidden details notice
  html += `
    <div class="field-row">
      <span class="label">Details</span>
      <span class="value hidden-notice">Hidden — not your record</span>
    </div>
  `;

  // "Request this company" button (disabled — ALT-283 workflow not built yet)
  const dncNote = isDNC
    ? ' — DNC companies cannot be requested'
    : ' — request flow coming soon (ALT-283)';

  html += `
    <div class="request-section">
      <button
        class="btn-request"
        disabled
        title="Request this company${dncNote}"
      >
        Request this company
      </button>
      <div class="request-note">
        ${isDNC
          ? '⚠️ This company is marked <strong>Do Not Contact</strong>.'
          : 'Approval flow coming soon. Contact your Team Lead to request this company.'
        }
      </div>
    </div>
  `;

  return html;
}

// ---------------------------------------------------------------------------
// Leads / tasks / activity sub-renderers
// ---------------------------------------------------------------------------

function renderLeads(leads: Awaited<ReturnType<typeof fetchContactLeads>>): string {
  if (leads.length === 0) return '';

  let html = `<div class="section-title">Leads (${leads.length})</div>`;
  leads.slice(0, 3).forEach((l) => {
    const stage = l.lead_stage ?? l.lead_status ?? 'unknown';
    html += `
      <div class="field-row">
        <span class="label">#${l.lead_id}</span>
        <span class="value">
          <span class="badge badge-blue">${esc(stage)}</span>
          ${l.company_name ? ` ${esc(l.company_name)}` : ''}
        </span>
      </div>
    `;
  });
  if (leads.length > 3) {
    html += `<div class="more-note">…and ${leads.length - 3} more</div>`;
  }
  return html;
}

function renderTasks(tasks: Awaited<ReturnType<typeof fetchTasks>>): string {
  if (tasks.length === 0) return '';

  let html = `<div class="section-title">Open tasks (${tasks.length})</div>`;
  tasks.slice(0, 3).forEach((t) => {
    html += `
      <div class="field-row">
        <span class="label">${t.due_at ? formatDate(t.due_at) : 'No due date'}</span>
        <span class="value">${esc(t.title)}</span>
      </div>
    `;
  });
  return html;
}

function renderActivity(activities: Awaited<ReturnType<typeof fetchActivityFeed>>): string {
  if (activities.length === 0) return '';

  let html = `<div class="section-title">Recent activity</div>`;
  activities.forEach((a) => {
    html += `
      <div class="activity-item">
        <span class="type">${esc(a.type)}</span>
        ${a.disposition ? `<span class="badge badge-gray">${esc(a.disposition)}</span>` : ''}
        <span class="time">${formatDate(a.occurred_at)}</span>
        ${a.note_text ? `<div class="note">${esc(a.note_text)}</div>` : ''}
      </div>
    `;
  });
  return html;
}

// ---------------------------------------------------------------------------
// Partial mask + click-to-reveal
// ---------------------------------------------------------------------------

/**
 * Wire up click handlers for all elements with data-full-value.
 * On click, replaces the masked text with the full value.
 */
function wireMaskReveal(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('[data-full-value]').forEach((el) => {
    el.style.cursor = 'pointer';
    el.title = 'Click to reveal';
    el.addEventListener('click', function handleReveal() {
      const full = el.getAttribute('data-full-value') ?? '';
      el.textContent = full;
      el.removeAttribute('data-full-value');
      el.title = '';
      el.style.cursor = '';
      el.classList.remove('masked');
    }, { once: true });
  });
}

/**
 * Render a field row with masked display + click-to-reveal for owned PII.
 */
function maskedFieldRow(label: string, fullValue: string, maskedValue: string): string {
  return `
    <div class="field-row">
      <span class="label">${esc(label)}</span>
      <span class="value masked" data-full-value="${esc(fullValue)}">${esc(maskedValue)}</span>
    </div>
  `;
}

/**
 * Render a field row showing a genuinely empty value (not hidden/masked).
 */
function emptyFieldRow(label: string): string {
  return `
    <div class="field-row">
      <span class="label">${esc(label)}</span>
      <span class="value empty">—</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Masking helpers (partial reveal)
// ---------------------------------------------------------------------------

/** e.g. "john.doe@example.com" → "jo*****@example.com" */
function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return email.substring(0, 3) + '***';
  const local = email.substring(0, atIdx);
  const domain = email.substring(atIdx);
  const visible = local.substring(0, Math.min(2, local.length));
  return visible + '*'.repeat(Math.max(3, local.length - visible.length)) + domain;
}

/** e.g. "+91 98765 43210" → "+91 9876 ****10" */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return phone; // too short to mask meaningfully
  const prefix = phone.substring(0, Math.max(1, phone.length - 4));
  return prefix.replace(/\d(?=.*\d{2})/g, '*') + phone.substring(phone.length - 2);
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** HTML-escape a string to prevent XSS in innerHTML. */
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Boot: check session, then show the right view
// ---------------------------------------------------------------------------

(async function boot() {
  const profile = await getSessionAndProfile();

  if (profile) {
    currentProfile = profile;
    setAuthUI(profile);
    await loadProjects();
    showView('idle');
    queryCurrentTab();
  } else {
    setAuthUI(null);
    showView('login');
  }
})();
