# Decision Log — Amplior / Altleads CRM Rebuild

*Purpose: A running record of the important architecture and product decisions on the rebuild — what we chose, why, what we rejected, and whether the decision still stands. So nobody re-litigates a settled question, and a future developer understands the "why".*

*Last updated 2026-06-12*

---

## How to read this

Each decision is a short block in the same shape ("ADR" = Architecture Decision Record):

- **Context** — the situation that forced a choice.
- **Decision** — what we picked.
- **Why** — the reasoning, in plain terms.
- **Alternatives considered** — what we rejected, and why.
- **Status** — *Accepted* (in force), *Superseded* (replaced by a newer decision), or *Proposed* (not yet locked).

The numbering (ADR-01, ADR-02 …) is just an index; it is not a priority order.

---

## ADR-01 — Use Supabase instead of a self-managed MySQL-on-DigitalOcean database

- **Context:** The old system ran MySQL on a DigitalOcean droplet that someone had to SSH into, patch, restart, and firewall by hand. There was no usable interface for the owner to view or fix data; every change meant a vendor ticket and a bill.
- **Decision:** Move the database, authentication and file storage to **Supabase** (managed PostgreSQL).
- **Why:** **Manageability** — servers become "someone else's problem" (Supabase patches and runs them). The owner can **view and edit data himself** through Supabase's spreadsheet-like Table Editor, with no developer in the loop. Every table also gets a secure auto-generated API, removing most of the old hand-written backend.
- **Alternatives considered:** Keep self-managed MySQL on DigitalOcean (rejected — ongoing maintenance burden, no owner-facing tooling, vendor dependency). A different managed DB without the built-in Auth/Storage/API bundle (rejected — Supabase gives all three together).
- **Status:** Accepted.

---

## ADR-02 — Use Supabase Auth instead of the homemade JWT login

- **Context:** The old backend stored passwords in **plain text** (`NoOpPasswordEncoder`), hardcoded an AES key in source, and rolled its own JWT login. This is a serious security hole.
- **Decision:** Use **Supabase Auth** for all logins. Do **not** migrate the old plaintext passwords; at go-live each user receives a one-time email to set a new password.
- **Why:** Supabase Auth gives **bank-grade password hashing and session handling** out of the box and removes the plaintext-password problem entirely. Building auth ourselves would repeat the vendor's mistakes. A trigger links `auth.users` to the existing `user_master` records by email, so users keep their roles. Verified working: admin login resolves to role ADMIN.
- **Alternatives considered:** Re-implement custom JWT auth (rejected — reinventing a solved, security-sensitive problem). Migrate the old password hashes (impossible/unsafe — they were plaintext, not hashes).
- **Status:** Accepted.

---

## ADR-03 — Build the web app on React + Vite + TypeScript (+ Tailwind + shadcn-style UI)

- **Context:** The old web app was React 19 but unbuildable (a required `environment_urls` file was withheld by the vendor) and contained unmaintainable files (one component was 3,767 lines). We needed a clean, modern, owner-friendly front end.
- **Decision:** Rebuild the web app with **React + Vite + TypeScript**, styled with **Tailwind** and a **shadcn-style** UI kit. Hosted on Netlify.
- **Why:** This is a fast, modern, widely-supported stack. **TypeScript** catches errors early; **Vite** gives quick builds; **Tailwind + shadcn** give a consistent, professional look without a heavy design system. It keeps server logic minimal (Supabase direct + a few Netlify Functions).
- **Alternatives considered:** Salvage the old React 19 code (rejected — won't build, and the code quality is poor). A heavier framework / different bundler (rejected — unnecessary complexity for this app's size).
- **Status:** Accepted.

---

## ADR-04 — Use TanStack Table instead of paid AG Grid Enterprise

- **Context:** The data grids (Leads, Meetings) need sorting, filtering and the 7+7 filters from the vendor's ₹96k change request, plus Excel export. The old approach leaned toward AG Grid Enterprise, which is a **paid license**.
- **Decision:** Use **TanStack Table** for all data tables.
- **Why:** TanStack Table is **free and open-source**, fully capable of the required filtering/sorting, and avoids a recurring license cost. The "expensive" CR features (filters + Excel export) are trivial to build in a clean codebase.
- **Alternatives considered:** **AG Grid Enterprise** (rejected — license cost for features we can get free). AG Grid Community (rejected — TanStack chosen for flexibility and zero license risk; see Risk R-10).
- **Status:** Accepted.

---

## ADR-05 — Host on Netlify with GitHub auto-deploy, but turn auto-deploy OFF after the first deploy

- **Context:** We want simple hosting wired to the code repository, but the owner wants **control over when the live site changes** (no surprise deploys).
- **Decision:** Host the web app on **Netlify**, connected to **GitHub**. The **first** deploy is done by Claude — but only after the owner explicitly says go. After that, **auto-deploy is turned OFF** and all further deploys are **manual, by the owner only** (one click).
- **Why:** Gives the convenience of a GitHub-connected pipeline for the initial setup, while keeping the owner in full control afterward. Nothing reaches production without a deliberate human action.
- **Alternatives considered:** Leave auto-deploy ON (rejected — owner wants no automatic production changes). A different host (rejected — Netlify pairs cleanly with the chosen stack and Functions). **Hard prerequisite:** RLS must be applied before any deploy (see Risk R-08).
- **Status:** Accepted.

---

## ADR-06 — Migrate the real production data, via a database fork, without touching production

