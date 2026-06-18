# AltLeads — Sales / Client Portal Spec
*2026-06-18 · grounded in the old vendor mobile app (`old-code/amplior-mobile-app-main`) + current `new-code` + live DB*

## What we're building
A **client-facing Sales Portal** inside the same web app, with a **separate login**. Client sales teams log in here and see **only their project(s)' leads**; they record outreach outcomes — **starting with Feedback**. Amplior internal users can also enter the sales portal (read leads), but sales users can **never** reach the internal CRM screens.

This is the web rebuild of the vendor's **mobile** sales app (which was meeting + feedback centric — a good fit for our outreach-only model).

## Roles & access (confirmed model)
| Role | id | Sees | Can do |
|------|----|------|--------|
| **Sales Person** | 5 | Only **their own** leads (`lead_report.user_id = self`) | Record feedback, update meeting status/schedule on their leads |
| **Sales Head** | 4 | All leads of **their downline** (their sales persons) across their project(s) | Everything a SP does + **assign/reassign** leads + **add Sales Persons** + executive dashboard |
| (Amplior internal) | 1–3,6 | May open the sales portal (read leads) | Their real work stays in the internal CRM |

- **Multiple Sales Heads per project** are allowed → we need a real **downline link** (the old app let a head see *all* project leads; with multiple heads we must distinguish "my team").
- Client/sales users are **provisioned by Admin from Settings** (assigned to project[s]); a Sales Head can then add their own Sales Persons.

## Two login interfaces, one app
- `/login` (existing) = **Lead Gen login** → internal CRM (ADMIN/TEAM_LEAD/AGENT/QC). Harden so **pure sales users are bounced to `/sales`**.
- `/sales/login` (new) = **Sales login** → `/sales/*` subtree behind a new `SalesProtectedRoute` (session + sales-role *or* internal user).
- Same Supabase auth + same backend; the difference is the post-login shell, nav, and route guard.
- `AuthContext` must expose the **full role set** (today it only exposes the single most-privileged `profile.role`) so "internal may enter sales" and "sales blocked from internal" are decidable.

