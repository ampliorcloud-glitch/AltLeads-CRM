# AltLeads Data Research Extension

The research / back-office team's Chrome side-panel tool.  Separate from the outreach `contact-viewer` — different logins, different purpose.

## What it does

**Queue view** (default)
- Lists open `contact_research_request` rows (pending + in_progress), newest first.
- Each row shows: requester name, when requested, target (LinkedIn slug / contact name), fields needed, status.
- Click any row to open the **detail view**.

**Detail view** (per request)
- Shows request metadata (who asked, when, what fields are needed).
- Loads the linked contact's CURRENT data from `contact_master_masked` and answers **"is the info already there?"** — each of `email`, `mobile_no`, `linkedin_url`, `designation` is clearly shown as FILLED or MISSING.
- Edit form for the missing fields.
- **Save & mark done** — writes filled values to `contact_master` (re-derives `linkedin_clean` from the LinkedIn URL) and stamps the request as `done` with `fulfilled_by` + `fulfilled_at`.
- **Mark not found** — stamps the request `not_found`.
- 42501 (permission denied) errors show a friendly "ALT-152 not yet unlocked" message; never crash.

**Profile banner** (when active tab is a LinkedIn `/in/` URL)
- The background service worker detects the URL (via `chrome.tabs.onUpdated` / `onActivated` — NO page injection).
- The panel shows a banner with the normalized slug, the matching CRM contact (if any), and a "+ Raise request" button if no open request exists for that slug.

**Raise request**
- Form to insert a new `contact_research_request` row with a LinkedIn URL, fields needed, and notes.
- Gracefully handles the table not existing yet (ALT-282 R3).

---

## How to load in Chrome

1. Run `npm install && npm run build` from **this folder** (`new-code/extensions/data-research/`).
2. Open `chrome://extensions/` → enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select the `dist/` folder inside this directory.
4. Click the AltLeads Research toolbar icon → side panel opens.
5. Sign in with a research-team CRM account.

---

## Environment setup

`.env` in this folder already contains the live Supabase URL and public anon key (copied from `new-code/web/.env.local`).  The anon key is safe to ship — it is already in the web bundle.  **Never** put the service-role key here.

If you need to update the keys:
```
VITE_SUPABASE_URL=https://puvozfhypqbwbmbhrhcr.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from new-code/web/.env.local>
```
Rebuild after any `.env` change.

---

## Build

```bash
cd new-code/extensions/data-research
npm install          # first time only
npm run build        # outputs dist/  (the loadable extension)
npm run dev          # watch mode (rebuilds on file change)
npm run typecheck    # type-check only (expected to warn about @supabase — see below)
```

Same Vite 5 manual multi-entry pattern as `contact-viewer/`.  No `@crxjs`.  See `vite.config.ts` and `new-code/extensions/BUILD-CONVENTIONS.md`.

**TypeScript note:** `npm run typecheck` reports one expected error:
> `Cannot find module '@supabase/supabase-js'` in `shared/supabaseClient.ts`

This is a known limitation: `tsc` cannot resolve `@supabase/supabase-js` when the importing file lives in `../shared/` (outside this extension's `node_modules`).  Vite handles it correctly via `resolve.dedupe`.  The build is fully green; the typecheck error is cosmetic.

---

## Hard compliance rules (non-negotiable)

- **NO content scripts.  NO page injection.  NO DOM reading.**  The only LinkedIn input is the active tab's URL, read off-page in the background service worker via `chrome.tabs.onUpdated` / `onActivated`.
- **NO `linkedin.com` host permission** requested.
- **NO service-role key** — anon key + user JWT + RLS only.
- Permissions: `["sidePanel", "tabs", "storage"]`.  Host permission: Supabase URL only.
- All UI renders in a Chrome MV3 `side_panel`.

---

## Known TODOs / CRM dependencies

- **`contact_research_request` table (ALT-282 R3):** The queue, save, raise-request, and not-found actions all require this table on the CRM. Until deployed, these show a friendly "backend not ready" message.  No crash.
- **Research role + RLS (REQUEST 5 / DECISIONS.md):** The owner must decide whether research users get a new `RESEARCH` role (role_master id 7) or another mechanism.  Until the role and RLS land, writes to `contact_research_request` and `contact_master` may return 42501 — shown as a friendly permission error.
- **Write path (ALT-152):** Filling contact fields (`email`, `mobile_no`, `linkedin_url`, `designation`) on `contact_master` requires writing through RLS.  Until the assignment-based write model (ADR-21 / ALT-152) is applied and the research role's write gate is aligned, saves to `contact_master` surface a 42501 error.  Marking a request `done`/`not_found` on `contact_research_request` itself does NOT require ALT-152.
- **`find_contact_for_panel` RPC (ALT-282):** The profile banner uses `find_contact_dup` (which exists today).  The richer panel RPC is not needed by this extension.
- **Icons:** Add `icons/icon16/32/48/128.png` before Chrome Web Store submission.
- **Requester name resolution:** `resolveUserName()` queries `profiles` by `user_id`.  If the profile row is not accessible (RLS), it falls back to "User {id}".
