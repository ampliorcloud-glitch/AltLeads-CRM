# DEC-03 — Lead Ownership Model: implementation plan (2026-06-28)

**Decision (Ankit, locked):** owner-of-record = the **assignee** `lead_report.user_id`. At CREATE it defaults to the **creator**. It changes ONLY when a TL/Admin reassigns. `created_by` = immutable provenance. This is the **#1 launch blocker**.

## Key finding (why it's a migration, not a one-line patch)
A code audit found the current state is inconsistent (census bug O1):
- `createLead` (LeadFormPage path) creates **only a `lead_master` row — NO `lead_report` row**. So form-created leads have **no assignee** under the new model.
- The app currently resolves a lead's owner from **`created_by`** in places (list/detail), and the **Edit-Lead form's Agent dropdown reassigns by rewriting `created_by`** (`leadsApi.updateLead`).
- Meanwhile the dedicated **ReassignModal** (`assignment.ts reassignLead`) writes **`lead_report.user_id`** — the column the bulk-migrated data actually uses.
- The only place that seeds a `lead_report.user_id` at creation today is `wishlist.convertWishlistToLead` (`user_id = agentId ?? actor`).
→ Two competing owner columns + a create path that seeds neither = the bug. A partial patch (e.g. just stopping the `created_by` rewrite) would REGRESS edit-form reassign and leave the read path inconsistent. Must be done as one coherent expand-contract change.

## Coherent build steps (expand-contract; ship behind a flag, validate RLS on a throwaway login)
1. **Seed assignee on create** — `createLead` inserts a `lead_report` row with `user_id = creator` (+ the row's other required cols — mirror `convertWishlistToLead`'s insert shape). Form-created leads now have an assignee.
2. **Single owner resolution** — make `realLeads.ts` + list/detail owner display resolve owner from **`lead_report.user_id`** (not `created_by`). Keep `created_by` shown as "created by / source" provenance only.
3. **Edit-Lead form** — STOP rewriting `created_by` (immutable). The Agent field becomes read-only provenance OR routes through the proper reassign writer (`lead_report.user_id`); routine edits never change ownership. Reassignment = the ReassignModal (TL/Admin), which already writes `lead_report.user_id`.
4. **Backfill** — staged migration: every lead with no active `lead_report` row gets one with `user_id = created_by`; (optionally) reconcile any divergence so every lead has exactly one operative assignee.
5. **RLS (ALT-152)** — agents may UPDATE leads where `assigned_to('lead', id) = current_user_id()` (resolves `lead_report.user_id`). **Validate on a throwaway non-admin login before prod** (the #5 step Ankit OK'd me to do myself).

## Order / safety
Steps 1–3 are app-code (reviewable, build-gated). Step 4 is a staged migration (not auto-run). Step 5 is the RLS flip — validated on a throwaway login, then applied. Ship 1–3 behind a feature flag if needed so display + write flip together (no half-migrated read/write mismatch). Nothing destructive without owner sign-off; dual-write/backfill, never cut-over-in-place.

## Tickets
ALT-433 (this) · ALT-152 (assignment RLS) · ALT-411 (audit-cols FK) related.
