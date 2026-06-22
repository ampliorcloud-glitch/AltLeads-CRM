/**
 * gen-backlog-tracker.cjs
 * ========================
 * Generates (or refreshes) docs/AltLeads-Backlog-Tracker.xlsx
 * Re-run any time to merge new tickets while preserving manually-edited Notes/Status/Created.
 *
 * Usage:
 *   cd new-code/web && node scripts/gen-backlog-tracker.cjs
 */

'use strict';

const XLSX   = require('xlsx');
const path   = require('path');
const fs     = require('fs');

// ─── OUTPUT PATH ───────────────────────────────────────────────────────────────
const OUT_PATH = path.resolve(
  __dirname,
  '../../../docs/AltLeads-Backlog-Tracker.xlsx'
);

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const d = (y, m, day) => y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
const TODAY = d(2026, 6, 21);

// ─── UX AUDIT TICKETS (2026-06-21) ───────────────────────────────────────────
// Generated from the 26-agent UX/UI/feature-gap audit (718 raw -> 170 deduped).
// Full report: docs/product/UX-AUDIT.md. Epic ALT-177; Top-30 ALT-178..207;
// missing-capability bundles ALT-208..214; quick-wins batch ALT-215.
function uxAuditTickets() {
  const AD = d(2026, 6, 21);
  const mk = (id, title, type, module, priority, notes) => ({
    id, title, type, module, wave: 'UX audit', priority, status: 'Planned',
    created: AD, updated: AD, finished: null, owner: 'Claude', notes,
  });
  const out = [];
  out.push(mk('ALT-177', 'UX/UI/feature-gap audit — 26-agent swarm (718→170 findings)', 'Docs', 'UX', 'P1',
    'Full report: docs/product/UX-AUDIT.md. 26 agents (15 screen + 9 dimension + synthesis + critic). 718 raw → 170 deduped findings · 13 themes · 14 quick wins · Top-30 (ALT-178..207) · 27 missing capabilities (ALT-208..214) · quick-wins batch (ALT-215). Owner to REVIEW and pick the launch-with items before any build.'));

  // [title, module, severity, effort, priority, detail]
  const top = [
    ['Bulk-action bars on all lists (multiselect only Exports today)', 'UX', 'High', 'L', 'P2', 'Shared SelectionActionBar when sel>0: bulk status/stage change, reassign, approve, login-provision. Needs new batch endpoints (data layer is single-record today).'],
    ['One global toast + confirmation system', 'UX', 'High', 'M', 'P1', 'No app-wide toast; only one window.confirm in whole app. ToastProvider (auto-dismiss, success/error/info, aria-live) + branded ConfirmDialog routed through all write paths. Unlocks dozens of downstream findings.'],
    ['Confirm every destructive / irreversible action', 'UX', 'High', 'M', 'P1', 'Clinch, confirm/cancel meeting, request-approval, approve, disable user/project, unassign, convert all fire on one click with no guard/undo. SHIP WITH LAUNCH.'],
    ['Restore a visible keyboard focus indicator app-wide', 'UX', 'High', 'S', 'P2', 'index.css strips outline from every control — WCAG 2.4.7 fail. Add global :focus-visible ring + brand ring on form controls.'],
    ['Make table rows + sortable headers keyboard-operable', 'UX', 'High', 'M', 'P2', 'Rows are onClick on non-focusable <tr>; headers no role/aria-sort. NotificationsPage already does it right — replicate.'],
    ['Searchable multi-select filters (replace single-select dropdowns)', 'UX', 'High', 'M', 'P2', 'Every facet is a native single <select> over hundreds of options. SearchSelect combobox already exists but used in zero filters. Multi-select + chips + set.has() predicates.'],
    ['Advanced / per-column filtering + missing core facets', 'UX', 'High', 'L', 'P2', 'No contains/is-empty/AND-OR; customizer-added columns un-filterable. Missing facets: Account Status/Demo/Size/Owner/date on Companies; Contact Status; Meeting Mode+Confirmed; Wishlist Unassigned.'],
    ['Saved views capturing filters+sort+density (multiple, named)', 'UX', 'High', 'M', 'P2', 'user_view_pref has a name column but saveView persists only columns + one anonymous slot. Extend to {columns,filters,sorting,pageSize,density} + view picker (save-as/rename/delete).'],
    ['Persist list/detail state (filters, sort, page, tab) in the URL', 'UX', 'High', 'M', 'P2', 'All state is React-only; refresh/back/share resets the worklist. Serialize to query params; sync active tab + projectId on detail pages.'],
    ['"Select all N matching" across pages (not just current page)', 'UX', 'Medium', 'M', 'P3', 'Header checkbox toggles only the visible page; partial off-page selection silently scopes Export. Add "Select all N matching" banner.'],
    ['Global search / Cmd-K command palette', 'UX', 'High', 'L', 'P2', 'No global search anywhere. Cmd/Ctrl-K across leads/companies/contacts/meetings by name/number/phone with deep-link navigation.'],
    ['Converge on one DataTable engine (migrate Contacts + Approvals)', 'UX', 'High', 'L', 'P2', 'Contacts + Approvals are hand-rolled; others use TanStack — divergent headers/row-heights/sort-glyphs and every fix built 3×. One <DataTable> + shared spec.'],
    ['Dirty-state navigation guard on all forms/modals', 'UX', 'High', 'M', 'P2', 'No form tracks dirty; Cancel/back/tab-switch/backdrop silently discards edits. Track isDirty + useBlocker + beforeunload + modal-close guard. Worst for ReportTab (~20 fields).'],
    ['Move filter/sort/paginate server-side (stop loading whole datasets)', 'Data', 'High', 'L', 'P2', 'Every list downloads the full dataset + lookups on mount; Contacts capped at 1000. Push to Supabase range+filters or cache; remove the 1000 cap.'],
    ['Role-aware, actionable dashboard ("what do I do today")', 'UX', 'High', 'L', 'P2', 'Dashboard never calls useAuth; same org-wide all-time totals for everyone. Scope to current user, add "my meetings today / follow-ups due / leads needing first contact", TL/ADMIN rollups.'],
    ['Clickable dashboard drill-downs (cards/bars/activity rows)', 'UX', 'High', 'M', 'P2', 'All stat cards, stage bars, activity rows are static (some even fake a hover). Wire each to the filtered list / record.'],
    ['Masked email/phone → distinct masked + click-to-reveal treatment', 'Security', 'High', 'M', 'P2', 'Masked values render identical to genuinely empty ("—"); the locked partial-mask+click-reveal decision (ADR-22) has no UI. Lock/dotted treatment + Reveal + copy. Pairs with ALT-173.'],
    ['Sticky table headers + frozen identity column', 'UX', 'Medium', 'S', 'P3', 'No thead is sticky; with 100 rows/page headers scroll away. Sticky header + freeze select+name column + scroll-shadow cue.'],
    ['Top-level React ErrorBoundary (+ per-route fallback)', 'UX', 'High', 'M', 'P2', 'Any uncaught render error white-screens the whole SPA. Add top-level ErrorBoundary + per-route fallbacks + logging.'],
    ['Forgot-password + show/hide toggle; reauth on password change', 'Security', 'High', 'M', 'P2', '~110/111 users freshly provisioned will mistype initial passwords. Add reset flow + eye toggle + mailto help-desk; require current password before change in Settings.'],
    ['Constrain header stage-select + meeting workflow transitions', 'Leads', 'High', 'M', 'P2', 'Stage dropdown lists every stage so an agent can jump to "Meeting Successful" bypassing report/approval; closed leads still mutable. Constrain to valid next steps / make read-only.'],
    ['Form validation (email/phone/URL/required/dirty) + on-blur feedback', 'UX', 'Medium', 'M', 'P3', 'Phone accepts any text; email/URL validated inconsistently; required name can save empty; submit-only single error. Shared validators + on-blur inline errors.'],
    ['Skeleton rows/cards instead of a single centered spinner', 'UX', 'Medium', 'M', 'P3', 'Loading collapses the table to one spinner row → layout jump on every navigation. Skeleton rows matching columns + role=status.'],
    ['Collapsible filter panels + active-filter chips + per-filter clear', 'UX', 'Medium', 'M', 'P3', '8–11 filters in an always-open panel push the table below the fold; only all-or-nothing Clear. Collapsible "Filters" + active-count badge + removable chips.'],
    ['Fix Companies Account-Status column (load full set; sort/filter/export)', 'Companies', 'High', 'M', 'P2', 'Status batch-fetched per page only → can\'t sort/filter, flickers on project change, export blanks unscrolled pages. Merge into row data + per-project cache.'],
    ['Proper ARIA dialog semantics + focus trap on modals', 'UX', 'High', 'M', 'P2', 'Only AssignModal sets role=dialog. Centralize Esc-to-close, focus trap, initial focus, focus-restore, aria-labelledby in one Modal shell.'],
    ['Approvals queue: age/SLA, sort, search, filters, pagination, in-modal approve', 'Leads', 'Medium', 'M', 'P3', 'No search/filters/sort/pagination/age/history/in-preview approve; sidebar badge lags 60s. Add SLA aging + Pending|Approved|Rejected + immediate badge refresh.'],
    ['Inline-edit + quick row/hover actions across lists & detail panels', 'UX', 'Medium', 'M', 'P3', 'Editing one field needs a full page nav. Inline status/notes edit, per-field detail edit, hover quick-actions (copy email/phone, quick status). Core to update-only outreach.'],
    ['Make the Sales Portal a first-class shell (not the internal grid reskinned)', 'Sales Portal', 'Medium', 'M', 'P3', '/sales reuses internal LeadsPage verbatim (unscoped, internal chrome, dead pencil link). Add sales dashboard/notifications/settings, gate internal controls, portal switcher.'],
    ['Standardize shared primitives (Button/Badge/Avatar/Input/Modal/Pagination/EmptyState)', 'UX', 'Medium', 'M', 'P3', '3 button systems, 5 badge styles, 5 avatar copies, 4 input/pagination copies, hardcoded hex vs CSS tokens. Extract one component per atom; kill drift; enable theming.'],
  ];
  top.forEach((row, i) => {
    const [title, module, sev, eff, pri, detail] = row;
    out.push(mk('ALT-' + (178 + i), title, 'Feature', module, pri,
      sev + ' severity · effort ' + eff + ' · UX-AUDIT Top-30 #' + (i + 1) + '. ' + detail));
  });

  // Missing-capability bundles (critic gaps — capabilities that don't exist yet)
  const missing = [
    ['Calling loop — single-screen queue→dial→log→auto-advance + click-to-call + call logging', 'Tasks', 'P2', 'Critic gap. Core to high-volume outreach speed; the recorded call history also feeds the AI "superpower" (RAG).'],
    ['Task manager — follow-up reminders, callback scheduling, snooze/defer, to-dos', 'Tasks', 'P2', 'Owner-requested task manager. "Call back tomorrow 3pm" set on a record and surfaced when due; snooze pushes a lead out of today and brings it back.'],
    ['Today work-queue / prioritized worklist (overdue, untouched, fresh assignments)', 'Tasks', 'P2', 'Turns the passive dashboard into a driver of next actions; the single screen a caller lives in.'],
    ['Duplicate detection & merge (leads / contacts / companies)', 'Data', 'P2', 'Known risk after the bulk migration. Detect + merge dup records.'],
    ['Data trust layer — freshness (days-since-touch), SLA/aging cues, per-record audit history', 'Data', 'P2', 'Helps agents prioritize + trust data, lets TLs manage the floor, and feeds AI. "Who changed what, when" surfaced consistently.'],
    ['Quick-access — global quick-search, inline row quick-edit, recently-viewed/pinned, undo', 'UX', 'P2', 'Speed for users who live in lists all day. Overlaps Top-30 #11/#28; undo-toast for status/disposition/bulk edits.'],
    ['Compliance & comfort — Do-Not-Call/opt-out, timezone-aware scheduling, density/compact mode, dark mode, per-user notif prefs, first-run onboarding, autosave of notes', 'UX', 'P3', 'Bundle of critic gaps: compliance flag + warning, caller-vs-prospect TZ, compact rows, theme, notification preferences, onboarding for the 110 first-login users, and autosave so a dropped session keeps call notes.'],
  ];
  missing.forEach((row, i) => {
    const [title, module, pri, detail] = row;
    out.push(mk('ALT-' + (208 + i), title, 'Feature', module, pri,
      'Missing capability (UX-AUDIT §5, completeness critic). ' + detail));
  });

  // ── Progress (2026-06-21 launch-safety bundle, commit aa9375e) ──────────────
  // Mark what shipped locally so the board reflects reality.
  const PROGRESS = {
    'ALT-179': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: ToastProvider/useToast + ConfirmProvider/useConfirm built and mounted at App root (src/components/ui/Toast.tsx + ConfirmDialog.tsx). Now used by the launch-safety wiring; remaining pages migrate to it incrementally.' },
    'ALT-180': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: confirm wired on cancel-meeting, approve-report (Approvals + inline ReportTab), request-approval (locks form), disable-user, disable-project, remove-member, convert-to-lead, and now clinch/close (mark-successful). Irreversible actions guarded by the branded ConfirmDialog + toast feedback.' },
    'ALT-181': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: global :focus-visible brand ring restored in index.css (was stripping outline from every control).' },
    'ALT-182': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: all 5 lists — data rows keyboard-operable (role=link, tabIndex, Enter/Space opens) and sortable headers get role=button + aria-sort + Enter/Space-to-sort.' },
    'ALT-186': { status: 'In Progress', finished: null, extra: ' 🔧 IN PROGRESS 2026-06-21: useUrlState/useUrlString/useUrlNumber/useUrlStringArray hooks built (src/lib/useUrlState.ts, on react-router useSearchParams); dashboard drill-downs already deep-link /leads?stage=. Remaining: wire list filters/sort/page/tab to the URL.' },
    'ALT-188': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: global Cmd/Ctrl-K CommandPalette across leads/companies/contacts (keyboard nav + deep-link) + TopBar Search button. Index reuses existing RLS-safe fetchers, cached, cleared on logout.' },
    'ALT-193': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: dashboard stat cards, stage bars, and recent-activity rows are keyboard-operable drill-downs (cards→list, bars→/leads?stage=, rows→/leads/:id) + personalized header.' },
    'ALT-196': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: top-level ErrorBoundary at app root (Reload / Go to dashboard fallback; DEV-only stack). RouteErrorBoundary helper available for per-route use.' },
    'ALT-197': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: ForgotPasswordPage + ResetPasswordPage (+ routes), LoginPage show/hide toggle + Forgot link. OWNER OPS: add <origin>/reset-password to Supabase Auth Redirect URLs for prod.' },
    'ALT-199': { status: 'In Progress', finished: null, extra: ' 🔧 IN PROGRESS 2026-06-21: shared pure validators built (src/lib/validators.ts: isEmail/isPhone/isUrl/isRequired + validateField/validateForm). Remaining: wire on-blur inline errors into Contact/Company/Lead forms.' },
    'ALT-200': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: Skeleton/SkeletonText/SkeletonTable/SkeletonCards built; all 5 lists render column-aligned skeleton rows on load instead of one spinner (no layout jump).' },
    'ALT-204': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: Approvals queue gained an SLA age badge (escalating colour), search, sort (oldest-first SLA / name), no-match state, and in-modal Approve/Reject. Pagination deferred (low value at current volume).' },
    'ALT-213': { status: 'In Progress', finished: null, extra: ' 🔧 IN PROGRESS 2026-06-21: global quick-search delivered via the Cmd-K palette (ALT-188). Remaining: inline row quick-edit, recently-viewed/pinned, undo-toast.' },
    'ALT-183': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21 (owner #1 ask): reusable MultiSelectFilter (searchable popover + checkboxes + chip count, OR-within-facet, empty=all) now on ALL FIVE lists — Leads (Agent/Project/City/Source/Industry/Stage), Contacts (Company/City), Companies (Industry/City), Meetings (Agent/Industry/City/Salesperson/Status), Wishlist (Status/Agent/TeamLead/Industry/City). Separate follow-up: per-column/advanced operators (Top#7, ALT-184).' },
    'ALT-203': { status: 'Done',        finished: AD, extra: ' ✅ DONE 2026-06-21: shared admin Modal + global ConfirmDialog now have role=dialog/aria-modal/aria-label, Escape-to-close, initial focus, focus-restore, AND a real focus-trap (useFocusTrap — Tab/Shift+Tab cycle inside). Bespoke meeting/approval modals can adopt the hook as touched.' },
    'ALT-190': { status: 'In Progress', finished: null, extra: ' 🔧 IN PROGRESS 2026-06-21: useUnsavedChanges hook (localStorage draft cache + restore + beforeunload warn) wired into the New/Edit Lead, Contact and Company forms with Cancel-confirm; drafts cleared on save + on logout. Remaining: detail-page edit modes + modals + (optional) in-app route blocker (needs data-router).' },
    'ALT-215': { status: 'In Progress', finished: null, extra: ' 🔧 IN PROGRESS 2026-06-21: shipped #1 (truncation tooltips), #2 (removed dev "read-only preview" banners on Leads/Wishlist/Dashboard), #3 (bell → /notifications + unread badge), #4 (hide create from non-admins), #5 (focus ring, see ALT-181), #6 (search-clear ×), #7 (copy-to-clipboard + mailto/tel via CopyButton), #9 (surface swallowed errors), #11 (no-data vs no-match empty states + inline Clear-filters on Leads/Contacts/Companies), #13 (Contacts 1000-row cap), #14 (modal Esc). NOW ALSO #8 (checkbox aria-labels on all 5 lists) + #12 (Retry on load error on all 5 lists). Remaining: #10 (persist filters/tab to URL — hook built, see ALT-186).' },
  };

  out.push(mk('ALT-215', 'UX quick-wins batch — 14 small, high-payoff fixes', 'Task', 'UX', 'P1',
    'All effort-S (hours each), UX-AUDIT §3: (1) tooltips on truncated cells (2) remove dev "read-only preview" banners (3) wire bell→/notifications + unread badge (4) hide create buttons from outreach roles (5) global focus ring (6) search clear (×) (7) mailto/tel + copy-to-clipboard (8) checkbox/bell aria-labels (9) SURFACE swallowed inline status/stage/toggle errors (10) persist tab/banner state (11) "no data" vs "no match" empty states (12) Retry on load errors (13) fix Contacts 1000-row cap (14) modal Esc + dirty-backdrop guard. Items 4, 9, 13 + Top-30 #3 = SHIP WITH LAUNCH (they hide failure / data loss).'));

  for (const t of out) {
    const p = PROGRESS[t.id];
    if (p) { t.status = p.status; t.finished = p.finished; t.notes += p.extra; }
  }
  return out;
}

// ─── TICKET DATA ──────────────────────────────────────────────────────────────
// Columns: ID, Title, Type, Module, Wave/Epic, Priority, Status,
//          Created, LastUpdated, Finished, Owner, Notes
//
// Type:     Feature | Bug | Task | Chore | Security | Docs
// Module:   Deploy/Infra | Notifications | Contacts | Companies | Leads |
//           Meetings | Wishlist | Admin | Security | AI | Docs | Data
// Priority: P0 | P1 | P2 | P3
// Status:   Done | In Progress | Planned | Blocked
// Owner:    Claude | Mohit | Sub-agent

const TICKETS = [

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Foundation & Repo
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-001', title:'Lock tech stack (Supabase + React/Vite + repaired RN)',
    type:'Task', module:'Deploy/Infra', wave:'Foundation',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,11), finished: d(2026,6,11),
    owner:'Mohit',
    notes:'Owner-approved 2026-06-11. No Java, no MySQL, no droplet.'
  },
  {
    id:'ALT-002', title:'Archive vendor code to old-code/ and clean repo',
    type:'Chore', module:'Deploy/Infra', wave:'Foundation',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,11), finished: d(2026,6,11),
    owner:'Claude',
    notes:'Clean commit e10f4c1. Secrets to .credentials/ (gitignored).'
  },
  {
    id:'ALT-003', title:'Create GitHub repo with clean history (AltLeads-CRM)',
    type:'Chore', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Claude',
    notes:'New clean repo; old-code/figma/secrets excluded. Git auto-deploy to Hostinger wired.'
  },
  {
    id:'ALT-004', title:'Verify & store Supabase / Netlify / DO access tokens',
    type:'Task', module:'Deploy/Infra', wave:'Foundation',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,11), finished: d(2026,6,11),
    owner:'Mohit',
    notes:'Tokens in .credentials/ (gitignored). DO API token verified.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Data Migration
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-005', title:'Create Supabase project (amplior-crm, Mumbai)',
    type:'Task', module:'Data', wave:'Migration',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Claude',
    notes:'IDs/keys in .credentials/. Region ap-south-1.'
  },
  {
    id:'ALT-006', title:'Recreate full 65-table schema in Supabase',
    type:'Task', module:'Data', wave:'Migration',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Vendor added 21 audit tables post-Jan; drift captured in schema-drift.sql.'
  },
  {
    id:'ALT-007', title:'Fork DO MySQL cluster and copy ~108k rows to Supabase',
    type:'Task', module:'Data', wave:'Migration',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'65/65 tables row-count match. Production never touched. Migration report in new-code/migration/.'
  },
  {
    id:'ALT-008', title:'Apply foreign keys (60/64; 4 skipped for orphan rows)',
    type:'Task', module:'Data', wave:'Migration',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'fk-skipped.txt lists 4 vendor data-quality issues; nothing deleted.'
  },
  {
    id:'ALT-009', title:'Reset all Postgres identity sequences after explicit-PK migration',
    type:'Bug', module:'Data', wave:'Migration',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Claude',
    notes:'CRITICAL: sequences were at 1 causing PK collisions on all inserts. Fixed via setval DO-block on all 65 tables.'
  },
  {
    id:'ALT-010', title:'Remove dead placeholder code (mockLeads.ts, PlaceholderPage.tsx)',
    type:'Chore', module:'Data', wave:'Foundation',
    priority:'P2', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'Verified 2026-06-21: mockLeads.ts + PlaceholderPage.tsx no longer exist (removed in an earlier cleanup). Only the actively-used SalesPlaceholderPage remains.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Auth & Security
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-011', title:'Supabase Auth login (email + password)',
    type:'Feature', module:'Security', wave:'Auth',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Verified: mohit@amplior.com → role ADMIN. profiles table links auth.users → user_master + role.'
  },
  {
    id:'ALT-012', title:'Auto-onboard trigger (on_auth_user_created) matching by email',
    type:'Feature', module:'Security', wave:'Auth',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Trigger auto-builds profiles row with role from user_role → role_master.'
  },
  {
    id:'ALT-013', title:'Route protection (block pages when logged out / wrong role)',
    type:'Feature', module:'Security', wave:'Auth',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Admin nav gated to ADMIN role. 6 roles in DB: ADMIN, TEAM_LEAD, SALES_HEAD, SALES_PERSON, AGENT, QC.'
  },
  {
    id:'ALT-014', title:'Decide: do not migrate old plaintext passwords',
    type:'Task', module:'Security', wave:'Auth',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Mohit',
    notes:'At go-live each user gets a one-time set-your-password email.'
  },
  {
    id:'ALT-015', title:'RLS baseline — enable RLS on all 70 tables, block anon, block self-promote',
    type:'Security', module:'Security', wave:'Security audit',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'70/70 tables; authenticated full access on 68; profiles SELECT-only; anon denied; adversarially verified. SQL: rls-policies.sql.'
  },
  {
    id:'ALT-016', title:'Hide legacy plaintext password column from API',
    type:'Security', module:'Security', wave:'Security audit',
    priority:'P0', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Claude',
    notes:'REVOKE SELECT/INSERT/UPDATE on user_master + user_master_audit for anon+authenticated. Script: hide-password-column.js.'
  },
  {
    id:'ALT-017', title:'Fine-grained per-role RLS (agent sees own leads via created_by)',
    type:'Security', module:'Security', wave:'Security audit',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Access RLS v1: lead row-isolation + write-locks + owner/manager/admin logging rules. v1b: contact masking view + column revoke + find_contact_dup RPC. v2: project_visibility_setting dials + Project Access admin UI. Proven with throwaway logins.'
  },
  {
    id:'ALT-018', title:'Full IDOR/RLS security audit (sub-agent pass, all modules)',
    type:'Security', module:'Security', wave:'Security audit',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Multi-agent security audit -> docs/SECURITY-AUDIT.md. 29 findings, 14 High/Critical. All critical issues addressed in hardening pass same day.'
  },
  {
    id:'ALT-019', title:'Fix xlsx CVE (swap xlsx@0.18.5 → SheetJS 0.20.3)',
    type:'Security', module:'Security', wave:'Security audit',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Claude',
    notes:'CDN tarball, same import/API, drop-in. Build passes. 313kB gzip.'
  },
  {
    id:'ALT-020', title:'Set one-time password-set emails to all users at go-live',
    type:'Task', module:'Security', wave:'Security audit',
    priority:'P0', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Claude',
    notes:'Batch-send script needed. Email service is live.'
  },
  {
    id:'ALT-021', title:'Prune DO DB firewall IPs (~14 old vendor devs) at cutover',
    type:'Task', module:'Security', wave:'Security audit',
    priority:'P1', status:'Planned',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Prune at cutover, not before — one may be owner office IP.'
  },
  {
    id:'ALT-022', title:'Refine manager access to true team-scope RLS',
    type:'Security', module:'Security', wave:'Security audit',
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Start with managers-see-all; tighten to team-scope after launch.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Leads
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-023', title:'Leads list page on real data (605 leads, pagination)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Pagination added after first owner review. PostgREST 1000-row cap handled with .range().'
  },
  {
    id:'ALT-024', title:'Fix data accuracy: joins used wrong columns (agent_id/company_id vs created_by/client_assoc_id)',
    type:'Bug', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Root cause: company = client_association.client_name via client_assoc_id; owner = created_by. Now 18 owners, 0 null companies.'
  },
  {
    id:'ALT-025', title:'7 Leads filters (vendor CR scope ₹96k)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Sales Person filter dropped — no such field in vendor schema.'
  },
  {
    id:'ALT-026', title:'Excel export of Leads (multi-select + export)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Part of the ₹96k CR scope.'
  },
  {
    id:'ALT-027', title:'Add Lead (/leads/new) with ALT#### number generation',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,14), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Unique number generator scans global max. Retry on 23505 unique-violation.'
  },
  {
    id:'ALT-028', title:'Fix lead number duplicate key bug (generateLeadNumber scanned only last 50)',
    type:'Bug', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Claude',
    notes:'Fix: scan ALL lead_numbers for global max; insertLeadWithUniqueNumber retries on 23505.'
  },
  {
    id:'ALT-029', title:'Edit Lead (/leads/:id/edit)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Was broken at first owner review; since fixed.'
  },
  {
    id:'ALT-030', title:'Lead Detail page (header, all fields, related meetings, stage history)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'/leads/:id. Clickable contacts, activity timeline, stage changer.'
  },
  {
    id:'ALT-031', title:'Lead workspace: HubSpot-style 3 tabs (Activity/Lead Report/Meeting) + right info panel',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'src/components/lead/ + src/data/leadWorkspace.ts. Meeting tab scoped to current lead only.'
  },
  {
    id:'ALT-032', title:'Approval flow (request → TL/Admin queue → approve/reject + notifications)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'/approvals page (gated ADMIN/TL) + sidebar badge + ReportTab inline + email+in-app at each step. Stage IDs verified.'
  },
  {
    id:'ALT-033', title:'Pick existing contact when creating a lead (SearchSelect combobox)',
    type:'Feature', module:'Leads', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'lead_master.contact_id new column added. SearchSelect.tsx combobox (dependency-free).'
  },
  {
    id:'ALT-034', title:'Fix inline create-new-company placeholder values (NOT NULL cols)',
    type:'Bug', module:'Leads', wave:'6 fixes',
    priority:'P1', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Claude',
    notes:'Creates placeholder values into address_id, country_code_id, domain_id, industry_id. Needs refinement.'
  },
  {
    id:'ALT-035', title:'Per-user saved column views on Leads list',
    type:'Feature', module:'Leads', wave:'Per-project status',
    priority:'P2', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'user_view_pref table + UI built. Wave F complete.'
  },
  {
    id:'ALT-036', title:'Full stage-change workflow with approval + auto meeting creation',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P2', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Current stage change is simple only. Deferred — full workflow with auto-meeting creation.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Meetings
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-037', title:'Meetings list on real data (610 rows, 7 filters, pagination)',
    type:'Feature', module:'Meetings', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'610 meetings; 593 lead-linked. Correct column: meeting_status (not empty `status`).'
  },
  {
    id:'ALT-038', title:'Meeting detail page (FRS-parity)',
    type:'Feature', module:'Meetings', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:''
  },
  {
    id:'ALT-039', title:'Excel export of Meetings (18-field)',
    type:'Feature', module:'Meetings', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Part of ₹96k CR scope.'
  },
  {
    id:'ALT-040', title:'Create / schedule a meeting (linked to lead)',
    type:'Feature', module:'Meetings', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:''
  },
  {
    id:'ALT-041', title:'Reschedule / cancel a meeting (UpdateMeetingModal)',
    type:'Feature', module:'Meetings', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'Fires email+in-app on reschedule/cancel.'
  },
  {
    id:'ALT-042', title:'Email + in-app notification on meeting scheduled / rescheduled / cancelled',
    type:'Feature', module:'Notifications', wave:'6 fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'Templates in email-templates.js. Fires via Gmail SMTP.'
  },
  {
    id:'ALT-043', title:'Fix Meeting tab: scope to current lead only (not whole calendar)',
    type:'Bug', module:'Meetings', wave:'Web core',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'fetchLeadMeetings replaces fetchMyMeetings — feedback no longer leaks across leads.'
  },
  {
    id:'ALT-044', title:'Per-user saved views on Meetings list',
    type:'Feature', module:'Meetings', wave:'Per-project status',
    priority:'P2', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Wave F complete. user_view_pref table + UI built.'
  },
  {
    id:'ALT-045', title:'Meeting status workflow for QC role',
    type:'Feature', module:'Meetings', wave:'Web core',
    priority:'P1', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'QC role interaction with meetings not yet specified. Needs owner decision.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Wishlist
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-046', title:'Wishlist list on real data (54 rows, filters, export)',
    type:'Feature', module:'Wishlist', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'wishlist.ts reads company_name + lead_name + assign_agent/assign_tl direct.'
  },
  {
    id:'ALT-047', title:'Add to wishlist + edit wishlist item',
    type:'Feature', module:'Wishlist', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:''
  },
  {
    id:'ALT-048', title:'Assign wishlist item — email + in-app notification',
    type:'Feature', module:'Wishlist', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'wishlist.ts + WishlistDetailPage.tsx wired to notify service.'
  },
  {
    id:'ALT-049', title:'Convert wishlist item → lead',
    type:'Feature', module:'Wishlist', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'convertWishlistToLead uses shared insertLeadWithUniqueNumber helper.'
  },
  {
    id:'ALT-050', title:'Per-user saved views on Wishlist list',
    type:'Feature', module:'Wishlist', wave:'Per-project status',
    priority:'P2', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Wave F complete. user_view_pref table + UI built.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Notifications & Email Service
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-051', title:'Build email + notification service (Node/Express + nodemailer, branded templates)',
    type:'Feature', module:'Notifications', wave:'6 fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'new-code/notify-service. Gmail SMTP from amplior.ankits@gmail.com. /notify + /health, port 8787. Smoke test: real email delivered.'
  },
  {
    id:'ALT-052', title:'Email + in-app on lead assigned / reassigned',
    type:'Feature', module:'Notifications', wave:'6 fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,16), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'createLead/updateLead wired. Recipient = salesperson (lead_report.user_id). Test recipient: ankit.s@amplior.com.'
  },
  {
    id:'ALT-053', title:'Email + in-app on approval requested / approved / rejected',
    type:'Feature', module:'Notifications', wave:'6 fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Fires at each step of approval flow.'
  },
  {
    id:'ALT-054', title:'Live unread-count bell badge in sidebar (60s poll)',
    type:'Feature', module:'Notifications', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'fetchUnreadNotifCount in account.ts. Mirrors Approvals badge pattern.'
  },
  {
    id:'ALT-055', title:'Mark-as-read / unread state on Notifications page',
    type:'Feature', module:'Notifications', wave:'Per-project status',
    priority:'P2', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'Verified 2026-06-21: NotificationsPage already has per-row Mark-read, Mark-all-as-read, optimistic+revert, all/unread tabs, mark-on-open — backed by markNotificationSeen/markAllNotificationsSeen.'
  },
  {
    id:'ALT-056', title:'Tune notification recipients per action (owner to specify each event)',
    type:'Task', module:'Notifications', wave:'Per-project status',
    priority:'P2', status:'Planned',
    created: d(2026,6,16), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Currently recipient = salesperson. Each action has a single TODO-commented spot in code.'
  },
  {
    id:'ALT-057', title:'Add meeting_rescheduled + meeting_cancelled email templates',
    type:'Feature', module:'Notifications', wave:'6 fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Claude',
    notes:'email-templates.js. Both templates added and verified firing.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Admin
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-058', title:'Admin panel built — Users / Projects / Clients / Reference tabs, ADMIN-gated',
    type:'Feature', module:'Admin', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,14), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'Real edits work. Figma-matched (vertical sub-nav, role chips, toggles, modals).'
  },
  {
    id:'ALT-059', title:'Add User: backend POST /api/users/create using service role key',
    type:'Feature', module:'Admin', wave:'6 fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'Creates user_master row + user_role + Supabase Auth account. Temp password returned. Verified end-to-end locally. Needs SUPABASE_SERVICE_ROLE_KEY on Hostinger.'
  },
  {
    id:'ALT-060', title:'Reset any user password (admin): POST /api/users/reset-password',
    type:'Feature', module:'Admin', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Claude',
    notes:'auth.admin.updateUserById. Verified live (404 on bogus id). Prod needs SUPABASE_SERVICE_ROLE_KEY on Hostinger.'
  },
  {
    id:'ALT-061', title:'Admin-editable dropdown option lists UI (Wave B)',
    type:'Feature', module:'Admin', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'dropdown_option table seeded + admin UI management screen built. Wave B complete.'
  },
  {
    id:'ALT-062', title:'Manage roles / change a user\'s role',
    type:'Feature', module:'Admin', wave:'Per-project status',
    priority:'P1', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Confirm role change updates profiles + takes effect immediately.'
  },
  {
    id:'ALT-063', title:'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars on Hostinger',
    type:'Task', module:'Admin', wave:'Deploy',
    priority:'P0', status:'Planned',
    created: d(2026,6,16), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Hard gate: add-user and reset-password return 503 until this is done in production.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Companies & Contacts
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-064', title:'Create contact_master table and migrate 607 contacts from lead_master',
    type:'Task', module:'Data', wave:'Companies & Contacts',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'607 contacts migrated; 130 initially company-linked. DDL in companies-contacts.sql.'
  },
  {
    id:'ALT-065', title:'Add company_master.domain_clean + is_demo columns',
    type:'Task', module:'Data', wave:'Companies & Contacts',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'525 companies updated with domain_clean.'
  },
  {
    id:'ALT-066', title:'Email-domain sync: link contacts to companies by work-email domain',
    type:'Feature', module:'Contacts', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'286 contacts linked (417/608 total now have company_id). Script: backfill-apply.js. 159 contacts with unmatched work domains = candidate for auto-create.'
  },
  {
    id:'ALT-067', title:'interaction table for call-disposition / activity log',
    type:'Task', module:'Data', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'RLS on.'
  },
  {
    id:'ALT-068', title:'Companies list page (525 companies, search, filters, export, pagination)',
    type:'Feature', module:'Companies', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Industry + city filters.'
  },
  {
    id:'ALT-069', title:'Company detail page (HubSpot layout, contacts-by-city, project selector)',
    type:'Feature', module:'Companies', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Project selector display-only.'
  },
  {
    id:'ALT-070', title:'New company with dedup (clean domain OR CIN)',
    type:'Feature', module:'Companies', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Surfaces existing record if match found; blocks duplicate. is_demo=false default.'
  },
  {
    id:'ALT-071', title:'Link existing contact into a company (modal → sets contact.company_id)',
    type:'Feature', module:'Companies', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'"Link existing contact" modal on company detail. Uses SearchSelect combobox.'
  },
  {
    id:'ALT-072', title:'Contacts list page (607 contacts, search, filters, export, pagination)',
    type:'Feature', module:'Contacts', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Default columns per spec.'
  },
  {
    id:'ALT-073', title:'Contact detail full edit (all fields + call/disposition panel)',
    type:'Feature', module:'Contacts', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'All fields editable; call & disposition panel writes to interaction table.'
  },
  {
    id:'ALT-074', title:'Change / clear a contact\'s company (pencil icon on contact detail)',
    type:'Feature', module:'Contacts', wave:'6 fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Sub-agent',
    notes:'updateContactCompany in contacts.ts.'
  },
  {
    id:'ALT-075', title:'New contact with dedup (email → LinkedIn → phone)',
    type:'Feature', module:'Contacts', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Demo mode DEFAULT-ON (skips dedup, is_demo=true).'
  },
  {
    id:'ALT-076', title:'Per-project contact status / description / comments on contact detail (Wave C)',
    type:'Feature', module:'Contacts', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'contact_project_status table + UI display + edit built. Wave C complete.'
  },
  {
    id:'ALT-077', title:'Company detail: account status / feasibility / decision power / desc / comments (Wave E)',
    type:'Feature', module:'Companies', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'company_project_status table + UI (account_status, is_feasible, decision_power, desc, comments) built. Wave E complete.'
  },
  {
    id:'ALT-078', title:'Contact Status column in Contacts list (Wave C)',
    type:'Feature', module:'Contacts', wave:'Per-project status',
    priority:'P1', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Reads contact_project_status.status per active project.'
  },
  {
    id:'ALT-079', title:'Multi-select + export on Contacts list',
    type:'Feature', module:'Contacts', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Wave C complete.'
  },
  {
    id:'ALT-080', title:'Multi-select + export on Companies list',
    type:'Feature', module:'Companies', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Wave F complete.'
  },
  {
    id:'ALT-081', title:'Per-user saved column views on Contacts and Companies',
    type:'Feature', module:'Contacts', wave:'Per-project status',
    priority:'P2', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'user_view_pref table + UI built for Contacts and Companies. Wave C/E complete.'
  },
  {
    id:'ALT-082', title:'Per-project ownership: company_project_owner table + assign UI',
    type:'Feature', module:'Companies', wave:'Per-project status',
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Companies currently show "Unassigned". 1 owner per company PER PROJECT.'
  },
  {
    id:'ALT-083', title:'Masked visibility (names+city to all; details to owner+downline)',
    type:'Feature', module:'Contacts', wave:'Per-project status',
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Depends on per-project ownership + user_master.manager_id hierarchy column.'
  },
  {
    id:'ALT-084', title:'Auto-create companies for 159 contacts with unmatched work domains',
    type:'Task', module:'Data', wave:'Companies & Contacts',
    priority:'P3', status:'Planned',
    created: d(2026,6,16), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:''
  },
  {
    id:'ALT-085', title:'Company detail: LinkedIn field display',
    type:'Feature', module:'Companies', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'Done 2026-06-21: LinkedIn shown in the company "About" grid (CompanyDetailPage), alongside revenue/employees/website/email/CIN.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Per-Project Status Model (Wave A DB done, UI waves B-E)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-086', title:'dropdown_option table + seed starter values (Wave A DB)',
    type:'Task', module:'Data', wave:'Per-project status',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'contact_status ×6, call_disposition ×8, account_status ×7, decision_power ×3, feasibility ×3. SQL: feature-status-schema.sql.'
  },
  {
    id:'ALT-087', title:'contact_project_status table (unique contact+project, status/desc/comments)',
    type:'Task', module:'Data', wave:'Per-project status',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'RLS on (authenticated baseline).'
  },
  {
    id:'ALT-088', title:'company_project_status table (account_status, is_feasible, decision_power, desc, comments)',
    type:'Task', module:'Data', wave:'Per-project status',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Per project per company. RLS on.'
  },
  {
    id:'ALT-089', title:'user_view_pref table (per-user column layout preferences)',
    type:'Task', module:'Data', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Schema only; UI not built yet.'
  },
  {
    id:'ALT-090', title:'Surface pre-sales questions in lead workspace per domain (Wave B)',
    type:'Feature', module:'Leads', wave:'Per-project status',
    priority:'P2', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Pre-sales questions surfaced per domain_master in lead workspace. Wave B complete.'
  },
  {
    id:'ALT-091', title:'Call Disposition UI in Contact detail + Company contact rows',
    type:'Feature', module:'Contacts', wave:'Per-project status',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,17), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Writes to interaction table.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Deploy / Hosting
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-092', title:'Combine web app + email service into one Node process for Hostinger',
    type:'Feature', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Claude',
    notes:'Root package.json + server.js → new-code/notify-service/server.js. Node 22.x.'
  },
  {
    id:'ALT-093', title:'Deploy live at crm.altleads.com (Hostinger, git auto-deploy from AltLeads-CRM)',
    type:'Task', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Claude',
    notes:'HTTP 200, /health OK, email delivery verified. Git auto-deploy from clean AltLeads-CRM repo.'
  },
  {
    id:'ALT-094', title:'Verify email delivery on live Hostinger deploy',
    type:'Task', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Done',
    created: d(2026,6,16), updated: d(2026,6,16), finished: d(2026,6,16),
    owner:'Claude',
    notes:'Live POST /notify → {ok:true}. Gmail SMTP not blocked. Test recipient: ankit.s@amplior.com.'
  },
  {
    id:'ALT-095', title:'Parallel run: team uses new + old system together for 1-2 weeks',
    type:'Task', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'1-2 weeks of owner-led testing. Very little AI work. Old system runs untouched.'
  },
  {
    id:'ALT-096', title:'Cutover — switch fully to new system and retire DigitalOcean',
    type:'Task', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'After parallel run passes. Retire DO droplet + MySQL.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Design Polish
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-097', title:'Set base UI style (Attio/Linear, Inter font, white sidebar)',
    type:'Feature', module:'Deploy/Infra', wave:'Design',
    priority:'P1', status:'Done',
    created: d(2026,6,11), updated: d(2026,6,14), finished: d(2026,6,11),
    owner:'Sub-agent',
    notes:'Done after owner "AI generated" feedback.'
  },
  {
    id:'ALT-098', title:'Export Figma frames as reference PNGs (web + mobile)',
    type:'Task', module:'Docs', wave:'Design',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Web (29) + mobile (23) exported. Admin (35) hit Figma API rate limit (~73h quota).'
  },
  {
    id:'ALT-099', title:'Apply brand design system: blue #1A7EE8 palette, tokens, primitives',
    type:'Feature', module:'Deploy/Infra', wave:'Design',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'index.css tokens, Sidebar/TopBar/AppShell/LoginPage/Badge restyle. docs/DESIGN-SYSTEM.md written.'
  },
  {
    id:'ALT-100', title:'Design-match pass: web app vs Figma "New UI" (29 frames)',
    type:'Feature', module:'Deploy/Infra', wave:'Design',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Split login, lead-detail stepper, leads avatars, breadcrumbs, all modules unified.'
  },
  {
    id:'ALT-101', title:'Design-match pass: Admin panel (from design system, Figma admin unavailable)',
    type:'Feature', module:'Admin', wave:'Design',
    priority:'P2', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Styled from design system. Figma admin frames hit rate limit (~73h; stop retrying).'
  },
  {
    id:'ALT-102', title:'AltLeads logo: "AltLeads" wordmark (Alt=brand blue, Leads=near-black)',
    type:'Feature', module:'Deploy/Infra', wave:'Design',
    priority:'P2', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'src/components/ui/Logo.tsx. Wired into Sidebar + LoginPage. Per owner request.'
  },
  {
    id:'ALT-103', title:'AltLeads bear-head logo SVG asset from owner / Figma zip',
    type:'Task', module:'Deploy/Infra', wave:'Design',
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Currently wordmark only. Owner to provide SVG or extract from Figma zip.'
  },
  {
    id:'ALT-104', title:'Design-match pass: Mobile vs Figma "Mobile UI" (23 frames)',
    type:'Feature', module:'Deploy/Infra', wave:'Design',
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Phase 6.'
  },
  {
    id:'ALT-105', title:'Empty states, loading states, error states polish',
    type:'Feature', module:'Deploy/Infra', wave:'Design',
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:''
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Mobile (Phase 6)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-106', title:'Recreate 2 missing mobile config files (environment_urls, httpMethod)',
    type:'Task', module:'Deploy/Infra', wave:'Mobile',
    priority:'P1', status:'Planned',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Vendor withheld them; RN app can\'t build without them.'
  },
  {
    id:'ALT-107', title:'Rewire mobile RN app to Supabase (new backend, ~57 files)',
    type:'Feature', module:'Deploy/Infra', wave:'Mobile',
    priority:'P1', status:'Planned',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'App is API-driven (RN 0.78). Replace all API endpoint refs with Supabase client calls.'
  },
  {
    id:'ALT-108', title:'New Android signing keystore',
    type:'Task', module:'Deploy/Infra', wave:'Mobile',
    priority:'P1', status:'Planned',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Release keystore not in repo. Fine for new listing. Existing Play listing needs vendor key or Google reset.'
  },
  {
    id:'ALT-109', title:'iOS build via GitHub Actions macOS runner',
    type:'Task', module:'Deploy/Infra', wave:'Mobile',
    priority:'P1', status:'Planned',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Claude',
    notes:'Owner on Windows. Can also borrow 2020 MacBook.'
  },
  {
    id:'ALT-110', title:'Apple Developer + Google Play access recovery',
    type:'Task', module:'Deploy/Infra', wave:'Mobile',
    priority:'P1', status:'Planned',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Vendor may ghost (unpaid invoice) — have Apple/Google support recovery route.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Dashboard
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-111', title:'Dashboard on real data (lead/meeting stat cards)',
    type:'Feature', module:'Leads', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'604 leads, meetings this week, 333 successful. Owner chose stat cards over calendar view.'
  },
  {
    id:'ALT-112', title:'Role-aware dashboard (admin vs agent see different numbers)',
    type:'Feature', module:'Leads', wave:'Per-project status',
    priority:'P1', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Depends on fine-grained RLS (A-06).'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: QA Audit & Bug Fixes
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-113', title:'Wave 1 QA audit (11-agent, all modules vs code+live DB)',
    type:'Task', module:'Deploy/Infra', wave:'QA & Bugfix',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'docs/QA-AUDIT.md: 3 critical, 9 high, 13 med, 16 low issues found.'
  },
  {
    id:'ALT-114', title:'Wave 2 fix swarm (6 disjoint file lanes): fix all confirmed QA bugs',
    type:'Bug', module:'Deploy/Infra', wave:'QA & Bugfix',
    priority:'P0', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'All 6 lanes fixed; build passes clean. Fixed: inline company cols, created_by=user_id, resubmit flow, decision rehydrate, meetings company col, mark-confirmed stage, wishlist dropdown, admin role-edit, notification rendering.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: AI / pgvector (Future Phase)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-115', title:'Design AI/pgvector plan for semantic search over activity log',
    type:'Task', module:'AI', wave:'AI',
    priority:'P3', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'HubSpot access-model research + AI/pgvector design completed by sub-agent. Findings in docs/product/ACCESS-CONTROL-MODEL.md.'
  },
  {
    id:'ALT-116', title:'Enable pgvector extension in Supabase',
    type:'Task', module:'AI', wave:'AI',
    priority:'P3', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Depends on AI plan.'
  },
  {
    id:'ALT-117', title:'Embed and index interaction/activity logs for vector search',
    type:'Feature', module:'AI', wave:'AI',
    priority:'P3', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Depends on pgvector enabled.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Docs & Product Spec
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-118', title:'Write USER-STORIES-AND-FLOWS.md from FRS + old code + CR doc',
    type:'Docs', module:'Docs', wave:'Docs',
    priority:'P0', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:'13-stage lifecycle, approval flow, all modules, 20 ❓open questions, CR Delta section.'
  },
  {
    id:'ALT-119', title:'Write full product docs suite (PRD, BACKLOG, ROADMAP, ROLES, DATA-DICTIONARY, UAT, RISK, DECISIONS, GLOSSARY)',
    type:'Docs', module:'Docs', wave:'Docs',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'docs/product/ suite: 10 docs + INDEX.md. Root README rewritten.'
  },
  {
    id:'ALT-120', title:'Write COMPANIES-CONTACTS-BLUEPRINT.md (per-project ownership + dedup rules)',
    type:'Docs', module:'Docs', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,14), updated: d(2026,6,14), finished: d(2026,6,14),
    owner:'Sub-agent',
    notes:'Dedup keys: contact = email → LinkedIn → phone; company = domain → CIN.'
  },
  {
    id:'ALT-121', title:'Owner reviews user-stories doc and answers the open-question gaps',
    type:'Task', module:'Docs', wave:'Docs',
    priority:'P0', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'20 ❓ questions in USER-STORIES-AND-FLOWS.md. Reconcile backlog after review.'
  },
  {
    id:'ALT-122', title:'REBUILD_LOG.md session log — keep up to date every session',
    type:'Docs', module:'Docs', wave:'Docs',
    priority:'P1', status:'In Progress',
    created: d(2026,6,11), updated: d(2026,6,17), finished: null,
    owner:'Claude',
    notes:'Append every session. Living log.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: This Backlog Tracker
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-123', title:'Build Jira-style Excel backlog tracker (this file)',
    type:'Docs', module:'Docs', wave:'Docs',
    priority:'P2', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Claude',
    notes:'Generator: new-code/web/scripts/gen-backlog-tracker.cjs. Re-run to refresh. Merge by ID preserves Created dates.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Settings
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-124', title:'Editable profile (Settings page)',
    type:'Feature', module:'Admin', wave:'Web core',
    priority:'P2', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:''
  },
  {
    id:'ALT-125', title:'Change password (Settings, via Supabase Auth)',
    type:'Feature', module:'Admin', wave:'Web core',
    priority:'P1', status:'Done',
    created: d(2026,6,12), updated: d(2026,6,12), finished: d(2026,6,12),
    owner:'Sub-agent',
    notes:''
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Security Hardening (2026-06-17)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-126', title:'Security audit (multi-agent) → docs/SECURITY-AUDIT.md',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'29 findings, 14 High/Critical. Headline: data protected client-side only; admin endpoints unauthenticated; open email relay. All critical issues addressed same day.'
  },
  {
    id:'ALT-127', title:'Auth-gate /api/users/create + /reset-password (requireAdmin middleware)',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Claude',
    notes:'JWT + role check (requireAdmin). Was zero-credential admin takeover. 401 verified without token.'
  },
  {
    id:'ALT-128', title:'Auth + rate-limit + single-recipient guard on /notify (open relay fix)',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Claude',
    notes:'requireAuth + single-email validation (blocks injected recipients) + express-rate-limit on /notify endpoint.'
  },
  {
    id:'ALT-129', title:'helmet security headers + 32 KB body limit on notify-service',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Claude',
    notes:'helmet() for CSP/HSTS/etc. express.json({ limit: "32kb" }). Deps added to notify-service + root package.json.'
  },
  {
    id:'ALT-130', title:'Disable public Supabase signup (Management API, disable_signup=true)',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Claude',
    notes:'Prevents self-registration on the public Supabase Auth endpoint. Verified via Management API.'
  },
  {
    id:'ALT-131', title:'Lock permission-table writes: user_role/rbac_master/dropdown_option/user_master/user_view_pref + is_admin()/current_user_id() helpers',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'user_role/rbac_master/dropdown_option = admin-only; user_master = admin-or-self; user_view_pref = own row. Helpers is_admin() + current_user_id() in DB. Frontend admin.ts + notify.ts send Authorization bearer.'
  },
  {
    id:'ALT-132', title:'Access RLS v1: lead row-isolation + write-locks + owner/manager/admin logging rules',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Lead row-isolation via created_by. Write-locks on company/contact/status/interaction. Status+interaction writes = owner+manager+admin only. Proven with throwaway rep+manager logins.'
  },
  {
    id:'ALT-133', title:'Access RLS v1b: contact-detail masking view + column revoke + find_contact_dup RPC + frontend routing',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Secured DB view masks phone/email/linkedin to non-owner. Column revoke on base table. find_contact_dup RPC. Frontend routed through masked view. Friendly RLS errors. Proven with logins.'
  },
  {
    id:'ALT-134', title:'Access RLS v2: project_visibility_setting dials (additive) + Project Access admin UI',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Configurable per-project view/edit dials. Admin UI to manage project access settings. Additive visibility model (owner+manager+admin base; dials can open up). Proven.'
  },
  {
    id:'ALT-135', title:'HubSpot access-model research + design → docs/product/ACCESS-CONTROL-MODEL.md',
    type:'Docs', module:'Docs', wave:'Security hardening',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'Owner decisions recorded: companies/contacts = PUBLIC rows + per-project masked details; leads = CLOSED; managers = project leads; QC reads all; Admin overrides all + sets dials.'
  },
  {
    id:'ALT-136', title:'Doc refresh: PRD/BACKLOG/ROADMAP/DECISIONS/DATA-DICTIONARY + ARCHITECTURE/USER-STORIES/QA/DESIGN-SYSTEM updated',
    type:'Docs', module:'Docs', wave:'Security hardening',
    priority:'P1', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Sub-agent',
    notes:'All major product and technical docs refreshed to reflect 2026-06-17 security + access-control work.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Security Follow-ups (Planned)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-137', title:'Rotate Gmail app password at go-live',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P1', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Rotate amplior.ankits@gmail.com app password used by notify-service SMTP. Owner-gated (requires Google account access).'
  },
  {
    id:'ALT-138', title:'Manager-edit default dial tuning (decide whether managers can edit leads by default)',
    type:'Task', module:'Security', wave:'Security hardening',
    priority:'P2', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Mohit',
    notes:'Access v2 dials are set; default for manager-edit needs owner decision before go-live.'
  },
  {
    id:'ALT-139', title:'Per-user / per-record sharing (Access v3)',
    type:'Feature', module:'Security', wave:'Security hardening',
    priority:'P3', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Share a specific lead/contact with a specific user outside normal access rules. Deferred post-launch.'
  },
  {
    id:'ALT-140', title:'App-layer friendly-error coverage audit (RLS-denied writes show human message)',
    type:'Task', module:'Security', wave:'Security hardening',
    priority:'P2', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'v1b added friendly errors for contact masking. Full audit across all modules not done.'
  },
  {
    id:'ALT-141', title:'First production deploy / push to live (owner-gated)',
    type:'Task', module:'Deploy/Infra', wave:'Deploy',
    priority:'P0', status:'Done',
    created: d(2026,6,17), updated: d(2026,6,17), finished: d(2026,6,17),
    owner:'Mohit',
    notes:'Pushed commit 3c0c2ba on 2026-06-17 → Hostinger auto-deploy. Owner must add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars for email/add-user to work.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Post-deploy fixes & HubSpot-style associations (2026-06-18)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-142', title:'Fix: user edit/reset failed with "No login found"',
    type:'Bug', module:'Admin', wave:'Post-deploy fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'110/111 users had no auth login (only 1 profiles row). Reset now resolves auth account by email, AUTO-CREATES a login when none exists, and self-heals the profiles id↔user_id link. Create-user now upserts profiles explicitly (no longer relies on the email trigger).'
  },
  {
    id:'ALT-143', title:'Fix: Pre-Sales Questions tab broken (missing is_active column)',
    type:'Bug', module:'Admin', wave:'Post-deploy fixes',
    priority:'P0', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'pre_sales_question.is_active never existed (42703 → empty tab, no edits). Added column via fix-questions-domains.sql + admin-only write RLS (everyone reads).'
  },
  {
    id:'ALT-144', title:'Fix: Domain reference data add/edit not wired',
    type:'Bug', module:'Admin', wave:'Post-deploy fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'Domain table was read-only and edit pencil was a no-op. Added addDomain/updateDomain (+ updateSource/updateDesignation) and wired ReferenceDataTab add+edit modal; admin-only write RLS on domain_master.'
  },
  {
    id:'ALT-145', title:'Company detail: rename "Deals" tab → "Leads" + New Lead action',
    type:'Feature', module:'Companies', wave:'HubSpot associations',
    priority:'P1', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'Owner: "those deals in contact are same of our leads." Tab key+label now Leads; empty/placeholder copy updated; added "New lead" button (prefills company).'
  },
  {
    id:'ALT-146', title:'Create a Lead from within a Contact or Company (prefilled)',
    type:'Feature', module:'Leads', wave:'HubSpot associations',
    priority:'P1', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'LeadFormPage reads /leads/new?contact=&company= and prefills person+company (mirrors ContactFormPage). Launch buttons on both detail pages. Uses lead_master.contact_id (confirmed present in live DB).'
  },
  {
    id:'ALT-147', title:'Contact detail: associated Leads + Colleagues panels',
    type:'Feature', module:'Contacts', wave:'HubSpot associations',
    priority:'P1', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'New fetchContactLeads (by contact_id + source_lead_id). Contact page now shows associated Leads and Colleagues (other contacts at same company), matching the company page associations.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Outreach-first pivot — bug fixes + internal-launch workstreams (2026-06-18)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-148', title:'Fix: Company Feasibility saved/showed wrong value (boolean vs 3-value text)',
    type:'Bug', module:'Companies', wave:'Post-deploy fixes',
    priority:'P1', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'is_feasible modeled as boolean while dropdown+DB column are text (feasible/not_feasible/unknown). Picking Feasible showed+saved not_feasible. Fixed end-to-end. Commit 19021cf, pushed.'
  },
  {
    id:'ALT-149', title:'Email templates improved (copy + working CTA buttons)',
    type:'Feature', module:'Notifications', wave:'Post-deploy fixes',
    priority:'P2', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'All 8 rewritten: warmer copy, better subjects, greeting, working buttons (ctaUrl/APP_URL). Baseline; owner to send final wording. Commit 19021cf.'
  },
  {
    id:'ALT-150', title:'Role posture — outreach team is update-only (hide create + gate /admin route)',
    type:'Feature', module:'Security', wave:'Internal launch',
    priority:'P0', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'canCreate/isAdmin in AuthContext; hide +New buttons; RoleProtectedRoute on /leads-new,/contacts-new,/companies-new,/leads/:id/edit and /admin. See UX-REDESIGN.md A. Owner decision: who can create.'
  },
  {
    id:'ALT-151', title:'Bulk login provisioning for the launch team',
    type:'Task', module:'Admin', wave:'Internal launch',
    priority:'P0', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'~110 users, only 1 has a login. Bulk create-logins admin action + temp-password CSV + forced first-login change. Owner: provide 15-20 launch users + roles.'
  },
  {
    id:'ALT-152', title:'BLOCKER: agent write-path / ownership model (edit ASSIGNED not CREATED records)',
    type:'Bug', module:'Security', wave:'Internal launch',
    priority:'P0', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'LAUNCH-STOPPER. status/disposition/notes/interaction writes gate on contact/company created_by=current_user_id; bulk-migrated data => agents hit 42501 on their call-list. Re-point created_by to assignees OR widen WITH CHECK to assignment/membership. Validate with REAL agent login. Owner: confirm assignment model.'
  },
  {
    id:'ALT-153', title:'RLS + masking validation with real non-admin logins',
    type:'Task', module:'Security', wave:'Internal launch',
    priority:'P0', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Throwaway AGENT/TEAM_LEAD/QC logins. NOTE: leads are ROW-scoped; contacts/companies are ROW-public + COLUMN-masked. Confirm friendly 42501 on all write paths. Depends on ALT-151/152.'
  },
  {
    id:'ALT-154', title:'Email sign-off: wording + recipient + Gmail rotation + links',
    type:'Task', module:'Notifications', wave:'Internal launch',
    priority:'P0', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Mohit',
    notes:'Owner approves wording; confirm recipient=user_master.email; rotate Gmail app password (env key GMAIL_APP_PASSWORD, not GMAIL_PASS); wire record deep-links. See ALT-137.'
  },
  {
    id:'ALT-155', title:'Record UX pass (action bar, click-to-call/email, ProjectStatusPanel)',
    type:'Feature', module:'Companies', wave:'Launch polish',
    priority:'P1', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Unify Company+Contact detail on 3-zone layout; OutreachActionBar; ContactMethods (tel:/mailto:, masked=locked); read-first ProjectStatusPanel. See UX-REDESIGN.md B. Can trail go-live.'
  },
  {
    id:'ALT-156', title:'Lead form reorg (Client/Source/Project on top) + autopopulate from company',
    type:'Feature', module:'Leads', wave:'Launch polish',
    priority:'P1', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Deal Setup section at top; enrich company lookup; autopopulate city/blank fields on company-select; industry/domain/CIN read-only. See UX-REDESIGN.md C.'
  },
  {
    id:'ALT-157', title:'Inline grid editing from lists (EditableCell family)',
    type:'Feature', module:'Contacts', wave:'Post-launch',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Extract EditableSelectCell/EditableTextCell; wire Contacts notes/comments + Companies status/feasibility inline via existing upserts. See UX-REDESIGN.md D. Deferred post-launch.'
  },
  {
    id:'ALT-158', title:'Owner + next-step schema & inline setters',
    type:'Feature', module:'Data', wave:'Post-launch',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Migration: next_step/next_step_date (+ optional last_disposition) on *_project_status; patch types + setStatusOwner. Gated on ownership-model decision. See UX-REDESIGN.md E.'
  },
  {
    id:'ALT-159', title:'Bulk Export->edit->Import (UPDATE) for companies (admin-only)',
    type:'Feature', module:'Companies', wave:'Post-launch',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Company ID column in export; service-role POST /api/companies/bulk-update (match id/domain/cin, update-only, skip-blanks, dry-run diff, per-row report); admin import wizard. Phase 2 -> contacts. See BULK-IMPORT-EXPORT.md.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: North-star ecosystem & roadmap (2026-06-18)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-160', title:'Task Manager — scheduled tasks as tickets, associated to records (HubSpot/Zoho-style)',
    type:'Feature', module:'Tasks', wave:'Roadmap',
    priority:'P1', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'OWNER RE-CONFIRMED 2026-06-21: a per-CRM-user Task Manager as a SEPARATE module. Each user can schedule or 1-CLICK create a Call task / Meeting / general task, associated to a record (lead/company/contact/meeting), with EMAIL + BROWSER reminders so a "call this customer" ask is not forgotten. HubSpot/Zoho-style (check their task/engagement model). EPIC now broken into the PHASE-1 plan ALT-250..ALT-262 (full detail docs/product/TASK-MANAGER.md, grounded in HubSpot live task model + Zoho + adversarial review). Build: task table + reminder-timing trigger + manages_user RLS helper; reminders -> in-process email scanner + bell insert + ~60s web timer (web push deferred); My Tasks Today/Overdue/Upcoming + per-record one-click. OPEN: per-task vs digest email (ALT-262). See VISION.md.'
  },
  {
    id:'ALT-161', title:'Client portal — clients see scheduled/success post-scheduling + dashboard',
    type:'Feature', module:'Client Portal', wave:'Roadmap',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'SUPERSEDED/EXPANDED by epic ALT-221 (see docs/product/CLIENT-PORTAL.md, planned 2026-06-21 from CEO transcript). Client-scoped read views of lead reports/meetings/dashboard + governance/onboarding/invoices, Amplior-branded.'
  },
  {
    id:'ALT-221', title:'EPIC: Client Portal / Sales Screen (white-label Amplior + AltLeads) — plan in docs/product/CLIENT-PORTAL.md',
    type:'Feature', module:'Client Portal', wave:'Roadmap',
    priority:'P2', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'PLANNED 2026-06-21 (CEO transcript + 2 owner interviews; see CLIENT-PORTAL.md v1-v3). ONE white-label product, TWO brands (Amplior + AltLeads), absolute brand isolation, 2 domains. Client roles = Company Admin > Sales Head > Sales Person (these were the vendor MOBILE app users = CLIENT, never Amplior staff). Replaces the mobile app; the /sales shell is the seed. APPROVED: same Supabase project + Pro ($25) + curated client-scoped read-only views + CLIENT role + adversarial multi-tenant RLS validation. PHASE-1 ORDER: (1) sales screens = view + assign/reassign meetings (port old-code/amplior-mobile-app-main); (2) ICP/docs/decks (edit by Company Admin+Sales Head w/ notify-on-save); (3) governance scheduling = review-meeting reminders + calendar view. Feedback available once meeting STARTED; recorded in CRM. DATA ISOLATION: client owns only MEETING records (not company/contact); sees company info as a SNAPSHOT captured up to their meeting; never another project/client meeting on the same shared company. Dashboard spec TBD. PHASE-1 PLAN NOW DETAILED in docs/product/CLIENT-PORTAL-PHASE1.md + child tickets ALT-222..ALT-245 (grounded in old-code mobile app + adversarial review). KEY DECISIONS from review: portal is a BRAND-NEW separate app (NOT a re-skin of the CRM — reuse would leak live shared data); isolation = a per-meeting denormalised SNAPSHOT table + SECURITY-INVOKER portal_* views + RLS, validated by throwaway-login test (ALT-229, HARD GATE); a one-time BACKFILL (ALT-225) seeds existing meetings so day-one is not empty; full email re-branding (ALT-232). OWNER DECISIONS PENDING: client-visible column whitelist (ALT-243) + snapshot-writer trigger mechanism (ALT-224). Build after those.'
  },
  {
    id:'ALT-162', title:'Chrome extension — LinkedIn contact details + inline CRM edit (writes back live)',
    type:'Feature', module:'Extension', wave:'Roadmap',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Priority #3. Extension reads the same Supabase backend; show contact details over an open LinkedIn profile + small editable controls that reflect in the CRM. Reuse the CRM data layer/API.'
  },
  {
    id:'ALT-163', title:'Market-mapping data per city (enrich base + targeting)',
    type:'Feature', module:'Data', wave:'Roadmap',
    priority:'P3', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Priority #4. City-wise company/site dataset feeding targeting + enriching the RAG base.'
  },
  {
    id:'ALT-164', title:'AI / RAG suggestion engine (who/when/what to reach out; targeting)',
    type:'Feature', module:'AI', wave:'Roadmap',
    priority:'P3', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Priority #5, gradual. pgvector embeddings over interaction history; suggestions per contact (best time/what to say) + targeting ("100 companies whose contracts renew next month"). DEPENDS on rich interaction capture from day one (ALT-152/foundations). See AI-PGVECTOR-PLAN.md + VISION.md.'
  },
  {
    id:'ALT-165', title:'Leadership decks — Product & Launch + Product Guide (HTML/PDF)',
    type:'Docs', module:'Docs', wave:'Roadmap',
    priority:'P1', status:'Done',
    created: d(2026,6,18), updated: d(2026,6,18), finished: d(2026,6,18),
    owner:'Claude',
    notes:'docs/product/deck-product-launch.(html|pdf) + deck-product-guide.(html|pdf). Branded 10-slide decks, rendered via Playwright. Show impact, best+upcoming features, ecosystem/RAG north-star, roadmap, launch decisions.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Sales / Client Portal (priority #2) — see SALES-PORTAL.md (2026-06-18)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-166', title:'Sales Portal shell — second login + /sales routes + sales nav (reuse leads)',
    type:'Feature', module:'Sales Portal', wave:'Sales portal',
    priority:'P2', status:'In Progress',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'/sales/login + SalesProtectedRoute + sales AppShell/Sidebar (Leads/Meetings/Feedback); block sales users from internal routes; expose full role set in AuthContext. Additive, no DB risk. See SALES-PORTAL.md build step 1.'
  },
  {
    id:'ALT-167', title:'Sales downline hierarchy + RLS scoping (SP=own, SH=downline)',
    type:'Feature', module:'Security', wave:'Sales portal',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Add project_user.sales_head_user_id + partial UNIQUE(project_id,user_id). RLS helpers is_sales_person/is_sales_head/sales_downline_ids; additive SELECT term on lead_master keyed on lead_report.user_id in {self,downline}. VALIDATE with real SP/SH logins before prod. Owner: confirm downline model.'
  },
  {
    id:'ALT-168', title:'Feedback CRUD (first sales write) — feedback_answer + complete meeting',
    type:'Feature', module:'Sales Portal', wave:'Sales portal',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Server-driven questions (feedback_question_master), Yes/No + free-text + follow-up date; INSERT feedback_answer per question, set meeting Completed + follow_up_date; write RLS for assigned SP/SH. Write path does NOT exist yet (read-only today). Capture real question set from live DB.'
  },
  {
    id:'ALT-169', title:'Sales Head adds Sales Person (/api/sales/users/create + requireSalesHead)',
    type:'Feature', module:'Sales Portal', wave:'Sales portal',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'New endpoint forces role_id=5, assigns caller projects via project_user, records downline link. Reuse genTempPassword/findAuthUserByEmail/ensureProfileLink. Admin provisions first SALES_HEAD per project from Settings.'
  },
  {
    id:'ALT-170', title:'Provision client/sales users from Admin Settings',
    type:'Feature', module:'Admin', wave:'Sales portal',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Make SALES_HEAD/SALES_PERSON web-assignable in the right context; assign to project(s); the SALES roles are is_web=false today and hidden from the picker.'
  },
  {
    id:'ALT-171', title:'Sales Head executive dashboard + assign/reassign salesperson',
    type:'Feature', module:'Sales Portal', wave:'Sales portal',
    priority:'P3', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Recreate vendor head dashboard: meeting-status strip, revenue potential, hot prospects, meetings-by-city, F2F vs virtual %, industry spread, pipeline funnel; SP gets simple today-view. Assign/reassign via lead_report.user_id. Date-range filter.'
  },
  {
    id:'ALT-172', title:'Integrations: own workflow engine + public APIs + MCP (other CRMs/tools)',
    type:'Feature', module:'Integrations', wave:'Roadmap',
    priority:'P3', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'In scope (owner): integrate with other CRMs/tools via our own workflow engine, public APIs, and an MCP server (two-way sync, webhooks, automation). Design after internal launch + portal v1.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: 2026-06-19 owner decisions (see DECISIONS.md ADR-21/22)
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-173', title:'Contact masking redesign — partial mask + click-to-reveal (ADR-22)',
    type:'Feature', module:'Security', wave:'Launch polish',
    priority:'P1', status:'Planned',
    created: d(2026,6,19), updated: d(2026,6,19), finished: null,
    owner:'Claude',
    notes:'Phone: first 3 + last 3 visible, middle blurred; email similar; click reveals full until page refresh. Non-permitted viewers = hidden always (masked view returns null). UI layer over contact_master_masked. See DECISIONS.md ADR-22.'
  },
  {
    id:'ALT-174', title:'Create rights as configurable per-project setting (default admin-only)',
    type:'Feature', module:'Admin', wave:'Internal launch',
    priority:'P1', status:'Planned',
    created: d(2026,6,19), updated: d(2026,6,19), finished: null,
    owner:'Claude',
    notes:'Default CREATE = ADMIN only; admin can grant create + CRUD to Team Leads (others) via the Project Access dials. Not hardcoded. Ties to accessSettings + role posture ALT-150. See DECISIONS.md ADR-21.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC: Planned (not started) — owner asked to "plan somewhere", 2026-06-19
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-175', title:'Email templates v2 — re-engineer + attachments (e.g. meeting-schedule PDF report)',
    type:'Feature', module:'Notifications', wave:'Backlog (planned)',
    priority:'P3', status:'Planned',
    created: d(2026,6,19), updated: d(2026,6,19), finished: null,
    owner:'Claude',
    notes:'Owner wants richer emails per event, possibly a generated PDF report attached (e.g. meeting-schedule confirmation as a PDF). Current emails = improved copy + working buttons only (ALT-149). v2 = re-engineered layouts per event + PDF/attachment generation (reuse the Playwright HTML->PDF method from render-decks.cjs). PLAN ONLY for now.'
  },
  {
    id:'ALT-176', title:'Bulk USER import (admin) — provision many users from a sheet',
    type:'Feature', module:'Admin', wave:'Backlog (planned)',
    priority:'P3', status:'Planned',
    created: d(2026,6,19), updated: d(2026,6,19), finished: null,
    owner:'Claude',
    notes:'Future: import users (name/email/role/project) from CSV/XLSX to bulk-create logins + roles + project membership (extends the bulk-login work ALT-151 and the bulk import engine ALT-159). Launch-user list not needed now; this is the durable mechanism. PLAN ONLY.'
  },
  {
    id:'ALT-216', title:'INSERT RLS does not enforce admin-only create — DEFER, but REQUIRED before sales portal shows companies/contacts',
    type:'Security', module:'Security', wave:'Security hardening',
    priority:'P2', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'SECURITY FINDING (security pass 2026-06-21). access-rls-v1.sql INSERT policies on lead_master/company_master/contact_master are WITH CHECK (is_admin() OR created_by = current_user_id()) — so ANY authenticated user can create records they own, contradicting ADR-21 "admin-only create". OWNER DECISION 2026-06-21: DO NOT harden the DB now — the internal team is trusted and the UI gate (canCreateData=isAdmin, hides New buttons) is sufficient for the internal launch. HOWEVER this MUST be enforced at the DB before the SALES PORTAL exposes companies/contacts: sales users (SALES_HEAD/SALES_PERSON) must NOT be able to create company/contact/lead. Action when that lands: tighten INSERT WITH CHECK to is_admin() (or is_admin() OR has_project_create_grant) AND ensure sales-role users fail the check; validate with throwaway sales logins before prod. Pairs with sales-portal RLS scoping (ALT-167) + update-path blocker ALT-152.'
  },
  {
    id:'ALT-217', title:'Company record — richer "About" details (revenue, employees, website, email, LinkedIn, description)',
    type:'Feature', module:'Companies', wave:'Companies & Contacts',
    priority:'P2', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'DONE 2026-06-21 (owner ask). CompanyDetailPage now shows an "About this company" grid: Industry, Employees (company_size), Revenue (turnover_master.turnover via turnover_id), City, Website, Email, LinkedIn, CIN + the free-text description. companies.ts fetchCompanyById extended (turnover_id, description joins). Build passes.'
  },
  {
    id:'ALT-218', title:'Inline Zoho-style tick-to-save contact editor inside company + cross-record new-tab redirects',
    type:'Feature', module:'Companies', wave:'Companies & Contacts',
    priority:'P2', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'DONE 2026-06-21 (owner ask). Replaced the confusing expand-arrow+Save with an always-visible inline editor strip (status + description + comments) that uses the row width; a green ✓ tick saves (Enter also saves) and ✗ discards, only while dirty; toast feedback. Contact name now links to the contact record. ALL cross-record redirects now open in a NEW TAB with rel=noreferrer noopener: company→contact, company→lead (DealsTab), contact→company, contact→lead, contact→colleague. "Add new contact" inside company gated by canCreateData.'
  },
  {
    id:'ALT-219', title:'Unsaved-changes guard + draft cache + restore on New/Edit forms',
    type:'Feature', module:'Web core', wave:'UX audit',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'DONE 2026-06-21 (owner ask: "if something is edited and someone tries something that loses it, save in cache + warn to save or discard"). New useUnsavedChanges hook: caches the in-progress draft to localStorage while dirty, warns on browser close/refresh (beforeunload), and offers to RESTORE the draft when the user returns. Wired into Lead/Contact/Company New+Edit forms with a Discard-changes confirm on Cancel/Back, cache cleared on successful save and on logout (shared-computer hardening). Implements UX-AUDIT Top-30 #13 (ALT-190) for forms; modals/detail-edit remain.'
  },
  {
    id:'ALT-220', title:'Security: clear global-search index cache on logout (cross-session leak)',
    type:'Security', module:'Security', wave:'UX audit',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'DONE 2026-06-21 (found in post-milestone security review). The Cmd-K search index is cached at module scope; the SPA does not full-page reload on logout, so on a shared machine the next user could see the previous user\'s cached leads/companies/contacts. signOut() now calls clearSearchIndex() alongside the existing draft-cache purge.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC ALT-221 children: Client Portal PHASE-1 build plan (2026-06-21)
  // Plan-only, grounded in old-code/amplior-mobile-app-main + adversarially
  // critiqued. Full detail: docs/product/CLIENT-PORTAL-PHASE1.md
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-222', title:'Portal schema + CLIENT role + client_portal_user table',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'AUTHORED + adversarially reviewed + revised 2026-06-21 -> apply-portal-foundation.cjs (portal schema, client_portal_user[auth_uid->client_assoc_id+role], meeting_snapshot, SECURITY-INVOKER portal_* views, portal.notification, explicit grants — only views granted, ZERO on base tables). Covers ALT-223/226/228. STAGED — gated on ALT-229 throwaway-login validation. See CLIENT-PORTAL-PHASE1.md.'
  },
  {
    id:'ALT-223', title:'portal.meeting_snapshot table (denormalised, per-meeting frozen copy)',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Denormalised project_id+client_assoc_id+assigned_user_id on every row + snapshot_source flag. The core data-isolation mechanism. GATED on column-whitelist sign-off ALT-243 — do NOT guess columns. dependsOn ALT-222, ALT-243.'
  },
  {
    id:'ALT-224', title:'Snapshot writer (live path) on CRM meeting generation',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'DECISION RESOLVED 2026-06-21 (owner delegated to Claude): mechanism = a SECURITY DEFINER Postgres function fired by a DB TRIGGER on the meeting source (AFTER INSERT/UPDATE), chosen over an app endpoint because the snapshot is isolation-critical and must be ATOMIC + UNBYPASSABLE (cannot be forgotten at a call site). The browser never writes snapshots. Until wired, no NEW meeting produces a snapshot. dependsOn ALT-223.'
  },
  {
    id:'ALT-225', title:'One-time snapshot BACKFILL applier (seed every existing meeting)',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Idempotent migration applier snapshotting every PRE-EXISTING meeting (snapshot_source=backfill) so the portal is not empty on day one. Run AFTER RLS validation, BEFORE go-live; re-validate isolation on real volume after. dependsOn ALT-223, ALT-227, ALT-229, ALT-243.'
  },
  {
    id:'ALT-226', title:'Curated portal_* views (incl. portal_notifications)',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'SECURITY INVOKER views over snapshot/notification tables; clients get ZERO grants on base tables. dependsOn ALT-223, ALT-228.'
  },
  {
    id:'ALT-227', title:'Portal RLS policies (snapshot/wishlist/feedback/docs/governance)',
    type:'Security', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'AUTHORED + adversarially reviewed + revised 2026-06-21 -> apply-portal-rls.cjs. Review caught 2 EXISTENTIAL gaps, both FIXED: (1) policies now target the real authenticated role (gated by portal.caller_client_assoc_id() IS NOT NULL), not an unbridged portal_client role; (2) BASE-TABLE LEAK CLOSURE — an AS RESTRICTIVE deny_portal_session policy is added to EVERY RLS-enabled public table so a portal session fails the CRM permissive USING(true) reads while CRM staff are unaffected. Company Admin=client scope; Sales Head=project+downline; Sales Person=own assigned; NO client write policy. This is a CRM-WIDE RLS change — MUST pass ALT-229 throwaway-login validation before prod. dependsOn ALT-223.'
  },
  {
    id:'ALT-228', title:'Portal notifications table + RLS (portal.notification)',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Closes a review gap. Portal-OWNED table (NOT the CRM in_app_notification). RLS scopes SELECT/UPDATE to recipient_auth_uid AND client_assoc_id; INSERT service-role only. dependsOn ALT-222.'
  },
  {
    id:'ALT-229', title:'Adversarial throwaway-login RLS validation (HARD RELEASE GATE)',
    type:'Security', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'One login per portal role on a test client; PROVE no cross-client snapshot read, no peer-meeting read, no cross-client notification read. Run pre-prod AND after backfill on real volume. Multi-tenant leak is existential. dependsOn ALT-227, ALT-228.'
  },
  {
    id:'ALT-230', title:'Portal app skeleton (net-new /portal route tree)',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'BUILT + isolation-reviewed + wired 2026-06-21 (build passes). PRAGMATIC DEVIATION from "separate Vite app": built as a NET-NEW, fully isolated /portal route tree inside the existing web app (src/portal/**) with its OWN login + guard + layout + data layer — mounted in App.tsx OUTSIDE the CRM/sales guards. Adversarial review VERIFIED: zero imports of CRM pages/live-data modules (only portal data layer + ui primitives), data layer hits ONLY supabase.schema(portal) views. Separate-origin brand isolation still achievable via per-deploy VITE_BRAND + 2 domains -> same build. Covers ALT-231/233/234/237/240 in 2a. INERT until portal schema applied + exposed (ALT-229). dependsOn ALT-222.'
  },
  {
    id:'ALT-231', title:'Brand seam — web (BrandContext + per-brand CSS vars)',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'useBrand() resolves from VITE_BRAND/hostname; data-brand tokens; Logo/login/error/help read it. Amplior vs AltLeads brand isolation by separate origins. dependsOn ALT-230.'
  },
  {
    id:'ALT-232', title:'Brand seam — email FULL parameterization (email-templates.js)',
    type:'Task', module:'Notifications', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Parameterize ALL hardcoded AltLeads strings: header wordmark, footer line, every [AltLeads] subject prefix, per-event body copy, accent colour + APP_URL. Defaults to AltLeads so CRM emails are unchanged. Prevents brand bleed to Amplior clients.'
  },
  {
    id:'ALT-233', title:'Portal auth (own guard: login/forgot/set-password)',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:"Portal's OWN guard accepting only enabled client_portal_user rows (not the CRM SalesProtectedRoute). OPEN: OTP vs email-link. dependsOn ALT-230, ALT-222."
  },
  {
    id:'ALT-234', title:'Meetings list / status / detail (NET-NEW pages, snapshot-only)',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Reads ONLY portal_meetings snapshot. FORBIDDEN to reuse CRM LeadsPage/LeadDetailPage (they query live company_master/lead_report). No reschedule/drop/cancel buttons. dependsOn ALT-226, ALT-233.'
  },
  {
    id:'ALT-235', title:'Assign / reassign salesperson (port SalesPersonModal)',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Company Admin + Sales Head only; updates lead_report.user_id for the Amplior-generated meeting via an RLS-checked write; fires lead_reassigned email (brand=Amplior). dependsOn ALT-234.'
  },
  {
    id:'ALT-236', title:'Lead / Lead-details (NET-NEW read-only, snapshot-only)',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Snapshot lead profile from portal views only. Explicitly NOT the CRM LeadDetailPage. dependsOn ALT-234.'
  },
  {
    id:'ALT-237', title:'Feedback (started-gated) + MeetingReview',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Enabled only when meeting_snapshot.started_at <= now(). Sales Person own; Sales Head edit in-scope. Writes portal_feedback; records back into the CRM + notifies Amplior (portal.notification + email). dependsOn ALT-234.'
  },
  {
    id:'ALT-238', title:'Wishlist + SAFE name-only company suggest',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'company_name_suggest returns ONLY {company_name} — no id/industry/website/owner/count, nothing revealing another client targets it. Reconcile to a real company_id server-side, Amplior-side. Optional file upload + free-text address replace camera/GPS. dependsOn ALT-233.'
  },
  {
    id:'ALT-239', title:'Notifications feed (portal-scoped)',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Reads portal_notifications (RLS-scoped per recipient + client_assoc_id). Reuses the bell PATTERN, not CRM in_app_notification data. dependsOn ALT-228, ALT-233.'
  },
  {
    id:'ALT-240', title:'Home + dashboard shell + Profile',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P2', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'Status cards + date-range from portal_dashboard_metrics; role-gated extras. Full chart spec DEFERRED until owner provides it. dependsOn ALT-233.'
  },
  {
    id:'ALT-241', title:'Docs / ICP / criteria / decks + save-popup notify flow',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Read all roles; edit by Company Admin + Sales Head with a confirm popup that notifies Amplior ADMIN+TL+project users. Per-client/project Storage bucket scoping. dependsOn ALT-227, ALT-233.'
  },
  {
    id:'ALT-242', title:'Governance review-meeting reminders (email + .ics) + detail page',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P2', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'governance_meeting_reminder notify event + portal.governance_meeting table. Email + .ics only, NO web push (that lives in the Task Manager module). TL/Manager <-> Company Admin review meetings. dependsOn ALT-232, ALT-233.'
  },
  {
    id:'ALT-243', title:'DECISION: client-visible column whitelist sign-off',
    type:'Task', module:'Client Portal', wave:'Client portal P1',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'RESOLVED 2026-06-21: client sees EVERYTHING the vendor MOBILE-app user could see (i.e. the full field set the old client app surfaced for meetings/leads/companies). Owner will refine the list later (eventual target = "all that any project CRM user can see"). Snapshot columns (ALT-223) = the mobile-app field set; unblocked.'
  },
  {
    id:'ALT-244', title:'CRM Edit-User sales-role bug fix (UsersTab.tsx)',
    type:'Bug', module:'Admin', wave:'Client portal P1',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'DONE 2026-06-21. UsersTab Edit-roles modal now always surfaces SALES_HEAD/SALES_PERSON (via new SALES_ROLE_NAMES const) in roleOptions = [...webRoles, ...salesRoles, ...extras], making Edit symmetric with Add — an admin can now GRANT a sales role to a user who lacks it (previously extras only re-showed non-web roles the user already had). Build passes.'
  },
  {
    id:'ALT-245', title:'Provisioning: Company-Admin login creation',
    type:'Feature', module:'Client Portal', wave:'Client portal P1',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Extend notify-service /api/users/create for portal users; also writes the client_portal_user row. Company Admin then adds their own Sales Heads/People. dependsOn ALT-222.'
  },

  // ══════════════════════════════════════════════════════════════════════
  // EPIC ALT-160 children: Task Manager module (internal CRM) — 2026-06-21
  // Plan-only, grounded in HubSpot's live task model + Zoho + adversarially
  // critiqued. Full detail: docs/product/TASK-MANAGER.md
  // ══════════════════════════════════════════════════════════════════════
  {
    id:'ALT-250', title:'Task table + reminder-timing trigger + indexes (migration applier)',
    type:'Task', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'AUTHORED + adversarially reviewed 2026-06-21 -> new-code/migration/apply-create-task-table.cjs (self-contained embedded SQL, idempotent, txn-wrapped). public.task + public.task_user_pref; BEFORE INSERT/UPDATE trigger recomputes reminder_at = due_at - offset AND clears reminder_sent_at on due_at/offset change (snooze re-fires); partial scanner index; explicit grants (REVOKE anon/PUBLIC, GRANT authenticated). STAGED — not applied to prod (gated on owner sign-off + throwaway-login validation ALT-251).'
  },
  {
    id:'ALT-251', title:'manages_user() RLS helper + task RLS policies',
    type:'Security', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'AUTHORED + adversarially reviewed 2026-06-21 -> apply-task-rls.cjs. Review CAUGHT a leak (first draft derived manages_user from shared-project membership = a TL could read co-members tasks) and it was FIXED: manages_user() now FAILS CLOSED (owner + is_admin only) until a real person-hierarchy table exists. All 8 policies scoped TO authenticated. STAGED — apply to prod only after throwaway agent/TL/admin login validation. dependsOn ALT-250.'
  },
  {
    id:'ALT-252', title:'My Tasks screen — Overdue/Today/Upcoming/Completed (IST bucketing)',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:"BUILT + WIRED 2026-06-21 (build passes). src/pages/MyTasksPage.tsx (tabs + counts + per-row done/skip/snooze + New-task), src/data/tasks.ts (CRUD + IST bucketing in Asia/Kolkata), src/components/tasks/CreateTaskModal.tsx + taskScheduling.ts (preset chips). Route /tasks + Sidebar 'My Tasks' nav added. Covers ALT-253/254/255 UI. INERT until the task table is applied (ALT-250). Pending: TL owner-field (ALT-261), one-click-from-record (ALT-260), reminders (ALT-256/257/258)."
  },
  {
    id:'ALT-253', title:'Per-row actions: Mark done / Skip / Snooze',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'Snooze = UPDATE due_at; the trigger recomputes reminder_at and clears reminder_sent_at so it re-fires. Reuse useConfirm for Skip. dependsOn ALT-252.'
  },
  {
    id:'ALT-254', title:'Create-task modal + Owner field (TL/Admin only changes owner)',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'Reuse Modal.tsx + Toast + useUnsavedChanges. Owner change at create enforced by the INSERT policy. dependsOn ALT-251.'
  },
  {
    id:'ALT-255', title:'IST quick-schedule presets + global "+ Task"',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'Chips (Today 5pm / Tomorrow 9am / In 3 days / Next Monday / Custom) computed in Asia/Kolkata then stored as timestamptz. Global create with optional record association. dependsOn ALT-254.'
  },
  {
    id:'ALT-256', title:'Email reminder scanner (in-process send) + task_reminder template + heartbeat',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Scanner in notify-service using the service-role client; calls buildEmail+getTransporter().sendMail DIRECTLY (cannot use POST /notify — needs a user JWT). last_scan_at heartbeat on /health. Test to ankit. BLOCKED until ALT-262 (volume decision). dependsOn ALT-250, ALT-262.'
  },
  {
    id:'ALT-257', title:'Server-side in_app_notification insert from scanner (bell source)',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Scanner INSERTs directly into in_app_notification with the service-role client (notifyInApp is client-only and cannot run server-side). dependsOn ALT-256.'
  },
  {
    id:'ALT-258', title:'NEW ~60s web timer for live badge-bump + due-task toast',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Corrects a false premise: the TopBar bell only refetches on route change, NO timer today. Add setInterval (~60s) re-running fetchUnreadNotifCount + a toast for newly-due tasks. In-tab only. dependsOn ALT-257.'
  },
  {
    id:'ALT-259', title:'Optional OS toast via Web Notifications API',
    type:'Task', module:'Tasks', wave:'Task manager',
    priority:'P2', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'One-time Notification.requestPermission() then new Notification(...) from the ~60s timer; OS toast when the tab is backgrounded (tab still open). Trivial on top of ALT-258. dependsOn ALT-258.'
  },
  {
    id:'ALT-260', title:'One-click task actions on Lead/Company/Contact + open-tasks mini-list + top-bar badge',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Action row (Call back / Schedule meeting / Add task) pre-fills the association + denormalised name/phone. Record-page open-activities mini-list; top-bar open+overdue count shares the ~60s timer. dependsOn ALT-254, ALT-258.'
  },
  {
    id:'ALT-261', title:'TL/Admin reassign + assigned_by audit',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Reassign gated by manages_user (ALT-251); stamp assigned_by_user_id (HubSpot-style audit). dependsOn ALT-251, ALT-252.'
  },
  {
    id:'ALT-262', title:'DECISION: per-task vs digest email volume (Gmail throttling)',
    type:'Task', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'RESOLVED 2026-06-21: PER-TASK reminder email WITH a safety cap (per-user per-window) to protect Gmail deliverability, PLUS an optional DAILY SUMMARY digest that is OPT-IN, default OFF. So the scanner sends one email per due task (capped) + a separate daily digest job gated by a per-user pref (default false). Unblocks ALT-256.'
  },
  {
    id:'ALT-263', title:'Continuous code-health / UX hardening — find-and-fix loop',
    type:'Chore', module:'Web core', wave:'UX audit',
    priority:'P2', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'Owner directive 2026-06-21: keep finding + fixing small things continuously. Each round = a read-only multi-dimension audit (adversarially verified) -> per-file fixes -> build -> commit. ROUND 1 DONE (24 files, build passes): icon-only close/clear buttons given aria-labels (EditMeeting/UpdateMeeting/MeetingTab/Approvals x2/SearchSelect/CompanyDetail/ColumnCustomizer); dead code removed (WishlistPage X import + stale marker, ContactsPage XLSX, ProjectSelect unused prop); PreSalesQuestionsTab last window.confirm -> ConfirmDialog; clipboard copy .catch (UsersTab); truncation title tooltips (CompanyDetail/ContactDetail/PreSales); REAL BUGS: IST/UTC week-bucket (realLeads.getWeekStart) + lead-meeting upcoming/past bucket (leadWorkspace) fixed to local date-string compare; stuck-spinner unhandled rejections caught (Dashboard/CommandPalette/LeadDetail/ContactDetail/ContactForm/Meetings + globalSearch inflight self-clear); ExportButton try/catch; approveReport no longer self-notifies the actor; EditMeeting time-field no longer blanks a non-HH:MM saved time. ROUND 2 DONE (12 files incl. backend, build + node --check pass): swallowed Supabase errors now logged/surfaced (contacts/leadWorkspace/projectStatus/meetings); AuthContext provider value memoized (useMemo) to cut needless re-renders; ReportTab new-question rows keyed on a stable _uid (was array index); ActivityTab + DispositionForm got load error/empty states; MeetingTab delete -> ConfirmDialog; WishlistDetail toast auto-dismiss; UsersTab Add-User validates email before enabling Create; notify-service hardened x8 (async route bodies wrapped in try/catch -> 503, input validation, no internal-error leakage). ROUND 3 DONE (21 files, build pass after 1 typing fix): form a11y (admin Field links label htmlFor->control id via useId+cloneElement; aria-required/invalid/describedby on Login/Reset/Convert/Disposition; SearchSelect role=combobox+listbox; AssignModal focus-trap+autofocus); route-id guards (LeadDetail/WishlistDetail/ContactDetail: non-numeric/0 id -> error state not stuck spinner); date-format consistency (LeadsPage/leadWorkspace/ContactDetail via formatDate; Dashboard count toLocaleString en-IN); friendlier error copy (SettingsPage password change, WishlistDetail status, CompanyDetail "Status saved"); dead code removed (useUrlState module [ALT-186 recreates when built], listViews, admin TableHead, TypeBadge, fetchStageHistory, resolveUserEmail/Name). More rounds to follow.'
  },
  // ── Owner feedback batch 2026-06-21 (live testing of Task Manager) ──
  {
    id:'ALT-264', title:'BUG: modal inputs lose focus after 1 character (shared admin Modal)',
    type:'Bug', module:'Web core', wave:'UX audit',
    priority:'P0', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'DONE 2026-06-21 (owner found while testing My Tasks: "after 1 letter the cursor disappears"). Root cause: admin/Modal.tsx focus-on-open useEffect depended on [open, onClose]; onClose (handleClose) is a new fn identity each render, so every keystroke re-ran the effect and re-focused the dialog container, stealing focus from the input. Fix: split into two effects — Escape keydown ([open,onClose]) and focus-on-open ([open] ONLY). Affected EVERY modal form, not just tasks.'
  },
  {
    id:'ALT-265', title:'Task Manager Inc2 — reminder scanner (email + in-app bell) + opt-in digest',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P0', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Claude',
    notes:'BUILT + adversarially reviewed 2026-06-21 (node --check passes). notify-service scanner: every ~60s, service-role client finds OPEN tasks with reminder_at<=now() AND reminder_sent_at IS NULL (LIMIT cap 40, oldest first), sends a task_reminder email (new template) + inserts in_app_notification (bell), then sets reminder_sent_at (before send, so no double-fire). Per-tick try/catch can never crash the server; last_scan_at on /health. Opt-in DAILY DIGEST gated on task_user_pref.daily_digest_opt_in=true. ACTIVATES on notify-service restart/redeploy. Known minor: digest lastDigestDate is in-memory (a mid-day restart could re-send the digest) — acceptable for opt-in v1. Supersedes ALT-256/257.'
  },
  {
    id:'ALT-266', title:'One-click task from a record (Call back / Schedule meeting / Add task)',
    type:'Feature', module:'Tasks', wave:'Task manager',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'BUILT for Lead/Company/Contact detail 2026-06-21 (owner ask #3: "no task can be created from company/contact/meeting/lead"): a Call back / Schedule meeting / Add task action row opens CreateTaskModal pre-filled with the record association + owner. DONE for Meeting detail too 2026-06-21 (all four modules). Supersedes ALT-260.'
  },
  {
    id:'ALT-267', title:'BUG: activity not recorded for company-related contacts (per-project)',
    type:'Bug', module:'Companies', wave:'Companies & Contacts',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'OWNER (#4) 2026-06-21: doing an activity inside a company\'s related contacts records NO activity — should log a project-scoped activity like a normal disposition (separate per project). Investigate the company->related-contacts write path (contact status/disposition inside CompanyDetailPage) and ensure it appends an interaction/activity scoped to the project, visible in that contact/company activity feed.'
  },
  {
    id:'ALT-268', title:'Admin: all-projects activity view with detailed timeline',
    type:'Feature', module:'Admin', wave:'Roadmap',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'OWNER (#5, "big one") 2026-06-21: for ADMIN, ALL activity in detail across ALL projects + chronological timeline. SHIPPED (commit ab92711): new "Activity" tab in AdminPage (already ADMIN-gated). data/activityTimeline.ts reads the interaction table (status changes + logged calls, with project_id/occurred_at/actor), newest-first, cap 200, with a project selector incl. "All projects". components/admin/ActivityTimelineTab.tsx groups events by IST day, links each to its record (contact/company/lead), resolves actor+project names. Read-only, no migration. FOLLOW-UPS (future): add date/user filters; aggregate meetings/tasks/call_log sources too (currently interaction only — the richest single source); pagination beyond 200.'
  },
  {
    id:'ALT-269', title:'EPIC: Call module — schedule + log calls per record, dashboard, future call-tool integration',
    type:'Feature', module:'Calls', wave:'Roadmap',
    priority:'P1', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'OWNER (#6) 2026-06-21: a CALL module like the Task Manager but call-specific. BUILT (commit 57bcd92, migrations STAGED not applied): public.call_log ledger of calls that HAPPENED (direction OUT/IN, disposition [OWNER-DEFAULT B2B set: CONNECTED/INTERESTED/FOLLOW_UP/CALLBACK_REQUESTED/LEFT_VOICEMAIL/NO_ANSWER/BUSY/NOT_INTERESTED/WRONG_NUMBER], notes, duration_seconds, called_at, lead/company/contact/meeting assoc, owner_user_id, NULLABLE recording_url + transcript = future calling-tool SEAM) + RLS mirroring task (owner OR is_admin OR manages_user, fail-closed; anon revoked). data/calls.ts (logCall/listCallsForRecord/listMyCalls/callStatsToday); LogCallModal + CallHistoryCard; "Log call" on all 4 detail pages; "Calls Today" dashboard card (project-scoped). SCHEDULING reuses Task task_type=CALL (not duplicated). Review: no blocker/high. REMAINING: apply the 2 migrations in prod (gated); a My-Calls list page (so the dashboard card can drill down); wire the future telephony/transcription integration into the recording_url/transcript seam.'
  },
  {
    id:'ALT-270', title:'Advanced per-field filters with multi-select (each column)',
    type:'Feature', module:'Web core', wave:'UX audit',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'OWNER (#1) 2026-06-21: cannot see an advanced filter for EACH field with multi-select. Extends ALT-184: a per-column advanced filter (multi-select chips + contains/is-empty where relevant) on every list field, not just the few facets. Builds on the existing SearchSelect multi-select filters (Top#6) -> make it comprehensive per-field.'
  },
  {
    id:'ALT-271', title:'Research: basic B2B CRM feature list (non-sales) via websearch',
    type:'Docs', module:'Docs', wave:'Roadmap',
    priority:'P2', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Claude',
    notes:'OWNER 2026-06-21: web-search basic B2B CRM features; ignore sales features but still list them. DONE (doc docs/product/B2B-CRM-FEATURES.md): Section A = core/non-sales features mapped to our app (have/partial/gap) — top gaps: workflow automation, two-way email sync+tracking, custom report builder, kanban board, merge-duplicates, custom fields. Section B = sales-cycle features deliberately deferred (invoicing/quotes/CPQ/forecasting/commissions/marketing-automation/lead-scoring/ticketing/etc.). Grounded in 2026 HubSpot/Zoho/Salesforce/Pipedrive comparisons.'
  },
  {
    id:'ALT-272', title:'Global fuzzy search — grouped results (Leads/Companies/Contacts/Tasks/Meetings), Zoho/HubSpot-style',
    type:'Feature', module:'Web core', wave:'UX audit',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'OWNER (#7) 2026-06-21: enhance the EXISTING Cmd-K global search into GROUPED results. SHIPPED (commit 9fc6315): added TASKS + MEETINGS to globalSearch.ts (meetings via fetchMeetings; tasks via a direct RLS-scoped task read so the caller only sees their own/managed/admin). CommandPalette now renders fixed Zoho/HubSpot-style sections — Leads, Companies, Contacts, Tasks, Meetings — each with a count header; keyboard ↑/↓ walks the grouped list in display order, Enter opens the highlighted row; tasks open their associated record (or My Tasks). Index limit 24→40. FOLLOW-UP (future): always-visible inline results dropdown from the TopBar bar (currently the Cmd-K modal) + per-group "see all".'
  },
  {
    id:'ALT-273', title:'Global PROJECT selector (top bar) — pre-filters all modules/records; default in personal settings',
    type:'Feature', module:'Web core', wave:'Roadmap',
    priority:'P1', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'OWNER (#8) 2026-06-21: a PROJECT selector next to the global search bar on every screen. The selected project becomes the default pre-filter across ALL modules + records (so multi-project users see only that project by default). Default project changeable in personal Settings; persists. SHIPPED (commit 7241294): global ProjectContext (selected project_id, persisted to localStorage; default-project pref seeds new sessions), TopBar ProjectSwitcher (from the user\'s accessible projects via admin.fetchMyProjects — admin=all enabled, others=their project_user rows; self-hides for <2 projects), "All projects" = null = no filter, Settings "Default project" card. SCOPED on NUMERIC project_id (not name — duplicate/blank names + query drift can\'t hide records): Leads (RealLead.projectId from lead_master.project_id) + Meetings (MeetingRow.projectId via lead). REMAINING: Tasks + Wishlist left UNFILTERED (no reliable project field — documented TODO; Tasks could derive via linked lead later); Companies/Contacts are shared across projects (per-project scoping TBD). Status → In Progress until those modules are scoped or explicitly de-scoped by owner.'
  },
  {
    id:'ALT-273B', title:'Project-selector hardening — fixes from adversarial review (wh2yjqssa)',
    type:'Bug', module:'Web core', wave:'Roadmap',
    priority:'P1', status:'In Progress',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'Adversarial review of ALT-273 confirmed 21 defects. FIXED: portal-RLS BLOCKER (meeting_snapshot FORCE→ENABLE, commit e4c94a4). OPEN: HIGH Dashboard ignores selected project (shows all-project totals). MEDIUM: scope not cleared on logout (shared-device bleed) + not re-seeded on new login (key scope by user_id); fetchMyProjects swallows errors→[] can wipe saved selection; single-project user force-scoped w/ no "All projects" escape (switcher self-hides <2); Sales Portal silently inherits scope w/ no control; Contacts+Companies ignore global switcher while showing a competing local Project dropdown; daily-digest dedup in-memory only (restart re-sends); portal feedback writes to non-existent portal.meeting_feedback. LOW: NULL project_id rows silently hidden (no "N hidden" hint); reminder bell double-fire under overlapping ticks; CreateTaskModal stale prefill on reopen; MyTasks async setState/no in-flight guard. NIT: ProjectContext useMemo omits setter (latent stale closure); Tasks/Wishlist no-op need an on-screen "not project-scoped" hint.'
  },
  {
    id:'ALT-274', title:'Client Portal = show that client\'s meetings (simple) — not the internal CRM',
    type:'Feature', module:'Sales/Client Portal', wave:'Wave 2',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'OWNER 2026-06-21: the client portal simply shows that client\'s MEETINGS (list + the mobile-ditto record view ALT-275). "As simple as that." Scoped by client_assoc_id via the portal snapshot/RLS already designed (apply-portal-*; blocker fixed e4c94a4, still STAGED pending validate + Supabase schema-expose). No internal CRM tabs/machinery exposed. See SALES-PORTAL.md "Owner decisions 2026-06-21" #1.'
  },
  {
    id:'ALT-275', title:'Sales/Portal record view = EXACT ditto copy of mobile MeetingDetails (single consolidated screen)',
    type:'Feature', module:'Sales/Client Portal', wave:'Wave 2',
    priority:'P1', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'OWNER 2026-06-21: sales + client-portal users must NOT see the internal CRM record screens. SHIPPED (commit 8bf9aff): MobileMeetingRecord.tsx (7 sections, mobile order, Confirmed→Scheduled/Cancelled→Dropped relabel) at /sales/meetings/:id (SalesMeetingDetailPage); MeetingsPage navigates to /sales/meetings/:id under the sales shell so sales users never hit the internal screen. fetchMeetingDetail extended with ~15 mobile-parity cols (lead alt_mobile/linkedin/role_and_resp/area_of_interest/title/value/description; lead_report sales_intelligence+created_by→scheduledBy; company size/web_url/linkedin + turnover_master + company_sector.sector [col verified]; address lines). Adversarial review PASSED (no blocker/high). Review fixes applied: Call Recording/Image gated to SALES_HEAD+internal (canSeeRecordings) so a Sales Person / client never sees recordings. Sparse records (~79% NULL company_id) render N/A like mobile. REMAINING: client-portal REUSE of this view = ALT-274 (needs portal DB).'
  },
  {
    id:'ALT-276', title:'Sales/Portal Wishlist add (prospect capture) — company + lead + location, mobile-style',
    type:'Feature', module:'Sales/Client Portal', wave:'Wave 2',
    priority:'P2', status:'Done',
    created: d(2026,6,21), updated: d(2026,6,21), finished: d(2026,6,21),
    owner:'Mohit',
    notes:'OWNER 2026-06-21: sales/portal users can ADD a wishlist by selecting Company name + Prospect(lead) + Location. Mirrors mobile src/screens/wishlist/Wishlist.jsx. Fields: Company (searchable autocomplete from company master, ≥2 chars, free-text ok), Lead name (+auto-fill designation from company leads), Mobile(10-digit), Designation, Branch picker (auto-fills addr/city/state/pin), Address1+2(req), State→City cascading(req), PIN(req), Country(India default), Description, optional geo image/GPS (web v1 = skip). Submit→ our wishlist table (data/wishlist.ts). Full payload spec in SALES-PORTAL.md #3.'
  },
  {
    id:'ALT-277', title:'Site feasibility + per-site/city employee size (primary research) for calling agents',
    type:'Feature', module:'Companies/Market', wave:'Wave 2',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'OWNER 2026-06-21: agents waste time calling company SITES that aren\'t feasible for a given PROJECT (e.g. HungerBox non-feasible at many sites). Owner HAS primary market-researched data per company × site/city: feasible/non-feasible + employee size per site. Leverage the existing city-wise prospect grouping (COMPANIES-CONTACTS-BLUEPRINT.md) as the unit: show employee size per site/group + feasible/non-feasible badge for the active project; de-emphasise/filter non-feasible. Build: new per-(company,site/city,project) feasibility table + bulk import of owner\'s research sheet + surface in the grouped view (project-scoped via #8). Full spec: docs/product/SITE-FEASIBILITY.md. Sequencing: AFTER ALT-275/276, BEFORE live-data handoff to real calling agents. Design UX TBD with owner.'
  },
  {
    id:'ALT-278', title:'Pre-production readiness audit — "where do calling agents get stuck?"',
    type:'Task', module:'QA/Launch', wave:'Wave 2',
    priority:'P1', status:'Planned',
    created: d(2026,6,21), updated: d(2026,6,21), finished: null,
    owner:'Mohit',
    notes:'OWNER 2026-06-21: before real calling agents get LIVE production data, walk the agent\'s actual path and enumerate every place they can stall (missing feasibility/employee-size, non-feasible sites unflagged, ambiguous lead ownership, masked contact info they actually need, broken write-path, etc.) → produce a go/no-go checklist. Depends on ALT-277 (feasibility data) landing. See SITE-FEASIBILITY.md.'
  },
  ...uxAuditTickets(),
];

