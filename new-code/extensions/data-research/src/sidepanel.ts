/**
 * data-research/src/sidepanel.ts  —  Data Research extension panel
 *
 * The research / back-office team's tool.  Shows:
 *
 *  QUEUE VIEW (default, non-LinkedIn tab):
 *    - List of open contact_research_request rows (pending + in_progress),
 *      newest first.  Each row shows: requester name (resolved from user_id),
 *      when requested, target (contact name/company OR linkedin_url),
 *      fields_needed, status.
 *    - Click a row → DETAIL VIEW for that request.
 *
 *  DETAIL VIEW (per request):
 *    - Shows the linked contact's CURRENT data (from contact_master_masked).
 *    - Clearly marks each of email / mobile_no / linkedin_url / designation as
 *      FILLED or MISSING — answering "is the info already there?".
 *    - Edit form for the MISSING fields.
 *    - SAVE → writes to contact_master (re-derives linkedin_clean) AND marks
 *      the request done.  42501 (permission) errors surface a friendly message.
 *    - MARK NOT FOUND → marks the request status='not_found'.
 *    - BACK → returns to queue.
 *
 *  PROFILE CONTEXT (when active tab is a LinkedIn /in/ profile):
 *    - Shows current slug + any matching CRM contact + any open request for
 *      that slug.
 *    - Optional: pre-fill a "Raise request" form with the LinkedIn slug.
 *
 *  RAISE REQUEST (optional affordance):
 *    - Insert a row into contact_research_request for the current slug.
 *
 * Backend dependency: contact_research_request table (REQUEST 3 / ALT-282 R3).
 * If it doesn't exist, the queue shows a friendly "backend not ready" state.
 * The contact write path is RLS-gated; until the research role/ALT-152 land,
 * saves may return 42501 — shown as a friendly permission error, never crash.
 */

import { signIn, signOut, getSessionAndProfile } from '@shared/auth';
import { findContactDup } from '@shared/rpc';
import { fetchContactDetail, fetchProjects } from '@shared/contactData';
import { normalizeLinkedinSlug } from '@shared/normalizeLinkedin';
import { getSupabaseClient } from '@shared/supabaseClient';
import type { BgMessage, UserProfile, ResearchRequest, ContactDetail } from '@shared/types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentProfile: UserProfile | null = null;
let currentSlug: string | null = null;           // slug from active LinkedIn tab (or null)
let openRequestId: number | null = null;         // request currently in detail view
let detailContact: ContactDetail | null = null;  // contact loaded for detail view
let detailRequest: ResearchRequest | null = null;// request loaded for detail view

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginSection     = $('login-section');
const emailInput       = $<HTMLInputElement>('email-input');
const passwordInput    = $<HTMLInputElement>('password-input');
const loginBtn         = $<HTMLButtonElement>('login-btn');
const loginError       = $('login-error');

const mainSection      = $('main-section');   // shown when authenticated
const authStatus       = $('auth-status');
const signoutBtn       = $<HTMLButtonElement>('signout-btn');
const refreshBtn       = $<HTMLButtonElement>('refresh-btn');

const queueView        = $('queue-view');
const queueContent     = $('queue-content');
const profileBanner    = $('profile-banner');  // shown when on a LinkedIn profile

const detailView       = $('detail-view');
const detailContent    = $('detail-content');
const backBtn          = $<HTMLButtonElement>('back-btn');

const raiseView        = $('raise-view');
const raiseForm        = $('raise-form');
const raiseLinkedin    = $<HTMLInputElement>('raise-linkedin');
const raiseFields      = $<HTMLInputElement>('raise-fields');
const raiseNotes       = $<HTMLTextAreaElement>('raise-notes');
const raiseSubmitBtn   = $<HTMLButtonElement>('raise-submit-btn');
const raiseCancelBtn   = $<HTMLButtonElement>('raise-cancel-btn');   // the "← Cancel" at top
const raiseCancelBtn2  = $<HTMLButtonElement>('raise-cancel-btn2');  // the second cancel in btn-row
const raiseMsg         = $('raise-msg');

