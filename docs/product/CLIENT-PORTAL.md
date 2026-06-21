# Client Portal — Plan (v1, Phase 1)

> **Status: PLAN / not built.** Owner: Mohit. Branding: **Amplior** (not AltLeads). Web-only. Source: CEO meeting transcript 2026-06-21 (captured in REBUILD_LOG cont. 9). This doc is the durable plan; it will evolve as the owner confirms the open decisions in §10.

## 1. What this is (and isn't)
A **premium, Amplior-branded, client-facing web portal** — "Amplior's identity in front of the client," like Microsoft's `admin.microsoft.com`. One place where a client's **leadership** can see everything Amplior is doing for them: onboarding artifacts, lead reports, meetings + a dashboard, governance notes, updates, and invoices — instead of that being scattered across email/WhatsApp/calls.

Goals (from the CEO):
- **Single source of truth** per client → replaces scattered comms; standardizes client communication ("always refer back to the portal").
- **Transparency = trust** → show the work openly to the client's decision-maker ("leadership connect"); cut out middle-men disputes ("this isn't coming / that isn't coming").
- **Tech-enabled identity** → makes Amplior look like a tech-enabled player; auto-generates the material that today goes into PPTs.
- **Reusable internal mirror** → the same content doubles as an internal knowledge/training base for agents and an internal performance view for leadership.

**It is NOT a CRM.** It can *link* to the AltLeads CRM, but it's a curated, mostly-read-only governance/knowledge surface. Phase 1 = **mostly static content uploaded by Amplior staff from a backend**, plus a few **live** reads from the CRM (lead reports, meetings, dashboard). Low automation; connectors come later.

## 2. Who it's for — access model
Two audiences, both **access-gated by seniority** (owner: "for sales leader & their senior — not sales people themselves unless given access as a sales head"):

**Client side (external):**
- Invited **client leadership / decision-makers** (the person spending the money) + a few named client contacts.
- Each client user sees **ONLY their own client's** data (strict multi-tenant isolation). Read-only.

**Amplior side (internal):**
- **ADMIN + leadership + SALES_HEAD**: manage client portals, upload content, view any/their clients, see the internal performance mirror.
- **SALES_PERSON / AGENT**: **no** portal-admin access by default — only if elevated to SALES_HEAD-level access. (Internal performance dashboard may be visible to TEAM_LEAD/leadership per the transcript.)

> This mirrors the CRM's role model (`role_master`: ADMIN/TEAM_LEAD/AGENT/SALES_HEAD/SALES_PERSON/QC) and adds a new **CLIENT** role for external users.

## 3. Relationship to the existing apps
| App | Audience | Brand | Status |
|---|---|---|---|
| **AltLeads CRM** (`crm.altleads.com`) | Internal staff (full CRM) | AltLeads | Live |
| **Internal Sales Portal** (`/sales`) | Internal sales **team** day-to-day | AltLeads | Shell shipped |
| **Mobile (Blitz) app** | Salesperson ↔ coordination | — | Legacy; transcript wants its web equivalent folded into the portal eventually |
| **Client Portal** (this doc) | **External client leadership** + internal mirror | **Amplior** | **Planned (new)** |

The Client Portal is a **distinct, new app** — not the internal Sales Portal reskinned.

## 4. Supabase: same project or new? — **RECOMMENDATION**
**Recommended: SAME Supabase project** (`puvozfhypqbwbmbhrhcr`), on **Supabase Pro ($25/mo — pay for it regardless**, to remove the free-tier auto-pause risk the owner is worried about), with a **dedicated portal schema + curated read-only views + a separate CLIENT role**.

**Why same project (for Phase 1):**
- The portal's core value is showing **live** CRM data per client (lead reports, meetings, dashboard) that "reads exactly like the app." Same project = live with **no sync pipeline**. A separate project would need ETL/replication → constant staleness + engineering tax.
- **One bill, one backup, one auth** — simplest for a small team; matches the owner's $25 Pro intent.
- Fastest path to Phase 1.

