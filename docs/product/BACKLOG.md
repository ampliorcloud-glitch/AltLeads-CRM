# Product Backlog — Amplior / Altleads CRM Rebuild

*Purpose: the single prioritized to-do list for the CRM rebuild — what's done, what's in progress, and what's left — organized by module so the owner can see the whole picture at a glance.*

*Last updated 2026-06-13*

> **This is a living draft; reconcile flow details with USER-STORIES-AND-FLOWS.md after owner review.** Where this backlog and the user-stories doc disagree on how a screen should behave, the user-stories doc wins (it is the reviewed spec). This file tracks *work and priority*; that file tracks *exact behaviour*.

---

## How to read this

Each section below is an **Epic** — a big chunk of work, usually one product module plus a few cross-cutting epics (Foundation, Auth, Deploy, Design). Under each epic is a table of **work items** (user stories / tasks).

**Priority** — how important / how soon:

| Tag | Meaning |
|---|---|
| **P0** | Must-have to go live. Blocks launch. |
| **P1** | Important. Needed for a complete, trustworthy product (target before cutover). |
| **P2** | Should-have. Improves the product; can land shortly after launch. |
| **P3** | Nice-to-have / later. Won't block anything. |

**Status** — where it stands today:

| Tag | Meaning |
|---|---|
| **Done** | Built and verified (per REBUILD_LOG). |
| **In Progress** | Actively being worked right now. |
| **To Do** | Planned, scoped, not started. |
| **Backlog** | Known and wanted, not yet scheduled. |

**Plain-language note:** "RLS" = the database's own access rules (who can see which rows). "Module" = a section of the app (Leads, Meetings, etc.). "P0" items are the ones that genuinely stop us launching.

---

## Snapshot — where we are today (2026-06-13)

- **Data migration: DONE.** All 65 tables and ~108,000 rows copied into Supabase, row counts matched. Production was never touched (we worked off a fork).
- **Login & roles: DONE.** Supabase Auth works; the 6 roles (ADMIN, TEAM_LEAD, SALES_HEAD, SALES_PERSON, AGENT, QC) are live; route protection is on.
- **All modules have a first-pass build.** Leads, Meetings, Wishlist, Dashboard, Notifications, Admin, Settings are all built on real data and the app builds clean.
- **Leads is the furthest along:** list + the 7 filters + Excel export + pagination + add/edit/detail are working on real data.
- **In progress now:** the Lead workspace (HubSpot-style detail page — header + right info panel + 3 tabs: Activity / Lead Report / Meeting) and the authoritative USER-STORIES-AND-FLOWS.md spec.
- **Biggest gates before going live:** the database access rules (RLS) must be applied before *any* public deploy, a design-match pass against Figma, real email notifications, and the mobile app repair.

---

## EPIC 1 — Foundation & Data Migration

*Standing up the new platform and moving real data into it.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| F-01 | Decide & lock the tech stack (Supabase + React/Vite/Tailwind + Netlify + repaired RN) | P0 | Done | Owner-approved 2026-06-11. No Java, no MySQL, no droplet. |
| F-02 | Create new Supabase project (`amplior-crm`, Mumbai region) | P0 | Done | IDs/keys stored in `.credentials/`. |
| F-03 | Recreate full schema in Supabase | P0 | Done | Turned out to be 65 tables (vendor added 21 audit tables post-Jan). Drift captured in `new-code/migration/schema-drift.sql`. |
| F-04 | Copy all production data into Supabase | P0 | Done | ~108,000 rows; 65/65 tables row-count match. Worked off a DO fork; production untouched. |
| F-05 | Apply foreign keys | P1 | Done | 60/64 applied; 4 skipped because of orphan rows = pre-existing vendor data bugs (nothing deleted, logged in `fk-skipped.txt`). |
| F-06 | Wire web app to real Supabase data | P0 | Done | `src/data/realLeads.ts` does the joins; app reads live data. |
| F-07 | Clean up dead/placeholder code | P2 | To Do | Remove unused `src/data/mockLeads.ts` and `src/pages/PlaceholderPage.tsx`. |
| F-08 | Decide on and delete the DO fork (or keep) | P2 | Done | Decision: keep fork running — owner has ~$19k DO credits to Nov, billing is a non-issue. |
| F-09 | Fix the 4 orphan-row data bugs at source | P3 | Backlog | Optional clean-up of legacy data quality; not blocking. |

---

## EPIC 2 — Auth & Security