// ---------------------------------------------------------------------------
// View helpers (three top-level views: login / main / raise)
// ---------------------------------------------------------------------------

type TopView = 'login' | 'main' | 'raise';
type MainSubView = 'queue' | 'detail';

function showTopView(view: TopView) {
  loginSection.classList.toggle('hidden', view !== 'login');
  mainSection.classList.toggle('hidden', view !== 'main');
  raiseView.classList.toggle('hidden', view !== 'raise');
}

function showMainSub(sub: MainSubView) {
  queueView.classList.toggle('hidden', sub !== 'queue');
  detailView.classList.toggle('hidden', sub !== 'detail');
}

function setAuthUI(profile: UserProfile | null) {
  if (profile) {
    authStatus.textContent = profile.full_name ?? profile.role;
    signoutBtn.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
  } else {
    authStatus.textContent = '';
    signoutBtn.classList.add('hidden');
    refreshBtn.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) { showLoginError('Please enter email and password.'); return; }

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
  showTopView('main');
  showMainSub('queue');
  await loadQueue();
  queryCurrentTab();
});

passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });

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
  showTopView('login');
});

// ---------------------------------------------------------------------------
// Refresh queue
// ---------------------------------------------------------------------------

refreshBtn.addEventListener('click', async () => {
  showMainSub('queue');
  await loadQueue();
});

// ---------------------------------------------------------------------------
// Back from detail view
// ---------------------------------------------------------------------------

backBtn.addEventListener('click', async () => {
  openRequestId = null;
  detailContact = null;
  detailRequest = null;
  showMainSub('queue');
  await loadQueue();
});

// ---------------------------------------------------------------------------
// Resolve a user_id (numeric bigint as text) to a display name
// ---------------------------------------------------------------------------

const userNameCache = new Map<string, string>();

async function resolveUserName(userId: string | null): Promise<string> {
  if (!userId) return '—';
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;

  const supabase = getSupabaseClient();
  // profiles: id = auth.uid (uuid), user_id = bigint
  const { data } = await supabase
    .from('profiles')
    .select('full_name, user_id')
    .eq('user_id', parseInt(userId, 10))
    .maybeSingle();

  const name = (data as { full_name?: string | null } | null)?.full_name ?? `User ${userId}`;
  userNameCache.set(userId, name);
  return name;
}

// ---------------------------------------------------------------------------
// Research queue (contact_research_request table)
// ---------------------------------------------------------------------------

async function loadQueue() {
  queueContent.innerHTML = spinner('Loading research queue…');

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_research_request')
    .select(
      'request_id, contact_id, company_id, linkedin_url, linkedin_clean, ' +
      'project_id, fields_needed, status, notes, requested_by, requested_at'
    )
    .in('status', ['pending', 'in_progress'])
    .order('requested_at', { ascending: false })
    .limit(30);

  if (error) {
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
      queueContent.innerHTML = backendNotReadyMsg();
    } else {
      queueContent.innerHTML = errorMsg(`Queue error: ${esc(error.message)}`);
    }
    return;
  }

  const rows = (data ?? []) as ResearchRequest[];
  if (rows.length === 0) {
    queueContent.innerHTML = `
      <div class="info-banner">
        No pending research requests.
        <div style="margin-top:6px;font-size:11px;color:#888;">
          All caught up!  Raise a new request from a LinkedIn profile.
        </div>
      </div>`;
    return;
  }

  // Resolve requester names asynchronously then re-render
  const enriched = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      requesterName: await resolveUserName(r.requested_by),
    }))
  );

  let html = `<div class="section-label">Open requests (${enriched.length})</div>`;
  enriched.forEach((r) => {
    const statusBadge = r.status === 'in_progress' ? 'badge-orange' : 'badge-gray';
    const target = r.linkedin_clean ?? r.linkedin_url ?? (r.contact_id ? `Contact #${r.contact_id}` : '—');
    const when = r.requested_at ? formatDate(r.requested_at) : '—';
    html += `
      <div class="queue-row" data-req="${r.request_id}">
        <div class="req-header">
          <span class="req-id">#${r.request_id}</span>
          <span class="badge ${statusBadge}">${esc(r.status)}</span>
        </div>
        <div class="req-target">${esc(target)}</div>
        <div class="req-meta">
          ${esc(r.fields_needed ?? 'fields not specified')}
          &nbsp;·&nbsp;${esc(r.requesterName)}
          &nbsp;·&nbsp;${esc(when)}
        </div>
        ${r.notes ? `<div class="req-notes">${esc(r.notes)}</div>` : ''}
      </div>
    `;
  });

  queueContent.innerHTML = html;

  // Wire click handlers
  queueContent.querySelectorAll<HTMLElement>('.queue-row').forEach((el) => {
    el.addEventListener('click', () => {
      const reqId = parseInt(el.dataset['req'] ?? '0', 10);
      if (reqId) openDetail(reqId);
    });
  });
}