**The risk (be honest):** external client users authenticate against the project that holds **all** clients' data + internal-only fields. One RLS mistake could leak a competitor's leads or internal data — which would destroy the very trust this portal is meant to build. So same-project is **only acceptable with these non-negotiable guardrails:**
1. Clients **never** get access to base tables — only to **curated, client-scoped read-only VIEWS** (e.g. `portal_lead_reports`, `portal_meetings`) and per-client **Storage** buckets.
2. A dedicated **CLIENT** role with **zero** default grants; explicit grants only to the portal views/buckets.
3. Every client view filters by the caller's `client_assoc_id` via RLS; **adversarially tested with throwaway client logins** before any real client is onboarded (same discipline already used for staff RLS).
4. Client-safe **column whitelist** — decide exactly which fields a client may see (their leads' details: yes; internal cost/agent-performance/other-clients: never).

**When to switch to a SEPARATE project:** if/when the portal opens to many external client orgs, adds heavier automation, or the pre-launch security review judges direct exposure too risky → move the portal onto its **own** Supabase project fed by a **controlled, read-only sync** from the CRM, so the internal DB is never directly exposed to external users. Architect Phase 1 so this migration stays possible (portal reads go through a thin data layer, not scattered raw queries).

## 5. Architecture (same-project, Phase 1)
- **Frontend:** a **separate** Amplior-branded web app (e.g. `portal.amplior.com`), its own Vite/React build + deploy on Hostinger, **sharing the same Supabase backend**. Separate app = clean Amplior branding + a clean external surface + independent deploys. (Premium look & feel — design later, per transcript.)
- **Backend:** reuse/extend the existing `notify-service` (Express) for staff **uploads/admin** endpoints (service-role) and later **connectors** (Fathom). No client writes from the browser — all portal content is published by staff.
- **Data:**
  - **Live (read-only views):** lead reports, meetings, dashboard metrics — scoped by `client_assoc_id` / `project_id`.
  - **Portal-owned (new tables in a `portal` schema):** documents/links metadata, governance notes, updates/comms log, action log, escalations, weekly summaries, invoices, client-user mapping.
  - **Mapping:** `client_portal_user(auth_uid → client_assoc_id, role, enabled)` ties a Supabase Auth user to exactly one client. (CRM backbone today: `client_association` → `project(client_assoc_id)` → leads/meetings/reports.)
- **Storage:** Supabase Storage, **one bucket/prefix per client**, for uploaded files (proposals, implementation plans, ICP docs, governance notes, invoices, weekly decks, the Excel that gets parsed). RLS on storage scoped per client.
- **Excel → structured:** uploaded Excel parsed into structured, app-like tables (owner wants it "to read exactly like the app"), reusing the CRM's xlsx tooling.

## 6. Information architecture — Phase 1 pages (mapped to the transcript)
1. **Overview / Home** — premium landing: client logo, project status, quick links, "important updates."
2. **Onboarding & Implementation** — proposal, implementation plan, ICP (sectors/targeting), sample database, process/flow, sample messages. (Uploaded docs + structured.)
3. **Lead Reports** — **live** from the CRM, per client; no more digging through email.
4. **Meetings & Dashboard** — **live** meeting pool + the dashboard scoped to the client; **"How the week went"** weekly-summary selector (pick a week → a 3–4 "slide" summary, data through last week).
5. **Governance** — governance plan, templates, **meeting notes** (Fathom notes: manual copy-paste now; auto-connector later).
6. **Updates / Communication log** — standardized client comms in one place + **action log** + **escalation** doc per client.
7. **Invoices** — uploaded from the backend now; auto-invoice is a future phase.
8. **(Internal mirror)** — same content reused as an agent **knowledge/training** base + an internal **performance dashboard** for leadership.

## 7. Static/manual vs live (Phase 1)
- **Live from CRM:** lead reports, meetings, dashboard numbers.
- **Manual upload by staff:** everything else (docs, ICP, governance/Fathom notes, updates, action log, invoices, weekly summaries). A simple staff "publish" backend; ops can be tasked with pasting Fathom notes post-call.
- **Phase 2 automation:** Fathom connector, auto weekly summaries, auto-invoicing.

## 8. Security model & non-negotiable gates (external users!)
- Clients touch **only** curated per-client views + their Storage bucket — never base tables.
- Dedicated **CLIENT** role; least-privilege grants.
- **Multi-tenant isolation** proven adversarially (throwaway client logins) before onboarding a real client — Client A must never see Client B.
- **Column whitelist** signed off by the owner (what a client may/may not see).
- All portal **writes** are staff/backend only (service-role); the client app is read-only.
- Reuse the CRM's masking/PII decisions where relevant; lead PII shown to a client is *their own* leads.
- This is a **bigger external surface than the internal CRM** — it gets its own security review + RLS validation pass before go-live.

## 9. Phasing
- **Phase 1 (build first):** premium static portal + live lead reports + meetings/dashboard + per-client doc storage + invoices upload + per-client access + Amplior branding. Web-only.
- **Phase 2:** Fathom/connector automation, auto weekly summaries, auto-invoicing, the internal knowledge/training mirror + internal performance dashboard.
- **Phase 3 (future):** deeper automation, fold in the mobile-app coordination features as web, public polish.

## 10. Open decisions for the owner (confirm before build)
1. **Supabase:** approve **same project + pay for Pro ($25)** with the §4 guardrails? (Recommended.)
2. **Branding/domain:** `portal.amplior.com`? Amplior branding confirmed.
3. **Access interpretation (§2):** confirm "client leadership + ADMIN/SALES_HEAD/leadership; agents only if elevated."
4. **Phase-1 page scope:** which of the §6 sections are in Phase 1 vs deferred (owner said "remove anything slow + low value").
5. **Column whitelist:** what a client may see (esp. lead/meeting detail) vs internal-only.
6. **Pilot client:** start with whom? (Transcript hinted at testing with a friendly/transparent client, e.g. HungerBox-style, or "test waters" with a slightly-dissatisfied client.)

## 11. Backlog (epic + Phase-1 tickets)
Epic **ALT-221 Client Portal (Amplior-branded, external)**. Phase-1 children to be created on owner sign-off: Supabase Pro upgrade + portal schema/role; per-client access + `client_portal_user`; curated read-only CRM views (lead reports/meetings/dashboard); Storage + doc upload backend; Overview/Onboarding/Lead-Reports/Meetings-Dashboard/Governance/Updates/Invoices pages; weekly-summary selector; security + multi-tenant RLS validation. (Supersedes the old placeholder **ALT-161**.)