- **Context:** A fresh-start empty system would lose years of real data (~108k rows: 605 leads, 610 meetings, etc.). But pulling data directly from the **live** production DB risks disrupting the running business.
- **Decision:** **Migrate the real data**, but do it by **forking** the DigitalOcean cluster, locking the fork's firewall to one PC, copying fork → Supabase, verifying row counts, and leaving production **completely untouched**.
- **Why:** Real data is essential for a usable CRM and for honest testing. The **fork approach guarantees production is never touched** during migration. Result: 65/65 tables matched on row count; foreign keys 60/64 applied (4 skipped only because of pre-existing orphan rows = vendor data bugs, nothing deleted).
- **Alternatives considered:** Fresh start with empty tables (rejected — loses real history). Copy directly from the live DB (rejected — risk to the running business). The schema turned out to be **65 tables, not the documented 47** (vendor drift), captured in `schema-drift.sql`.
- **Status:** Accepted.

---

## ADR-07 — Keep the old DigitalOcean system running in parallel until cutover

- **Context:** Switching a live sales team to a brand-new system overnight is risky if anything is wrong or missing.
- **Decision:** **Keep the old system running in parallel** with the new one. The team uses both during a parallel-run period; only after the new system is tested and trusted do we **cut over** and then retire DigitalOcean.
- **Why:** Safety. The business keeps a working fallback while the new system is validated against real daily use. No data or workflow is lost if a gap is found late.
- **Alternatives considered:** Hard cutover with no overlap (rejected — too risky for a live business). The old DB firewall has ~14 individual IPs (likely vendor devs) — these are pruned **at cutover, not before** (one may be the owner's office).
- **Status:** Accepted.

---

## ADR-08 — Repair the existing React Native mobile app rather than rebuild it

- **Context:** A mobile app already exists (React Native 0.78, ~57 files, API-driven). It can't build because two files were withheld (`environment_urls`, `httpMethod`), and the release keystore isn't in the repo.
- **Decision:** **Repair** the existing React Native app — recreate the missing files and re-point it at the new Supabase backend — rather than rebuild the mobile app from scratch.
- **Why:** The app's structure is reusable; recreating two small missing files and rewiring the backend is far less work than a full mobile rebuild. iOS builds will run via a **GitHub Actions macOS runner** (the owner is on Windows). This is **Phase 6**, after the web app.
- **Alternatives considered:** Rebuild mobile from scratch (rejected — unnecessary effort given the existing app is largely intact). Note dependency: store publishing depends on resolving the keystore/store-access risk (Risk R-01).
- **Status:** Accepted.

---

## ADR-09 — Map lead ownership to `created_by` and company to `client_association` (not `agent_id` / `company_id`)

- **Context:** The first Leads build joined on the "obvious" columns `agent_id` and `company_id` — and showed blank companies and "only 2 agents", because those columns are mostly empty in the real data.
- **Decision:** Treat **lead owner/agent = `lead_master.created_by`** (18 real salespeople) and **company = `client_association.client_name` via `client_assoc_id`** (populated for all 605 leads). Project = `lead_master.project_id`. The RLS ownership rule will use **`created_by`**.
- **Why:** Verified by direct database queries: `agent_id` is null for 476 leads (only 2 distinct values), while `created_by` holds the real 18 owners; `company_id` is null for 477 leads, while `client_assoc_id` is populated for all. This mapping is what makes the data display correctly (e.g. lead 2211 = AP Securitas / Mansi Rajak). Lookups are paged with `.range()` to beat PostgREST's 1000-row cap.
- **Alternatives considered:** Use the named-but-empty `agent_id` / `company_id` columns (rejected — they are mostly null; this was the original bug). This is the standing data-mapping rule for **all** modules and for the RLS plan (see Risk R-04).
- **Status:** Accepted.

---

## ADR-10 — Work as an orchestrator with cheap sub-agents

- **Context:** The owner is **non-technical** and the build is large, with a model-cost/time constraint (Fable sunset 2026-06-22). Doing every task on the most expensive model would be slow and costly.
- **Decision:** Use an **orchestrator + sub-agent** model: the main session plans and decides; **sub-agents on cheaper models (Sonnet/Haiku)** do the heavy lifting — scanning, bulk coding, repetitive work. The owner is shown anything destructive before it happens, and everything is explained in plain language.
- **Why:** **Cost and speed.** Cheap sub-agents handle the bulk work in parallel (e.g. one workflow built 6 modules across 8 agents); the expensive model is reserved for planning and hard decisions. Keeps the owner in control without requiring technical skill. After the Fable sunset: Opus 4.8 for hard parts, Sonnet 4.6 as the daily driver.
- **Alternatives considered:** Do everything in the main, top-tier model (rejected — slower and far more expensive). Hand work to the original vendor (rejected — the whole point of the rebuild is to escape that dependency).
- **Status:** Accepted.

---

## Quick index

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-01 | Supabase over self-managed MySQL | Accepted |
| ADR-02 | Supabase Auth over homemade JWT | Accepted |
| ADR-03 | React + Vite + TypeScript web app | Accepted |
| ADR-04 | TanStack Table over paid AG Grid | Accepted |
| ADR-05 | Netlify + GitHub; auto-deploy OFF after first | Accepted |
| ADR-06 | Migrate real data via DB fork; don't touch prod | Accepted |
| ADR-07 | Keep old system running in parallel until cutover | Accepted |
| ADR-08 | Repair the existing React Native app, not rebuild | Accepted |
| ADR-09 | Ownership = `created_by`, company = `client_association` | Accepted |
| ADR-10 | Orchestrator + cheap sub-agents working model | Accepted |
