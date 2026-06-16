# Amplior / Altleads CRM — Product Requirements Document (PRD)

> **Purpose:** Define what the rebuilt Amplior CRM must do, for whom, and why — so the owner and any builder share one clear picture of the product before and during the rebuild.

*Last updated: 2026-06-12*

> **How to read this doc:** It is written in plain language for a business owner, with small technical notes in *italics* where they help. Anything not yet confirmed is marked **TBD — confirm with owner**. For the build sequence and dates, see the Roadmap; this PRD describes the *what* and *why*, not the *how/when*.

---

## 1. Product Vision

Amplior CRM is a B2B field-sales CRM that helps a sales team capture leads, run client meetings, and track every deal from first contact to close — on web and on mobile. The rebuilt product gives the business owner full, self-service control of his own system: he can see and edit any data, add users and change roles, and request product changes through a simple conversation instead of paying an outside vendor for every small request. It keeps everything the old system did well (leads, meetings, wishlist, role-based access for six job types) while being faster, cleaner, cheaper to run, and far easier to change.

---

## 2. Problem & Background

The current Amplior/Altleads CRM was built by an outsourced vendor and has become slow, expensive, and frustrating to work with. Three problems forced the decision to rebuild:

1. **Costly, slow change requests.** Even small, routine features are billed at a premium. The clearest example: the vendor quoted **₹96,000 (≈196 working hours)** just to add **7 filters on the Leads screen, 7 filters on Meetings, two Excel exports, and a few editable fields** — work that takes a clean codebase a fraction of that time. Every change means a vendor ticket, a wait, and an invoice.

2. **No self-service control.** The owner cannot see or edit his own data without going through the vendor. The old database had no usable admin interface, and the web app could not even be rebuilt locally because the vendor withheld key configuration files. The owner is effectively locked out of his own product.

3. **A messy, risky legacy system.** *Technical note:* the old stack is a Java Spring Boot backend (Java 8, now end-of-life) with **zero automated tests**, running on a self-managed DigitalOcean server, plus a MySQL database the owner can't easily touch. It also had serious security flaws — **user passwords were stored as plain text** and an encryption key was hard-coded in the source. Maintaining it is slow and fragile.

**The fix:** a clean rebuild on managed, modern services (Supabase for the database, logins, and file storage; a fresh React web app on Netlify; the existing mobile app repaired and re-pointed to the new backend). This puts the owner in control, removes the security flaws, and cuts running costs dramatically. The vendor's prior rebuild attempt is abandoned reference only.

---

## 3. Goals & Non-Goals

### Goals

- **Give the owner self-service control.** He can view/edit data, manage users and roles, and get product changes without a vendor in the loop.
- **Match (then beat) the old system's features** — leads, meetings, wishlist, notifications, role-based access for all six roles — with no loss of capability.
- **Ship the "₹96k" features as standard**: rich filters on Leads and Meetings, plus Excel exports.
- **Migrate the real business data** (~108,000 rows: 605 leads, 610 meetings, 54 wishlist items, 18 active salespeople) with **zero data loss**, not start from a blank system.
- **Slash running cost and operational burden** — no servers to patch or restart, predictable low monthly cost.
- **Fix the security problems** — proper, modern logins; no plain-text passwords; access rules enforced at the database level.
- **Keep the old system running in parallel** until the team has tested the new one, then cut over safely.

### Non-Goals (for this rebuild)

- **Not** re-creating the old Java backend or staying on self-managed MySQL/DigitalOcean — those are being retired.
- **Not** migrating the old plain-text passwords. *Each user sets a fresh password at go-live via a one-time email.*
- **Not** a ground-up redesign of business workflows — we rebuild the proven flows, then refine. Net-new features beyond parity are future scope.
- **Not** adding new integrations (new SMS/email providers, third-party CRMs, analytics suites) in this phase unless explicitly requested.
- **Not** a public/customer-facing portal — this is an internal sales-team tool.

---

## 4. Target Users & Personas

