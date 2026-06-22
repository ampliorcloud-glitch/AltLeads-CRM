# Ambiguous / Confusing Decisions — the conflict list

> **For Ankit + Mohit.** These are the undefined or contradictory decisions surfaced by the 2026-06-22 persona audit (4 parallel research agents) plus earlier work. Each will cause a conflict or rework if left unresolved. Format: the question → where it bites today → options → **my recommendation**. Resolve the **🔴 launch-blocking** ones before the team gets live data.
>
> Decide in this doc (write your pick next to each), and I'll fold the answers into `DECISIONS.md` as ADRs and into the build.

---

## A. Access & hierarchy (the biggest cluster — these gate the launch)

**A1. 🔴 What does a TEAM LEAD / SALES HEAD see and control outside their own people?**
Today: nothing is team-scoped — `canReassign` is a flat boolean, the reassign target list is unscoped (`fetchAssignableUsers(null)`), the Approvals queue is org-wide, and a Sales Person on `/sales` would see *every* lead (no `lead_report.user_id` scoping). There is no "who reports to whom" link in the DB yet.
- Options: (a) **downline-scoped** via a `manager_id` / `sales_head_user_id` reporting line (managers see + act on their people only); (b) project-scoped (you see everyone on your projects); (c) stay org-wide (then "Team Lead/Sales Head" ≈ admin-lite).
- **Recommend (a)** — it's the standard CRM model and what SALES-PORTAL.md already assumes. This single decision unblocks team reassign, team dashboards, scoped approvals, and the whole sales portal. (Tickets ALT-167, ALT-301; RLS ALT-152.)

**A2. 🔴 Who may reassign / change owner, and across what boundary?**
Today: Admin + any Team Lead + any Sales Head can reassign *anything* (UI-gated; RLS not yet applied). You already confirmed "upline can edit + reassign their people."
- Options: (a) admin anywhere + manager **within their downline only**; (b) any manager anywhere; (c) admin-only cross-team, managers within-team.
- **Recommend (a)** — pairs with A1. Enforced in the staged RLS (`apply-assignment-rls.cjs`) once the downline link exists.

**A3. Is "create data" truly admin-only — forever, and for Team Leads too?**
Today: `canCreateData = isAdmin` (hardcoded); the code itself notes the per-role create setting (ALT-174) isn't built. Outreach-only north-star says the team updates, doesn't create.
- Options: (a) admin-only (current); (b) admin + Team Lead (one-off creates); (c) per-project/per-role configurable (ALT-174).
- **Recommend (a) now, (c) later** via the project access modes (ALT-295).

**A4. The per-project access modes (ALT-295) — confirm the 4 modes + who sets them.**
You specced: Owner-scoped / Public-Edit / Public-View-only / Public-Limited-view (sensitive fields masked). Open: (i) who can set a project's mode — admin-only, or also that project's TL/Sales Head? (ii) does "Limited view" hide exactly contact email+phone, or a broader list?
- **Recommend:** admin sets it (managers request); "Limited view" masks contact email + phone + any field flagged sensitive, shows status/designation/linkedin/company. Lock the sensitive-field list in DECISIONS.

**A5. Should the Approvals queue be team-scoped?**
Today every Team Lead sees every pending report org-wide.
- **Recommend:** downline-scoped (follows A1); admin sees all.

---

## B. Roles' purpose & defaults

**B1. 🔴 What does QC (role 6) actually DO?**
Today: QC is a label with no screen, no route, and is excluded from the only review queue (Approvals). A QC login has nothing to do.
- Options: (a) QC = a 2nd approver on lead reports alongside TL/Admin; (b) QC = call/disposition **quality auditor** with a sampling queue + scorecard; (c) both.
- **Recommend:** decide before issuing any QC login. Likely (a) for launch, (b) later. (ALT-304.)

**B2. 🔴 Should lists default to "my assigned records" for agents — and keyed on which field?**
Today: lists return everything; the "Agent" facet keys off `created_by` (internal owner) while the real assignment is `lead_report.user_id`. So an agent can't easily see their own book, and the facet can be wrong.
- **Recommend:** a "Mine" default (ON for agents) scoping by `lead_report.user_id`; pick that as the canonical assignment field for display everywhere. (ALT-305.)

---

## C. Calls & dispositions

