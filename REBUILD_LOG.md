# Amplior CRM Rebuild — Master Log

> **PURPOSE:** This is the single source of truth for the rebuild. Any new Claude chat session
> should READ THIS FILE FIRST to pick up exactly where the last session left off.
> Every session MUST append to the Session Log at the bottom before ending.

---

## The Mission

Rebuild the Amplior/Altleads CRM (built badly by an outsourced vendor) into a clean,
self-manageable system. Owner (Mohit, mohit@amplior.com) is non-technical — Claude
orchestrates everything, delegates heavy work to sub-agents on cheap models (Sonnet/Haiku).

**Deadline pressure:** Fable 5 model available only until 2026-06-22. All hard work
(migration, core build, mobile rewiring) must finish before then. After 22 Jun: Opus 4.8
for hard parts, Sonnet 4.6 as daily driver.

## Target Architecture (DECIDED)

| Piece | New stack |
|---|---|
| Database + Auth + Storage | Supabase (Postgres) — replaces MySQL on DigitalOcean, homemade JWT auth, DO Spaces |
| Web app | React + Vite, rebuilt clean. Hosted on Netlify, GitHub auto-deploy |
| Server logic | Minimal — Supabase direct + Netlify/Edge Functions for Excel export, SMS, email |
| Mobile | Repair existing React Native app (RN 0.78), point at new backend. iOS builds via GitHub Actions macOS runner (owner is on Windows) |