## The downline hierarchy (the one foundational addition)
No manager/parent column exists anywhere today. Add an explicit, project-scoped link:
- **Preferred:** add `sales_head_user_id bigint NULL` to **`project_user`** (a Sales Person's row points at their Sales Head, per project). Supports multiple heads per project; keeps scoping project-aware. (Also add a partial UNIQUE on active `(project_id, user_id)` — today only JS-guarded.)
- New RLS helpers: `is_sales_person()`, `is_sales_head()` (role 5/4), `sales_downline_ids()` (user_ids reporting to me).

**Owner decision (2026-06-18): default = own team, but the Head can SHARE wider.** By default a Sales Head sees only *their* team (their `sales_head_user_id` reports). But a Head can grant another Head/person a broader **"senior viewer"** scope (e.g. see across teams / the whole project) — the Head decides, via an option in the portal. Model this with an explicit **grant table** (`sales_view_grant`: grantee_user_id, project_id, scope `team|project`, optional granted-by) layered into `sales_downline_ids()`/the lead SELECT term, so visibility = (my team) ∪ (anything granted to me). Keeps the default tight while letting Heads open it up case-by-case.

## Data scoping (RLS — additive, keeps internal rules intact)
The authoritative "lead belongs to sales person" link is **`lead_report.user_id`** (NOT `created_by`, which is the internal owner). Add an **additive** SELECT term to `lead_master` (and the reads it drives) — never remove the existing internal floor:
```
... OR EXISTS (
  SELECT 1 FROM lead_report lr
  WHERE lr.lead_id = lead_master.lead_id AND lr.deleted_date IS NULL
    AND lr.user_id IN ( current_user_id()  ∪  sales_downline_ids() )
)
```
- Sales Person → matches `lr.user_id = self`. Sales Head → matches `lr.user_id ∈ downline`. Unassigned leads (no `lead_report`) correctly stay invisible to sales.
- Mirror the term for `lead_report`, `meeting_master`, `feedback_answer` reads, and add a **write** policy on `feedback_answer` (+ `meeting_master.agent_feedback`/status) allowing the assigned SP (or their head) to write.
- ⚠️ These RLS edits touch `lead_master` — **validate with throwaway SP/SH logins before applying to prod**, especially during internal-launch week.

## First CRUD — Feedback (matches "start with feedback")
Recreate the vendor's feedback flow on the web. **Feedback questions apply when the meeting actually happened** (a successful/completed meeting), but the screen must also let the user **reschedule** or **cancel/drop** instead.
1. Questions are server-driven from **`feedback_question_master`** (`feed_que_id, feed_que`). Render Yes/No toggles; the free-text question (vendor hardcoded `feed_que_id == 7`) is a textarea — **don't hardcode the id; treat any non-boolean/feedback question as text, or flag it in data**. Capture the real question set from the live DB.
2. Plus a **Next Meeting / follow-up date** picker.
3. **Outcome at the Submit button (owner, 2026-06-18) — the user picks the meeting outcome:**
   - **Successful** (meeting happened) → save feedback answers + set `meeting_master.meeting_status='Completed'` + `follow_up_date`. *(default once feedback is filled.)*
   - **Reschedule** → date/time + reason → status `Rescheduled` (reuse the existing internal reschedule flow / `updateMeetingStatus`).
   - **Cancel / Drop** ("meeting drop" = cancelled) → reason → status `Cancelled`. *(owner is adding "Drop" as an explicit option now.)*
4. **Submit (Successful)** → INSERT rows into **`feedback_answer`** (one per question, keyed by `meeting_id`), set the meeting Completed + follow-up. Lock after submit. *(This write path does not exist in new-code yet — it's read-only today; build it + its RLS. Reschedule/Cancel reuse existing meeting actions.)*

## Sales-editable fields (from the vendor app) — confirm scope with owner
Sales users were **read/outreach-only** except: **feedback** (above), **meeting reschedule/cancel/complete**, **assign/reassign salesperson** (head only), **wishlist add** (prospect capture), profile photo. Lead/company fields themselves were **not** editable. → **Start with Feedback**; owner to confirm which others (meeting actions next most likely).

## Sales Head "add Sales Person"
New endpoint `POST /api/sales/users/create` + `requireSalesHead` middleware (verify JWT + caller is role 4). It **forces role_id=5**, creates the user (reuse `genTempPassword`/`findAuthUserByEmail`/`ensureProfileLink`), assigns them to the caller's project(s) via `project_user`, and records the **downline link** (caller as their `sales_head_user_id`). Admin still provisions the first Sales Head per project from internal Admin/Settings.

## Executive dashboard (Sales Head) — phase 2 of the portal
Recreate the vendor head dashboard: meeting-status stat strip (Scheduled/Completed/Rescheduled/Dropped/Missed), Revenue Potential, Hot Prospects, Meetings-by-city, Face-to-face vs Virtual %, Industry spread, pipeline funnel. Sales Person gets the simple "today's meetings" view. Date-range filter.

## Build order
1. **Portal shell** (safe, additive): `/sales/login`, `SalesProtectedRoute`, sales `AppShell`/`Sidebar` (Leads + Meetings + Feedback), reuse existing `LeadsPage`/`LeadDetailPage`; harden internal routes to block sales users; expose full roles in `AuthContext`. *(No DB risk.)*
2. **Hierarchy + RLS migration** (`project_user.sales_head_user_id` + helpers + additive lead/feedback policies) — write, then **validate with real SP/SH logins** before prod.
3. **Feedback CRUD** (write `feedback_answer` + complete meeting).
4. **Admin/SH user provisioning** (`/api/sales/users/create`).
5. **Executive dashboard** + assign/reassign.

## Owner decisions for this portal
1. **Downline model** — confirm `project_user.sales_head_user_id` (a SP reports to one SH per project). OK? Multiple SHs per project = yes.
2. **Editable fields beyond feedback** — start with Feedback; confirm meeting reschedule/cancel/complete + assign/reassign next.
3. **Provisioning** — Admin creates the first Sales Head per project (from Settings); SH self-serves Sales Persons. OK?
4. Does the client portal also need the **wishlist "add prospect"** flow at v1, or feedback-only first?

## Future — integrations (added to scope)
Our own **workflow engine + public APIs + MCP server** so AltLeads integrates with other CRMs/tools (two-way sync, webhooks, automation). Tracked separately; design after internal launch + portal v1.
