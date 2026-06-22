# Precise CRM-side requests for the Chrome-extension rebuild

> **For: the CRM-side Opus** (works in `new-code/web`, `new-code/notify-service`, `new-code/migration`).
> **From: the extension-side Opus.** These are the exact, **non-breaking** changes the two extensions need.
> **Owner posture: manual deploy.** Apply nothing to production until Mohit says so. Everything below is written to be **idempotent, transaction-wrapped, and reversible.**
>
> ⚠️ **Before applying anything:** the column/function names below come from code + migration analysis (see [01-CURRENT-STATE-ANALYSIS](./01-CURRENT-STATE-ANALYSIS.md) and [CRM-HANDOFF-FOR-CRM-OPUS](./CRM-HANDOFF-FOR-CRM-OPUS.md)). **Verify each against the live schema first** (a one-line `\d contact_master` etc.). If a name differs, adjust — do not force.

---

## REQUEST 1 — Lowercase fix for LinkedIn matching (ALT-287) · **low risk, do first**

**Why:** the extension matches a LinkedIn profile by `linkedin_clean` using an **exact `=`**. The migration stored `linkedin_clean = lower(...)`, but the web app's `deriveLinkedinClean()` (in `new-code/web/src/data/contacts.ts`, ~lines 47-54) does **not** lowercase. So any contact whose `linkedin_clean` was written by the app with mixed case will **silently never match**. Fix both sides.

**1a. App code change** (`src/data/contacts.ts`) — make `deriveLinkedinClean()` produce the canonical slug:
```
input → trim → lowercase
      → strip leading "https://" or "http://"
      → strip leading "www."
      → strip leading "linkedin.com/in/"
      → cut at the first "?" or "#" (drop query/fragment)
      → split on "/" and keep ONLY the first segment   // .../in/john-doe/details → john-doe
      → strip any trailing "/"
```
Result must equal what `find_contact_dup` compares against. (The extension will use this **exact** algorithm too.)

**1b. One-time data backfill** — idempotent, only touches rows that differ:
```sql
BEGIN;
-- preview first (should be the count you expect to change):
SELECT count(*) FROM public.contact_master
 WHERE linkedin_clean IS NOT NULL AND linkedin_clean <> lower(linkedin_clean);
-- apply:
UPDATE public.contact_master
   SET linkedin_clean = lower(linkedin_clean)
 WHERE linkedin_clean IS NOT NULL AND linkedin_clean <> lower(linkedin_clean);
COMMIT;
```
**Acceptance:** re-running the preview returns 0. **Rollback:** none needed (lowercasing is safe + idempotent); if paranoid, snapshot `contact_id, linkedin_clean` before.

---

## REQUEST 2 — `find_contact_for_panel` RPC (ALT-282) · **the non-owned card**

**Why:** `find_contact_dup` only returns `contact_id, full_name, company_id, company_name`. The non-owned panel card must also show **company status (incl. DNC), last activity date, and owner name** — without leaking PII (email/phone/linkedin) to a non-owner. Because this is `SECURITY DEFINER`, **the function itself must enforce masking.**

**Signature & behaviour (adjust column names to live schema):**
```
find_contact_for_panel(p_linkedin text, p_project_id bigint)
  RETURNS one row:
    contact_id        bigint
    full_name         text
    company_id        bigint
    company_name      text
    company_status    text   -- company_project_status.account_status for (company_id, p_project_id)
    contact_status    text   -- contact_project_status.contact_status for (contact_id, p_project_id); 'do_not_contact' = DNC
    last_activity_at  timestamptz  -- max(occurred_at) from interaction where record_type='contact' and record_id=contact_id
    owner_user_id     text   -- contact_master.created_by (the numeric user_id-as-text)
    owner_name        text   -- resolve owner_user_id -> user_master/profiles display name
    can_view_details  boolean -- = can_see_contact_details(created_by) for the CALLING user (auth.uid())
    email             text   -- ONLY if can_view_details, else NULL
    mobile_no         text   -- ONLY if can_view_details, else NULL
    linkedin_url      text   -- ONLY if can_view_details, else NULL
```
**Match clause:** `WHERE cm.linkedin_clean = p_linkedin AND cm.deleted_date IS NULL AND cm.is_demo = false`.
**Security:** `SECURITY DEFINER`, `STABLE`; `GRANT EXECUTE ... TO authenticated` only. Inside, compute `can_view_details` via the existing `can_see_contact_details(created_by)` helper and **NULL the three PII columns** when false. **Do not** return PII any other way.

**Acceptance (must test before granting broadly):**
- As the **owner** of a contact → full row incl. email/phone/linkedin.
- As a **non-owner authenticated** user → name, company, company_status, contact_status, last_activity_at, owner_name present; **email/mobile/linkedin = NULL**; `can_view_details=false`.
- As **anon** → no execute.