// ─── MERGE LOGIC ─────────────────────────────────────────────────────────────
function mergeTickets(existingRows, newTickets) {
  // Build index from existing rows keyed by ID
  const existingMap = {};
  for (const row of existingRows) {
    if (row.id) existingMap[row.id] = row;
  }

  const merged = [];
  for (const t of newTickets) {
    if (existingMap[t.id]) {
      const ex = existingMap[t.id];
      // The GENERATOR (this tracked file) is the source of truth for Status + Notes
      // — it drives them via the PROGRESS map and per-ticket fields. The xlsx is
      // gitignored and regenerated, so we only carry the original Created date over.
      // Exception: if the generator left a ticket at the default 'Planned' but the
      // existing sheet has a more-advanced status, keep the advanced one (so a manual
      // bump in Excel isn't silently reverted).
      const generatorIsAuthoritative = t.status && t.status !== 'Planned';
      merged.push({
        ...t,
        created: ex.created || t.created,
        status: generatorIsAuthoritative ? t.status : (ex.status || t.status),
        notes: generatorIsAuthoritative ? t.notes : (ex.notes !== undefined ? ex.notes : t.notes),
        finished: generatorIsAuthoritative ? t.finished : (ex.finished || t.finished),
        updated: TODAY,
      });
    } else {
      merged.push(t);
    }
  }
  return merged;
}