*Logins, roles, and the database access rules that keep one salesperson's data private from another.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| A-01 | Supabase Auth login | P0 | Done | Verified: mohit@amplior.com → role ADMIN. |
| A-02 | Link auth users → user records + roles (`profiles` table + auto-onboard trigger) | P0 | Done | Trigger `on_auth_user_created` matches by email. |
| A-03 | Route protection (block pages when logged out / wrong role) | P0 | Done | Live. Admin nav gated to ADMIN. |
| A-04 | Decision: don't migrate old plaintext passwords | P0 | Done | At go-live each user gets a one-time "set your password" email. |
| A-05 | **RLS hardening — one comprehensive pass across all 65 tables** | **P0** | **To Do** | **HARD GATE: must be done before any Netlify deploy.** Model: ADMIN sees all; managers (TEAM_LEAD/SALES_HEAD/QC) all-for-now; AGENT/SALES_PERSON see only their own. **Ownership match is `created_by` (NOT `agent_id`)** — see data lesson in REBUILD_LOG. |
| A-06 | Refine manager access to true team-scope | P2 | Backlog | Start with managers-see-all; tighten to team-scope after launch. |
| A-07 | Send one-time password-set emails to all real users at go-live | P0 | To Do | Depends on email provider (see N-04). Part of cutover. |
| A-08 | Rotate / prune leftover secrets & DB firewall IPs | P1 | To Do | Prune the ~14 individual firewall IPs (likely old vendor devs) at cutover, not before. |
| A-09 | Security review of RLS policies before launch | P1 | To Do | Confirm no table is left world-readable via the anon key. |

---

## EPIC 3 — Leads