// ---------------------------------------------------------------------------
// Detail view — open a request
// ---------------------------------------------------------------------------

async function openDetail(requestId: number) {
  openRequestId = requestId;
  showMainSub('detail');
  detailContent.innerHTML = spinner('Loading request…');

  const supabase = getSupabaseClient();

  // 1. Load the research request
  const { data: reqData, error: reqErr } = await supabase
    .from('contact_research_request')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();

  if (reqErr || !reqData) {
    detailContent.innerHTML = errorMsg(
      reqErr?.code === '42P01'
        ? backendNotReadyMsg()
        : `Failed to load request: ${esc(reqErr?.message ?? 'Not found')}`
    );
    return;
  }

  detailRequest = reqData as ResearchRequest;

  // 2. Load the linked contact (if any)
  detailContact = detailRequest.contact_id
    ? await fetchContactDetail(detailRequest.contact_id)
    : null;

  renderDetailView();
}

function renderDetailView() {
  if (!detailRequest) return;
  const req = detailRequest;
  const contact = detailContact;

  // --- Section 1: request summary ---
  const requesterDisplay = req.requested_by ? `User ${req.requested_by}` : '—';
  const when = req.requested_at ? formatDate(req.requested_at) : '—';
  const statusBadge = statusBadgeClass(req.status);

  let html = `
    <div class="detail-card">
      <div class="detail-header">
        Request #${req.request_id}
        <span class="badge ${statusBadge}">${esc(req.status)}</span>
      </div>
      <div class="field-row">
        <span class="label">Requested by</span>
        <span class="value">${esc(requesterDisplay)}</span>
      </div>
      <div class="field-row">
        <span class="label">When</span>
        <span class="value">${esc(when)}</span>
      </div>
      <div class="field-row">
        <span class="label">Fields needed</span>
        <span class="value">${esc(req.fields_needed ?? '—')}</span>
      </div>
      ${req.notes ? `
        <div class="field-row">
          <span class="label">Notes</span>
          <span class="value">${esc(req.notes)}</span>
        </div>` : ''}
      <div class="field-row">
        <span class="label">LinkedIn</span>
        <span class="value">${esc(req.linkedin_url ?? req.linkedin_clean ?? '—')}</span>
      </div>
    </div>
  `;

  // --- Section 2: "Is the info already there?" ---
  html += `<div class="section-label">Contact data check</div>`;

  if (!contact) {
    html += `
      <div class="info-banner">
        No CRM contact linked to this request.
        ${req.contact_id ? `(Contact #${req.contact_id} not found or not accessible)` : 'No contact_id set on this request.'}
      </div>
    `;
  } else {
    // Show which fields are filled vs missing
    html += `
      <div class="detail-card">
        <div class="field-row">
          <span class="label">Name</span>
          <span class="value">${esc(contact.full_name)}</span>
        </div>
        <div class="field-row">
          <span class="label">Company</span>
          <span class="value">${esc(contact.company_name ?? '—')}</span>
        </div>
      </div>
      <div class="section-label">Field status</div>
      <div class="detail-card">
        ${fieldStatusRow('Email', contact.email)}
        ${fieldStatusRow('Mobile', contact.mobile_no)}
        ${fieldStatusRow('LinkedIn URL', contact.linkedin_url)}
        ${fieldStatusRow('Designation', contact.designation)}
      </div>
    `;
  }

  // --- Section 3: edit form for missing fields ---
  if (req.status !== 'done' && req.status !== 'not_found') {
    const emailVal  = contact?.email ?? '';
    const mobileVal = contact?.mobile_no ?? '';
    const liVal     = contact?.linkedin_url ?? req.linkedin_url ?? '';
    const desigVal  = contact?.designation ?? '';

    if (contact) {
      html += `
        <div class="section-label">Fill missing fields</div>
        <div class="detail-card" id="fill-form">
          <div id="fill-msg" class="hidden"></div>
          <div class="form-group">
            <label>Email ${contact.email ? '<span class="filled-badge">filled</span>' : '<span class="missing-badge">missing</span>'}</label>
            <input type="email" id="fill-email" value="${esc(emailVal)}"
              placeholder="work@company.com" class="fill-input" />
          </div>
          <div class="form-group">
            <label>Mobile ${contact.mobile_no ? '<span class="filled-badge">filled</span>' : '<span class="missing-badge">missing</span>'}</label>
            <input type="tel" id="fill-mobile" value="${esc(mobileVal)}"
              placeholder="+91 98765 43210" class="fill-input" />
          </div>
          <div class="form-group">
            <label>LinkedIn URL ${contact.linkedin_url ? '<span class="filled-badge">filled</span>' : '<span class="missing-badge">missing</span>'}</label>
            <input type="url" id="fill-linkedin" value="${esc(liVal)}"
              placeholder="https://www.linkedin.com/in/slug" class="fill-input" />
          </div>
          <div class="form-group">
            <label>Designation ${contact.designation ? '<span class="filled-badge">filled</span>' : '<span class="missing-badge">missing</span>'}</label>
            <input type="text" id="fill-designation" value="${esc(desigVal)}"
              placeholder="e.g. Head of Procurement" class="fill-input" />
          </div>
          <div class="btn-row">
            <button id="save-btn" class="btn-primary">Save &amp; mark done</button>
            <button id="not-found-btn" class="btn-secondary">Mark not found</button>
          </div>
        </div>
      `;
    } else {
      // No contact linked — still allow raising a new request or marking not_found
      html += `
        <div class="section-label">Actions</div>
        <div class="detail-card" id="fill-form">
          <div id="fill-msg" class="hidden"></div>
          <p style="font-size:12px;color:#888;margin-bottom:10px;">
            No contact is linked to this request.  Mark as not found, or link a contact manually in the CRM.
          </p>
          <div class="btn-row">
            <button id="not-found-btn" class="btn-secondary">Mark not found</button>
          </div>
        </div>
      `;
    }
  } else {
    // Closed request — show final status
    html += `
      <div class="info-banner" style="background:#f0fdf4;border-color:#bbf7d0;color:#16a34a;">
        This request is ${req.status}.
        ${req.fulfilled_at ? `Fulfilled ${formatDate(req.fulfilled_at)}.` : ''}
      </div>
    `;
  }

  detailContent.innerHTML = html;

  // Wire save and not-found buttons (they may not exist for closed requests)
  const saveBtn = document.getElementById('save-btn');
  const notFoundBtn = document.getElementById('not-found-btn');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => handleSave(req));
  }
  if (notFoundBtn) {
    notFoundBtn.addEventListener('click', () => handleNotFound(req));
  }
}

// ---------------------------------------------------------------------------
// Save — fill contact fields + mark request done
// ---------------------------------------------------------------------------

async function handleSave(req: ResearchRequest) {
  if (!currentProfile) return;
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
  const fillMsg = document.getElementById('fill-msg');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  if (fillMsg) { fillMsg.className = 'hidden'; fillMsg.textContent = ''; }

  const emailEl = document.getElementById('fill-email') as HTMLInputElement | null;
  const mobileEl = document.getElementById('fill-mobile') as HTMLInputElement | null;
  const liEl = document.getElementById('fill-linkedin') as HTMLInputElement | null;
  const desigEl = document.getElementById('fill-designation') as HTMLInputElement | null;

  const email = emailEl?.value.trim() || null;
  const mobile = mobileEl?.value.trim() || null;
  const linkedinUrl = liEl?.value.trim() || null;
  const designation = desigEl?.value.trim() || null;

  const supabase = getSupabaseClient();
  const userId = String(currentProfile.user_id);
  const now = new Date().toISOString();

  // --- 1. Update contact_master if we have a linked contact ---
  if (req.contact_id) {
    // Build only the fields we want to write (avoid overwriting filled fields with empty strings)
    type ContactUpdate = {
      updated_by: string;
      updated_date: string;
      email?: string;
      mobile_no?: string;
      linkedin_url?: string;
      linkedin_clean?: string;
      designation?: string;
    };
    const updates: ContactUpdate = {
      updated_by: userId,
      updated_date: now,
    };
    if (email) updates.email = email;
    if (mobile) updates.mobile_no = mobile;
    if (linkedinUrl) {
      updates.linkedin_url = linkedinUrl;
      // Re-derive linkedin_clean using the spec-compliant normalizer
      const slug = normalizeLinkedinSlug(linkedinUrl);
      if (slug) updates.linkedin_clean = slug;
    }
    if (designation) updates.designation = designation;

    const { error: contactErr } = await supabase
      .from('contact_master')
      .update(updates)
      .eq('contact_id', req.contact_id);

    if (contactErr) {
      const userMsg = contactErr.code === '42501'
        ? 'Permission denied — your role cannot edit this contact yet (research write-path not unlocked; see ALT-152). The request status was NOT changed.'
        : `Failed to update contact: ${contactErr.message}`;
      showFillMsg(userMsg, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & mark done'; }
      return;
    }
  }

  // --- 2. Mark the research request as done ---
  const { error: reqErr } = await supabase
    .from('contact_research_request')
    .update({
      status: 'done',
      fulfilled_by: userId,
      fulfilled_at: now,
      updated_by: userId,
      updated_date: now,
    })
    .eq('request_id', req.request_id);

  if (reqErr) {
    if (reqErr.code === '42P01') {
      showFillMsg(backendNotReadyMsg(), 'error');
    } else if (reqErr.code === '42501') {
      showFillMsg('Permission denied — your role cannot update research requests yet. Contact your admin.', 'error');
    } else {
      showFillMsg(`Failed to update request: ${reqErr.message}`, 'error');
    }
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & mark done'; }
    return;
  }

  // Success — update local state and re-render
  if (detailRequest) {
    detailRequest = { ...detailRequest, status: 'done', fulfilled_by: userId, fulfilled_at: now };
    if (detailContact && (email || mobile || linkedinUrl || designation)) {
      detailContact = {
        ...detailContact,
        email: email ?? detailContact.email,
        mobile_no: mobile ?? detailContact.mobile_no,
        linkedin_url: linkedinUrl ?? detailContact.linkedin_url,
        designation: designation ?? detailContact.designation,
      };
    }
  }
  renderDetailView();
}

// ---------------------------------------------------------------------------
// Mark not found
// ---------------------------------------------------------------------------

async function handleNotFound(req: ResearchRequest) {
  if (!currentProfile) return;
  const notFoundBtn = document.getElementById('not-found-btn') as HTMLButtonElement | null;
  if (notFoundBtn) { notFoundBtn.disabled = true; notFoundBtn.textContent = 'Saving…'; }

  const supabase = getSupabaseClient();
  const userId = String(currentProfile.user_id);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('contact_research_request')
    .update({
      status: 'not_found',
      fulfilled_by: userId,
      fulfilled_at: now,
      updated_by: userId,
      updated_date: now,
    })
    .eq('request_id', req.request_id);

  if (error) {
    if (error.code === '42P01') {
      showFillMsg(backendNotReadyMsg(), 'error');
    } else if (error.code === '42501') {
      showFillMsg('Permission denied — cannot update research requests yet.', 'error');
    } else {
      showFillMsg(`Error: ${error.message}`, 'error');
    }
    if (notFoundBtn) { notFoundBtn.disabled = false; notFoundBtn.textContent = 'Mark not found'; }
    return;
  }

  if (detailRequest) {
    detailRequest = { ...detailRequest, status: 'not_found', fulfilled_by: userId, fulfilled_at: now };
  }
  renderDetailView();
}

function showFillMsg(msg: string, type: 'error' | 'info') {
  const el = document.getElementById('fill-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'error' ? 'msg-error' : 'msg-info';
}

// ---------------------------------------------------------------------------
// Profile context (shown as a banner when active tab is a LinkedIn /in/ URL)
// ---------------------------------------------------------------------------

async function renderProfileBanner(slug: string) {
  profileBanner.classList.remove('hidden');

  // Lazy lookup
  let bannerHtml = `
    <div class="profile-banner-inner">
      <span class="banner-slug">LinkedIn: <strong>${esc(slug)}</strong></span>
  `;

  try {
    const contact = await findContactDup(slug);
    if (contact) {
      bannerHtml += `<span class="banner-match">Found: ${esc(contact.full_name)} @ ${esc(contact.company_name ?? '—')}</span>`;
    } else {
      bannerHtml += `<span class="banner-no-match">Not in CRM</span>`;
    }

    // Check if there's already an open request for this slug
    const supabase = getSupabaseClient();
    const { data: existingReq } = await supabase
      .from('contact_research_request')
      .select('request_id, status')
      .eq('linkedin_clean', slug)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle()
      .catch(() => ({ data: null }));

    if (existingReq) {
      bannerHtml += `<span class="banner-req">Open request #${(existingReq as { request_id: number }).request_id}</span>`;
    } else {
      bannerHtml += `<button id="raise-from-banner" class="btn-raise">+ Raise request</button>`;
    }
  } catch {
    // Degrade silently — the banner still shows the slug
  }

  bannerHtml += '</div>';
  profileBanner.innerHTML = bannerHtml;

  const raiseBtn = document.getElementById('raise-from-banner');
  if (raiseBtn) {
    raiseBtn.addEventListener('click', () => openRaiseForm(slug));
  }
}