// ─── COLUMN HELPERS ──────────────────────────────────────────────────────────
const COL_HEADERS = [
  'ID', 'Title', 'Type', 'Module', 'Wave/Epic', 'Priority', 'Status',
  'Created', 'Last Updated', 'Finished', 'Owner', 'Notes'
];

const COL_WIDTHS = [12, 62, 12, 18, 22, 10, 14, 14, 14, 14, 14, 50];

function dateCell(dt) {
  // Plain ISO text (YYYY-MM-DD): displays exactly, sorts correctly, no Excel serial/timezone bugs.
  return { v: dt || '', t: 's' };
}

function ticketToRow(t) {
  return [
    t.id, t.title, t.type, t.module, t.wave,
    t.priority, t.status,
    dateCell(t.created), dateCell(t.updated), dateCell(t.finished || null),
    t.owner, t.notes || ''
  ];
}

// ─── BUILD SHEETS ────────────────────────────────────────────────────────────
function buildBacklogSheet(tickets) {
  const ws = {};
  const R0 = 0; // row 0 = header

  // Header row
  COL_HEADERS.forEach((h, c) => {
    const cellRef = XLSX.utils.encode_cell({ r: R0, c });
    ws[cellRef] = {
      v: h, t: 's',
      s: { font: { bold: true }, fill: { fgColor: { rgb: '1A7EE8' } }, fontColor: { rgb: 'FFFFFF' } }
    };
  });

  // Data rows
  tickets.forEach((t, ri) => {
    const row = ticketToRow(t);
    row.forEach((cell, ci) => {
      const cellRef = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      ws[cellRef] = typeof cell === 'object' ? cell : { v: cell, t: 's' };
    });
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: tickets.length, c: COL_HEADERS.length - 1 } });
  ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));
  // Freeze header row (row 1) using SheetJS sheetViews
  ws['!sheetViews'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: tickets.length, c: COL_HEADERS.length - 1 } }) };

  return ws;
}

