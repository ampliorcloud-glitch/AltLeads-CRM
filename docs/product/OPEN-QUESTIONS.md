# Open Questions — ambiguities & conflicts to resolve
*2026-06-19 · these are intersections/contradictions across what we've decided. Owner to decide; then fold answers into DECISIONS.md and remove here.*

---

## Q1 — What does "the team can't CREATE" actually cover? (outreach-only vs the exceptions)
**Conflict:** North-star = outreach team **updates only, never creates data**. But we've also said: Sales Head can **add Sales Persons**; Sales Head can **assign/reassign** leads; create rights are **grantable to Team Leads** per project; and the vendor sales app's one create flow was **Wishlist** (capture a prospect).
**Resolution needed:** define "no create" precisely. **Recommendation:** "no create" = **AGENT and SALES_PERSON cannot create the core data entities** (Company, Contact, Lead). The following are NOT "data creation" and stay allowed for the right role: **user provisioning** (Sales Head adds Sales Persons; Admin adds users), **lead assignment** (Sales Head), and **Wishlist capture** (a deliberate, separate "suggest a prospect" flow — decide: allow Sales/Agents to add Wishlist prospects at v1, yes/no?).
**Decide:** (a) Confirm the entity list agents/SPs can't create. (b) Wishlist capture allowed for sales at v1? 

## Q2 — Is the "Sales Portal" one thing, or two? (operational sales team vs the client's read-only view)
**Conflict:** You described two different client-facing needs: (1) the **sales team** (Sales Head/Person) who *do outreach* — see leads, record feedback; and (2) **"the client part where the client sees only what's scheduled/successful + a dashboard"** — a *read-only results view*. These are different audiences (a sales rep vs a client executive).
**Resolution needed:** Are Sales Head/Person the only client-side roles, or is there a separate **"Client Viewer/Exec"** role (read-only: scheduled/successful meetings + dashboard, no lead operations)?
**Recommendation:** Treat as **two surfaces in the sales portal**: the **operational** view (Sales Head/Person — leads + feedback) and a **read-only client dashboard** (a Client-Exec role, or the Sales Head's dashboard). **Decide:** is there a distinct read-only "Client" login separate from Sales Head/Person?

## Q3 — "Agents edit records ASSIGNED to them" — assigned by WHICH field? (the launch blocker)
**Conflict / gap:** For LEADS we have two owners — internal **`created_by`** (the lead-gen agent) and **`lead_report.user_id`** (the client salesperson). For **Contacts/Companies there is NO assignment field at all** today, and writes currently gate on `created_by` (which is NULL/wrong for migrated data). So "assigned to them" is undefined for contacts/companies.
**Resolution needed:** which field defines "this internal agent is assigned to this contact/company/lead" so they can update it?
**Recommendation:** add an explicit **`owner_user_id` (assignee)** on contact/company project-status (and use `created_by`→reassign or `lead_report.user_id` for leads), then bulk-set it for migrated rows from the real assignments. **This is the #1 launch blocker — needs a concrete answer before role-based editing works.**
**Decide:** how do we know which agent "owns" each migrated contact/company? (Is there a source list of who-works-what, or do we derive it from existing data?)

## Q4 — Masking: who can click-to-reveal, and who sees nothing? 
**Conflict:** ADR-22 says permitted viewers see **partial mask + click-to-reveal**; non-permitted see **hidden always**. But Contacts/Companies are **row-public** today (everyone sees the row; only phone/email columns are masked). So: can **any** logged-in user reveal **any** contact's number, or only the **owner + their manager + admin** (everyone else fully hidden)?
**Recommendation:** **Only owner + manager/Sales-Head + admin** get the partial-mask+reveal; **everyone else = fully hidden** (matches "all public contact details hidden always"). The reveal is a UI layer on values the DB already lets that user fetch.
**Decide:** confirm reveal is limited to owner+manager+admin (not every logged-in user). Also: exact **email mask pattern** (e.g. `ab••••@domain.com`?).

## Q5 — Notification recipients per event (internal agent vs client salesperson vs both)
**Conflict:** A lead has an internal agent (`created_by`) AND a client salesperson (`lead_report.user_id`). Today notifications go to "the salesperson (TODO)". With the sales portal live, who gets each email — meeting scheduled/rescheduled/cancelled, assignment, approval?
**Recommendation:** define per-event: e.g. **assignment → the assignee**; **meeting changes → the salesperson + the internal agent**; **approvals → the manager/agent**. **Decide:** the recipient matrix (I'll draft it for sign-off).

## Q6 — "Manual deploys during launch week" vs Hostinger auto-deploy-on-push
**Conflict:** We agreed **manual deploys**, but Hostinger **auto-deploys on every push to `main`**. So any push (even accidental) goes live. "Manual" today = we control *when we push*.
**Recommendation:** for true safety during launch week, **temporarily turn OFF Hostinger git auto-deploy** (deploy on demand) — or keep the discipline of "only push on owner go." **Decide:** turn auto-deploy off for launch week, or rely on push-discipline?

## Q7 — Email templates v2 (planned, ALT-175)
Not a conflict — a scope expansion. Current emails = improved copy + working buttons. **v2** = re-engineered per-event layouts + **attachments** (e.g. meeting-schedule **PDF report**). Plan: reuse the HTML→PDF (Playwright) method. **Decide later:** which events get a PDF, and what the PDF contains.

---
### Minor / lower-stakes
- "Senior viewer" sharing — who can grant it (only Sales Heads, or Admin too)? scope = team vs whole project?
- Do **internal** users actually need to log into `/sales` (they see leads internally anyway), or is `/sales` for sales users only?
- Mobile app — still in scope eventually (least priority), or dropped?