function clearProfileBanner() {
  profileBanner.classList.add('hidden');
  profileBanner.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Raise request form
// ---------------------------------------------------------------------------

function openRaiseForm(prefillSlug?: string) {
  raiseLinkedin.value = prefillSlug
    ? `https://www.linkedin.com/in/${prefillSlug}`
    : '';
  raiseFields.value = '';
  raiseNotes.value = '';
  raiseMsg.className = 'hidden';
  raiseMsg.textContent = '';
  showTopView('raise');
}

raiseCancelBtn.addEventListener('click', () => {
  showTopView('main');
  showMainSub('queue');
});

raiseCancelBtn2.addEventListener('click', () => {
  showTopView('main');
  showMainSub('queue');
});

raiseSubmitBtn.addEventListener('click', async () => {
  if (!currentProfile) return;

  const url = raiseLinkedin.value.trim();
  const fields = raiseFields.value.trim();
  const notes = raiseNotes.value.trim();

  if (!url && !fields) {
    raiseMsg.textContent = 'Please enter at least a LinkedIn URL or fields needed.';
    raiseMsg.className = 'msg-error';
    return;
  }

  raiseSubmitBtn.disabled = true;
  raiseSubmitBtn.textContent = 'Submitting…';
  raiseMsg.className = 'hidden';

  const slug = normalizeLinkedinSlug(url) || null;
  const supabase = getSupabaseClient();
  const userId = String(currentProfile.user_id);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('contact_research_request')
    .insert({
      linkedin_url: url || null,
      linkedin_clean: slug,
      fields_needed: fields || null,
      notes: notes || null,
      requested_by: userId,
      requested_at: now,
      status: 'pending',
      created_by: userId,
      created_date: now,
    });

  raiseSubmitBtn.disabled = false;
  raiseSubmitBtn.textContent = 'Submit request';

  if (error) {
    if (error.code === '42P01') {
      raiseMsg.textContent = 'Backend not ready — ask the CRM team to apply REQUEST 3 (contact_research_request table).';
    } else if (error.code === '42501') {
      raiseMsg.textContent = 'Permission denied — your role cannot raise research requests yet.';
    } else {
      raiseMsg.textContent = `Error: ${error.message}`;
    }
    raiseMsg.className = 'msg-error';
    return;
  }

  // Success — return to queue
  showTopView('main');
  showMainSub('queue');
  await loadQueue();
});

// ---------------------------------------------------------------------------
// Background messages (URL watcher)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: BgMessage) => {
  if (!currentProfile) return;

  if (message.type === 'TAB_URL') {
    currentSlug = message.slug;
    renderProfileBanner(message.slug);
  } else if (message.type === 'TAB_IDLE') {
    currentSlug = null;
    clearProfileBanner();
  }
});