function buildLegendSheet() {
  const rows = [
    ['HOW TO USE'],
    ['This tracker is kept up to date by re-running: cd new-code/web && node scripts/gen-backlog-tracker.cjs'],
    ['Merge-by-ID preserves Created dates and manually-edited Notes/Status. Append new tickets in the script.'],
    [''],
    ['STATUS', 'Meaning'],
    ['Done', 'Built and verified (per REBUILD_LOG)'],
    ['In Progress', 'Actively being worked right now'],
    ['Planned', 'Designed and scoped, not yet started'],
    ['Blocked', 'Waiting on an external dependency or decision'],
    [''],
    ['PRIORITY', 'Meaning'],
    ['P0', 'Must-have to go live. Blocks launch.'],
    ['P1', 'Important. Needed for a complete, trustworthy product (before cutover).'],
    ['P2', 'Should-have. Can land shortly after launch.'],
    ['P3', 'Nice-to-have / later. Won\'t block anything.'],
    [''],
    ['TYPE', 'Meaning'],
    ['Feature', 'New user-facing functionality'],
    ['Bug', 'Fix for broken behaviour'],
    ['Task', 'Internal work item (migration, config, decision)'],
    ['Chore', 'Cleanup / housekeeping with no new user-visible change'],
    ['Security', 'Access control, hardening, or vulnerability fix'],
    ['Docs', 'Documentation, spec, or process artifact'],
    [''],
    ['MODULE', 'Part of the system'],
    ['Deploy/Infra', 'Hosting, CI/CD, repo, build pipeline'],
    ['Notifications', 'Email + in-app notification service'],
    ['Contacts', 'Contact directory + call-disposition log'],
    ['Companies', 'Company/target-account directory'],
    ['Leads', 'Lead pipeline (list, workspace, approval)'],
    ['Meetings', 'Meeting scheduling and tracking'],
    ['Wishlist', 'Prospect wishlist + convert-to-lead'],
    ['Admin', 'Users, roles, dropdowns, reference data'],
    ['Security', 'RLS, IDOR, auth hardening'],
    ['AI', 'pgvector / semantic search (future phase)'],
    ['Docs', 'Specs, PRDs, user stories, logs'],
    ['Data', 'Database migration, schema, seeding'],
    [''],
    ['OWNER', 'Meaning'],
    ['Claude', 'Orchestrator / main session built this'],
    ['Mohit', 'Business owner decision / action needed'],
    ['Sub-agent', 'Delegated to a specialist sub-agent'],
  ];

  const ws = {};
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      ws[ref] = { v: cell, t: 's' };
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 1 } });
  ws['!cols'] = [{ wch: 20 }, { wch: 80 }];
  return ws;
}