*The core module: the lead list, filters, exports, and the lead detail workspace where agents do their work.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| L-01 | Leads list page on real data | P0 | Done | 605 leads. |
| L-02 | The 7 Leads filters (the vendor's ₹96k CR scope) | P0 | Done | Built in as standard. "Sales Person" filter dropped — no such field in vendor schema (agent == salesperson). |
| L-03 | Excel export of Leads | P0 | Done | Part of the ₹96k CR scope. |
| L-04 | Pagination on Leads list | P0 | Done | Added after owner review flagged it missing. |
| L-05 | Add Lead (`/leads/new`) | P0 | Done | Generates next `ALT####` lead number; writes audit fields. |
| L-06 | Edit Lead (`/leads/:id/edit`) | P0 | Done | Was broken at first owner review; since fixed. |
| L-07 | Lead Detail page (header, all fields, clickable contacts, related meetings, stage history) | P0 | Done | `/leads/:id`. |
| L-08 | Fix data accuracy (companies/agents showing blank or "only 2 agents") | P0 | Done | Root cause found: joins used wrong columns. Correct: company = `client_association.client_name` via `client_assoc_id`; owner = `created_by`; project via `project_id`. Now 18 owners, 0 null companies. |
| L-09 | Simple stage change on a lead | P1 | Done | Updates `lead_report.stage_id`. Simple case only. |
| L-10 | **Lead workspace: HubSpot-style 3 tabs (Activity / Lead Report / Meeting) + right info panel** | **P0** | **In Progress** | The screen where agents fill in info. Reverse-engineered from old `lead-overview/`. Components to live in `src/components/lead/`, data in `src/data/leadWorkspace.ts`. Building under workflow wf_7a4a706c-3ef. |
| L-11 | Full stage-change workflow (approval + auto meeting creation) | P1 | To Do | Current stage change is the simple case only; full approval/meeting-creation flow deferred. |
| L-12 | Fix inline "create new company" placeholder values | P1 | To Do | Creating a brand-new company inline writes placeholder values into required company columns (address/country/domain/industry) — must verify/refine before relying on it. |
| L-13 | Activity timeline writing (agents log calls/notes) | P1 | To Do | Read works; confirm full create/edit of activity entries in the Activity tab. |
| L-14 | Lead Report tab data entry | P1 | In Progress | Part of L-10 workspace. |
| L-15 | Bulk actions on leads (assign / reassign / export selected) | P2 | Backlog | Reconcile with user-stories doc. |

---

## EPIC 4 — Meetings

*Scheduling, viewing, and managing field-sales meetings.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| M-01 | Meetings list on real data | P0 | Done | 610 rows. |
| M-02 | Meeting detail page | P0 | Done | |
| M-03 | The 7 Meetings filters (CR scope) | P0 | To Do | Mirror of the Leads filters; confirm all 7 are present and working. |
| M-04 | Excel export of Meetings | P0 | To Do | Second of the two ₹96k CR exports. Confirm present. |
| M-05 | Create / schedule a meeting | P1 | To Do | Confirm create flow end-to-end (link to lead, assign agent). |
| M-06 | Edit / reschedule a meeting | P1 | To Do | |
| M-07 | Assign / reassign a meeting to an agent | P1 | To Do | Trigger point for the notification email (see N-02). |
| M-08 | Meeting status workflow (scheduled → done / cancelled, QC review) | P1 | To Do | Reconcile with user-stories + QC role. |
| M-09 | Calendar / day view of meetings | P2 | Backlog | Nice-to-have view; confirm against Figma. |

---

## EPIC 5 — Wishlist

*The list of prospect companies the team wants to pursue.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| W-01 | Wishlist list on real data | P1 | Done | 54 rows. |
| W-02 | Add to wishlist | P1 | To Do | Confirm create flow. |
| W-03 | Edit / remove wishlist item | P1 | To Do | |
| W-04 | Convert wishlist item → lead | P2 | Backlog | Confirm whether this flow exists in FRS / old app. |
| W-05 | Wishlist filters / search | P2 | Backlog | |

---

## EPIC 6 — Dashboard

*The home screen — key numbers and a quick read on activity.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| D-01 | Dashboard on real data (lead/meeting counts) | P1 | Done | Real stats: 604 leads, meetings this week, 333 successful. |
| D-02 | Role-aware dashboard (admin vs agent see different numbers) | P1 | To Do | Numbers should respect RLS / role once A-05 lands. |
| D-03 | Charts / trends (pipeline by stage, conversions over time) | P2 | Backlog | Confirm against Figma "New UI" frames. |
| D-04 | Date-range / project filters on dashboard | P2 | Backlog | |
| D-05 | Team-performance / leaderboard view (for managers) | P3 | Backlog | |

---

## EPIC 7 — Notifications

*Telling agents and managers when something needs their attention.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| N-01 | In-app notifications list on real data | P1 | Done | Reads `in_app_notification`. |
| N-02 | **Email notification on meeting assignment** | **P0** | **To Do** | Core promised behaviour. Needs a Netlify Function + DB trigger. ~100+ emails/day. |
| N-03 | Email notification on meeting *reassignment* | P1 | To Do | Same mechanism as N-02. |
| N-04 | Choose & wire an email provider | P0 | To Do | Leaning Resend (free 3k/mo) or owner's own SMTP. Blocks N-02/N-03 and A-07. Decision pending. |
| N-05 | Mark-as-read / unread state | P2 | To Do | |
| N-06 | Confirm whether SMS (Twilio) is actually used | P2 | Backlog | Owner to confirm if SMS is live and who owns the account. |
| N-07 | Notification preferences (per-user opt in/out) | P3 | Backlog | |

---

## EPIC 8 — Admin

*Where the owner manages users, roles, projects, clients, and reference data without a developer.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| AD-01 | Admin panel built, ADMIN-gated | P1 | Done | Tabs: Users / Projects / Clients / Reference. Real edits work. |
| AD-02 | Manage users (add / edit / deactivate) | P1 | Done (first pass) | Confirm full add-user flow incl. sending the set-password invite. |
| AD-03 | Manage roles / change a user's role | P1 | To Do | Confirm role change updates `profiles` + takes effect immediately. |
| AD-04 | Manage projects | P1 | Done (first pass) | |
| AD-05 | Manage clients / companies | P1 | Done (first pass) | |
| AD-06 | Manage reference / lookup data (designations, stages, etc.) | P2 | Done (first pass) | "Reference" tab. |
| AD-07 | Match Admin panel to Figma "Admin Panal" page (35 frames) | P2 | To Do | Part of the design pass; separate Figma page from the web UI. |
| AD-08 | Access-management / permissions screen | P2 | Backlog | Reconcile with FRS + role model. |
| AD-09 | Audit log view (who changed what) | P3 | Backlog | Vendor added 21 audit tables — surface them if useful. |

---

## EPIC 9 — Settings

*Each user's own profile and password.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| S-01 | Editable profile | P2 | Done | |
| S-02 | Change password | P1 | Done | Via Supabase Auth. |
| S-03 | Notification preferences | P3 | Backlog | Overlaps N-07. |
| S-04 | Theme / display preferences | P3 | Backlog | |

---

## EPIC 10 — Mobile (React Native)

*Repair the existing field app and point it at the new backend.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| MO-01 | Recreate the 2 missing config files (`environment_urls`, `httpMethod`) | P1 | To Do | Vendor withheld them; app can't build without them. |
| MO-02 | Rewire mobile app to Supabase (new backend) | P1 | To Do | App is API-driven (RN 0.78, ~57 files). |
| MO-03 | New Android signing keystore | P1 | To Do | Release keystore not in repo. Fine for a new listing; existing Play listing needs vendor key or Google reset. |
| MO-04 | iOS build via GitHub Actions macOS runner (owner on Windows) | P1 | To Do | Owner can also borrow a 2020 MacBook. |
| MO-05 | Apple Developer + Google Play access | P1 | To Do | Vendor may ghost (unpaid invoice) — plan an Apple/Google support recovery route. |
| MO-06 | Test mobile against new backend + RLS | P1 | Backlog | After web is stable. |
| MO-07 | Match mobile to Figma "Mobile UI" (23 frames) | P2 | Backlog | Phase 6 design pass. |

---

## EPIC 11 — Deploy & Cutover

*Going live safely, then retiring the old system.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| C-01 | **RLS applied (hard gate — see A-05)** | **P0** | **To Do** | No deploy until this is done. |
| C-02 | First Netlify deploy (Claude does it, only on owner's explicit "go") | P0 | To Do | Then turn auto-deploy OFF; all later deploys are manual by owner. |
| C-03 | GitHub repo + auto-deploy wired for the first deploy | P0 | To Do | `ampliorcloud-glitch/AL`. |
| C-04 | Send go-live password-set emails (see A-07) | P0 | To Do | |
| C-05 | Parallel run — team uses new + old together (1–2 weeks owner testing) | P0 | To Do | Near-zero AI time; owner-led. |
| C-06 | Cutover — switch fully to new system | P0 | Backlog | After parallel run passes. |
| C-07 | Prune DB firewall IPs | P1 | To Do | At cutover. |
| C-08 | Retire DigitalOcean (droplet + MySQL) | P1 | Backlog | After cutover is confirmed stable. |
| C-09 | Environment / secret hygiene check before public exposure | P1 | To Do | Confirm no anon-key-wide-open tables, no committed secrets. |

---

## EPIC 12 — Design Polish

*Making the app match the agreed Figma design, not just function correctly.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| DP-01 | Set base UI style (Attio/Linear-style: light, Inter font, white sidebar, compact tables) | P1 | Done | Done after "AI generated" feedback. |
| DP-02 | Export all Figma frames as reference PNGs | P1 | Done | `docs/figma-export/{web,admin,mobile}/`. Web (29) + mobile (23) done; admin may still be finishing. |
| DP-03 | **Dedicated design-match pass: web app vs Figma "New UI" (29 frames)** | P1 | To Do | Run after the lead workspace + user-stories land. View the PNGs during this pass (frame names are auto-generated). |
| DP-04 | Design-match pass: Admin vs Figma "Admin Panal" (35 frames) | P2 | To Do | Overlaps AD-07. |
| DP-05 | Design-match pass: Mobile vs Figma "Mobile UI" (23 frames) | P2 | Backlog | Phase 6, overlaps MO-07. |
| DP-06 | Empty states, loading states, error states polish | P2 | Backlog | |
| DP-07 | Accessibility & responsive check | P3 | Backlog | |

---

## EPIC 13 — Specification & Documentation

*Building from authoritative user stories instead of reverse-engineering messy old code.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| DOC-01 | Write USER-STORIES-AND-FLOWS.md from FRS + old code + CR doc | P0 | In Progress | Being written under workflow wf_7a4a706c-3ef (tags: confirmed / inferred / gap + owner open-questions list). |
| DOC-02 | Owner reviews user-stories doc & answers the "gap" questions | P0 | To Do | Don't make owner write from scratch — Claude drafts, owner reviews. |
| DOC-03 | Reconcile this backlog against the reviewed user-stories doc | P1 | To Do | Re-prioritize / add items once flows are confirmed. |
| DOC-04 | Keep REBUILD_LOG.md session log up to date | P1 | Done (ongoing) | Append every session. |
| DOC-05 | This Product Backlog (BACKLOG.md) | P1 | In Progress | This file. Living draft. |

---

## Top of the queue (the short list)

If we only look at the next handful of things, in order:

1. **Finish the Lead workspace** (L-10) — the 3-tab agent screen that's in progress now.
2. **Finish & get owner sign-off on USER-STORIES-AND-FLOWS.md** (DOC-01/02) — so we build from a reviewed spec.
3. **RLS hardening pass** (A-05 / C-01) — the hard gate before any deploy.
4. **Email provider + meeting-assignment emails** (N-04 / N-02) — a core promised behaviour.
5. **Design-match pass vs Figma** (DP-03) — make it look right, not just work.
6. **Meetings module completeness** (M-03/M-04/M-05) — confirm the 7 filters + export + create flow.
7. **First deploy + parallel run** (C-02 → C-05), then **mobile repair** (Epic 10), then **cutover & retire DigitalOcean** (C-06/C-08).

---

*Anything marked "TBD" or "confirm" needs an owner decision or a check against USER-STORIES-AND-FLOWS.md / the FRS before it's locked. Nothing in this file should be treated as a final spec on its own.*