function queryCurrentTab() {
  chrome.runtime.sendMessage({ type: 'QUERY_CURRENT_TAB' }, (response: BgMessage | undefined) => {
    if (chrome.runtime.lastError || !response) return;
    if (response.type === 'TAB_URL') {
      currentSlug = response.slug;
      renderProfileBanner(response.slug);
    } else {
      clearProfileBanner();
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function spinner(label: string): string {
  return `
    <div style="text-align:center;padding:24px 12px;">
      <div class="spinner"></div>
      <p style="color:#888;font-size:12px;margin-top:8px;">${esc(label)}</p>
    </div>`;
}

function errorMsg(msg: string): string {
  return `<div class="msg-error">${typeof msg === 'string' ? esc(msg) : msg}</div>`;
}

function backendNotReadyMsg(): string {
  return 'Backend not ready — ask the CRM team to apply REQUEST 3 (contact_research_request table, ALT-282 R3).';
}

function fieldStatusRow(label: string, value: string | null | undefined): string {
  const filled = !!(value && value.trim());
  return `
    <div class="field-row">
      <span class="label">${esc(label)}</span>
      <span class="value">
        ${filled
          ? `<span class="filled-badge">filled</span> <span style="color:#374151;">${esc(value!)}</span>`
          : `<span class="missing-badge">missing</span>`}
      </span>
    </div>`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':     return 'badge-gray';
    case 'in_progress': return 'badge-orange';
    case 'done':        return 'badge-green';
    case 'not_found':   return 'badge-red';
    default:            return 'badge-gray';
  }
}

// Suppress TS unused import warning — fetchProjects is a shared helper available
// for future project-scoped queue filtering.
void fetchProjects;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(async function boot() {
  const profile = await getSessionAndProfile();
  if (profile) {
    currentProfile = profile;
    setAuthUI(profile);
    showTopView('main');
    showMainSub('queue');
    await loadQueue();
    queryCurrentTab();
  } else {
    setAuthUI(null);
    showTopView('login');
  }
})();