function buildSummarySheet(tickets) {
  const statuses = ['Done', 'In Progress', 'Planned', 'Blocked'];
  const modules = ['Deploy/Infra', 'Notifications', 'Contacts', 'Companies', 'Leads', 'Meetings', 'Wishlist', 'Admin', 'Security', 'AI', 'Docs', 'Data'];

  // Count by status
  const byStatus = {};
  statuses.forEach(s => byStatus[s] = 0);
  tickets.forEach(t => { if (byStatus[t.status] !== undefined) byStatus[t.status]++; });

  // Count by module
  const byModule = {};
  modules.forEach(m => byModule[m] = 0);
  tickets.forEach(t => { if (byModule[t.module] !== undefined) byModule[t.module]++; });

  const rows = [
    ['AltLeads CRM — Backlog Summary', '', `Generated ${TODAY}`],
    ['', '', ''],
    ['Total tickets', tickets.length, ''],
    ['', '', ''],
    ['BY STATUS', 'Count', ''],
    ...statuses.map(s => [s, byStatus[s], '']),
    ['', '', ''],
    ['BY MODULE', 'Count', ''],
    ...modules.map(m => [m, byModule[m], '']),
  ];

  const ws = {};
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      ws[ref] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 2 } });
  ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 30 }];
  return ws;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
