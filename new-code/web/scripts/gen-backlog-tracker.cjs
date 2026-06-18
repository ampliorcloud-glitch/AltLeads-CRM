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
const TODAY = d(2026, 6, 18);

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
    priority:'P2', status:'Planned',
    created: d(2026,6,12), updated: d(2026,6,17), finished: null,
    owner:'Claude',
    notes:''
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
    priority:'P2', status:'Planned',
    created: d(2026,6,14), updated: d(2026,6,17), finished: null,
    owner:'Claude',
    notes:'is_seen column exists; read-state reconciliation not yet built.'
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
    priority:'P1', status:'Planned',
    created: d(2026,6,17), updated: d(2026,6,17), finished: null,
    owner:'Sub-agent',
    notes:'Part of Wave E company detail account fields expansion.'
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
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'New task + task_association tables; schedule task -> ticket linked to contact/company/lead + attach more records from other modules; reminders -> notifications; per-record Tasks tab + global My Tasks. See VISION.md.'
  },
  {
    id:'ALT-161', title:'Client portal — clients see scheduled/success post-scheduling + dashboard',
    type:'Feature', module:'Client Portal', wave:'Roadmap',
    priority:'P2', status:'Planned',
    created: d(2026,6,18), updated: d(2026,6,18), finished: null,
    owner:'Claude',
    notes:'Priority #2 after internal launch. Client-scoped read views of scheduled/successful outcomes + dashboard. Needs client-role + row scoping.'
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
      // Preserve: Created date, manually-edited Notes, manually-edited Status
      merged.push({
        ...t,
        created: ex.created || t.created,
        notes: ex.notes !== undefined ? ex.notes : t.notes,
        // Only preserve status if it was manually changed (i.e. different from script default)
        status: ex.status || t.status,
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