**Rollback:** `DROP FUNCTION find_contact_for_panel(text, bigint);` (additive — nothing else depends on it).

---

## REQUEST 3 — `contact_research_request` table (Extension 2 fulfillment queue) · **new, additive**

**Why:** Extension 2 (Data Research) is the research team's queue: *who requested, when, the target person/company, what fields are needed, status*. The old system used a Firestore `contactRequests` collection — we recreate a minimal Supabase table. **Verify nothing similarly-named already exists** before creating.

**Proposed DDL (idempotent):**
```sql
CREATE TABLE IF NOT EXISTS public.contact_research_request (
  request_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id     bigint REFERENCES public.contact_master(contact_id),  -- nullable: may be a brand-new person
  company_id     bigint REFERENCES public.company_master(company_id),  -- nullable
  linkedin_url   text,
  linkedin_clean text,                 -- normalized slug (same algorithm as Request 1)
  project_id     bigint,
  fields_needed  text,                 -- e.g. 'email,mobile,designation'
  status         text NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | not_found
  notes          text,
  requested_by   text,                 -- numeric user_id-as-text of the requester
  requested_at   timestamptz NOT NULL DEFAULT now(),
  fulfilled_by   text,
  fulfilled_at   timestamptz,
  created_by     text,
  created_date   timestamptz DEFAULT now(),
  updated_by     text,
  updated_date   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_crr_status         ON public.contact_research_request(status);
CREATE INDEX IF NOT EXISTS idx_crr_linkedin_clean ON public.contact_research_request(linkedin_clean);
CREATE INDEX IF NOT EXISTS idx_crr_project        ON public.contact_research_request(project_id);
```
**RLS:** enable RLS; the research team needs to **see all open requests** and **update status + fill the linked contact**. Pair this with the role decision in Request 5. Suggested (pending role decision): SELECT/UPDATE for users in the research role (or admin); INSERT for anyone authenticated (so an agent can raise a request).
**Acceptance:** a research user can list pending requests and mark one done; an outreach agent can insert a request. **Rollback:** `DROP TABLE public.contact_research_request;` (additive).

> Note: "is the info already there to edit?" is **computed by the extension** at open time (it reads the contact's current `email`/`mobile_no`/`linkedin_url` and shows what's filled vs. missing) — no extra column needed.

---

## REQUEST 4 — Test logins for Mohit to verify (provisioned by you, returned to Mohit)

Mohit will test with the **admin** account `mohit@amplior.com` (sees everything). To verify **masking** (non-owner sees name+company only) and **Extension 2**, please provision:

1. **Test AGENT (non-admin), Extension 1:** create via the existing `POST /api/users/create` (ALT-059) — e.g. `test.agent@amplior.com`, role **AGENT**. Then **set ownership** so it owns **≥2 contacts that have a non-null `linkedin_url`/`linkedin_clean`** (set those contacts' `created_by` to this user's `user_id`), and confirm **≥1 other contact with a `linkedin_url` is NOT owned by it**. Return the temp password to Mohit + list the 3 LinkedIn URLs to open while testing (2 owned → should show full detail; 1 not-owned → should show the masked card).
2. **Test RESEARCH user, Extension 2:** e.g. `test.research@amplior.com`, separate password, in whatever role the Request-5 decision lands on. Return the temp password to Mohit.

**Safety:** these are real prod auth users — create them clearly labelled as test accounts; they can be disabled after verification.

---

## REQUEST 5 — DECISION NEEDED (for the owner): research-team role

Extension 2's users are the research/back-office team, distinct from outreach agents. Pick one:
- **(a) Add a `RESEARCH` role** (`role_master` id 7) with RLS granting it read of the research queue + write to fill contacts it's working. Cleanest long-term.
- **(b) No new role** — designate specific existing users (e.g. a flag or a fixed allow-list) for research access.

This also intersects **ALT-152**: filling a contact's missing fields is a **write**, so research users hit the same `created_by` owner-only write gate. The role/RLS for research must allow them to **update contacts they're fulfilling** (likely: research role can update `contact_master` PII columns regardless of owner, scoped to project). Flag this with ALT-152's assignment-write fix so they're solved together.

---

## Summary checklist for the CRM Opus
- [ ] R1a: patch `deriveLinkedinClean()` (lowercase + query/fragment + first-segment). 
- [ ] R1b: run the idempotent lowercase backfill (preview → apply → preview=0).
- [ ] R2: create `find_contact_for_panel` RPC; **test masking with a non-owner login before granting**.
- [ ] R3: create `contact_research_request` (after checking none exists) + RLS.
- [ ] R4: provision + return the 2 test logins (+ the 3 test LinkedIn URLs).
- [ ] R5: get the owner's research-role decision; wire RLS accordingly (with ALT-152).

Nothing here deletes or alters existing data except the safe lowercasing in R1b. Apply in a transaction; keep the previews.
