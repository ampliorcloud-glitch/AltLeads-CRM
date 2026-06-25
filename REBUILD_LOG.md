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
- Build: web `tsc -b && vite build` exit 0; `node --check server.js` OK. Tracker refreshed to 147 tickets (ALT-142..147 added; dates 2026-06-18). PUSHED this session. PROD STILL NEEDS (owner) SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars on Hostinger for email + add-user + reset/login to work (unchanged requirement). [UPDATE: owner confirmed both env vars ARE set in prod.]

---
## 2026-06-18 (cont.) — Outreach-first pivot: launch plan + UX design + bug fix
- OWNER PIVOT (NORTH-STAR): the team does OUTREACH (call/email) + UPDATES records only; they do NOT create companies/contacts/leads (all data already loaded). Product must make UPDATING effortless and HIDE creation from the team; admin maintains data in BULK via import. Internal launch ASAP; client-facing later.
- BUG FIXED, committed 19021cf — *** NOT YET PUSHED *** (awaiting owner 'push'; bug is STILL LIVE on prod until deployed): Company Account-panel Feasibility was modeled as boolean while the dropdown + DB column are 3-value TEXT (feasible/not_feasible/unknown) -> picking 'Feasible' showed AND saved 'not_feasible'. Fixed end-to-end (projectStatus types + load/save/badge in CompanyDetailPage). is_feasible column was empty in prod, no cleanup.
- EMAILS improved (same commit 19021cf, NOT yet pushed): all 8 templates rewritten — warmer copy, better subjects, personalized greeting, and WORKING CTA buttons (data.ctaUrl or APP_URL default https://crm.altleads.com; APP_BASE_URL env override). Baseline only — owner will send wording tweaks.
- MULTI-AGENT ANALYSIS (Workflow wf_469ff838-223, 7 agents, ~648k tok) -> 4 NEW DOCS in docs/product/: INTERNAL-LAUNCH-PLAN.md (leadership deck/timeline), PRODUCT-GUIDE.md (leadership + user journey), UX-REDESIGN.md (role posture + record UX + lead-form reorg + grid edit), BULK-IMPORT-EXPORT.md (HubSpot/Zoho-style companies update). Read these before building the launch workstreams.
- LAUNCH STATE: app DEPLOYED+live, data migrated, all modules + RLS + masking + admin built. Go-live needs only: (1) ROLE POSTURE [hide create for agents + gate /admin route by role — today /admin only checks session], (2) BULK LOGIN provisioning (~110 users, only 1 has a login), (3) VALIDATE RLS/masking with REAL non-admin logins, (4) EMAIL sign-off + Gmail rotation. Grid-edit + bulk-import DEFERRED post-launch.
- *** LAUNCH-STOPPER (critic-found — clear BEFORE go-live): *** status/disposition/notes/interaction writes are RLS-gated on contact/company created_by = current_user_id(). Data was BULK-MIGRATED so created_by != the assigned agent -> every agent would hit 42501 on their own call-list; created_by is also NULLable. DECISION NEEDED: agents work ASSIGNED records (not created) -> either re-point created_by to assignees (data migration) OR widen WITH CHECK on *_project_status + interaction to allow assignment/project-membership. WS3 only spot-checked LEADS created_by (a DIFFERENT field). Validate with a REAL agent login before launch.
- OTHER critic catches: Gmail prod env var is GMAIL_APP_PASSWORD (NOT GMAIL_PASS); no forced first-login password change (voluntary today); contacts/companies are ROW-public + COLUMN-masked (only LEADS are row-scoped) so the test charter must distinguish row-scoping vs column-masking; apiLimiter is 30 req/min when scripting bulk provisioning.
- TRACKER: added ALT-148..159 (today's bug/email + the launch & post-launch workstreams). PENDING OWNER DECISIONS: launch-user list+roles; role posture; assignment/ownership model (the blocker); manager visibility (needs manager_id migration if yes); email wording; deploy posture for launch week.

---
## 2026-06-18 (cont.) — North-star vision + leadership decks
- OWNER VISION (captured in docs/product/VISION.md): an ECOSYSTEM — CRM web app (live) + Chrome extension + Mobile (least pri) — on ONE backend, capturing everything organised on the go, embedded as a fast RAG base for AI. SUPERPOWER: pick a contact -> AI suggestions/action items/content from OUR history (e.g. "unanswered 11am-2pm, picks after 3pm"); ask "which companies to target this month" -> 100 sites whose contracts renew next month + pitch. Must be fast.
- PRIORITY SEQUENCE (owner): (1) internal reachout [team updates records, capture on the go] -> (2) client portal [clients see scheduled/success + dashboard] -> (3) Chrome extension [LinkedIn details + inline CRM edits live] -> (4) market-mapping per city -> (5) AI gradually.
- UPCOMING FEATURE captured: TASK MANAGER (HubSpot/Zoho-style) — schedule tasks -> ticket/record associated to contact/company/lead + attach more records from other modules; reminders -> notifications; per-record Tasks tab + global My Tasks. New task + task_association tables (ALT-160).
- FOUNDATIONS THAT CAN'T CHANGE LATER (told to owner): (1) RICH interaction capture from day one (timestamp+outcome+disposition+context) — the RAG fuel, can't back-fill; (2) ownership/assignment model (the launch blocker ALT-152); (3) one shared backend+API for web/ext/mobile (Supabase — don't fork); (4) consistent IDs + cross-module associations (now incl. tasks); (5) embedding-ready text-tied-to-IDs shape for pgvector. Everything else layers on top.
- LEADERSHIP DECKS BUILT (ALT-165): docs/product/deck-product-launch.(html|pdf) + deck-product-guide.(html|pdf). Branded 10-slide decks (matched the career-ops HTML->PDF method at E:\New folder\Ankit\personal\career-ops-main; rendered via that project's Playwright using NODE_PATH; render script docs/product/render-decks.cjs). Visually QA'd (cover + dense slides screenshot-checked, no overflow). Show impact, best+upcoming features (incl. Task Manager), ecosystem/RAG north-star, roadmap, and the 6 launch decisions.
- Tracker regenerated incl. ALT-160..165 (Task Manager, client portal, Chrome ext, market mapping, AI/RAG, decks).
- NOTE: 19021cf (Feasibility fix + emails) is STILL UNPUSHED -> feasibility bug remains live on prod until owner says push. Decks + docs committed locally too (unpushed).

---
## 2026-06-18 (cont.) — Sales/Client Portal design (priority #2)
- OWNER ASK: build client-facing Sales Portal. Two login interfaces on the SAME app — "Lead Gen login" (internal, existing) + NEW "Sales login". Sales users see ONLY their project(s)' leads; internal users may enter sales portal (read leads) but sales users CANNOT reach internal screens. Start CRUD with FEEDBACK. Multiple Sales Heads per project (executive screens). Base it on the OLD VENDOR MOBILE app. Later: integrations with other CRMs/tools via our own workflow + APIs + MCP.
- TWO INVESTIGATIONS done (sub-agents): (a) old vendor mobile app = old-code/amplior-mobile-app-main (React Native "AltLeads", meeting+feedback centric). Roles SALES_HEAD(4)/SALES_PERSON(5); sales-only login (mobile+password). Sales Head = executive dashboard (revenue/funnel/city+industry graphs/assign-reassign) + sees all project leads; Sales Person = own meetings only. Visibility = project_user.role_name + lead_report.user_id; NO manager_id. Feedback = server-driven questions (feedback_question_master), Yes/No toggles + 1 free-text, writes feedback_answer + marks meeting Completed + follow_up_date. NO add-sales-person in mobile (only assign/reassign existing). Wishlist = only create flow. (b) current code: single role-agnostic Supabase login; profile.role = single top role; RLS on lead_master keys on created_by (internal owner) NOT lead_report.user_id; SALES roles is_web=false + hidden from picker; feedback is READ-ONLY in new-code (no write path); /api/users/create accepts role 1-6 (requireAdmin).
- SPEC written: docs/product/SALES-PORTAL.md (roles, two-login routing, downline hierarchy = NEW project_user.sales_head_user_id, additive lead RLS keyed on lead_report.user_id in {self,downline}, feedback CRUD, /api/sales/users/create+requireSalesHead, executive dashboard, build order, owner decisions, integrations). Tracker ALT-166..172. VISION integrations scope added.
- BUILD ORDER: (1) portal shell [additive, safe] -> (2) hierarchy+RLS migration [validate w/ real SP/SH logins before prod] -> (3) feedback CRUD -> (4) SH add-SP -> (5) exec dashboard.
- OWNER DECISIONS for portal: downline model (project_user.sales_head_user_id ok?); editable fields beyond feedback (meeting actions next?); provisioning (admin makes first SH per project, SH self-serves SPs); wishlist-add at v1 or feedback-only.

---
## 2026-06-19 — Launch decisions locked + continuity system + feedback shipped + sales pushed
- CREATED CLAUDE.md (repo root) = the OPERATING GUIDE (auto-loads every session): resume protocol (read REBUILD_LOG first), standards (capture-everything, manual deploy, outreach-only, orchestrator, progress updates, no secrets), key facts, current phase, doc map. This is the "new chat picks up where we left off" guide the owner asked for. Decisions formalized in docs/product/DECISIONS.md (ADR-21/22/23).
- OWNER LAUNCH DECISIONS (ADR-21): (1) CREATE rights = configurable per-project SETTING, DEFAULT ADMIN-ONLY; admin can grant create + CRUD to Team Leads via the Project Access dials (NOT hardcoded). Outreach roles update-only. (2) Agents edit records ASSIGNED to them (assignment-based write; re-point/derive ownership for migrated rows; validate with real agent login). (3) Manager visibility = yes, but via masking UX below. (4) Deploys MANUAL during launch week.
- MASKING REDESIGN (ADR-22): phone/email show PARTIALLY MASKED by default to permitted viewers — phone first 3 + last 3 visible, middle blurred; email similar; CLICK reveals fully, stays revealed until page REFRESH. Non-permitted viewers (not their record/team) = hidden always (masked view returns null). Build pending (ALT-173).
- SALES = WEB PORTAL (ADR-23, amends ADR-11): two logins one app; mobile deferred. Downline default = own team, but Head can grant a wider "senior viewer" share (sales_view_grant). Feedback submit outcomes = Successful / Reschedule / Cancel(Drop).
- FEEDBACK FEATURE SHIPPED (commit 31e2b9c, local): editable meeting feedback (submitMeetingFeedback → feedback_answer + meeting Completed + follow-up; Reschedule/Cancel reuse existing). Build passes. RLS: feedback_answer/meeting_master still blanket (works today); scoped policy flagged for the sales-portal RLS step.
- SALES PORTAL SHELL + decks + docs + feasibility fix + emails PUSHED live (fe33303..32c16b3) as a visual prototype for leaders. crm.altleads.com now has /sales login + portal shell, feasibility fixed, improved emails.
- TRACKER: + ALT-173 (masking partial+reveal redesign), ALT-174 (create-rights as per-project setting). PENDING OWNER: launch-user list (names+emails+roles); email wording (baseline OK or tweaks).

---
## 2026-06-21 — UX/UI/feature-gap AUDIT (26-agent swarm) → UX-AUDIT.md + 39 tickets
- OWNER ASK: "release multiple agents & tell me what all features, UI, UX can be improved — many missing, even small (advanced filters per table, multiselect) ... thousands of these — find them all."
- RAN a 26-agent Workflow (wf_0dcc24d8-b6d, "altleads-ux-audit"): 15 per-screen auditors + 9 cross-cutting dimension auditors (tables, filters/search, bulk, forms, states, consistency, a11y, responsive, feedback) → parallel barrier → synthesis (dedupe/rank) → completeness critic. NOTE: the run was cut off at the final synthesis step when the session compacted; it was still alive (task wpk7lrhut) and COMPLETED on resume. 718 raw findings → 170 deduped. 2.69M subagent tokens, 535 tool uses.
- WROTE docs/product/UX-AUDIT.md: owner TL;DR (top 5), the 13 themes (why "thousands"), 14 quick wins (effort-S), the ranked Top-30, Section 5 = 27 MISSING capabilities from the critic (the "fast caller" + AI-superpower layer: calling loop, click-to-call, task manager/follow-up reminders, today-queue, dup-merge, freshness/SLA, global search, inline quick-edit, undo, DNC/compliance, timezone, onboarding, autosave), category heatmap, coverage gaps (what we did NOT audit), and the LAUNCH LENS.
- LAUNCH LENS (key takeaway): this is a POST-LAUNCH quality runway, NOT a launch blocker — EXCEPT 4 "ship-with-launch" items because they hide failure/data loss: (a) stop swallowing inline status/stage/toggle errors [QW#9] — pairs with the assigned-ownership write-path fix (ALT-152); (b) confirm destructive/irreversible actions [Top#3]; (c) hide create buttons from outreach roles [QW#4] — matches ADR-21; (d) Contacts 1000-row silent cap [QW#13].
- BIGGEST functional gap (Top#1): multiselect is wired on every list but only feeds Export — no bulk status/stage/reassign/approve; data layer is single-record (needs batch endpoints). This is the core payoff for an "update records in bulk" outreach CRM.
- TRACKER: +39 tickets → 215 total. ALT-177 (audit epic/report), ALT-178..207 (Top-30), ALT-208..214 (7 missing-capability bundles), ALT-215 (14 quick-wins batch). New wave "UX audit", new module "UX". Generator updated (gen-backlog-tracker.cjs uxAuditTickets(); TODAY→2026-06-21). xlsx regenerated.
- NOT STARTED any implementation — report is for owner review first; owner to pick which of the 4 ship-with-launch items to build now.
- UNPUSHED local commits remain (feedback 31e2b9c, CLAUDE.md/ADRs 9b2b177, open-questions a488860, email-templates 94fe984, + this audit). Push only on owner "push".

---
## 2026-06-21 (cont.) — Built launch-safety bundle (toast + confirm + gating + cap fix) + security pass
- OWNER: "choose & start yourself, don't stop before testing, keep security checks after every big milestone."
- CHOSE the launch-safety bundle from UX-AUDIT (the 4 "ship-with-launch" items + the foundational toast/confirm system they depend on). BUILT:
  1. NEW src/components/ui/Toast.tsx — global ToastProvider + useToast() (success/error/info/warning, auto-dismiss 4s/6s, portal to body, aria-live + role=alert). [UX-AUDIT Top#2]
  2. NEW src/components/ui/ConfirmDialog.tsx — ConfirmProvider + useConfirm(): Promise<boolean>; role=dialog/aria-modal, Esc + backdrop cancel, focus mgmt, danger tone, optional type-to-confirm. [Top#3]
  3. App.tsx — mounted <ToastProvider><ConfirmProvider> at root.
  4. AuthContext — added isAdmin + canCreateData (= isAdmin per ADR-21; create is admin-only by default).
  5. Create-button gating (canCreateData) on 5 spots: Leads/Companies/Contacts list "New" buttons + ContactDetail "New Lead" + CompanyDetail "New lead". Outreach roles no longer see Create. [QW#4]
  6. Error surfacing: ContactsPage InlineStatusCell now shows toast on failure + only updates badge on success (was silently flipping even on RLS 42501). UsersTab/ProjectsTab disable + unassign now toast errors instead of swallowing. [QW#9]
  7. Destructive confirms (useConfirm): cancel meeting (UpdateMeetingModal), approve report (ApprovalsPage), disable user (UsersTab), disable project + remove member (ProjectsTab). [Top#3]
  8. Contacts 1000-row cap FIXED (data/contacts.ts): fetchContactById now queries the masked view by id directly (was scanning a 1000-row page → contacts past #1000 unfindable); fetchAllContacts pages via .range() up to 50k with a truncated flag. [QW#13]
  9. BONUS a11y: index.css restored a global :focus-visible brand ring (was stripping the outline from every control — WCAG 2.4.7). [Top#4]
- TESTED: `npm run build` (tsc -b + vite build) PASSES clean (1866 modules, built 947ms). Lint on touched files shows only pre-existing issues + the same react-refresh/only-export-components pattern AuthContext already uses (provider+hook in one file) — no NEW violations. No test runner configured in the project.
- SECURITY PASS (post-milestone): (a) No new vulns — toasts/confirms render strings as React text (XSS-safe, no dangerouslySetInnerHTML); masking preserved (still via contact_master_masked); no secrets; isAdmin is read-only derivation from existing user_role join. (b) FINDING → ALT-216 (P1): access-rls-v1.sql INSERT policies are WITH CHECK (is_admin() OR created_by=self), so ANY authenticated user can create owned records — contradicts ADR-21 "admin-only create". The new UI gate is client-side only/bypassable; true enforcement needs INSERT WITH CHECK = is_admin() (or +project-create-grant ALT-174), with owner sign-off + throwaway-role validation before prod. (c) The error-surfacing also makes the update-path blocker ALT-152 visibly toast "you can only edit records you own" — reinforces it must ship before launch.
- TRACKER: +ALT-216 (security finding) → 216 total. NOT pushed (manual deploy; awaiting owner "push"). Implementation committed locally only.

---
## 2026-06-21 (cont. 2) — Company-record UI + Zoho-style inline save + new-tab redirects + unsaved-changes guard
- OWNER ASKS (this batch): (1) tracker showed everything Planned — mark what's done; (2) ADR-21 admin-only-create: DON'T harden DB now (team trusted) but MUST enforce when sales portal sees companies/contacts; (3) contact-inside-company edit: drop the confusing expand-arrow, use the free middle space, add a Zoho-style ✓ tick-to-save next to the field; (4) company record: show revenue, employees, domain, industry + current; (5) company record has no link to contact record — add it, and make ALL cross-record redirects open in a NEW TAB; (6) if edited data could be lost, cache it + warn to save/discard.
- TRACKER STATUSES FIXED: generator now sets real statuses — ALT-179 (toast/confirm) + ALT-181 (focus ring) = Done; ALT-180 (confirms) + ALT-215 (quick-wins) + ALT-190 (dirty-guard) = In Progress. ALT-216 reworded → DEFER DB hardening (owner call) but REQUIRED before sales portal exposes companies/contacts (sales roles must fail INSERT).
- COMPANY RECORD (ALT-217): CompanyDetailPage "About this company" grid — Industry, Employees (company_size), Revenue (turnover_master.turnover via turnover_id), City, Website, Email, LinkedIn, CIN + description. companies.ts: Company type + fetchCompanyById extended (turnover_id, description).
- INLINE CONTACT EDITOR (ALT-218): ContactRowPanel rebuilt — removed the bare expand-chevron; always-visible inline strip (Status select + Description + Comments inputs) using the row width; green ✓ tick saves (Enter saves too), ✗ discards, shown only while dirty; toast feedback; "Log call" is now a labelled toggle. Contact NAME links to the contact record.
- NEW-TAB REDIRECTS (ALT-218): every cross-record link opens in a new tab with rel=noreferrer noopener — company→contact (name), company→lead (DealsTab), contact→company (header + panel), contact→lead, contact→colleague. "Add new contact" inside company gated by canCreateData.
- UNSAVED-CHANGES GUARD (ALT-219, implements Top#13/ALT-190 for forms): NEW src/components/ui/useUnsavedChanges.ts — caches the draft to localStorage while dirty, warns on browser close/refresh (beforeunload), and offers to RESTORE on return. Wired into Lead/Contact/Company New+Edit forms with a Discard-changes confirm on Cancel/Back; cache cleared on successful save AND on logout (shared-computer hardening, in AuthContext.signOut).
- TESTED: `npm run build` (tsc -b + vite build) PASSES (✓ ~1s). Lint: fixed a real React-19 "cannot access refs during render" in LeadFormPage (baseline ref → state); remaining lint = the project-wide set-state-in-effect pattern (build does not run eslint).
- SECURITY PASS: (a) all new target=_blank links carry rel=noreferrer noopener → no reverse-tabnabbing; (b) company revenue/employees/description are not PII and company_master SELECT is already public — no new exposure; (c) draft cache (could contain typed names/emails/phones) is cleared on logout; residual low risk: a draft survives a browser closed WITHOUT logout (acceptable for per-user internal logins; TTL is a possible later hardening); (d) no new endpoints/RLS/secrets/auth changes; canCreateData gating extended to "Add new contact" (defense in depth).
- TRACKER: +ALT-217/218/219 → 219 total (Done 120, In Progress 5). NOT pushed (manual deploy; awaiting owner "push").

---
## 2026-06-21 (cont. 3) — Wired the dead notification bell + Log-call confirmation
- TopBar bell was a no-op with no badge. Now: clicking it opens /notifications; shows an unread-count badge (red pill, "99+" cap) via fetchUnreadNotifCount(profile.user_id), refetched on every route change; added aria-label/title. (UX-AUDIT quick-win #3.)
- DispositionForm "Log call" now emits a "Call logged" success toast (and toasts errors) — was previously silent, the core action of an outreach CRM giving zero confirmation. (UX-AUDIT feedback theme.)
- Build passes (tsc + vite). Tracker ALT-215 note updated (#3 done). Not pushed.

---
## 2026-06-21 (cont. 4) — More destructive-action confirms + missing success toasts + truncation tooltips
- CONFIRMS (ALT-180): added confirm to Request-Approval (locks the report form) and the inline Approve in ReportTab (advances stage + emails). Now covered: cancel-meeting, approve (Approvals page + inline), request-approval, disable-user/project, remove-member.
- SUCCESS TOASTS: Wishlist "Convert to Lead" now toasts "Lead created from wishlist" (was a silent navigate); DispositionForm "Call logged" (prev commit). Convert keeps its deliberate multi-field modal (sufficient intent) — added toast, not an extra confirm.
- TRUNCATION TOOLTIPS (ALT-215 #1): added title= to the primary name/sub cells in Leads, Companies and Contacts lists so clipped names are readable on hover.
- Build passes (tsc + vite, 0.6s). Security: confirms/toasts/title attrs are additive, no new data exposure or XSS (title is an escaped attribute). Tracker notes updated. Not pushed.

---
## 2026-06-21 (cont. 5) — Searchable MULTI-SELECT filters (owner's #1 original ask)
- OWNER picked "multi-select / advanced filters" as the next priority (their original complaint that kicked off the audit: "all filters are not there as advance filter, multiselect is not there").
- NEW src/components/ui/MultiSelectFilter.tsx — reusable, dependency-free searchable filter: trigger shows "All"/value/"N selected" + a count badge; popover has a search box + checkbox list + Clear/Done; closes on outside-click/Escape; OR-within-facet, empty selection = no filter. Accessible (listbox/option roles, aria-label).
- WIRED into 3 lists (filters type string→string[], predicates →includes(), hasActiveFilters handles arrays, removed the old single-value SelectFilter helpers):
  - Leads: Agent, Project, City, Source, Industry, Stage
  - Contacts: Company, City
  - Companies: Industry, City
- Build passes (tsc + vite, 0.7s). Security/correctness: pure UI, renders option strings as text (no XSS), no new data exposure/endpoints; predicate semantics preserved (single-select still works as a 1-element multi-select).
- REMAINING (tracked on ALT-183/184): Meetings + Wishlist lists; per-column/advanced operators (contains/is-empty/AND-OR) Top#7. Tracker ALT-183 → In Progress.
- NOTE: I can't browser-test (no runner) — recommend the owner spot-check the filters on localhost before push. Not pushed.

---
## 2026-06-21 (cont. 6) — Multi-select on all lists + copy-to-clipboard + shared-modal a11y
- MULTI-SELECT FILTERS now on ALL FIVE lists (finished ALT-183 → Done): added Meetings (Agent/Industry/City/Salesperson/Status) and Wishlist (Status/Agent/TeamLead/Industry/City) to the Leads/Contacts/Companies rollout. Same pattern: filters string→string[], predicate includes(), removed the old per-page SelectFilter helpers.
- COPY-TO-CLIPBOARD (ALT-215 #7): new src/components/ui/CopyButton.tsx (copies + check + toast). ContactDetailPage InfoRow gained an optional copyValue; Email/Phone/Alt-Phone now have a copy button, and Phone/Alt-Phone became tel: links (were plain text).
- SHARED MODAL A11Y (ALT-203, Top#26): admin Modal now closes on Escape, has role=dialog/aria-modal/aria-label, and moves focus into the dialog on open — fixes every admin modal (Users/Projects/Clients/Dropdowns) at once.
- Build passes (tsc + vite) at each step. Security/correctness: filter predicates preserve semantics (single value = 1-element multi); CopyButton uses navigator.clipboard (user-gesture only) and renders nothing for empty values; modal change is additive a11y. No new endpoints/RLS/secrets.
- Tracker: ALT-183 Done; ALT-203 In Progress; ALT-215 notes updated (#1,3,4,6,7,9,13,14 shipped). Done now 121. Not pushed.

---
## 2026-06-21 (cont. 7) — Removed dev banners + real empty states
- QW#2: removed the dev-era "Connected to live Supabase data — read-only preview" banners from Leads, Wishlist and Dashboard (+ their now-unused bannerDismissed state). The app no longer tells users it's a read-only preview.
- QW#11: Leads/Contacts/Companies empty state now distinguishes "No <x> yet." (genuinely empty) from "No <x> match the current filters." + an inline "Clear filters" button (Meetings/Wishlist already distinguished). 
- Build passes. Additive/low-risk. Tracker ALT-215 note updated (#2,#11 shipped). Not pushed.

---
## 2026-06-21 (cont. 8) — "Clear all not-done tickets" campaign: Bucket A build-out (8 commits)
Owner directive: "do all pending = every not-done ticket out of the 220." I triaged the 98 not-done into A (build-now, frontend), B (needs owner/ops/DB+RLS validation), C (major new subsystems). This session cleared a large slice of **Bucket A**, each batch build-verified (tsc -b + vite) and committed (NOT pushed). Two parallel sub-agent workflows used for fan-out (infra files; list-a11y replication), integrated + build-verified centrally.

SHIPPED (commit-by-commit):
- INFRA (ALT-196/200/199/186/197): ErrorBoundary at app root (no more white-screen); Skeleton family; pure validators (email/phone/url/required + validateField/Form); useUrlState hooks (URL persistence foundation); self-serve **Forgot/Reset password** pages + routes + LoginPage show/hide toggle + Forgot link.
- A11Y/SAFETY (ALT-203/180): new useFocusTrap → Tab-trap on the shared admin Modal + global ConfirmDialog (completes dialog a11y); **clinch/close** now confirms + toasts.
- DASHBOARD (ALT-193, ALT-192 partial): personalized header (greeting + role chip) and every card/stage-bar/activity-row is a keyboard-operable drill-down (cards→list, bars→/leads?stage=, rows→/leads/:id).
- GLOBAL SEARCH (ALT-188/213 partial): Cmd/Ctrl-K CommandPalette across leads/companies/contacts (keyboard nav + deep-link) + TopBar "Search ⌘K" button. Index reuses existing RLS-safe fetchers, cached at module scope, **cleared on logout**.
- LISTS a11y/loading (ALT-200/215#12/182/215#8) on ALL 5 lists: column-aligned skeleton rows on load; error state with Retry (reloadKey); keyboard-operable rows (role=link, Enter/Space) + sortable headers (role=button, aria-sort, keyboard); checkbox aria-labels.
- APPROVALS (ALT-204): SLA age badge (escalates colour as a report ages), search, sort (oldest-first SLA / name), no-match state, in-modal Approve/Reject.
- SECURITY (ALT-220, new): post-milestone review caught that the Cmd-K search index (module-scope cache) wasn't cleared on logout → cross-session leak on a shared machine. signOut() now calls clearSearchIndex().
- TRACKER: gen-backlog-tracker.cjs PROGRESS map updated; merge logic fixed so the GENERATOR is authoritative for Status/Notes (was always preserving stale xlsx status). ALT-010/055/085 confirmed already-done and marked Done. **Done 121 → 134**, In Progress 7, Planned 79 (of 220).

SECURITY PASS (this milestone): new-tab links carry rel=noreferrer noopener; ErrorBoundary hides stack outside DEV; Toast/Confirm/CommandPalette render strings as React text (no XSS); search only surfaces RLS-readable rows (contacts via contact_master_masked) and is purged on logout; password reset never reveals whether an email exists; no new endpoints/RLS/secrets. One finding (ALT-220) fixed.

DEFERRED — needs OWNER decision / ops / DB+RLS validation (Bucket B), NOT done blind:
- ALT-063 Hostinger env vars; ALT-095/096 parallel-run + cutover; ALT-020 go-live password emails; ALT-021 firewall prune; ALT-137 Gmail rotation; ALT-154 email sign-off; ALT-121 owner doc review; ALT-056 notif-recipient tuning; ALT-045 QC workflow; ALT-108/109/110 Apple/Google/keystore.
- ALT-152 write-path/ownership RLS (THE launch blocker) + ALT-153 RLS validation w/ throwaway logins + ALT-022/167 team-scope/sales-downline RLS + ALT-216/174 admin-only-create enforcement + ALT-176 bulk user import → all DB/RLS, validate before prod.
- ALT-197 OPS: add <origin>/reset-password to Supabase Auth Redirect URLs before the reset flow works in prod.
- ALT-198 stage-select forward-skip constraint: needs the stage state-machine confirmed (closed-lead lock already works); moved off blind-build.
- ALT-112/192 per-role dashboard NUMBERS: blocked on ALT-152 ownership model (scoping "my leads" wrong would mislead the team) — drill-downs + framing shipped.

DEFERRED — major new subsystems, each needs its own plan + owner input (Bucket C):
- ALT-104/106/107 mobile RN rewire; ALT-162 Chrome extension; ALT-116/117/164 AI/RAG+pgvector; ALT-161 client portal; ALT-208 calling loop; ALT-160/209 task manager; ALT-172 integrations/MCP; ALT-163 market-mapping; ALT-166/169/170/171/206 sales-portal build-out.

REMAINING Bucket A (build-now, next sessions): ALT-199 wire validators into forms; ALT-186/215#10 wire URL persistence into lists; ALT-184 advanced facets; ALT-185 saved views; ALT-187 select-all-N; ALT-195 sticky headers (visual—needs a browser check); ALT-201 collapsible filters+chips; ALT-205/157 inline-edit + quick actions; ALT-212 freshness column; ALT-214 density/autosave; ALT-207 standardize primitives; ALT-155/156 record/form UX; ALT-194/173 masking treatment; ALT-190 dirty-guard on detail/modals.

STATE: 21 commits unpushed on clean-main (13 prior + 8 this turn). I cannot browser-test (no runner). Recommend the owner spot-test on localhost (cd new-code/web && npm run dev) or say "push" to deploy (git push altleads clean-main:main).

---
## 2026-06-21 (cont. 9) — Client Portal: PLAN (not built)
Owner requirement (from a CEO meeting transcript, captured in full): build a **premium, Amplior-branded, client-facing web portal** — "Amplior's identity in front of the client," like Microsoft's admin portal. Single source of truth per client (onboarding/ICP, LIVE lead reports + meetings + dashboard, governance/Fathom notes, updates/action-log/escalation, invoices) + an internal knowledge/performance mirror. Web-only, Phase 1 = mostly static staff-uploaded content + a few live CRM reads, low automation. Access by SENIORITY (client leadership + ADMIN/SALES_HEAD/leadership; agents only if elevated to sales-head access). Branding stays **Amplior** (CRM stays AltLeads).
- Full plan written to **docs/product/CLIENT-PORTAL.md** (v1). Distinct from the internal Sales Portal (/sales).
- **Supabase recommendation: SAME project** (puvozfhypqbwbmbhrhcr) on **Pro ($25 — pay regardless** to kill the free-tier pause risk), with a dedicated `portal` schema + **curated client-scoped read-only VIEWS** + a separate **CLIENT** role + per-client Storage. Same project = live CRM data with no sync + one bill; the external-user risk is contained by exposing ONLY curated views (never base tables) and **adversarial multi-tenant RLS validation with throwaway client logins** before any real client. Switch to a SEPARATE project (fed by a read-only sync) if it scales to many client orgs or the security review deems direct exposure too risky.
- Data backbone confirmed in schema: client_association → project(client_assoc_id) → leads/meetings/lead_report; new client_portal_user(auth_uid→client_assoc_id) mapping needed.
- Tracker: new epic **ALT-221** (Mohit-owned, Planned); old **ALT-161** marked superseded/expanded by it. Build only after owner signs off the open decisions in CLIENT-PORTAL.md §10.

---
## 2026-06-21 (cont. 10) — Client Portal interview round 2 + Task Manager re-confirmed
- Supabase **same-project + Pro APPROVED** by owner. ONE product, TWO brands (Amplior + AltLeads), 2 domains for now. The vendor MOBILE app was the CLIENT sales-team app (confirmed via old-code/amplior-mobile-app-main screens: Meetings/StatusWiseMeetings/MeetingDetails, Feedback/MeetingReview, SalesPersonModal assign, Wishlist+SearchCompany, Home/MeetingOverview/Industry+City graphs, HotProspect, Notifications, Profile).
- **Phase-1 build order:** (1) sales screens — view + assign/reassign meetings (port mobile→web); (2) ICP, docs & decks; (3) governance scheduling = review-meeting reminders (email) + calendar-style details (governance is just a TL/Manager <-> Company-Admin review meeting). Dashboard spec later (Amplior x HungerBox 3-Year Review PDF = premium-look + content reference).
- **Feedback:** available once a meeting has STARTED; Sales Rep (SP/SH) provides, SH edits; recorded in CRM (Amplior agent/TL/managers + rep + uplines see outcomes). Assign/reassign only the meetings Amplior generated for that lead/project.
- **DATA ISOLATION (critical):** client owns only MEETING records, NOT the company/contact; sees company info as a SNAPSHOT captured up to their meeting; NEVER sees another project's/client's meeting on the same shared company (breach); snapshot refreshes only if Amplior generates a new meeting. -> snapshot company/contact onto the meeting at generation; portal views read snapshot, scoped per project. ONE DB, many isolated views (no separate copy).
- **Task Manager** re-confirmed as a separate CRM module (ALT-160/209): 1-click Call/Meeting/Task per user, record-associated, email + browser reminders (HubSpot/Zoho-style).
- Detail in docs/product/CLIENT-PORTAL.md §13. Plan only.

---
## 2026-06-21 (cont. 11) — Phase-1 Client Portal plan + Task Manager plan (multi-agent, PLAN ONLY)
Owner: "i want both via different sub agents that you control as ultracode." Ran one Workflow (`portal-and-taskmgr-plans`, 10 agents, ~20 min): 4 parallel grounding scouts (vendor mobile app / current CRM code+email+theming / locked CLIENT-PORTAL model / **HubSpot live task schema via MCP** + Zoho) -> 2 SEPARATE design agents (portal, task-manager) -> adversarial completeness critique per plan -> each design agent revised its own doc. Two planning docs written; 37 tickets added to the tracker (now 258; Planned 80->117). Nothing built, nothing pushed.

**docs/product/CLIENT-PORTAL-PHASE1.md** (ALT-222..ALT-245, 24 tickets). Critique caught + fixed 4 real issues:
1. **Day-one empty portal** -> added a one-time **snapshot BACKFILL** applier (ALT-225) since most meetings already exist.
2. **Architecture contradiction** -> the portal is a **BRAND-NEW separate app** (ALT-230), NOT a re-skin of the CRM; reusing internal pages that read LIVE shared company data would leak across clients. Banned reusing the /sales shell or any live-data page.
3. **Isolation mechanism made concrete** -> per-meeting denormalised **portal.meeting_snapshot** (ALT-223) + SECURITY-INVOKER **portal_* views** (ALT-226) + RLS (ALT-227) + a portal-owned **notifications** table (ALT-228), proven by a **throwaway-login RLS test that is a HARD release gate** (ALT-229).
4. **Add/Edit-User bug corrected** -> Add already assigns sales roles; the real fix is Edit not letting you ADD a sales role a user lacks (ALT-244).
   Plus: safe **name-only** company suggest in wishlist (ALT-238, reveals nothing about who else targets a company) + **full email re-brand** (header+footer+subject+body, ALT-232).
   **OWNER DECISIONS PENDING:** client-visible **column whitelist** (ALT-243, blocks snapshot schema+backfill) and **snapshot-writer trigger** mechanism (ALT-224, endpoint vs DB trigger). Also OPEN: portal auth OTP-vs-link; downline source; full dashboard chart spec.

**docs/product/TASK-MANAGER.md** (ALT-250..ALT-262, 13 tickets). Internal CRM module. Critique caught + fixed 3 honesty gaps:
1. The TopBar **bell does NOT poll today** (only refetches on route change) — so the live badge-bump + toast is genuinely NEW front-end work: a ~60s timer (ALT-258).
2. The reminder job **cannot reuse POST /notify** (that needs a user JWT) — the scanner must **send email in-process** (buildEmail+getTransporter().sendMail) and **insert the bell row server-side** with the service-role client (ALT-256/257).
3. TL-sees-team needs a **new manages_user() RLS helper** (the existing one is project-keyed, not person-keyed) (ALT-251).
   Pinned to **IST** so Today/Overdue is correct near midnight; reminder timing maintained by a **DB trigger** (snooze/edit re-fires); web push deferred to backlog.
   **OWNER DECISION PENDING:** **per-task vs digest** reminder email (ALT-262, Gmail throttling) — blocks the email slice (ALT-256). Default-offset (fire-at-due vs 10-min-before) also open.

STATE: still 22 CRM commits unpushed on clean-main (portal/task-manager are PLAN docs, not code). Next: owner answers the 4 blocking decisions (ALT-243, ALT-224, ALT-262, + Add/Edit bug go-ahead), then we build Phase-1 sales screens first.

---
## 2026-06-21 (cont. 12) — Increment 1 BUILT (Task Manager + Portal foundation), code-only, staged
Owner: "lets start building" + answered A/B/D + C go. Built via a multi-agent workflow (3 parallel build agents → adversarial RLS review → revise), then integrated + build-verified centrally. Nothing applied to the live DB; nothing pushed.

**C (ALT-244) DONE:** UsersTab Edit-roles modal now always offers SALES_HEAD/SALES_PERSON, so an admin can GRANT a sales role (not just remove one already held). Build passes.

**Decisions locked:** A = clients see the full vendor-mobile-app field set (refine later); B = per-task reminder email capped + opt-in daily digest (default OFF); D = snapshot writer is a SECURITY DEFINER fn + DB trigger (atomic, unbypassable).

**Task Manager (ALT-250/251/252 → In Progress, code-complete, STAGED):**
- apply-create-task-table.cjs (task + task_user_pref, reminder-timing trigger that re-fires on snooze, scanner index, explicit anon-revoke/authenticated-grant).
- apply-task-rls.cjs — review CAUGHT a real leak (manages_user derived from shared-project membership → a TL could read co-members' tasks) and FIXED it: manages_user() now FAILS CLOSED (owner + admin only). All policies TO authenticated.
- Frontend: data/tasks.ts + components/tasks/{CreateTaskModal,taskScheduling} + pages/MyTasksPage; wired as /tasks + Sidebar "My Tasks". Build passes. Inert until the table is applied.

**Portal foundation (ALT-222/227 → In Progress, code-complete, STAGED):** 4 appliers. Review CAUGHT two EXISTENTIAL gaps, both FIXED in revise: (1) policies were targeting an unbridged custom role; now target the real `authenticated` role gated by portal.caller_client_assoc_id(); (2) base-table leak — portal sessions would inherit the CRM's permissive `USING(true)` company/contact reads; now closed by an `AS RESTRICTIVE deny_portal_session` policy applied to every RLS-enabled public table. Snapshot writer = SECURITY DEFINER fn + trigger, REVOKE EXECUTE FROM PUBLIC. Remaining VERIFY items (started_at cast on dirty meeting_time, deterministic meeting→report resolution, backfill completeness abort, downline definition) to confirm during the ALT-229 throwaway-login validation, which is MANDATORY before apply (it's a CRM-wide RLS change).

**Parallel:** a read-only audit workflow (find-small-fixes-r1) returned 29 vetted small fixes (a11y aria-labels, dead imports, stuck-spinner unhandled rejections, IST/UTC week-bucket bug, approve-self-notify, time-field clobber). Applying next in a batch.

STATE: ~25 commits unpushed on clean-main. NEXT GATE for the owner: (a) review + approve applying the staged DB migrations (then I run them + the throwaway-login validation), (b) continue Increment 2 (reminders, one-click, portal app/screens). Continuous find-and-fix loop running per owner's "keep working" directive.

---
## 2026-06-21 (cont. 13) — Continuous find-and-fix loop, round 1 (24 files)
Per owner "keep finding small things & keep fixing them". Read-only multi-dimension audit (5 finder dims, adversarially verified -> 29 confirmed) then per-file fixes applied by parallel agents, integrated + build-verified (tsc -b && vite build pass). Tracked as ALT-263 (ongoing).
- a11y: aria-labels on icon-only close/clear/column buttons (EditMeeting, UpdateMeeting, MeetingTab, Approvals x2, SearchSelect, CompanyDetail link-contact, ColumnCustomizer toggle/up/down).
- consistency: the last `window.confirm` in the app (PreSalesQuestionsTab delete) -> app ConfirmDialog; clipboard copy now has .catch+toast (UsersTab); truncation title tooltips (CompanyDetail breadcrumb, ContactDetail InfoRow, PreSales full-question).
- code health: removed dead code (WishlistPage unused X + stale marker; ContactsPage dead XLSX import + void; ProjectSelect unused className prop).
- REAL BUGS fixed: getWeekStart used toISOString -> shifted the dashboard "this week" window a day under IST (now local date string); fetchLeadMeetings bucketed upcoming/past with mixed Date clocks (now YYYY-MM-DD string compare); six "stuck spinner forever" unhandled-rejection paths now catch + show empty/error (Dashboard, CommandPalette, LeadDetail, ContactDetail, ContactForm, Meetings) + globalSearch inflight promise self-clears on failure (was poisoning the Cmd-K palette until reload); ExportButton wraps SheetJS in try/catch; approveReport no longer emails the approver about their own click; EditMeeting time field no longer silently blanks a saved non-HH:MM time on save.
Loop continues (round 2 next). Nothing pushed.

---
## 2026-06-21 (cont. 14) — find-and-fix loop round 2 (12 files incl. backend)
Build + node --check pass. ALT-263. Web: swallowed Supabase errors now logged/surfaced (contacts/leadWorkspace/projectStatus/meetings); AuthContext provider value memoized; ReportTab new-question rows keyed on stable _uid; ActivityTab + DispositionForm load error/empty states; MeetingTab delete -> ConfirmDialog; WishlistDetail toast auto-dismiss; UsersTab Add-User email validation. Backend (notify-service) hardened x8: async route handlers wrapped in try/catch -> 503, input validation, no internal-error leakage. Loop continues (now alternating with portal build). Local stack confirmed up: web :5174 + notify :8787 healthy.

---
## 2026-06-21 (cont. 15) — Client Portal app Increment 2a BUILT (net-new /portal, isolated)
Built via workflow (foundation -> 3 screens -> adversarial isolation review), wired + build-verified. Code only; inert until DB applied + exposed.
- **Pragmatic architecture call:** instead of a separate Vite app, built a NET-NEW, fully isolated /portal route tree inside the existing web app (src/portal/**) with its OWN login + guard + layout + data layer, mounted in App.tsx OUTSIDE the CRM/sales guards. (Separate-origin brand isolation still possible via VITE_BRAND + 2 domains -> same build.)
- Files: src/portal/{data/portal.ts, brand.ts, usePortalSession.ts, PortalProtectedRoute.tsx, PortalLayout.tsx, PortalRoutes.tsx} + pages/{PortalLoginPage, PortalHomePage, PortalMeetingsPage, PortalMeetingDetailPage}.
- **Isolation review PASSED (verified):** zero imports of CRM pages or live-data modules (greppped); data layer queries ONLY supabase.schema('portal') views; raw supabase client used ONLY for auth. Feedback DOUBLE-gated (UI + server re-read) on snapshot started_at <= now(). Types derived 1:1 from the real portal_meetings/portal_lead/portal_notifications view columns in apply-portal-foundation.cjs.
- **To go live (gated):** (1) owner approves applying apply-portal-foundation + apply-portal-rls (+ ALT-229 break-in test); (2) add `portal` to Supabase API exposed schemas; (3) provision >=1 enabled client_portal_user row. Until then every fetcher returns error -> UI shows empty/error (expected).
- Covers ALT-230/231/233/234/237/240. NEXT portal (2b): Wishlist (safe name-only suggest), Notifications feed, assign/reassign, governance reminders.
Loop continues. Nothing pushed.

---
## 2026-06-21 (cont. 16) — Task Manager DB APPLIED to prod (owner-authorised) — module is LIVE
Owner: "yes apply migration - task manager not working, make it work." Applied the TASK migrations to the live Supabase DB (additive, low-risk: new tables + fail-closed RLS on those tables only; existing CRM RLS untouched).
- `node apply-create-task-table.cjs` -> public.task + public.task_user_pref created (idempotent, txn-wrapped). Verified columns.
- `node apply-task-rls.cjs` -> RLS enabled; policies TO authenticated (owner_user_id = current_user_id() OR is_admin() OR manages_user()); manages_user() present + FAILS CLOSED. Verified pg_policies + helpers.
- Smoke test (service connection): INSERT computed reminder_at = due_at - offset via the BEFORE trigger, defaults OPEN/NORMAL, reminder_sent_at NULL; row cleaned up. `NOTIFY pgrst, 'reload schema'` issued so the REST API serves /task immediately.
- => My Tasks (/tasks) now functional on the live app: create Call/Meeting/To-do, Overdue/Today/Upcoming buckets (IST), done/skip/snooze. ALT-250..255 DONE.
- NOT yet built (Increment 2): email reminder scanner (ALT-256), server-side bell insert (257), ~60s live web timer (258), one-click-from-record (260), TL reassign (261), digest opt-in toggle.
- PORTAL migrations NOT applied yet: higher blast radius (CRM-wide RESTRICTIVE deny_portal_session policy on every RLS table) -> must validate with a throwaway portal login that CRM staff are NOT locked out + isolation holds (ALT-229) BEFORE applying to the live CRM; also needs a one-time Supabase dashboard step (expose the `portal` schema). Handling that as a separate careful step.

---
## 2026-06-21 (cont. 17) — find-and-fix loop round 3 (21 files)
Build pass (after a 1-line typing fix in admin/Modal.tsx Field cloneElement). ALT-263.
- Form a11y: admin `Field` now links <label htmlFor> to its child control id (useId + cloneElement; TextInput/SelectInput accept id); aria-required/aria-invalid/aria-describedby on Login/Reset/Convert/Disposition forms; SearchSelect trigger role=combobox + options role=listbox; AssignModal focus-trap + initial focus.
- Robustness: LeadDetail/WishlistDetail/ContactDetail now guard a non-numeric/0 route :id -> show an error state instead of a stuck spinner.
- Formatting consistency: meeting/updated/generated dates via formatDate (LeadsPage, leadWorkspace, ContactDetail); Dashboard Total-Leads count uses toLocaleString('en-IN').
- Copy: SettingsPage password-change error mapped to friendly text; WishlistDetail status error surfaced; CompanyDetail misleading "has data" placeholder -> gated "Status saved".
- Dead code removed (zero importers verified): src/lib/useUrlState.ts (ALT-186 URL-persistence foundation — will be recreated when that feature is built), data/views.listViews, admin primitives TableHead, Badge TypeBadge, leadsApi.fetchStageHistory, notify.resolveUserEmail/resolveUserName.
Loop continues. Nothing pushed.

---
## 2026-06-21 (cont. 18) — owner live-testing feedback: critical modal fix + Task Manager Inc2
Owner tested My Tasks and reported 6 items. Captured all as ALT-264..271.
- **ALT-264 (P0 BUG, FIXED):** typing in any modal lost focus after 1 char. Root cause = admin/Modal.tsx focus-on-open effect depended on [open, onClose]; onClose is a new fn each render so every keystroke re-ran it and re-focused the dialog, stealing input focus. Split into Escape effect ([open,onClose]) + focus-once effect ([open]). Fixes EVERY modal form. Build passes.
- **ALT-265 (Task Manager Inc2 reminders, BUILT):** notify-service scanner (per-task email + in_app_notification bell, cap 40, reminder_sent_at set before send => no double-fire, per-tick try/catch, /health heartbeat) + opt-in daily digest (default off). Adversarial review passed 8/8. ACTIVATES on notify-service restart. New task_reminder email template.
- **ALT-266 (one-click from record, BUILT for 3 of 4):** Call back / Schedule meeting / Add task on Lead/Company/Contact detail (opens CreateTaskModal pre-filled). Meeting detail pending.
- **ALT-267 (#4 BUG, planned):** activities inside company-related contacts not recorded per-project — to investigate the write path + log a project-scoped interaction.
- **ALT-268 (#5 big, planned):** admin all-projects detailed activity timeline.
- **ALT-269 (#6 EPIC, planned):** Call module (schedule + log calls per record, dashboard, future call-tool + transcript/audio) — mirrors Task Manager.
- **ALT-270 (#1, planned):** advanced per-field multi-select filters (extends ALT-184).
- **ALT-271:** after #1-6, web-search basic B2B CRM features (non-sales; still list sales ones).
Build + node --check pass. Loop continues: next wave = #4 fix + Meeting one-click, then Call module.

---
## 2026-06-21 (cont. 19) — Wave A: #4 company-contact activity fix + #3 Meeting one-click (build passes)
- **ALT-267 (#4) DONE.** Root cause: the company Activity tab reads only `company`-typed interaction rows for the project, but a disposition/status-change done on a company's related contact logs a `contact`-typed interaction (shows on the contact timeline) — so it was invisible from the company view. Fix: new `logCompanyContactActivity()` mirrors the activity onto the COMPANY's per-project feed (a second `company`-typed interaction, same project_id, contact name prefixed). Wired into BOTH paths in CompanyDetailPage: the inline tick-to-save status change (type 'status_change') and the DispositionForm call log (DispositionForm.onLogged now passes back the disposition+note). Best-effort (void), never blocks the primary write.
- **ALT-266 (#3) DONE.** Meeting detail page now has the same Call back / Schedule meeting / Add task one-click row (CreateTaskModal pre-filled with meetingId + assoc). Tasks now creatable from all four: Lead, Company, Contact, Meeting.
Next wave: #8 global project selector (cross-cutting ProjectContext).

---
## 2026-06-21 (cont. 20) — #8 Global PROJECT selector shipped (ALT-273; commit 7241294, build passes)
- **What shipped.** A global project scope: `contexts/ProjectContext.tsx` (ProjectProvider + `useProjectScope()`), `components/layout/ProjectSwitcher.tsx` (TopBar dropdown next to global search), a "Default project" card in Settings, and `data/admin.fetchMyProjects()` (admin = all enabled projects; everyone else = their `project_user` rows). Selection persists to localStorage (`altleads:selected-project`); the Settings default (`altleads:default-project`) seeds new sessions. "All projects" (null) = no filter. Switcher self-hides for users with <2 accessible projects. Mounted ProjectProvider inside AuthProvider in App.tsx (above the router so pages + TopBar share one scope).
- **Adversarial review caught 2 mustFix; both fixed before commit:**
  1. **Leads matched on project NAME, not id** — fragile: `fetchMyProjects` filters enabled/not-deleted while the leads loader doesn't, and project names aren't unique, so name-matching could hide valid rows or merge two same-named projects. FIX: surfaced numeric `RealLead.projectId` (from `lead_master.project_id`) and filter on `lead.projectId === selectedProjectId`.
  2. **Meetings silently NOT scoped** (`void selectedProjectId`). FIX: extended `data/meetings.ts` (added `project_id` to the lead select + `MeetingRow.projectId`) and AND-ed the scope into MeetingsPage's filter.
- **Honestly de-scoped (documented TODOs, not silent):** Tasks + Wishlist carry no reliable project field, so they're left UNFILTERED even when a project is selected (a wrong filter that hides records is worse than none). Tasks could later derive project via the linked lead; Wishlist has no project column. Companies/Contacts are shared across projects — per-project scoping is a separate design question.
- **Tracker:** ALT-273 → In Progress (not Done — Tasks/Wishlist/Companies/Contacts not yet scoped). Done 146 / In Progress 18 / Planned 105.
- **Nothing is running in the background** — the project-selector workflow completed; the "loop" is manual iteration. Next: a hard adversarial self-review pass (owner asked), then #6 Call module (ALT-269).

---
## 2026-06-21 (cont. 21) — Adversarial review of project selector + OWNER reshapes Portal direction
- **Hostile review (workflow wh2yjqssa, 29 agents, find→refute):** 24 findings raised, **21 confirmed**. Logged as ALT-273B.
  - **BLOCKER (FIXED, commit e4c94a4):** `apply-portal-rls.cjs` set `FORCE ROW LEVEL SECURITY` on `portal.meeting_snapshot` with no INSERT policy → the SECURITY DEFINER snapshot trigger (runs as owner `postgres`, no BYPASSRLS on Supabase) would be denied → **every meeting INSERT/UPDATE in prod would roll back** the moment the staged portal migrations were applied. Fixed: ENABLE (not FORCE) so owner/definer bypasses the write while portal-session reads stay gated. The "validate before prod" gate earned its keep.
  - **HIGH (open):** Dashboard ignores the selected project — shows all-project totals while Leads/Meetings narrow.
  - **10 MEDIUM / 8 LOW-NIT (open):** logout/login scope bleed on shared device (key scope by user_id; clear on signout); fetchMyProjects swallows errors→[] (can wipe saved selection); single-project user force-scoped with no "All projects" escape; Sales Portal silently inherits scope; Contacts+Companies ignore the global switcher AND show a competing local Project dropdown; digest dedup in-memory only (restart re-sends); portal feedback writes to a non-existent table; NULL project_id rows silently hidden; reminder bell double-fire; modal stale prefill; etc. (full list in ALT-273B notes).
- **OWNER reshaped the Sales/Client Portal (2026-06-21) — locked in SALES-PORTAL.md "Owner decisions 2026-06-21" + ALT-274/275/276:**
  - **ALT-274 — Client Portal = just that client's MEETINGS.** "As simple as that." No internal CRM tabs.
  - **ALT-275 — record view = EXACT ditto copy of mobile `MeetingDetails.jsx`** for sales+portal users only: one scrollable screen, sections in mobile order (summary card → Pre-Sales Qs → Company → Lead/Contact → Agenda&Notes → Opportunity → Sales Intelligence). Mapped every section/field to the mobile source + our `meetings.ts` (Explore agents produced full specs). Data gaps to audit (turnover/sector/website/linkedin/altMobile/opportunity/salesIntelligence) → show N/A where absent.
  - **ALT-276 — Sales/Portal Wishlist add** (company + prospect + location), mobile `Wishlist.jsx` parity → our `wishlist` table.
- **Tracker:** Done 146 / In Progress 19 / Planned 108.
- Next: decide sequencing with owner (finish project-selector review fixes vs build the mobile-ditto portal record view first), then execute.

---
## 2026-06-21 (cont. 22) — Review fixes shipped (ALT-273B) + ALT-275 data audit kicked off
- **Project-selector review fixes (commits e4c94a4, f352b73, ff748bd, 8544c49):**
  - BLOCKER (e4c94a4): portal meeting_snapshot FORCE→ENABLE (won't break CRM meeting writes when applied).
  - HIGH (f352b73): Dashboard now scopes ALL stats to the selected project (chunked id-set; ~600 leads so cheap) + a "Showing <project>" header.
  - 5 MEDIUM (ff748bd): per-user scope keys (no shared-device bleed) + re-seed on login; fetchMyProjects throws on error so a transient failure can't wipe the saved scope; switcher always offers a path back to "All projects"; Sales Portal ignores the internal scope; Contacts/Companies drive their local Project picker from the global switcher (one source of truth); setter is useCallback.
  - LOW/NIT (8544c49): task modal re-seeds on each open (no stale prefill); Leads/Meetings show "N with no project hidden"; Tasks/Wishlist show "not filtered by project" notes.
- **STILL OPEN (deferred, activate on deploy):** notify-service batch — digest dedup persistence (M6), reminder-bell double-fire guard, scanner backlog metric. The scanner isn't running yet (needs a notify-service restart), so these go in with that deploy. Plus the React-18-no-op MyTasks async guard (lowest value).
- **ALT-275 next:** launched a DB-column audit (sub-agent) to map which mobile record-screen fields exist in our Supabase (company turnover/sector/size/website/linkedin/address; lead altMobile/roleAndResp/areaOfInterest; opportunity title/value/desc; salesIntelligence) vs which render as N/A — so the mobile-ditto record view is built on real columns.

---
## 2026-06-21 (cont. 23) — notify-service hardened + OWNER new requirement (site feasibility) + Chrome-ext FYI
- **notify-service scanner hardened (commit 235c49c)** — clears the remaining review items: durable daily-digest dedup (new `public.task_job_run` table via `apply-create-task-job-run.cjs`, staged; survives restarts so no double-blast), `scanInFlight` re-entrancy guard (no bell double-fire), and a `last_scan_backlog`/`cap_per_tick` metric on /health. Activates on the next notify-service restart. (Only remaining open review item: the React-18-no-op MyTasks async guard — lowest value.)
- **OWNER new requirement (captured — docs/product/SITE-FEASIBILITY.md, ALT-277/278):** before live data goes to real calling agents, surface **site feasibility + per-site/city employee size** from the owner's **primary market research** (per company × site/city: feasible/non-feasible + employee size). Many company sites aren't feasible for a given project (HungerBox etc.); flagging them saves agent time. Leverage the existing city-wise prospect grouping as the unit. Plus a **pre-production "where do agents get stuck" readiness audit** (ALT-278). Sequenced AFTER the mobile-ditto portal build (ALT-275/276), BEFORE production handoff. UX design TBD with owner.
- **FYI from owner:** a SEPARATE agent is building the Chrome extension — I will NOT touch that area (the `Chrome Extension EcoSystem/` tree) to avoid collisions.
- **In flight:** ALT-275 build workflow (mobile-ditto record view) running in background; verify + commit on completion.

---
## 2026-06-21 (cont. 24) — ALT-275 mobile-ditto record view SHIPPED (commit 8bf9aff)
- Built via a single-builder + adversarial-review workflow. Build passes; review found NO blocker/high.
- **What shipped:** `components/sales/MobileMeetingRecord.tsx` — exact-layout copy of mobile `MeetingDetails.jsx`, 7 sections in mobile order (summary → Pre-Sales [excl. Discussion] → Company → Lead/Contact → Agenda&Notes → Opportunity → Sales Intelligence), status relabel (Confirmed→Scheduled, Cancelled→Dropped). `pages/sales/SalesMeetingDetailPage.tsx` at `/sales/meetings/:id`; `/sales/meetings` now lists meetings (MeetingsPage in sales shell) and rows navigate to `/sales/meetings/:id` — sales users never reach the internal record screen (verified by review).
- **Data layer:** `fetchMeetingDetail` extended with ~15 mobile-parity columns + new `turnover_master` / `company_sector` lookups + `lead_report.created_by → "Meeting scheduled by"`. `company_sector.sector` column name VERIFIED against `docs/amplior_backup.sql:257` (review had flagged it unverified — it's correct). Sparse records (~79% NULL company_id) degrade to N/A, matching mobile.
- **Review fixes applied before commit:** (MEDIUM) Call Recording / View Image gated to SALES_HEAD + internal staff via `canSeeRecordings` — a Sales Person, and a future client, never see recordings (mirrors mobile's SALES_HEAD-only rule). (LOW) MyTasks reload-token guard (out-of-order reloads can't clobber). The two LOW "parity" notes (always-render Agenda, Rs.-prefix on free-text value) intentionally match the mobile app.
- **Open follow-ups (tracked):** spot-check `lead_report.created_by` holds the scheduler's user_id on real rows (else "Meeting scheduled by" shows N/A — degrades safely). Client-portal REUSE of this view = ALT-274 (gated on portal DB).
- Next: ALT-276 (Sales/Portal wishlist add).

---
## 2026-06-21 (cont. 25) — ALT-276 Sales/Portal wishlist add SHIPPED (commit da58d65)
- Built via single-builder + adversarial-review workflow. The review EARNED ITS KEEP: tsc passed but it caught 2 RUNTIME blockers (the insert would fail), both fixed before commit.
- **What shipped:** `components/wishlist/WishlistCreateModal.tsx` (company autocomplete ≥2 chars + prospect/designation auto-fill, State→City cascade from state_master/city_master, address/PIN), `data/wishlist.ts` addWishlist + searchCompanies/listStates/listCitiesByState/leadsByCompany, `pages/sales/SalesWishlistPage.tsx` at `/sales/wishlist` + a sales-nav "Wishlist" item. Reuses the already-fixed shared Modal (no focus-steal).
- **Blockers fixed:** (1) `wishlist.address_id` is NOT NULL — addWishlist now creates an address row via ensureAddress(cityId, actor) + sets address_id (?? 1), mirroring the lead path; without it EVERY save failed. (2) `wishlist.created_by` is NOT NULL — now requires a resolvable numeric actor (assertNumericActor) instead of omitting it for no-user actors. (Client-portal no-user accounts need a sentinel → deferred to ALT-274.)
- **Parity:** City made required (drives the address row + displayed State/City). Country/State are UI-only (no wishlist column); geo-photo/GPS skipped for web v1.
- **Tracker:** ALT-275 + ALT-276 Done. The mobile-app Sales experience (record view + wishlist) is built on web.
- **NEXT FORK:** ALT-274 (client portal = apply + validate the portal DB so the portal reuses the record view) is GATED — it's a production-facing RLS change and needs owner go-ahead + throwaway-login validation + Supabase schema-expose before prod. Meanwhile launching ALT-269 (Call module) as the next safe build.

---
## 2026-06-21 (cont. 26) — ALT-269 #6 Call module BUILT (commit 57bcd92; migrations STAGED)
- Single-builder + adversarial-review workflow. Build green, both migrations node --check OK, review found NO blocker/high (2 LOW, acceptable).
- **call_log** ledger of calls that HAPPENED (scheduling stays in Task task_type=CALL — not duplicated): direction, disposition (OWNER-DEFAULT B2B set), notes, duration_seconds, called_at, lead/company/contact/meeting assoc, owner_user_id, + NULLABLE recording_url/transcript as the future calling-tool seam. RLS mirrors apply-task-rls (owner OR is_admin OR manages_user [fail-closed]; reuses shared helpers, doesn't redefine; anon/PUBLIC revoked).
- data/calls.ts (logCall/listCallsForRecord/listMyCalls/callStatsToday); LogCallModal (shared Modal, focus-safe) + CallHistoryCard; "Log call" wired on all 4 detail pages; Lead detail shows call history; Dashboard "Calls Today" card (project-scope aware, returns 0 safely until the table is applied).
- **STAGED/not applied** (launch posture). To go live: apply apply-create-call-log.cjs + apply-call-log-rls.cjs in prod (gated). Follow-ups: a My-Calls list page (so the dashboard card drills down); wire real telephony into the recording_url/transcript seam.
- **Session so far (15 commits, nothing pushed):** project selector + full hostile-review fix set + notify-service hardening + ALT-275 mobile record view + ALT-276 wishlist + ALT-269 Call module. Tracker: 148 Done.
- Next: ALT-268 (#5 admin all-projects activity timeline). Portal DB apply (ALT-274) still awaits owner go-ahead.

---
## 2026-06-21 (cont. 27) — ALT-268 #5 admin activity timeline SHIPPED (commit ab92711) — built direct (workflows hit session limit)
- The ALT-268 build WORKFLOW failed (both agents hit "session limit · resets 1am"), so I built it DIRECTLY in the main loop.
- **What shipped:** new "Activity" tab in AdminPage (already ADMIN-gated → inherits admin-only). `data/activityTimeline.ts` reads the `interaction` table (the rich activity store: status_change + call rows, with project_id/occurred_at/actor), newest-first, cap 200, project selector incl. "All projects". `components/admin/ActivityTimelineTab.tsx` groups by IST day, kind badges (call/status), links each event to its record (contact/company/lead), resolves actor + project names. Read-only; no migration. Build green.
- **Follow-ups (future):** date/user filters; also aggregate meetings/tasks/call_log (currently `interaction` only — the richest single source); pagination beyond 200.
- **Session: 18 commits.** Remaining owner items: #1 advanced filters (ALT-270, partially via MultiSelectFilter), #7 grouped global search (ALT-272), ALT-271 websearch (LAST). Gated: portal DB (ALT-274), feasibility (ALT-277/278).
- NOTE: sub-agent workflows are hitting the weekly/session limit; continuing DIRECT builds in the main loop while budget remains.

---
## 2026-06-21 (cont. 28) — #7 grouped search + #1 partial + ALT-271 research (weekly-limit sprint, DIRECT builds)
- **ALT-272 #7 grouped global search DONE (commit 9fc6315):** Cmd-K palette now renders Zoho/HubSpot-style sections (Leads/Companies/Contacts/Tasks/Meetings) with count headers + cross-group keyboard nav; added Tasks (RLS-scoped read) + Meetings to globalSearch.ts index.
- **ALT-271 research DONE (doc docs/product/B2B-CRM-FEATURES.md):** core B2B-CRM feature inventory mapped to our app (have/partial/gap) + a separate deferred sales-features list (invoice/quotes/forecasting/etc.) per owner. Top non-sales gaps: workflow automation, two-way email sync+tracking, custom report builder, kanban board, merge-duplicates, user-defined custom fields.
- **#1 advanced filters (ALT-270):** PARTIAL — multi-select per-field filters live on Leads + Meetings; remaining = extend to Contacts/Companies/Tasks (tracked, not yet built).
- **Session total: ~20 commits, NOTHING PUSHED.** Owner's full feedback batch (#1-#8) now addressed: #2 modal focus ✅, #3 one-click tasks ✅, #4 activity mirroring ✅, #5 admin timeline ✅, #6 Call module ✅(staged), #7 grouped search ✅, #8 project selector ✅; #1 advanced filters 🟡 partial; ALT-271 research ✅. Plus the full mobile Sales experience (ALT-275 record view + ALT-276 wishlist).
- **GATED / awaiting owner:** ALT-274 portal DB apply (say "do the portal DB"); applying the staged migrations (task_job_run, call_log) on next deploy; ALT-277/278 site-feasibility (after portal, before live calling-agent handoff).
- **NOTE for next session:** sub-agent workflows hit the weekly/session limit mid-sprint; the last several features were built DIRECTLY in the main loop. Resume by reading this log + the tracker.

---
## 2026-06-22 — Chrome extension rebuild: scan + 5 docs + owner decisions LOCKED (PLAN ONLY, ALT-279..287)
- Owner wants to rebuild the 2 Firebase Chrome extensions (**AltLeads 4.1.0** + **Data ResearchExt**; the **AL Prospect Finder web app** = learn-from only, not copied) into **ONE MV3 extension wired to our Supabase CRM** (not a separate prospects DB). Ran a 13-agent scan workflow; wrote docs to `docs/chrome-extension-rebuild/`: README, 01-CURRENT-STATE-ANALYSIS, 02-MIGRATION-BLUEPRINT, 03-LINKEDIN-MINI-CRM-FLOW, CRM-HANDOFF-FOR-CRM-OPUS, + **04-PHASE-1-BUILD-PLAN**.
- **Make-or-break confirmed:** contacts have `contact_master.linkedin_url` + indexed `linkedin_clean`; match via the existing SECURITY DEFINER RPC **`find_contact_dup`** (the web app already uses it). One indexed lookup, not the old 12-URL brute force.
- **OWNER DECISIONS LOCKED 2026-06-22:**
  1. **NO INJECTION — side-panel only, read ONLY the active tab's address-bar URL.** LinkedIn **BANNED the owner's users' personal accounts** because of injection; never read the page DOM. (This overrode the scan's initial shadow-DOM-injection recommendation — all 4 docs were corrected.)
  2. **Non-owned contact view** = name + company + **company status (DNC must be visible)** + last activity + owner-in-project + a **"Request this company"** button → **TL approval** (new workflow mirroring the lead/meeting approval flow; on approve, reassign → reveal). = ALT-282 + ALT-283.
  3. **Project selector in both the extension and the CRM.** CRM side already shipped (**ALT-273**); the extension shares the selection (default = personal-settings project). = ALT-284.
  4. **Plan Phase 1 first** — done (04-PHASE-1-BUILD-PLAN.md).
- **Phase 1 (read-only show details) = SHIPPABLE**; only cheap pre-req is **ALT-287** (`deriveLinkedinClean` lowercase + backfill, else mixed-case slugs silently miss). **Phase 2 (edit-in-place) = BLOCKED on ALT-152** — adversarial verify found the blocker spans **THREE** owner-only write gates (`contact_master` + `contact_project_status` + `interaction`-on-contact); the fix must align all three, validated with a real non-admin agent login.
- **Auth** = anon key + user JWT + RLS (Option A); **NEVER** the service-role key in the extension. Old extensions ship a hardcoded Firebase apiKey + DO Gradient/Groq/Gemini/OpenRouter LLM keys → **ALT-286** rotate (treat as compromised). All Firebase/AI/credits/research-queue dropped.
- **Backlog:** added EPIC **ALT-279** + **ALT-280..287**; regenerated the tracker. CRM-side asks live in CRM-HANDOFF-FOR-CRM-OPUS.md (TODO-1 + TODO-A/B/C).
- **Status: PLAN ONLY — nothing coded, NOTHING PUSHED.** Awaiting owner OK to start M0/M1, + 4 open questions in 04-PHASE-1-BUILD-PLAN §8. Memory updated (chrome-extension-linkedin-rebuild).

---
## 2026-06-22 (cont. 29) — Extension coordination shipped + High-impact UX gaps captured → starting Tier 1 (reassignment + ALT-152)
- **IDENTITY:** the person in chat is **Ankit** (hands-on engineer, uses Mohit's Claude sub; only has a Gemini sub), **not Mohit** (non-technical business owner). Tracker assignee changed Mohit→Ankit for new tickets; future asks come from Ankit. Memory updated (`user-ankit-vs-mohit`). Owner sign-off gates still trace to Mohit's posture.
- **Extension coordination (commit f32f365):** shipped the 2 CRM-side fixes the parallel extension-Opus requested — TODO-1 `deriveLinkedinClean()` now `.toLowerCase()`s (matches the migration backfill so `find_contact_dup` exact-match stops silently missing), and TODO-C the canonical `altleads:active-context` bridge key (`ACTIVE_CONTEXT_KEY` + `writeActiveContext`) in ProjectContext, written on hydrate/select/signout. Wrote `docs/chrome-extension-rebuild/CRM-RESPONSE-TO-EXTENSION.md` answering all their TODOs (done vs owner-gated). The rest (find_contact_for_panel RPC, company-assignment approval, ALT-152 alignment, atomic write RPC) are owner-gated.
- **High-impact UX gaps — answered Ankit + CAPTURED.** Prioritized Tier 1/2/3; new doc `docs/product/HIGH-IMPACT-UX-GAPS.md`. Backlog audit showed the gaps were only PARTIALLY ticketed (the owner's own example — reassignment — had no unified ticket). Added: **ALT-288** EPIC reassign/change-owner (lead/company/contact/meeting, internal+sales, single+bulk), **ALT-289** lead+meeting reassign (buildable now, `lead_report.user_id`), **ALT-290** company+contact reassign (OPEN ownership-model decision), **ALT-291** bulk-action toolbar, **ALT-292** kanban board, **ALT-293** merge duplicates. Referenced (not duplicated): ALT-152 (write model), ALT-167 (sales scoping), ALT-157/213 (inline edit), ALT-272 (search). Tracker regenerated → **290 tickets**.
- **Now building Tier 1 → 2 → 3 (Ankit's instruction).** Tier 1 core = reassignment + the ALT-152 assignment write-model (they ship together: you can only edit what you own, so reassignment is how a record becomes editable). Kicked off design workflow **wa2g8qboi** (read-only) to map the current ownership columns + write-path RLS and produce a file-level build plan + staged RLS design before coding. RLS/migration changes will be authored as STAGED appliers (manual-deploy posture; prod apply + throwaway-login validation gated).
- **NOTHING PUSHED.** Still on `clean-main`, local only.

---
## 2026-06-22 (extension session) — BOTH extensions BUILT + synced with CRM Opus (commit 708fb9b)
- **Parallel sessions discovered each other via git + docs.** This (extension) session and the CRM session are coordinating through `docs/chrome-extension-rebuild/` files (no shared bus). The CRM Opus already shipped two of my asks: TODO-1 `deriveLinkedinClean()` lowercase (commit f32f365) + TODO-C the canonical `altleads:active-context` bridge key. I replied in `EXTENSION-RESPONSE-TO-CRM.md` (canonical key is sufficient — no postMessage; extension will read it via a content script on OUR crm.altleads.com domain, which is fine — the no-injection ban is LinkedIn-only).
- **Built (Sonnet-coded, Opus-orchestrated, both build green, committed 708fb9b):** `new-code/extensions/{shared, contact-viewer, data-research}`. Contact Viewer = MV3 side panel, background watches `tab.url` via `chrome.tabs` (NO content script/DOM/injection, no linkedin host), owned/non-owned-masked/no-match card + associated records, read-only, local project selector, "Request company" disabled (ALT-283). Data Research = research-team fulfillment queue (who/when requested, is-info-present, fill missing) vs `contact_research_request`, separate logins, degrades gracefully until table/role land. Branded icons copied from old exts; `.env` gitignored, `.env.example` committed.
- **Compliance personally verified** (manifests + background + normalizer read): MV3, perms `[sidePanel,tabs,storage]`, Supabase host only, no service-role, no skip-login. `normalizeLinkedinSlug` = 9-step lowercase/query-trim/first-segment (matches the CRM's now-lowercased `linkedin_clean`).
- **Owner-gated for full fidelity** (precise SQL in `CRM-REQUESTS-PRECISE.md`): R1 backfill (ALT-287, code half DONE by CRM), R2 `find_contact_for_panel` (ALT-282), R3 `contact_research_request` table, R4 two test logins, R5 research-role decision. Phase-2 edit BLOCKED on ALT-152 (3-gate alignment, confirmed by CRM Opus).
- **NEXT (owner/Ankit):** load both `dist/` in chrome://extensions (admin mohit@amplior.com + R4 non-admin login), open a few LinkedIn profiles → verify owned-vs-masked. **Not pushed.**

---
## 2026-06-22 (cont. 30) — Reassignment workstream SHIPPED (ALT-288: A+B+C1) + ALT-294 project-scoping bug fixed
> (CRM session. Note: the extension session is also committing to `clean-main` — sequential commits, no conflicts so far.)
- **Design-first:** read-only workflow wa2g8qboi mapped ownership cols + write-path RLS before coding. Leads carry a real assignment col (`lead_report.user_id`, populated); meetings derive owner via `meeting_schedule.report_id→lead_report`; company/contact have `owner_user_id` on `*_project_status` that EXISTED but was DORMANT. Ankit confirmed per-project owner model → NO schema add.
- **FIX ALT-294 (82a69b5):** record detail per-project view now follows the global top-bar project selector (was always defaulting to first project / "AP North"). ProjectSelect defaults to global selection; Company/Contact detail seed + live-sync. Meetings single-project; My Tasks stays all-project.
- **ALT-289 Phase A (3b805eb):** reassign lead + meeting salesperson. `components/common/ReassignModal.tsx` + `data/assignment.ts` (reassignLead/reassignMeeting/reassignLeadsBulk/fetchAssignableUsers, modeled on assignWishlist; writes `lead_report.user_id`, fires `lead_reassigned` notify). "Change salesperson" on Lead + Meeting detail, gated by `canReassign` (admin/TL/SH). LeadDetail exposes `salesperson_user_id`.
- **ALT-290 Phase B (75cc2a0):** reassign company + contact owner (per-project `owner_user_id`). "Owner (this project)" row + Change/Assign button on Company AccountPanel + Contact Project-Status card, scoped to active project.
- **ALT-291 Phase C1 (d5fd6cb):** BULK reassign on ALL FOUR lists — "Reassign (N)" toolbar button → bulk helpers (per-row RLS check, partial-success toast, one summary notify). Companies/Contacts bulk needs an active project. (Remaining: bulk status + bulk add-to-project.)
- **STAGED ALT-152 write-model — `new-code/migration/apply-assignment-rls.cjs` (NOT applied, --rollback):** `assigned_to()` + `meeting_lead_id()` helpers; `lead_master` UPDATE gains assignment OR-term (THE ALT-152 fix); `lead_report` RESTRICTIVE UPDATE guard (assignee self-edit / managers reassign); company/contact `*_project_status` gain `owner_user_id` term. ENABLE not FORCE.
- **⚠️ OWNER GATE (Ankit):** reassignment UI works NOW (writes columns the blanket policy allows), but EDIT-unlocking + manager-only enforcement need `apply-assignment-rls.cjs` APPLIED → requires go-ahead + throwaway-login validation (agent-edits-assigned ✓, agent-cannot-reassign ✓, regression on legacy created_by owner + snapshot trigger ✓) → then prod apply.
- **SALES-SIDE reassign = GATED** on a separate downline migration (`project_user.sales_head_user_id` + `is_sales_head()`/`sales_downline_ids()`, ALT-167/171/235). UI is role-aware but not downline-scoped yet.
- Build green every commit. NOTHING PUSHED.

---
## 2026-06-22 (cont. 31) — Company→contacts cascade, ALT-295 access modes, + Tier-2/3 via PARALLEL subagents
- **Cascade (Ankit ask):** assigning a company now also assigns ALL its contacts in that project to the same owner (`cascadeCompanyContacts` in data/assignment.ts; applies to single + bulk company reassign).
- **ALT-295 captured (NEW, P1):** per-project **access mode** in Project Settings (admin) to kill ownership ambiguity — Owner-scoped / Public-Edit / Public-View-only / Public-Limited-view (sensitive fields masked). Maps onto the existing `project_visibility_setting` dials (ALT-134) + masking (ALT-133). To build with a Settings UI + STAGED RLS/masking tier + validation. ADR to follow in DECISIONS.md.
- **Parallel subagents (Ankit asked to fan out):** ran 3 general-purpose agents concurrently on DISJOINT files, integrated + built green:
  - **ALT-292 Kanban (read-only):** LeadsKanbanPage + components/kanban/*; route /leads/board + "Board" toggle on Leads. Drag seam built but disabled (needs report_id/stage_id — TODO).
  - **ALT-213 Always-visible search:** components/ui/GlobalSearchBar.tsx in TopBar; reuses the globalSearch index + palette grouping/nav; Cmd-K + clear-on-logout intact.
  - **ALT-293 Merge duplicates:** data/merge.ts + MergeDuplicatesModal — CODE ONLY, **deliberately NOT wired** (non-atomic, no per-project dedupe, admin-only-by-convention). Needs a transactional SECURITY DEFINER RPC + validation before going live.
- **Collision posture:** subagents scoped to disjoint files; the extension session also commits to `clean-main` — sequential commits, no conflicts. Commits this batch: cascade+ALT-295, then kanban+search+merge.
- **REMAINING Tier-2 (shared list pages, main-loop next):** bulk status-change + bulk add-to-project (ALT-291), inline edit (ALT-157), per-column advanced filters (ALT-270). **OWNER GATE still open:** validate + apply `apply-assignment-rls.cjs` to make assigned-agent editing + manager-only reassign actually enforced. NOTHING PUSHED.

---
## 2026-06-22 (extension session, cont. 2) — Ext1 Request/Re-request + Ext2 details-only + UX audit & quick-wins (commit 37e09b6)
- Owner (Ankit) feedback addressed: Ext 1 lacked the request/re-request action (the FEED for Ext 2's queue — without it Ext 2 is pointless); Ext 2 should be **contact-details-only**; make the RESEARCH role a firm CRM request; audit all small UX frictions with psychology; continue without stop.
- **Ext 1 (contact-viewer):** added **"Request / Re-request contact details"** on the owned card — computes missing fields, INSERTs `contact_research_request` (status pending, requested_by=user_id-as-text), re-opens an existing open request. New `shared/researchRequests.ts`. This is the ONLY write Ext 1 does; degrades gracefully until the table/RESEARCH role land.
- **Ext 2 (data-research):** stripped to **CONTACT DETAILS ONLY** (removed leads/meetings/tasks/activity/project-status), now mirrors Ext 1's card styling; queue + LinkedIn-match fill flow retained; added **"Saved ✓"** confirmation.
- **RESEARCH role = firm request:** `CRM-REQUESTS-PRECISE.md` R5 now **APPROVED** (add `role_master` id 7 `RESEARCH`, `is_web=true`; RLS for the queue + a project-scoped `contact_master` PII-fill grant tied to ALT-152) + **R6** (Ext-1 raise/re-request INSERT contract). For the CRM Opus.
- **UX/psychology audit → `05-UX-PSYCHOLOGY-AUDIT.md`** (Opus): journey-by-journey frictions with the psychological principle + fix + severity. Top issues = login recovery/feedback (no forgot-password/show-password, raw error below button), perceived latency (6 sequential awaits behind a bare spinner), always-disabled "Request company" button (learned helplessness), missing save confirmation, internal jargon (42501/ALT-###/REQUEST 3) leaking to users, sub-AA muted-text contrast.
- **Applied SAFE quick-wins (Sonnet, both exts):** login autofocus + Enter-to-submit + show/hide password + friendly errors moved above the button + Forgot-password link (→ crm.altleads.com/forgot-password) + signing-in state; instant header render + `Promise.all` + skeletons; 300ms SPA debounce; plain-language messages (codes → console only); Ext2 Saved✓; WCAG-AA contrast bumps. **HELD for owner:** brand color (#0a2540 vs CRM #1A7EE8), the intentionally-disabled "Request company" (ALT-283).
- Both builds **GREEN**; `dist/` loadable with branded icons. Commits this session: 708fb9b → 489b58c → 37e09b6. **NOTHING PUSHED.** Awaiting owner load-test + CRM Opus applying CRM-REQUESTS-PRECISE.md.

---
## 2026-06-23 — Durable chat archive + universal grid/toolbar/preview pass (Ankit)
- **Conversation archive (NEW):** after `/compact` made past asks feel lost, built `new-code/web/scripts/gen-conversation-log.cjs` → reads EVERY session transcript, strips tool-noise, scrubs secrets, writes **`docs/CONVERSATION-LOG.md`** (gitignored, local-only — old chats contain pasted tokens). 7 sessions / 171 user msgs / 1552 replies. Ankit chose "Claude refreshes it every session" (no hook — a SessionStart hook was also blocked by the auto-mode classifier). Wired into CLAUDE.md resume step 4 + memory `conversation-log-archive.md`.
- **Read the full 52MB session via 6 parallel readers** to recover history; surfaced the standardization gap (Kanban/Grid/etc. covered 5 modules but NOT Task Manager / Call Logs).
- **NEW Ankit requirements (captured as ALT-331..336):**
  - **ALT-331** REAL editable **Excel grid** (inline-edit cells, no need to open record) — the shipped "Grid" was read-only tiles. Universal all modules. Edit scope = **SAFE editable set** (Ankit chose): status/stage, owner, description, comments, editable text; identifiers/counts read-only; per-project fields need a project picked. Reuse existing writers.
  - **ALT-332** multi-select checkboxes in **Grid + Kanban** (today: Table only) → bulk toolbar from every view.
  - **ALT-333** standardize the **toolbar** (shared `ListToolbar`, canonical order) — drift today (Contacts Export before switcher, etc.).
  - **ALT-334** preview **"Open full record" → NEW tab**.
  - **ALT-335** **Call-log (disposition + comment) in the preview** for Company/Contact/Lead/Meeting — feeds daily-calls metrics (dials/connects/connected/pitched) for the manager/leadership dashboard.
  - **ALT-336** (Planned) **dashboard redesign** per the Claude-design deck (dials + Scheduled⊇Successful funnel; Successful was always once Scheduled, but Scheduled can drop/cancel/postpone). Ankit to re-share the deck.
- **Pointed Ankit to history docs:** USER-STORIES-AND-FLOWS, PERSONA-AUDIT-2026-06, HIGH-IMPACT-UX-GAPS, UX-AUDIT, AMBIGUOUS-DECISIONS, OPEN-QUESTIONS, + CONVERSATION-LOG.
- ALT-331..335 SHIPPED + committed (build green, 2 commits af80716 + e055e57): EditableGrid (replaced Grid tiles), ListToolbar, multi-select in Grid+Kanban, CallLogPreview in 4 previews, open-full→new-tab. NOT pushed yet at that point.

---
## 2026-06-23 (cont.) — Ankit feedback + OPEN-QUESTIONS answers + HubSpot-parity backlog
- **Tiles:** Ankit didn't ask to remove the Grid tiles (I swapped them for the editable grid). "No need to restore as of now" → parked as ALT-339 (later offer BOTH cards + spreadsheet).
- **BUILD this session:** ALT-337 **Log-a-call FROM the preview** (reuse DispositionForm→logDisposition→interaction; refresh CallLogPreview) for Company/Contact/Lead/Meeting; ALT-338 **Kanban group-by** field selector (status/city/industry/owner; disposition needs latest-call data → note). ALT-348 HubSpot+Zoho UX research (subagents → doc).
- **NEW backlog (HubSpot-parity, mostly DB/RLS → owner-gated):** ALT-340 merge duplicate companies + parent/child association (PARKING LOT, extends ALT-293); ALT-341 generic record ASSOCIATIONS (add company/lead/meeting/contact/wishlist/task/call to any record); ALT-342 multiple emails/phones per contact (child table); ALT-343 record COLLABORATORS (project users edit/view exactly like owner, all modules) + lite/viewer users for seniors; ALT-345 mask sensitive details at DB level + reveal-on-demand.
- **Dashboard deck RECEIVED** (Amplior×HungerBox 3-Year Review). Funnel to model: Dials ~200k → Connects ~82k (~41%) → Qualified Pitches ~7k → Scheduled 3,500 → Successful 2,637 (~67% sched→success). cancel(prospect) vs drop(sales) vs reschedule/postpone. THREE dashboards (Agent/Sales/TL). ALT-336 (umbrella) + ALT-344 (full build spec).
- **OPEN-QUESTIONS.md answered by Ankit (2026-06-23) — locked, captured as tickets:**
  - Q1: Sales Head assigns leads only to Sales Persons (not agents); sales = company-process, reflected in records; TL/PM can reassign SP with OPTIONAL remark (TL only, not SH). → ALT-347.
  - Q2: Sales team does NOT outreach — they only attend meetings Amplior scheduled. 3 client roles (Company Admin > Sales Head > Sales Person), edit/view set per project/client setting by CRM super-admin; Company Admin can add SP/SH (super-admin approved). 3 dashboards (Agent/Sales/TL). → ALT-347 + ALT-344.
  - Q3: only SAFE edits (company/contact status, description, comments); unassigned = TL/admin only; assigned/reassigned agent can edit; every change captured with who-edited. → already the EditableGrid scope; audit via interaction.
  - Q4: NO direct view of sensitive details — reveal every time (sticks till tab refresh); who-can-reveal set per project setting, default owner + all uplines; enforce at DB (not client-side). Mask ab••••@domain.com / 999****999. → ALT-345.
  - Q5: notification recipients re-engineering (lead-scheduled → ASSIGNED agent not created_by; sales gets schedule/feedback/reschedule/cancel; first schedule → SH too; TL gets downline+own incl successful/cancel/drop/reschedule; reschedule/cancel request → TL+agent; task pending + daily-summary toggle). → ALT-346.
  - Q6: deploy posture fine — evenings after 6pm and/or weekends.
  - Q7: PDF emails via Playwright OK, or HTML for now; Ankit may supply template UI.
  - Minor: lite/team VIEWER users for senior stakeholders (read-only) → ALT-343; internal users don't need /sales (admin can); mobile app = backlog (not dropped).
- Build of ALT-337/338 + research DONE + pushed (88ef6a4 → main).

---
## 2026-06-23 (cont. 2) — Autonomous QC pass + doc hygiene (Ankit: "stop waiting, make it better")
- **Harsh QC panel (3 subagents)** reviewed recent work + whole app + data layer; **doc-hygiene subagent** reorganized docs. Then **5 disjoint fix subagents** applied every SAFE-NOW finding (build green). Items needing Ankit's eye were NOT touched (listed below).
- **Doc hygiene:** created **`docs/INDEX.md`** (owner-friendly map, priority docs ⭐ at top), refreshed `docs/product/INDEX.md`, moved all scratch/temp/vendor-binary/figma dumps into **`docs/archive/`** (untracked moves — nothing deleted, no tracked refs broken; SUMMARY.md figma paths repointed).
- **Shared helper:** `src/lib/writeError.ts` `humanizeWriteError()` — one source mapping raw 42501 (RLS) / 42P01·PGRST205 (missing table) to friendly copy. Wired into data/calls, data/wishlist, data/projectStatus(logDisposition propagates now), ContactPreview, LeadPreview.
- **Safe fixes applied:** EditableGrid (indeterminate checkbox every-render + text-cell focus parity); CallLogPreview shows real error; DispositionForm button disabled until disposition; GenericKanban empty-state when no columns; ExportButton window.alert→toast + success toast; realLeads deterministic stage tiebreaker (report_id desc); companies dedup `.or()` → sanitized `.eq()` (injection/edge fix); LeadsPage+MeetingsPage `sel.clear()` on filter + pageIndex clamp; kanban group-by resets when option invalid (all 5); Companies/Contacts Owner+Status grid loading affordance + owner refresh after reassign; Companies loadStatuses cancellation guard; Dashboard error+Retry surface + dropped "(from lead_report)" jargon; unified primary blue → brand token (4 modals); per-route ErrorBoundary at AppShell (a page throw no longer blanks the shell); CopyButton on Lead/Company/Meeting detail phone/email/ID.
- **LEFT FOR ANKIT (needs his eye, not bugs):** badge color canonicalization (StatusBadge vs StageBadge conflicts — visible color call); Wishlist grid pagination (design); rapid description/comments optimistic-vs-refetch; preview ESC/backdrop vs nested modal stacking; grid whole-row click-to-open (interaction design); `saveReport` transactional RPC (needs DB); call_log actually persisting (needs DB migration); undo-on-bulk (larger). Captured for a follow-up pass.
- Build green. NOTHING PUSHED (awaiting "push").

---
## 2026-06-24 — Ultracode: rulings folded in + SCHEMA AUDIT + EMBEDDING PLAN + Stage-2 build
- **Stage-1 workflow (4 agents):** extracted Ankit's inline answers from OPEN-QUESTIONS + AMBIGUOUS-DECISIONS into a build/capture action-list; turned the APPROVED UX-Audit + persona audit into an implementation list; ran a **schema flaw audit** and an **embedding plan**.
- **`docs/SCHEMA-AUDIT.md` (NEW)** — live read-only introspection of prod confirmed real corruption. Top flaws → tickets **ALT-349..358**: (349) split ownership created_by≠assignee = the LAUNCH BLOCKER → one canonical assignee_user_id + RLS off created_by; (350) status columns are free text already drifted (report_status 11 variants, meeting_status incl NULL/"", active_status="0") → CHECK+FK to dropdown_option; (351) area_of_interest 24+ spellings of ~4 concepts; (352) no clean interaction/activity model (scattered across 5 shapes) → make `interaction` canonical (also unblocks AI); (353) NO FORCE RLS + broad anon grants on PII; (354) audit cols are varchar-ids no-FK; (355) 20 dup-email contact groups, no unique idx; (356) nullable project_id / weak tenant scoping; (357) contact_id 0/607 populated + dead tables; (358) id-type + money/time chaos. All DB → owner-gated + throwaway-login validation.
- **`docs/product/EMBEDDING-PLAN.md` (NEW)** — capture-from-now (embed-on-write ~free; backfill lossy). Tickets **ALT-359** (pgvector + embeddings table + embed-on-write flag, gated behind ALT-353, depends on ALT-352) + **ALT-360** (backfill + retrieval + vector RLS).
- **Ankit's rulings captured** (full text inline in OPEN-QUESTIONS + AMBIGUOUS-DECISIONS; cross-ref ticket **ALT-365**): A1 manager sees downline + unassigned (uniform all modules); A2 reassign scoped to downline+unassigned, SH only pre-schedule leads of own team; A3 create=admin-only now, configurable later + create-from-existing; A4 four access modes (Public view / Limited view / Private / Public edit) admin-set per project + sensitive-field config + set-owner-to-self + Save View; A5/B1 QC = parallel approver to TL, project-scoped, mandatory reject comment; B2 "Mine" default for agents on lead_report.user_id; C1 ONE logger (DispositionForm) + admin-editable Call Disposition + Call module; D1/E2 considering removing Meeting module → fold into Leads + lead→task + unified due-today queue; D2 feedback model BLOCKED (wants plain-language explain + recover earlier client-portal tweaks); D4 client sees all statuses + recordings hidden unless per-project toggle; E1 inline status uses global/auto-resolved project; Q5 notif recipients re-engineer (created_by→assignee, cancel vs drop, etc.); lite/viewer role for seniors.
- **Stage-2 build workflow (6 disjoint agents, building now):** ALT-361 inline-status global/auto-project (E1); ALT-362 QC→Approvals access + mandatory reject comment; ALT-363 optional reassign reason + default-owner-self; ALT-364 UX-approved polish (grid truncation tooltips + frozen identity col; preview mailto/tel/copy; search clear-× parity; password show/hide + sales forgot/back-to-CRM; muted-text contrast). Build + commit pending. NOTHING PUSHED.

---
## 2026-06-24 (cont.) — Pending safe-UX batch (Ankit: "wait for them, work on other UX pending")
While the DB/schema fixes (ALT-349..358) + access-control + the D2/Meeting decisions wait on Ankit, built two universal, no-DB, no-deploy UX items across every list module. Build green; **NOTHING PUSHED**.
- **ALT-368 — "Select all N matching" everywhere.** Bulk reassign/status/export could only ever act on the *current page*. New `SelectAllMatchingBar` (shows once the whole page is selected) offers "Select all N matching" → selects every row in the full filtered set. Safe because every list paginates CLIENT-SIDE (full set already in memory) → `sel.addAll(allFilteredIds)`, no extra fetch, every existing bulk action just works. New `addAll()` on `useRowSelection`. Wired into Leads (reference, by hand) → Contacts/Companies/Meetings/Wishlist (4 disjoint agents, one file each). Per-page id fields respected (Contacts uses `contact_id`). My Tasks has no multi-select → correctly skipped.
- **ALT-369 — list filters + search survive a refresh.** New `src/lib/listFilters.ts` `useListFilters()` — a drop-in for `useState<Filters>(defaultFilters)` that persists each module's filter+search set to localStorage. Keyed by ENTITY only (not userId → no async-resolve race that would overwrite a saved set) and MERGED over current defaults (adding a filter field later never breaks an old saved blob). Degrades to plain in-memory state if storage is unavailable; "Clear filters" still resets. Universal across all 5 list modules.
- Tracker → 2 new tickets (ALT-368/369); regenerated. Two central `npm run build` passes green (1929→1930 modules). Commit local only; not pushed (Q6: deploy evenings 6pm+/weekends, on Ankit's "push").

---
## 2026-06-25 — PM-mode kickoff: operating system + discovery + role correction
Ankit asked Claude to run as **PM / mini-CEO** — autonomous product engine with a sub-agent team (researcher, dev, UI/UX, security/risk, a mandatory QC gate, a harsh senior advisor), building only **non-dependent** work while his decisions wait, token-disciplined.
- **`product-os/` operating system (NEW)** — README (start-here) + OPERATING-MODEL (resume protocol v2 written from my own friction; sub-agent charters; build loop; definition-of-done; guardrails; a "focus principle" set by the advisor) + PRODUCT-BRIEF (1-page context) + DISCOVERY-2026-06-25 (synthesis). CLAUDE.md §0 now points here first.
- **`docs/Amplior-Review-Hub.xlsx` (NEW, gitignored)** via `gen-review-tracker.cjs` — the single owner-facing tracker: Decisions Needed (9) / Awaiting Review (11) / Risks (9).
- **Discovery workflow (`pm-discovery`, 4 agents):** market/need = **mixed** (as a pure CRM we lose to GHL/HubSpot/Close; the moat is the client ROI/feedback portal). Advisor reality-check was brutal + fair: the safe no-DB/no-deploy UX lane is **avoidance**; the product is a read-only viewer on corrupted data with no security (RLS off, anon PII reachable, assignment write-path never applied). → **Redirected the build queue** to foundation-readiness: (1) make writes honest, (2) read-only Data-Health report to make gated decisions easy, (3) prep+validate assignment-RLS + bulk-login dry-run (throwaway roles only), (4) stop manufacturing corruption (hide inline-create). Owner-gated items elevated in Review Hub incl. **DEC-09: gate the live URL (active PII exposure now)**. (`args` passthrough bug made the OS-critique agent return junk — lesson logged: inline context into prompts.)
- **Role correction (Ankit):** **Ankit = Product Manager** (directs the product), **Mohit = CEO** (business owner, does NOT build). Fixed at source: `gen-backlog-tracker.cjs` had `owner:'Mohit'` baked into ~35 tickets (which kept reverting Ankit's manual xlsx fix on each regenerate) → now `owner:'Ankit'`; legends + CLAUDE.md + product-os + memory updated. Both trackers regenerated.
- Commits: b1f4d54 (product-os scaffolding) + this batch. NOTHING PUSHED.