function main() {
  let finalTickets = TICKETS;

  // Merge with existing file if present
  if (fs.existsSync(OUT_PATH)) {
    console.log(`Found existing file at ${OUT_PATH} — merging by ID…`);
    try {
      const existing = XLSX.readFile(OUT_PATH, { cellDates: true });
      const backlogSheet = existing.Sheets['Backlog'];
      if (backlogSheet) {
        const existingRows = XLSX.utils.sheet_to_json(backlogSheet, { header: 1, defval: '', raw: false });
        // Map header positions
        const headers = existingRows[0];
        const idIdx = headers.indexOf('ID');
        const createdIdx = headers.indexOf('Created');
        const notesIdx = headers.indexOf('Notes');
        const statusIdx = headers.indexOf('Status');

        const parsedExisting = existingRows.slice(1).map(row => {
          let created = null;
          const rawCreated = row[createdIdx];
          // Dates are plain YYYY-MM-DD text now; keep a valid one as-is (2020s+).
          if (rawCreated && typeof rawCreated === 'string' && /^20[2-9]\d-\d{2}-\d{2}$/.test(rawCreated.trim())) {
            created = rawCreated.trim();
          }
          return {
            id: row[idIdx],
            created,
            notes: row[notesIdx],
            status: row[statusIdx],
          };
        });
        finalTickets = mergeTickets(parsedExisting, TICKETS);
      }
    } catch (e) {
      console.warn('Could not read existing file (will create fresh):', e.message);
    }
  } else {
    console.log('No existing file found — creating fresh.');
  }

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildBacklogSheet(finalTickets), 'Backlog');
  XLSX.utils.book_append_sheet(wb, buildLegendSheet(), 'Legend');
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(finalTickets), 'Summary');

  // Write file (cellDates:true ensures Date objects write as real date cells, not serial numbers)
  XLSX.writeFile(wb, OUT_PATH, { cellDates: true });
  console.log('\n✓ Workbook written to:', OUT_PATH);
  console.log('  Total tickets:', finalTickets.length);

  // Verify by re-reading
  const check = XLSX.readFile(OUT_PATH);
  const sheets = check.SheetNames;
  console.log('  Sheets:', sheets.join(', '));

  const backlog = check.Sheets['Backlog'];
  const backlogData = XLSX.utils.sheet_to_json(backlog, { header: 1 });
  console.log('  Backlog rows (incl. header):', backlogData.length);

  // Status breakdown
  const byStatus = {};
  backlogData.slice(1).forEach(row => {
    const s = row[6] || 'Unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  console.log('\n  Tickets by Status:');
  Object.entries(byStatus).forEach(([s, n]) => console.log(`    ${s}: ${n}`));
}

main();