**Decisions made:** migrate real production data (not fresh start) · keep old DO system
running in parallel until tested · web first, mobile second · filters + Excel exports
(the vendor's ₹96k CR) built in as standard.

## Key Facts About the Old System

- Old backend: Java Spring Boot 2.5.5 / Java 8 (EOL), 357 files, 29 REST controllers, ZERO tests.
  Lives in `legacy/` (was `amplior-java-backend-main/`). WAR on Tomcat, DO droplet 68.183.246.243.
- DB: MySQL managed cluster on DigitalOcean blr1, 47 tables. Schema dump: `amplior_backup.sql`.
  Prod db: `amplior_prod_db`. A second forked cluster also exists from an earlier rebuild attempt.
- Old web: React 19/Vite, 51 components (AddLead.jsx = 3,767 lines). CANNOT BUILD —
  `environments/environment_urls` file missing from repo (vendor withheld it).
- Mobile: React Native 0.78, ~57 files, API-driven (no direct DB). Same two files missing
  (`environment_urls`, `httpMethod`). Release keystore NOT in repo — new Android signing key
  needed (fine for new listing; existing Play listing needs vendor key or Google key reset).
- SECURITY: passwords stored PLAINTEXT (NoOpPasswordEncoder); AES key hardcoded in source;
  live DO MySQL password was committed in `amplior-rebuild/backend/.env` → MUST ROTATE.
- Vendor CR docs (`cr_doc_content/`, `cr_est_content/`): ₹96k quote = 7 filters on Leads +
  7 on Meetings + 2 Excel exports + editable fields. Trivial in clean codebase.

## Phase Checklist

- [ ] **Phase 0 — Accounts & access** (owner): GitHub remote, Supabase token, Netlify token. IN PROGRESS
- [x] **Phase 1 — Cleanup** DONE 2026-06-11: old code archived to `old-code/`, docs to `docs/`, secrets to `.credentials/`, clean commit e10f4c1. Password rotation NOT NEEDED — leaked cred belonged to the deleted forked cluster (db-mysql-blr1-97683), which no longer exists. Live cluster (db-mysql-blr1-amplr) unaffected. NOTE: live DB firewall has ~14 individual IPs (likely vendor devs) — prune at cutover, not before (one may be owner's office).
- [x] **Phase 2 — Supabase foundation** DATA DONE 2026-06-12: prod schema turned out to be
  65 tables (not 47 — vendor added 21 audit tables + columns post-Jan; drift DDL in
  new-code/migration/schema-drift.sql). Owner FORKED the live cluster (db-mysql-blr1-72129,
  id in .credentials/fork_cluster_id.txt) so production was never touched; fork firewall
  locked to this PC only. ~108,000 rows copied, 65/65 tables row-count MATCH
  (new-code/migration/migration-report.txt). FKs: 60/64 applied, 4 skipped
  for orphan rows = vendor data bugs (new-code/migration/fk-skipped.txt, nothing deleted).
  Web app WIRED TO REAL DATA (new-code/web/.env.local has anon key; src/data/realLeads.ts
  does the joins). Real stats: 604 leads, 22 meetings this week, 333 successful.
  NOTE: "Sales Person" filter dropped — no such field in vendor schema (agent==salesperson);
  real lead stage lives in lead_report→stage_master, NOT lead_master.stage (601/604 null).
  STILL TODO in Phase 2/3: Supabase Auth + RLS (tables currently have NO RLS —
  anon key has full access, local preview only, DO NOT deploy before RLS). Fork to be
  DELETED after owner confirms (bills hourly).
- [ ] **Phase 3 — Web core** (~12–18h): login, dashboard, Leads, Meetings, Wishlist, notifications, filters + Excel exports
  - STRATEGY: depth-first — finish Leads as one complete judgeable vertical (list+filters+export+detail+add/edit behind real auth+RLS) before spreading to other modules. Owner judges a FINISHED module, then replicate the pattern.
  - AUTH DECISION (made): old plaintext passwords NOT migrated. At go-live each user gets a one-time email to set a new password (Supabase Auth). For build/testing: test admin login mohit@amplior.com, password in .credentials/test_admin_login.txt (gitignored).
  - 3.1 Auth: DONE & VERIFIED — Supabase Auth login works (tested: mohit@amplior.com → role ADMIN, user_id 1 = Mohit Sharma). profiles table links auth.users→user_master+role; trigger on_auth_user_created auto-onboards by email match. Route protection live. Real roles in DB: ADMIN, TEAM_LEAD, SALES_HEAD, SALES_PERSON, AGENT, QC. Service role key saved to .credentials/supabase_service_role_key.txt (gitignored).
  - LEAD OWNERSHIP: lead_master.agent_id → user_master.user_id (this is the column RLS will use).
  - RLS RESEQUENCED: deferred to a dedicated pre-deploy hardening pass (one comprehensive pass across all 65 tables) — NOT done piecemeal during feature build. Local preview has no internet exposure so it's safe to build features with RLS off (admin/anon sees all). HARD GATE: RLS MUST be applied before ANY Netlify deploy. Planned model: ADMIN sees all; managers (TEAM_LEAD/SALES_HEAD/QC) all-for-now (refine to team-scope later); AGENT/SALES_PERSON see only agent_id = own user_id.
  - 3.3 Leads COMPLETE module: BUILT, build passes — LeadDetailPage (/leads/:id: all fields, clickable contacts, activity timeline from lead_activity, related meetings via lead_report→meeting_schedule→meeting_master, stage history from lead_report, live stage changer), Add Lead (/leads/new) + Edit (/leads/:id/edit) via LeadFormPage with audit fields + ALT#### lead_number gen (max was ALT1608). AWAITING OWNER REVIEW.
    - KNOWN CAVEAT: creating a brand-new company inline writes placeholder values into company_master NOT NULL cols (address_id, country_code_id, domain_id, industry_id) — verify/refine before relying on it.
    - Stage change = simple case only (updates lead_report.stage_id); full approval/meeting-creation workflow deferred.
  - 3.4 Meetings/Wishlist/Notifications/Settings (after Leads judged).
  - OWNER REVIEW of Leads (2026-06-12): auth ✓, lead creation ✓. ISSUES TO FIX: lead EDIT
    broken; leads list missing PAGINATION; DATA MISMATCH — many companies/projects missing,
    only 2 agents showing (suspect PostgREST 1000-row cap / wrong join keys in realLeads.ts);
    old stage editing works (parity target). Owner wants COMPLETE product (all modules), not
    placeholders. Figma file "Amplior CRM 0.1 (Copy).fig" exists at root but is BINARY —
    cannot parse; using old app + established style as design ref.
    FIGMA: public view link can't be machine-read (JS canvas). File key = jS6N3Ru9xsNpsbKAxxOFsr.
    Owner to drop a Figma personal access token at .credentials/figma_token.txt (read scope) →
    then a sub-agent pulls all frames via Figma API (GET /v1/files/{key} + /v1/images) as PNGs
    and runs a DEDICATED DESIGN-MATCH PASS after the functional workflow lands.
    FIGMA TOKEN RECEIVED & VALID. File "Amplior CRM 0.1 (Copy)", 4 pages: "New UI" (29 frames=
    web target), "Admin Panal" (35=admin target), "Mobile UI" (23=Phase 6), "User UI (Old)" (24,
    ignore). Background agent exporting frames → docs/figma-export/{web,admin,mobile}/ as PNGs +
    manifest.json + README.md. These PNGs are the design ref for the polish pass (Read them).
    Owner was viewing node 3005:14579.
  - ULTRACODE WORKFLOW LAUNCHED (run id wf_89002aee-fe0; script saved under
    .../workflows/scripts/amplior-complete-product-wf_89002aee-fe0.js): 6 parallel agents
    (data-accuracy+pagination, lead-edit fix, Meetings, Wishlist, Admin, Notifications+Settings)
    then wire-routes (App.tsx+Sidebar) then verify-build (npm run build, fix all errors).
    Each agent owns distinct files; no npm install/build in parallel agents. RESUME if paused:
    Workflow({scriptPath: <that path>, resumeFromRunId: "wf_89002aee-fe0"}).
  - WORKFLOW wf_89002aee-fe0 COMPLETE (8 agents, ~488k tokens): all 6 modules built, wired
    (App.tsx routes + Sidebar, Admin nav gated to ADMIN role), build PASSES clean.
  - DATA-ACCURACY ROOT CAUSE (verified by direct DB query): the FIRST Leads build joined on the
    WRONG columns. Real data lives elsewhere:
      * COMPANY: use client_association.client_name via lead_master.client_assoc_id (populated for
        ALL 605 leads). NOT company_master via company_id (NULL for 477 → was showing blank).
      * OWNER/AGENT: use lead_master.created_by (varchar = user_master.user_id, 18 distinct real
        salespeople). NOT agent_id (NULL for 476, only 2 distinct → was the "only 2 agents" bug).
      * PROJECT: lead_master.project_id -> project (wasn't fetched before).
      * Lookups paged with .range() (PostgREST 1000-row cap). Verified: 18 owners, 0 null companies,
        sample leads resolve correctly (lead 2211 = AP Securitas / Mansi Rajak).
    LESSON for future sessions: lead ownership/company in this DB is created_by + client_assoc_id,
    NOT agent_id + company_id. Update RLS plan accordingly (owner match = created_by).
  - Modules built on real data: Meetings (610 rows) +detail, Wishlist (54 rows), Admin (Users/
    Projects/Clients/Reference tabs, real edits, ADMIN-gated), Notifications (in_app_notification),
    Settings (editable profile + password change). Pagination added to Leads. Lead edit fixed.
  - Dead code to clean later: src/data/mockLeads.ts, src/pages/PlaceholderPage.tsx (unused).
  - Figma export: web (29) + mobile (23) PNGs in docs/figma-export/ (admin set may still be
    finishing). Frame names are auto-generated → must VIEW images during design pass.
  - KEY REALIZATION (owner, 2026-06-12): we've been REVERSE-ENGINEERING flows from messy old
    code, not building from authoritative user stories. Owner offered to help. DECISION: Claude
    drafts a master spec from the FRS (authoritative!) + old code + CR doc; owner REVIEWS &
    answers ❓GAPs (don't make owner write from scratch). Authoritative sources on disk:
    docs/Amplior_Altleads_CRM_ FRS_V2.0 (1).pdf (FRS V2.0), DBD docx, cr_doc_content/.
  - LEAD DETAIL gap found: needs HubSpot-style layout — header + right info panel + 3 TABS
    (Activity / Lead Report / Meeting) where AGENTS FILL INFO. Detailed spec reverse-engineered
    from old-code/.../lead-overview/ (LeadOverview/LeadActivity/LeadReport/LeadMeeting). Captured
    in workflow + will be in USER-STORIES-AND-FLOWS.md.
  - WORKFLOW wf_7a4a706c-3ef RUNNING: (1) mine FRS + reverse-engineer Meetings/Wishlist/Dash/
    Admin + CR scope → (2) write docs/USER-STORIES-AND-FLOWS.md (tags ✅confirmed/🔶inferred/
    ❓gap + owner open-questions list) → (3) build lead workspace (3 tabs + right panel, real
    data, components in src/components/lead/, data in src/data/leadWorkspace.ts) → (4) verify build.
    Resume: Workflow({scriptPath: .../amplior-spec-and-lead-workspace-wf_7a4a706c-3ef.js,
    resumeFromRunId: "wf_7a4a706c-3ef"}).
  - DONE 2026-06-12: docs/USER-STORIES-AND-FLOWS.md written (13-stage lifecycle, approval flow,
    all modules, 20 ❓open questions, CR Delta section). LEAD WORKSPACE built & build PASSES
    (forced clean rebuild verified): src/components/lead/{LeadInfoPanel,ActivityTab,ReportTab,
    MeetingTab,primitives}.tsx + src/data/leadWorkspace.ts; LeadDetailPage restructured to
    HubSpot layout (header+stage+progress+Clinch, 3 tabs, right panel). Writes wired to
    lead_activity, lead_report, pre_sales_answer, new_sales_question, meeting_master/schedule/
    participant, agent_feedback, meeting_url. KEY SCHEMA: pre-sales domain via
    client_association.domain_id; salespeople via project_user.role_name; assigned SP =
    lead_report.user_id. TODOs left (in code comments): no options column on pre_sales_question
    (all text); soft-delete+reinsert children; stage-id mapping for postpone/cancel is best-guess;
    Clinch doesn't write Closed-Deal record; comment limit 500 vs 1000 (FRS conflict).
  - CR DELTA finding: CR has 2 layers. Layer1 = small (filters/exports — built). Layer2 = major
    re-architecture (multi-tenant orgs, Companies + Contacts modules, meetings-centric pivot,
    proposes REMOVING web Leads screen, multiple TL/SH per project, calendar/email/Kafka). Big.
  - OWNER DECISIONS MADE 2026-06-12 (LOCKED):
    * APP STRUCTURE = TWO APPS. Web = Amplior internal team (Admin, Team Lead, Agent). Mobile =
      client sales team (Sales Head, Sales Person). NUANCE: give SALES PERSON web access LATER
      (not in first release) — design web with this in mind but gate SP off web for now.
    * FIRST-REBUILD SCOPE = FRS-PARITY + small "Layer 1" CR (filters, Excel exports, editable
      settings/reports — mostly already built). CR LAYER 2 (multi-tenant orgs, Companies+Contacts
      modules, meetings-centric pivot, remove-web-Leads, multi TL/SH, calendar/email/Kafka) =
      DEFERRED to a later phase. Build to the FRS blueprint, not the Layer-2 vision.
    * Still OPEN: 18 detail questions in USER-STORIES-AND-FLOWS.md (mostly have a recommended
      default in the doc) — can proceed on defaults, flagging the few high-impact ones.
    Dev server now localhost:5175 (5173/5174 stale instances — clean up next restart).
  - OWNER CHOSE next step = finish Meetings & Wishlist to FRS-parity, THEN design pass over all.
  - WORKFLOW wnm363u2j RUNNING (build to blueprint): Meetings module (list + 7 CR filters +
    18-field Excel export + detail + reschedule/cancel + feedback view + edit-after-conclusion
    gated to ADMIN/TL) and Wishlist module (list + filters + detail + assign + convert-to-Lead)
    deepened to FRS-parity, then wire (+/wishlist/:id) & verify build. Defaults applied & flagged:
    modes=3 (Tel/Online/Offline), auto-Missed NOT automated (TODO cron), wishlist→Lead (not Meeting,
    Layer2 deferred), no-TL project blocks wishlist capture. Resume: Workflow({scriptPath:
    .../amplior-meetings-wishlist-parity-wf_343ae171-c9c.js, resumeFromRunId: "wf_343ae171-c9c"}).
  - FIGMA ADMIN FRAMES: export FAILED 0/35 — Figma images API account-level 429 rate limit (needs
    ~24h to reset; all retries burned). web/ (29) + mobile/ (23) ARE exported. manifest.json has 35
    admin entries marked "rate_limited" with file paths pre-set. RETRY at design-pass time (>24h
    out by then): re-run the admin-export agent / Figma /v1/images for the "Admin Panal" page.
  - MEETINGS & WISHLIST FRS-PARITY DONE (wf_343ae171-c9c): build PASSES; routes /meetings,
    /meetings/:id, /wishlist, /wishlist/:id all wired. ADVERSARIALLY VERIFIED data layers vs live
    DB — both CORRECT (agents used documented schema facts, did NOT repeat the leads wrong-column
    bug): wishlist.ts reads company_name + lead_name + assign_agent/assign_tl DIRECT (wishlist_assign
    is dead/0 rows, company_id only 8/54); meetings.ts uses meeting_status (not empty `status`) +
    correct meeting_schedule->lead_report->lead_master chain, salesperson=lead_report.user_id.
    Meeting statuses in data: Scheduled/Missed/Completed/Rescheduled/Confirmed (610 meetings,
    593 lead-linked). WEB APP NOW FUNCTIONALLY COMPLETE TO FRS-PARITY across all modules.
    Dev server consolidated to single instance at localhost:5173.
  - BUGFIX 2026-06-12 (owner-reported via screenshot): Convert-to-Lead AND Add-Lead failed with
    "duplicate key ... lead_master_lead_number_key". Cause: generateLeadNumber() scanned only last
    50 leads by lead_id with a hardcoded floor 1608 → recomputed an existing ALT#### (true max was
    ALT1609). FIX in src/lib/leadsApi.ts: generateLeadNumber now scans ALL lead_numbers for global
    max; new shared insertLeadWithUniqueNumber() retries on 23505 unique-violation; createLead +
    wishlist.ts convertWishlistToLead both use it (removed duplicate generator in wishlist.ts).
    tsc --noEmit passes.
  - CRITICAL BUGFIX 2026-06-14 (owner-reported, 2 screenshots): lead create + meeting save failed
    ("could not allocate unique lead number" / "duplicate key meeting_master_pkey"). ROOT CAUSE:
    after migrating data with explicit original IDs into GENERATED-BY-DEFAULT identity columns, the
    Postgres sequences were NEVER advanced → every new insert got id=1.. and collided. FIX: reset
    ALL identity sequences to max(id) across all 65 tables (setval via Management API DO-block).
    VERIFIED: lead_master seq=2211 (max 2211→next 2212), meeting_master seq=645→646, lead_activity
    2706. This unblocks ALL data-entry flows (leads, meetings, activities, lead_report + children:
    pre_sales_answer/new_sales_question/meeting_schedule/meeting_participant). lead_number helper
    (global-max + retry) kept as defense. NOTE for future migrations: ALWAYS reset identity
    sequences after inserting explicit PKs.
  - LOGO: created src/components/ui/Logo.tsx = "AltLeads" wordmark (Alt=brand blue, Leads=near-black);
    wired into Sidebar + LoginPage (replaced "A" placeholder). Per owner request 2026-06-14.
  - Owner: DASHBOARD redesign NOT wanted right now (keep stat cards). Design blue direction accepted.
  - OWNER-REPORTED GAPS 2026-06-14 → building (agent abcc09097511f143b): (1) lead-report APPROVAL
    flow missing — agent can Request Approval but TL/Admin had NO queue/notification/view to
    approve/reject. Building /approvals page (gated ADMIN/TEAM_LEAD) + Approve(→stage 5 Meeting
    Scheduled, notify agent+SP)/Reject(mandatory reason→Meeting Dropped by Amplior, notify agent) +
    in_app_notification on request/approve/reject + sidebar "Approvals" w/ pending count + inline
    approve/reject on ReportTab + status badge. (2) BUG: Meeting tab showed the logged-in user's
    WHOLE meeting calendar + all feedback → scope to CURRENT LEAD's meeting(s)/feedback only
    (feedback_answer keyed by meeting_id; lead meetings via report_id→meeting_schedule→meeting_master).
    Rules per blueprint section F + lifecycle G. Team-scoped TL targeting left as TODO (open Q#3).
  - APPROVAL FLOW DONE (build passes): new src/data/approvals.ts + src/pages/ApprovalsPage.tsx
    (route /approvals, gated ADMIN/TEAM_LEAD), sidebar "Approvals" nav w/ pending-count badge
    (polls 60s), ReportTab status badge + inline approve/reject for approvers, MeetingTab now
    lead-scoped (fetchLeadMeetings replaces fetchMyMeetings — feedback no longer leaks across leads).
    STAGE IDS VERIFIED vs stage_master: 3=New Meeting, 4=Meeting Scheduled (approve), 6=Meeting
    Droped By Amplior (reject). 8 reports already Pending in data → queue is populated. Notifications
    written on request/approve/reject (status='unread'; NotificationsPage read-state reconciliation =
    TODO). Owner to test at localhost:5173.
  - 2026-06-14 "FIRE EVERYTHING" 2-HOUR PUSH (ultracode ON, weekly limit resets ~2h, owner wants max
    utilization). Battle plan, chained automatically: (1) QA AUDIT [wf_f8af7908-370, RUNNING] 11
    read-only agents audit every module vs code+live DB → docs/QA-AUDIT.md prioritized bug report;
    (2) FIX all confirmed bugs; (3) per-screen DESIGN pass vs Figma; (4) RLS SECURITY hardening
    (gated before deploy); (5) re-verify full build. Admin Figma frames retry running in background.
    If a session interrupts: read docs/QA-AUDIT.md for the fix queue; resume workflows via their
    scriptPath+resumeFromRunId noted in this log/the workflow launch results.
  - WAVE 1 QA AUDIT DONE (wf_f8af7908-370): docs/QA-AUDIT.md — 3 critical, 9 high, 13 med, 16 low.
    Top: RLS off (anon full DML) + privilege-escalation via profiles.role [-> wave4 RLS]; new-company
    inline create writes non-existent cols + bad industry_id FK; created_by stores NAME not user_id;
    rejected reports locked (no resubmit); No/Tentative meeting decisions don't rehydrate; meetings
    company reads empty company_id not client_association; mark-confirmed overwrites terminal status +
    regresses stage; wishlist reassign dropdown drops current agent; admin role-edit hard-deletes other
    roles; 91% notifications user_id NULL + status rendered as title; xlsx@0.18.5 HIGH CVEs.
  - WAVE 2 FIX SWARM RUNNING (wf_95c7bcc0-9c8): 6 disjoint file-lanes fixing the above + medium items,
    shared rule created_by=user_id, then integrator build-verify. DEFERRED to dedicated steps: RLS/
    privilege-escalation (wave 4 security), xlsx CVE swap (needs npm install -> do alone). NEXT after
    fix: wave 3 per-screen design, wave 4 RLS security, then re-verify + xlsx swap.
  - WAVE 2 FIX SWARM DONE (wf_95c7bcc0-9c8): all 6 lanes fixed, build PASSES (forced clean rebuild).
  - WAVE 3 DESIGN (wf_fac21dd4-522) + WAVE 4 RLS SECURITY (wf_1d5577e1-21e) RUNNING IN PARALLEL
    (non-conflicting: design=React files, RLS=DB policies). Wave3: split login, leads avatars,
    breadcrumbs, lead-detail stepper, then build-verify. Wave4: enable RLS all tables, authenticated
    full access on operational tables, profiles SELECT-only (blocks self-promote), anon denied;
    policies saved to new-code/migration/rls-policies.sql; adversarial verify (authed-works/anon-blocked/
    no-self-promote) with auto-rollback if authed access breaks. RLS fine-grained per-role = FOLLOW-UP.
  - WAVE 3 DESIGN DONE (wf_fac21dd4-522): split login + leads avatars + breadcrumbs + lead-detail
    stepper, build PASSES.
  - xlsx CVE FIXED: swapped xlsx@0.18.5 → patched SheetJS 0.20.3 (CDN tarball, same import/API,
    drop-in, no code change), build PASSES (313kB gzip). 3 export sites (Leads/Meetings/Wishlist) unchanged.
  - WAVE 4 RLS DONE & ADVERSARIALLY VERIFIED (wf_1d5577e1-21e): 69/69 tables RLS-enabled;
    authenticated full access (68 tables) / profiles SELECT-only; anon DENIED everywhere (empty
    reads + 42501 on writes); self-promote BLOCKED (PATCH profiles.role = 0 rows, role unchanged).
    Authenticated app reads all PASS — nothing broken, nothing rolled back. SQL: new-code/migration/
    rls-policies.sql (idempotent). FOLLOW-UP: fine-grained per-role (agent-sees-own) + app role-mgmt path.
  - 2-HOUR PUSH COMPLETE. Dev server restarted clean at localhost:5173 (re-optimized new xlsx).
    NET RESULT: audited (41 issues) → fixed all confirmed bugs → per-screen design → xlsx CVE patched
    → RLS security closed. Build PASSES. App is FRS-parity, secured (baseline), and visually on-brand.
  - 2026-06-14 (post-push, owner at lunch, autonomous): owner provided Figma EXPORT zip (root
    "Amplior CRM 0.1.zip", gitignored) → extracted 295 SVGs to docs/figma-zip/, rasterized 39
    full-screen SVGs → docs/figma-png/ (via sharp in %TEMP%\svgrender). Now have REAL admin screens
    (project/client/domain/designation/add-user/edit-* etc.). ADMIN DESIGN PASS running (agent
    a638c00f3dd5f0c87) — restyle AdminPage + components/admin to match docs/figma-png admin screens,
    preserve the role-edit fix. Committed the whole 2-hr push: d3db3f1 (436 files; no secrets tracked).
  - DEPLOY PREP for Phase 5: created new-code/web/netlify.toml (build=npm run build, publish=dist,
    SPA /* -> /index.html redirect [REQUIRED or deep links 404], security headers). Netlify base dir
    must be new-code/web. Env vars to set in Netlify: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
    (anon key in .credentials/supabase_anon_key.txt). FIRST deploy = Claude on owner "go"; auto-deploy
    OFF after first; GitHub PUSH still pending owner authorization (local commits ahead of origin).
  - ADMIN DESIGN DONE (agent a638c00f3dd5f0c87): AdminPage + components/admin matched to exported
    Figma (vertical sub-nav, Figma tables, role chips, toggles, edit modals), behavior preserved,
    build clean. Committed 57b6965 (admin design + netlify.toml + dead-code removal + gitignore).
  - CONSISTENCY DESIGN PASS running (agent acb29f370a6c28d1a): Meetings/Wishlist/Notifications/
    Settings restyled to match Leads+Admin look (visual only). After: verify build, restart dev
    server clean, final commit. Local commits so far: d3db3f1 (2hr push), 57b6965 (admin+netlify).
  - CONSISTENCY PASS DONE (agent acb29f370a6c28d1a): Meetings/Wishlist/Settings/Notifications/detail
    pages unified to Figma look (blue table headers, avatars, section cards, badges), build clean.
    Committed 3dc2703. Dev server restarted clean at localhost:5173.
  - EMAIL + NOTIFICATION SERVICE DONE (agent a1da6664, committed fe514a0): new-code/notify-service
    (Node/Express+nodemailer, Gmail SMTP from amplior.ankits@gmail.com, branded templates, /notify +
    /health, port 8787). SMOKE TEST PASSED — real email delivered via Gmail. Web wired (src/lib/notify.ts):
    lead assign/reassign (agent_id), meeting scheduled (lead_report.user_id), approval request/approved/
    rejected → in-app + email to recipient's user_master.email. Fire-and-forget (never blocks user action).
    .env (Gmail pass) gitignored. SUMMARY.md handoff created (mobile-chat section 8).
    TO RUN LOCALLY (BOTH needed for email): web = `npm run dev` in new-code/web (5173); email =
    `npm start` in new-code/notify-service (8787). App defaults VITE_NOTIFY_URL to localhost:8787.
    PROD: deploy notify-service to Hostinger Node, set its env vars, point web VITE_NOTIFY_URL at it.
    Commits now: d3db3f1, 57b6965, 3dc2703, fe514a0 (all LOCAL, unpushed).
  - CR LAYER 2 PLANNING (owner wants internal CRM w/ Companies+Contacts+Deals, HubSpot-style):
    Wrote docs/product/COMPANIES-CONTACTS-BLUEPRINT.md — per-project ownership (1 owner per
    company PER PROJECT, none outside; Tata=Adarsh@Hungerbox / Ankit@AP-Securitas), dedup
    (company by cleaned domain OR cin_number [both cols EXIST in company_master] ; contact by
    cleaned LinkedIn OR email), masked visibility (names+city to all, details to owner+downline),
    Companies module + Contacts module (calling/disposition) like Leads. NEEDS: contact_master
    table, company_project_owner table, user_master.manager_id (downline). GAP: no contacts table
    today (contacts live in lead_master); no user hierarchy column.
    Research agent a5263dc05dfb57381 running → docs/product/HUBSPOT-SALES-REFERENCE-PRD.md
    (Part A how HubSpot sales works + Part B Amplior modified). Owner wants reference to review,
    not narrate. This is a FUTURE phase (after web go-live). Key divergence: HubSpot owner = global;
    Amplior = per-project.
  - OWNER DECISION 2026-06-14: BUILD Company + Contact modules NOW (start of CR Layer 2). Existing
    dupes OK; prevent NEW dupes only. Dedup keys: CONTACT = professional email → else LinkedIn(clean)
    → else phone; COMPANY = domain(clean website url) → else CIN (caveat: 1 company can have multiple
    CINs). On create-match: surface existing record + its per-project owner (or unowned), block dup.
    DEMO mode: new test entries tagged is_demo, can duplicate, excluded from real data/dedup.
    BUILD SEQUENCE (Agent sub-agents, ultracode off): (1) data foundation agent ad1900e3f7fa4903c
    RUNNING — create contact_master + migrate all lead_master contacts (keep dupes), add
    company_master.domain_clean + is_demo, contact dedup-lookup indexes, DDL→new-code/migration/
    companies-contacts.sql. (2) NEXT: Company module + Contact module (parallel) + wire/verify.
    Companies=company_master (525). Contacts=new contact_master. Modules like Leads (list/search/
    filters/detail/new-with-dedup). Still a FUTURE-phase feature but owner wants it built now to see.
  - COMPANIES + CONTACTS MODULES DONE (commit ca901f7, build passes, dev server localhost:5173):
    * Data: contact_master (607 migrated, 130 company-linked), company_master.domain_clean(525)+is_demo,
      new `interaction` table (RLS on) for call dispositions/activity log. DDL: new-code/migration/
      companies-contacts.sql.
    * Companies module: src/data/companies.ts + CompaniesPage/CompanyDetailPage/CompanyFormPage.
      List(525, search/industry+city filters/export/pagination), HubSpot detail (Contacts-by-city +
      Deals tabs, project selector display-only), New w/ dedup (clean domain OR cin, is_demo=false).
    * Contacts module: src/data/contacts.ts + ContactsPage/ContactDetailPage/ContactFormPage.
      List(607), detail w/ Call&Disposition panel → writes interaction rows + activity timeline,
      New w/ dedup (email→linkedin_clean→mobile). Demo mode DEFAULT-ON (skips dedup, is_demo=true).
    * Wired routes + sidebar (Companies via Building2, Contacts via Contact2, between Leads & Meeting).
    NEXT for this feature: per-project ownership (company_project_owner table + assign UI; owner shows
    "Unassigned" now), improve contact↔company linkage (only 130/607 linked), masked visibility/RLS,
    per-project scoping of interactions. All deferred — owner reviewing the records now.
  - AUTONOMOUS SESSION COMPLETE (owner at lunch). 3 commits this session: d3db3f1, 57b6965, 3dc2703.
    APP STATE: FRS-parity web app, fully Figma-matched (login/leads/lead-detail/admin/meetings/
    wishlist/settings/notifications), secured (RLS baseline), correctness-audited+fixed, build PASSES.
    NEXT NEEDS OWNER: (1) authorize GitHub push of local commits (3 ahead of origin); (2) say "go"
    for the FIRST Netlify deploy (netlify.toml ready; set env VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY;
    base dir new-code/web; turn auto-deploy OFF after). Then Phase 6 mobile.
  - REMAINING (not regressions — planned next steps): Phase 5 Netlify first deploy (owner-triggered,
    auto-deploy OFF after first); fine-grained RLS; 18 blueprint detail Qs; admin Figma pixel-match
    (blocked ~3d on Figma quota); Phase 6 mobile repair; optional bundle code-split; dashboard (deferred).
  - Owner Q answered conceptually 2026-06-14: keep Supabase (not MySQL) — MySQL needs a backend server
    + manual DB mgmt (the pain being escaped) and doesn't help mobile (mobile rewires to new backend
    either way); Supabase serves web+mobile from one backend. No change.
  - DESIGN PASS STARTED (ultracode now OFF → using Agent sub-agents, not Workflow): (a) background
    agent retrying admin Figma export (24h passed); (b) agent extracting design system from Figma
    WEB frames (views PNGs) → docs/DESIGN-SYSTEM.md + applies global theme foundation (palette/
    type/radii/spacing/primitives) without restructuring layouts. Per-screen polish after owner reacts.
  - DESIGN FOUNDATION DONE: real brand = BLUE #1A7EE8 (not indigo); palette/type in docs/DESIGN-SYSTEM.md.
    Applied: index.css tokens, Sidebar/TopBar/AppShell/LoginPage/Badge restyle, primitives (ui + lead +
    admin), indigo→blue swept across ~30 files. Build passes. Refresh localhost:5173 (hard refresh).
  - ADMIN FIGMA FRAMES HARD-BLOCKED ~3 DAYS: Figma API Retry-After=~73h, x-figma-rate-limit-type=low,
    plan=STARTER (free) — image-render quota exhausted by the 52 web+mobile pulls. STOP retrying.
    DECISION: design admin panel from our extracted DESIGN-SYSTEM.md (not pixel-matched to admin frames).
    Unblock options: wait ~3 days OR owner upgrades Figma to Pro. Web(29)+mobile(23) frames are fine.
  - PER-SCREEN LAYOUT GAPS vs Figma (need dedicated passes, NOT done — skin only so far): 1) Login =
    split form+photo (currently centered card); 2) page-aware breadcrumb in TopBar; 3) Leads table company
    logo/avatar in col 1; 4) Figma DASHBOARD = calendar/meeting-schedule view, NOT stat cards (likely the
    Layer-2 meetings-centric vision — DECISION needed: FRS-parity stat-cards vs Figma calendar); 5) Lead
    detail 3-step progress + tab underline styling; 6) real AltLeads logo SVG (bear-head) — NEED ASSET from
    owner or extract from Figma (currently "A" placeholder); 7) printable A4 Lead Report page (frames 017/018)
    — not built. AWAITING owner verdict on design direction + which passes to prioritize + logo asset.
  - AFTER THIS: design-match pass vs Figma (web frames ready in docs/figma-export/web; RETRY admin
    frames first) across ALL modules at once; then RLS hardening (gated before deploy); then Phase 5
    Netlify first deploy (owner-triggered); then Phase 6 mobile.
  - NEXT MAJOR STEP after this: owner reviews USER-STORIES-AND-FLOWS.md; then design-match pass
    vs Figma; then replicate lead-workspace pattern's missing sub-pages into other modules.
  - PRODUCT DOCS DONE (wf_fce971e0-663): docs/product/{PRD,BACKLOG,ROADMAP,ROLES-AND-PERMISSIONS,
    DATA-DICTIONARY,UAT-CHECKLIST,RISK-REGISTER,DECISIONS,GLOSSARY,INDEX}.md + root README rewritten.
    All verified on disk with real content. KEY INSIGHT surfaced by ROLES doc: FRS designed this as
    TWO apps — WEB for Amplior internal (Admin/TL/Agent), MOBILE for client sales team (SH/Salesperson).
    BIG OPEN QUESTION FOR OWNER: keep the two-app split or merge into one web app? Also QC role exists
    in DB but undefined in FRS — owner must define QC permissions. Owner review priorities: BACKLOG,
    ROLES-AND-PERMISSIONS, and the ❓list in USER-STORIES-AND-FLOWS.md.
  - (was) PRODUCT DOCS WORKFLOW wf_fce971e0-663 (concurrent, writes only to docs/product/):
    authoring PRD, BACKLOG, ROADMAP, ROLES-AND-PERMISSIONS, DATA-DICTIONARY, UAT-CHECKLIST,
    RISK-REGISTER, DECISIONS, GLOSSARY + INDEX.md + updates root README.md. Grounded in
    REBUILD_LOG + FRS + live schema. Two workflows running at once (spec+lead-workspace AND
    product-docs) — no file overlap (one owns new-code/ + USER-STORIES doc, other owns docs/product/).
    Resume: Workflow({scriptPath: .../amplior-product-docs-wf_fce971e0-663.js, resumeFromRunId: "wf_fce971e0-663"}).
  - Test admin login: mohit@amplior.com / pw in .credentials/test_admin_login.txt. Dev server:
    `npm run dev` in new-code/web → currently localhost:5174 (5173 had a stale instance).
  - Owner now on Opus 4.8 (switched from Fable); sub-agents stay on Sonnet.
  - Fork: owner has $19k DO credits till Nov — KEEP fork running, billing is a non-issue.
- [ ] **Phase 4 — Admin panel** (~4–6h): users, roles, projects, clients, designations, access mgmt
- [ ] **Phase 5 — Netlify deploy** (~1h): live site + GitHub auto-deploy
- [ ] **Phase 6 — Mobile repair** (~6–10h): recreate missing files, rewire to new backend, signing + cloud iOS build
- [ ] **Phase 7 — Parallel run & cutover** (1–2 weeks owner testing, near-zero AI time)

## Working Rules (how Claude operates on this project)

1. **Read this file first** in every new session; append a Session Log entry before ending.
2. **Orchestrator pattern:** main chat plans & decides; sub-agents (model: sonnet/haiku) do
   scanning, bulk coding, repetitive work. Always prefer sub-agents for heavy tasks.
3. Owner is non-technical: explain in plain language, never assume they can run SQL/CLI.
4. Nothing destructive (deletes, deploys, password rotations) without showing the owner first.
5. Credentials live in `.credentials/` (gitignored). NEVER commit secrets; never print them in chat.

## Credentials & Accounts (locations only — no secrets here)

- `.credentials/supabase_token.txt` — Supabase personal access token (PENDING from owner)
- `.credentials/netlify_token.txt` — Netlify personal access token (PENDING from owner)
- `.credentials/github_repo.txt` — GitHub repo URL (PENDING from owner)
- Old DB creds: owner's spreadsheet + `temp_db_creds/` (gitignored; delete after migration)

---

## Session Log (append-only, newest last)

## Folder Layout (as of 2026-06-11)

- `old-code/` — all 4 vendor codebases (java backend, web app, mobile app, abandoned rebuild). READ-ONLY reference; this is the spec we rebuild from.
- `new-code/` — everything new gets built here (web app, functions, mobile fixes).
- `docs/` — all project documents, transcripts, extracted doc content, SQL dumps (`docs/amplior_backup.sql` = the 47-table schema for Phase 2 migration).
- `.credentials/` — gitignored secrets vault (tokens, DB creds spreadsheet/zip).
- Root keeps only: README.md, REBUILD_LOG.md, .gitignore, .vscode.

## Tech Stack (LOCKED, owner approved 2026-06-11)

TypeScript everywhere · Supabase (DB+Auth+Storage) · React + Vite · Tailwind + shadcn/ui · TanStack Table (replaces paid AG Grid Enterprise) · Netlify Functions for server logic · React Native (repair existing) · Netlify hosting with GitHub auto-deploy. No Java, no MySQL, no droplet.

---

### 2026-06-11 — Session 1 (Fable 5)
- Full 4-agent analysis of all codebases + docs completed. Findings recorded above.
- Verdict: rebuild is GO. Stack decided (Supabase + React/Vite/Netlify + repaired RN app).
- Model strategy set: Fable 5 for everything until 22 Jun sunset, then Opus/Sonnet.
- Created this log, gitignored `.credentials/` + `temp_db_creds/`.
- NEXT STEP: owner creating GitHub repo + Supabase & Netlify tokens → then Phase 1.
- Folder reorg DONE: old-code/ · new-code/ · docs/ · .credentials/. Stack locked (see above).
- Tokens received & verified: Supabase (org "AltLeads"), Netlify (ankit.s@amplior.com).
- **Deployment rules from owner (BINDING):** create a NEW Supabase project and a NEW Netlify
  site (both accounts are existing/shared — limits partly used). Netlify auto-deploy must be
  TURNED OFF after the very first deploy; afterwards deploys are MANUAL by owner only.
  The first deploy is done by Claude, but ONLY after owner explicitly says go.
- PENDING FROM OWNER: DigitalOcean access (API token in .credentials/do_token.txt OR guided
  clicks) for password rotation + prod data export; later (Phase 6): Apple Developer account,
  Google Play access, ask vendor for Android signing keystore; confirm whether SMS (Twilio)
  and email (SendGrid) features are actively used and who owns those accounts.
- DO token received & verified (owner owns the account). Visible: MySQL cluster
  `db-mysql-blr1-amplr`, droplets incl. `Ubuntu-25-Amplior` (68.183.246.243).
  Data-pull plan: temporarily add this PC's IP to the DB cluster's trusted-sources
  firewall via DO API, dump over SSL, remove IP after. No vendor needed.
- Supabase project CREATED: `amplior-crm`, id in .credentials/supabase_project_id.txt,
  region ap-south-1, db password in .credentials/supabase_db_password.txt.
- Email decision (pending, Phase 3): need ~100+ emails/day for meeting assignment AND
  reassignment notifications. Lean: Resend (free 3k/mo) or owner's own SMTP. Decide later.
- Mobile: owner can borrow senior's MacBook (2020); vendor may ghost on Apple/Play access
  due to withheld payment — plan for Google/Apple support recovery route.
- docs/ARCHITECTURE.md written (PM-friendly explanation of serverless architecture).
- PHASE 2 progress: all 47 tables CREATED in Supabase (verified via information_schema,
  column counts match MySQL). FKs deferred in new-code/migration/foreign_keys.sql — apply
  AFTER data load. Data-copy tool ready: new-code/migration/copy-data.js (read-only on
  MySQL, batch insert, row-count verification, --verify-only flag). To run it: create
  new-code/migration/.env from .env.example with prod MySQL creds (doadmin password is
  retrievable from DO API databases endpoint) + PG_CONNECTION_STRING (Supabase pooler,
  IPv4: postgres.puvozfhypqbwbmbhrhcr@aws-X-ap-south-1.pooler.supabase.com:5432 — try
  aws-1 then aws-0; password in .credentials/supabase_db_password.txt).
- DATA-PULL PLAN CHANGED (owner decision): do NOT touch live DB at all. Instead FORK the
  cluster in DO (owner creates it, or Claude via API on "yes, create the fork"), add this
  PC's IP to the FORK's firewall only, copy data fork→Supabase, verify counts, then DELETE
  the fork (ask owner first; fork bills hourly ~₹2-4/hr). Production never touched.
- UI redesigned per owner feedback ("AI generated"): light/quiet Attio-Linear style, Inter
  font, white sidebar, muted badges, compact tables. Build passes. Owner reviewing.
- WAITING ON OWNER: (a) fork creation (his click or my API call), (b) approval to push
  commit e10f4c1 to GitHub main.
- Demo app BUILT & VERIFIED in new-code/web (login + dashboard + Leads page with the
  7 ₹96k filters + working Excel export, 18 mock leads, build passes with 0 errors).
  Run with: `npm run dev` inside new-code/web → http://localhost:5173. Built by one
  Sonnet sub-agent in ~8 min / ~41k cheap tokens. This scaffold becomes the real app
  in Phase 3 (mock data swapped for Supabase).

---
## 2026-06-16 (cont.) — Deploy live + Company/Contact sync
- DEPLOYED to Hostinger as ONE Node app (web + email service combined). Live at crm.altleads.com (HTTP 200, /health OK). Root entry: repo-root package.json + server.js -> new-code/notify-service/server.js. Hostinger git auto-deploy from AltLeads-CRM repo (NEW clean repo, fresh history, old-code/figma/secrets excluded). Node 22.x.
- EMAIL VERIFIED WORKING on the deployed app: live POST /notify -> {ok:true} (Gmail SMTP not blocked, env vars set). If users don't receive: deliverability (spam) or recipient-email resolution, NOT the service.
- DATA REALITY found: leads are organized by PROJECT (7: AP Securitas 252, HungerBox 198, MediCare Plus 53, DTSS 52, Firmity 23, Demo 15, Urest 14) via client_association.client_name — NOT by target company. company_master (525) is a separate target list. So name-matching leads->companies fails.
- SYNC done via EMAIL DOMAIN: matched contact email domain -> company_master.domain_clean. Linked 286 contacts (now 417/608 have company_id). Scripts: new-code/migration/{backfill-dryrun,domain-match-dryrun,backfill-apply}.js. 159 contacts have work domains whose company isn't in the 525 list (candidate to auto-create companies).
- OPEN FIXES requested by owner: (1) email deliverability/trigger check, (2) push notifications [browser push NOT built; in-app exists], (3) add-user [button is empty stub; needs backend endpoint w/ service role], (4) select existing contact in lead [lead_master has NO contact_id], (5) change company on contact detail [view-only], (6) link existing contact in company record [only create-new].

---
## 2026-06-16 (cont.) — 6 fixes + notifications wave
- NOTIFICATIONS: added meeting_rescheduled + meeting_cancelled email templates (email-templates.js) + fire email+in-app on reschedule/cancel (UpdateMeetingModal.tsx). meeting_scheduled now also writes in-app (leadWorkspace.ts). Assign/reassign fire email+in-app: createLead/updateLead already wired; added wishlist assign (wishlist.ts + WishlistDetailPage.tsx). Live unread bell badge on Sidebar (fetchUnreadNotifCount in account.ts, 60s poll, mirrors Approvals badge). Recipient = salesperson for now, single TODO-commented spot per action (owner to tune later). Test recipient for emails = ankit.s@amplior.com (NOT mohit).
- LINKING (new SearchSelect.tsx combobox, dependency-free): #4 lead form "link existing contact" picker -> prefills + saves lead_master.contact_id (NEW column added). #5 contact detail pencil -> change/clear company (updateContactCompany in contacts.ts). #6 company detail "Link existing contact" modal -> sets contact.company_id.
- ADD USER (#3): backend POST /api/users/create in notify-service/server.js using @supabase/supabase-js + SERVICE ROLE key. Flow: insert user_master (user_id auto), insert user_role (role_id), auth.admin.createUser -> trigger handle_new_auth_user builds profiles row w/ role from user_role->role_master. Returns tempPassword. UsersTab.tsx modal wired (createUser in admin.ts). VERIFIED end-to-end locally (created+verified+deleted test user 117). role_master: 1 ADMIN,2 TEAM_LEAD,3 AGENT,4 SALES_HEAD,5 SALES_PERSON,6 QC. @supabase/supabase-js added to notify-service/package.json AND root package.json (prod resolves from root).
- LOCAL TEST ENV running: web 5173 (VITE_NOTIFY_URL=localhost:8787 in web/.env.local), notify 8787 (.env has GMAIL + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for local).
- NOT YET PUSHED (awaiting owner go). PROD NEEDS: add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars on Hostinger for add-user to work (returns 503 until then). All builds exit 0.

---
## 2026-06-16 (cont.) — Supabase security advisor
- Advisor email (issues "as of 12 Jun") flagged: (1) rls_disabled_in_public — STALE, RLS now ON for all 70 public tables (verified, 0 disabled, policies target authenticated only, anon denied). (2) sensitive_columns_exposed — legacy plaintext user_master.password (+ _audit).
- Owner chose HIDE (not drop). Applied column-level grants: REVOKE SELECT/INSERT/UPDATE on user_master + user_master_audit from anon+authenticated, re-GRANT on all columns EXCEPT password. Now password has only REFERENCES (no data exposure). Data kept intact. Script: new-code/migration/hide-password-column.js. App unaffected (all user_master queries use explicit non-password column lists; verified email column still SELECTable).
- OPEN: owner asked for admin "reset any user's password" feature — not built yet; can add via same service-role backend (auth.admin.updateUserById).

---
## 2026-06-17 — Per-project status model + big feature batch (in progress)
- RESET PASSWORD (admin): POST /api/users/reset-password (service role, auth.admin.updateUserById) + UsersTab row action. Verified live (404 on bogus id). Prod needs SUPABASE_URL + SERVICE_ROLE on Hostinger.
- DESIGN (owner-confirmed): 3 layers — Call Disposition (per call -> activity history), Contact Status (per contact, shown in list), Account Status (per company). All PER-PROJECT, owner+admin visibility, full history. Company also gets: is_feasible (per project), decision_power (centralised/regional/hybrid), description, comments. Admin can edit ALL dropdown option lists. Pre-sales questions to be surfaced per domain (TODO, inspect pre_sales_question). Per-user saved column views everywhere (reset keeps old).
- WAVE A DONE: tables dropdown_option (seeded: contact_status 6, call_disposition 8, account_status 7, decision_power 3, feasibility 3), contact_project_status (uniq contact+project), company_project_status (account_status,is_feasible,decision_power,desc,comments), user_view_pref (per-user column views). RLS on (authenticated baseline; owner+admin to harden in security pass). SQL: new-code/migration/feature-status-schema.sql.
- ROADMAP: B Admin dropdown mgmt + pre-sales-per-domain | C Contact list (multiselect+export+column customise+saved views+status col) | D Contact detail full edit + status/disposition/comments | E Company detail account fields + contact-row disposition/comments + linkedin | F multiselect+export on Leads/Meetings/Wishlist | G security audit (RLS/IDOR) subagents | H AI/pgvector plan subagent. THEN push.

---
## 2026-06-17 (cont.) — Security audit + hardening + access model
- SECURITY AUDIT (multi-agent) -> docs/SECURITY-AUDIT.md. 29 findings, 14 High/Critical. Headline: data was protected ONLY client-side; any authenticated user could read/write ALL rows; user-create/reset endpoints had NO auth (zero-credential admin takeover); open email relay; self-promote-to-admin. Secrets were clean; anon blocked from reads; password col hidden.
- CRITICAL HARDENING DONE + VERIFIED: /api/users/create + /reset-password now requireAdmin (JWT+role); /notify requireAuth + single-email validation + rate-limit; helmet + headers + 32kb body limit; created_by from token. Frontend (admin.ts, notify.ts) send Authorization bearer. Public SIGNUP DISABLED (Management API, disable_signup=true). Permission-table writes locked to admin/self (user_role, rbac_master, dropdown_option admin-only; user_master admin-or-self; user_view_pref own). Helpers is_admin()/current_user_id() created. Verified: endpoints 401 w/o token; signup off; policies show is_admin(). Deps helmet+express-rate-limit added to notify-service + root package.json.
- ACCESS MODEL (HubSpot-researched) -> docs/product/ACCESS-CONTROL-MODEL.md. OWNER DECISIONS: companies/contacts = PUBLIC rows + per-project MASKED contact details (phone/email/linkedin to owner+manager+admin only); leads = CLOSED (owner/manager/admin/QC); managers = PROJECT leads (TL/SH on a project; multi-project; ~1 manager/person now, admin can add more later); manager edit-if-allowed = LEADS only (companies/contacts edit = owner + admin-granted); activity LOGGING (interaction/status) = owner + manager + admin ONLY (not shared pool); QC reads all; Admin overrides all + sets the dials; masking via secured DB view.
- ACCESS RLS v1 (in progress, workflow): lead row-isolation + write-locks on company/contact/status/interaction + status/interaction write = owner+manager+admin; tested with throwaway rep/manager logins. FOLLOW-UPS: v1b contact-detail column masking (secured view + frontend switch); v2 configurable per-project view/edit dials + admin UI; manager-edit dial; rotate Gmail app password; app-layer friendly "not allowed" messages on RLS-denied writes.

---
## 2026-06-18 — Post-deploy fixes + HubSpot-style associations
- BUG ALT-142 (user edit/reset said "No login found"): ROOT CAUSE — 110 of 111 user_master rows had NO Supabase Auth login (only 1 profiles row, mohit). reset-password looked users up by the never-populated profiles.user_id link → 404 for everyone. FIX (notify-service/server.js): resolve email from user_master, find the auth account BY EMAIL (paginated listUsers), reset if it exists OR AUTO-CREATE the login if it doesn't (this is how an admin grants a migrated user access), then self-heal the profiles id↔user_id link (+ role from role_master). create-user now upserts profiles explicitly instead of trusting the email trigger. UI shows "Login created" vs "Password reset". New shared helpers genTempPassword/findAuthUserByEmail/ensureProfileLink.
- BUG ALT-143 (Pre-Sales Questions tab broken): pre_sales_question.is_active column never existed (Postgres 42703 → "Error loading questions", empty table, no edits). Added the column + admin-only write RLS (everyone reads). Migration new-code/migration/fix-questions-domains.sql, applied via new apply-sql.cjs runner.
- BUG ALT-144 (Domain edit not working): the Domain reference table was read-only and the edit pencil was a no-op for ALL reference tables. Added addDomain/updateDomain (+ updateSource/updateDesignation) in data/admin.ts; reworked ReferenceDataTab into a combined add+edit modal for Designation/Domain/Source; admin-only write RLS on domain_master.
- FEATURE ALT-145 (Deals→Leads): Company detail "Deals" tab renamed to "Leads" (tab key + label + empty/placeholder copy) and given a "New lead" action. Owner: "those deals in contact are same of our leads."
- FEATURE ALT-146 (create lead from a contact/company): LeadFormPage reads /leads/new?contact=<id>&company=<id> and prefills person + company (mirrors ContactFormPage). "+ New Lead" buttons added on both Contact and Company detail pages. Uses lead_master.contact_id — CONFIRMED present in the live DB this session (the earlier "lead_master has NO contact_id" note from 06-16 is OBSOLETE; the column was added during the 6-fix wave).
- FEATURE ALT-147 (contact associations): Contact detail now shows associated Leads (new fetchContactLeads, by contact_id + source_lead_id) and Colleagues (other contacts at the same company), matching the company page.
- LIVE DB FACTS verified this session (introspection): pre_sales_question.is_active was MISSING (now added); lead_master.contact_id EXISTS; domain_master + pre_sales_question still carried the legacy blanket authenticated_full_access policy (now admin-write/everyone-read); profiles linkage = only 1 of 111 users linked to an auth login.
- Build: web `tsc -b && vite build` exit 0; `node --check server.js` OK. Tracker refreshed to 147 tickets (ALT-142..147 added; dates 2026-06-18). PUSHED this session. PROD STILL NEEDS (owner) SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars on Hostinger for email + add-user + reset/login to work (unchanged requirement).