The system serves one sales organization with **six roles**. Access is enforced by role *(technical note: via Row Level Security — rules attached to the database itself, so even a bug in the app cannot leak another person's data)*.

| Role | Who they are | What they mainly need from the CRM |
|---|---|---|
| **ADMIN** | The owner / system administrator (e.g., Mohit) | See **everything**; add/edit/remove users; assign roles; manage projects, clients, and reference lists; edit any data directly. The most powerful role. |
| **SALES_HEAD** | Senior sales leader overseeing the whole sales function | Broad visibility across teams and pipeline; oversight of leads, meetings, and performance; reporting and exports. |
| **TEAM_LEAD** | Manages a team of salespeople | Visibility of their team's leads and meetings; assign/reassign work; monitor progress and stages. |
| **SALES_PERSON** | Field salesperson (a.k.a. "agent" in this data) | See and work **their own** leads; log activity; record meetings and lead reports; update stages. *Note: in this data set "agent" and "salesperson" are effectively the same person; there is no separate "sales person" field.* |
| **AGENT** | Field agent who captures and progresses leads | Same day-to-day needs as a salesperson: own leads, log activity, fill in meeting and report details. |
| **QC** | Quality Control reviewer | Review lead and meeting data for quality/accuracy; visibility across records to verify and flag. |

**Access model (planned):**
- **ADMIN** sees all data.
- **Managers (TEAM_LEAD, SALES_HEAD, QC)** see broadly for now, to be refined to team-scoped views later.
- **AGENT / SALES_PERSON** see only their **own** leads.

*Technical note on ownership:* in the real data, a lead's owner is identified by the **`created_by`** field (18 distinct real salespeople), and the company is identified via **`client_assoc_id`** — not the older `agent_id`/`company_id` columns, which are mostly empty. Access rules use **`created_by`** for ownership.

---

## 5. Scope

### In-Scope modules (this rebuild)

| Module | Summary |
|---|---|
| **Login / Authentication** | Secure sign-in for all six roles; one-time password setup at go-live; sessions; route protection. |
| **Dashboard** | At-a-glance numbers (leads, meetings this week, successful deals) and quick navigation. |
| **Leads** | The core module. Searchable, filterable, paginated list with Excel export; full lead detail with a HubSpot-style workspace (header + info panel + **Activity / Lead Report / Meeting** tabs where agents fill in information); add/edit leads; live stage changes. |
| **Meetings** | List + detail of client meetings (610 records), filters, and Excel export; linked to their leads. |
| **Wishlist** | Wishlist / prospect list (54 records). |
| **Notifications** | In-app notifications (e.g., when a meeting is assigned or reassigned). |
| **Admin Panel** | Manage Users, Projects, Clients, and reference/lookup lists; assign roles; ADMIN-only. |
| **Settings** | Editable profile and password change for the logged-in user. |

### Out-of-Scope / Future (not in this rebuild unless requested)

- **Mobile app polish beyond repair-and-reconnect** — the existing React Native app is repaired and pointed at the new backend; deeper redesign is later.
- **New outbound channels** — adding/replacing SMS (Twilio) or email (e.g., Resend/SendGrid) providers beyond what notifications need. *Email provider for meeting-assignment notifications is **TBD — confirm with owner** (~100+ emails/day expected).*
- **Advanced reporting/analytics dashboards** beyond the core dashboard numbers and Excel exports.
- **Team-scoped fine-grained permissions** for managers (start broad, refine later).
- **Any net-new workflow** not present in the old system (full multi-step stage-change approval with auto meeting creation is captured but **deferred** — current stage change is the simple case).
- **Third-party CRM / external integrations.**

---

## 6. Key Features by Module

### Login / Authentication
- Email + password sign-in for all six roles *(via Supabase Auth — bank-grade, no plain-text passwords).*
- One-time "set your password" email for each user at go-live.
- Each login is auto-linked to the right person and role; protected routes keep signed-out users out.

### Dashboard
- Headline metrics from real data (e.g., total leads, meetings this week, successful deals).
- Fast entry points into Leads, Meetings, and other modules.

### Leads (core)
- **List view** with search, **multiple filters** (the "₹96k" filters delivered as standard), **pagination**, and **Excel export**.
- **Lead detail** in a HubSpot-style layout: header + right-hand info panel + three workspace tabs:
  - **Activity** — timeline of what's happened on the lead.
  - **Lead Report** — the structured report agents fill in, including stage history.
  - **Meeting** — meetings related to this lead.
- **Add / Edit lead** with proper audit fields and auto-generated lead numbers (e.g., `ALT####`).
- **Live stage changes** (simple case today; full approval + auto-meeting workflow is deferred).
- Clickable contacts; related companies, projects, and meetings resolved from the real data.

### Meetings
- Filterable, paginated list of meetings with **Excel export**.
- Meeting detail, linked back to its lead.

### Wishlist
- List of wishlist / prospect items, viewable and editable.

### Notifications
- In-app notification feed (e.g., meeting assignment / reassignment alerts).

### Admin Panel (ADMIN only)
- **Users** — add, edit, and manage people and their **roles**.
- **Projects**, **Clients**, and **Reference/lookup lists** — create and edit the supporting data the CRM depends on.

### Settings
- Edit own profile; change own password.

---

## 7. Success Metrics

The rebuild is successful when:

1. **Owner self-service works.** The owner can make data and UI/feature changes **without a vendor** — directly (via the database table editor / Admin panel) or by requesting a change that is built and deployed the same day.
2. **Running cost drops sharply.** From the old droplet + managed MySQL + vendor invoices to roughly **$0–$25/month** on managed free/low tiers.
3. **Cutover with zero data loss.** All real data migrated and verified — target met in migration (**65/65 tables matched on row counts, ~108,000 rows**); go-live preserves it.
4. **Feature parity (then better).** Everything the old system did — leads, meetings, wishlist, notifications, six-role access — plus the filters and Excel exports the vendor wanted to charge ₹96k for, all working.
5. **Security fixed.** No plain-text passwords; access enforced at the database level so the app cannot leak data across users/roles.
6. **Confident cutover.** The team runs new + old in parallel, confirms the new system, then retires the old DigitalOcean stack.
7. **Change turnaround.** Routine changes (a new filter, a new export, an editable field) go from *weeks-and-an-invoice* to *hours-or-less, at near-zero cost.*

---

## 8. Assumptions & Dependencies

**Assumptions**
- The team is willing to run the new and old systems in parallel for a short testing period before cutover.
- Each user will set a new password via the one-time email at go-live (old passwords are intentionally not migrated).
- "Agent" and "salesperson" refer to the same field worker; there is no separate "sales person" field in the real data.
- The proven old-system workflows are the spec; we rebuild them faithfully, then refine.

**Dependencies / open items**
- **Accounts & access (owner):** Supabase, Netlify, and GitHub access are set up; the new Supabase project (`amplior-crm`, Mumbai region) and migration are done.
- **Deploy rules (binding):** the first Netlify deploy is done only when the owner says go; auto-deploy is turned **off** after the first deploy — deploys are **manual by the owner** thereafter.
- **Security gate:** database access rules (Row Level Security) **must** be applied before any public deploy. *(Currently off for local-only building.)*
- **Email provider** for notifications: **TBD — confirm with owner.**
- **Mobile (later phase):** the existing app needs missing files recreated and re-pointing to the new backend; an **iOS build needs a Mac** (owner is on Windows, can borrow one) and Apple/Google Play access.
- **Vendor risk:** the vendor may withhold the Android signing key / app-store access (final invoice unpaid); recovery via Google/Apple support is the fallback. **TBD — confirm with owner.**
- **Known data-quality items:** some lead/company links rely on `created_by` + `client_assoc_id` (not the older empty columns); a few records have minor vendor-era data bugs (handled, nothing deleted).
- **Deadline pressure:** the heavy build is front-loaded due to an AI-model availability window; see the Roadmap.

---

## 9. High-Level Timeline

The build is front-loaded: data migration and core web modules first, then the admin panel, the first deploy, mobile repair, and finally a parallel-run-and-cutover period before retiring the old DigitalOcean system.

➡ **For the detailed phase plan, dates, and current status, see the Roadmap** (and `REBUILD_LOG.md` for the full running history). This PRD intentionally does not duplicate those dates so there is a single source of truth for timing.

---

*Document owner: Amplior (Mohit). Built and maintained with Claude as orchestrator. Plain-language by design — flag anything unclear and it will be revised.*