**C1. 🔴 What is the CANONICAL disposition vocabulary, and which is the ONE call logger?**
Today: two live loggers with **different** vocabularies on the same Contact page — `LogCallModal`→`call_log` (UPPER enum: CONNECTED, CALLBACK_REQUESTED, LEFT_VOICEMAIL…) and `DispositionForm`→interactions (lowercase: connected, call_back, switched_off…). They write different tables/histories.
- Options: (a) standardize on the `call_log` enum, migrate the dropdown; (b) drive `call_log` from an **admin-editable** `dropdown_option` list (one source, tunable).
- **Recommend (b)** — matches the "admin maintains data" posture; retire the second logger. (ALT-303.)

---

## D. Meetings & feedback

**D1. Can an agent self-schedule a meeting, or is TL/Admin approval always required?**
Today: booking needs ~10 fields + a TL/Admin approval round-trip; the report locks Pending. Intentional per DECISIONS, but it's heavy at call volume.
- **Recommend:** keep approval for the qualified pipeline; add a lightweight "log a quick/confirmed meeting" path for simple cases. Confirm.

**D2. 🔴 Which feedback model wins — and is feedback editable after submit?**
Today: the spec wants server-driven `feedback_question_master` Yes/No + Successful/Reschedule/Cancel; the Client Portal already ships a *different* free-text-remark + 3-option model; the Sales Portal feedback page is a "Coming soon" stub. Edit-after-submit is specced "locked" but the client form silently resets with no lock/read-back.
- **Recommend:** ONE structured feedback model everywhere (it powers the HubSpot monthly remarks report); after submit show it read-only; edits by owner until the meeting closes, then locked. (ALT-168, ALT-311.)

**D3. One meeting-record component or two?**
Today: `MobileMeetingRecord` (mobile-ditto, sales) vs `PortalMeetingDetailPage` (flat grid, client) — two implementations of the same screen, drifting. ALT-275 says the mobile-ditto view is *the* record for both.
- **Recommend:** render one `MobileMeetingRecord` for both (client fed by snapshot data). (ALT-311.)

**D4. What does the CLIENT see — all meetings, or only some statuses? Recordings ever?**
Today: client meeting list shows all statuses; recordings are gated to internal + Sales Head ("a future client does not").
- **Recommend:** client sees all their meetings (with a status filter) but **never** call recordings / internal images. Confirm whether cancelled/dropped are hidden.

**D5. Once the mobile app is retired, what is the source of truth for the record layout?**
SALES-PORTAL.md names the archived `old-code` mobile screen as authoritative.
- **Recommend:** make `MobileMeetingRecord.tsx` the canonical spec after retirement, so future changes don't require diffing dead code.

---

## E. Data display

**E1. Should inline status edit require a selected project?**
Today: Contacts inline status edit is disabled unless a project is selected ("Select a project first") — agents on a single project hit this constantly.
- **Recommend:** auto-resolve when a record has exactly one project; only require a pick when genuinely ambiguous.

**E2. Is "due today" tasks-only, or tasks + meetings + stale leads?**
Drives whether we build one unified queue (ALT-306) or keep three screens.
- **Recommend:** unified (tasks due + today's meetings + untouched assigned leads).

---

## F. Design system (resolve once to stop visual drift)

**F1. Canonical authoring mode: Tailwind vs inline-style vs CSS-var?** All three coexist today. **Recommend:** Tailwind utilities mapped to the existing tokens; inline allowed only with `var(--*)`, never raw hex. (ALT-314.)

**F2. One Button component or many?** Three primitive sets + inline buttons today. **Recommend:** one `ui/Button` with variants; ban raw `<button style>`. (ALT-315.)

**F3. Who owns the status-color map?** Defined 3× (badges, status badges, charts) with different colors. **Recommend:** one `statusColor(category,value)` seeded from `dropdown_option`, used by badges AND charts. (ALT-321.)

**F4. Row density & table engine standard?** Heights vary 40–48px; Contacts uses a different engine. **Recommend:** one density token + one shared `DataTable` (TanStack) for all lists. (ALT-316.)

**F5. Hover/focus: JS or CSS?** 42 files mutate styles on mouse events. **Recommend:** standardize on CSS `:hover` + the existing `:focus-visible`. (ALT-322.)

**F6. Empty-state philosophy + role-aware copy?** **Recommend:** illustrated icon + CTA, role-aware ("ask admin to import" vs "no records assigned to you"). (ALT-320.)

---

_Created 2026-06-22 from the persona audit. Full findings: `PERSONA-AUDIT-2026-06.md`. Resolve the 🔴 items first — they gate the internal launch._
