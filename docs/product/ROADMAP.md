# Amplior CRM Rebuild — Roadmap

> **Purpose:** A simple, phase-by-phase timeline of the whole rebuild — what each phase delivers, where we are today, and what's left. Written for the business owner; no technical background needed.
>
> *Last updated 2026-06-13.*

---

## The 60-second summary

We are rebuilding the old Amplior/Altleads CRM (built badly by an outside vendor) into a clean, modern system that you can manage yourself. The work is split into **8 phases (0 to 7)**. The hardest phases were front-loaded on purpose, because the fast Fable AI model is only available until **22 June 2026**.

**Where we are right now:** the foundation is done and the real data is already live in the new system. We are in the middle of **Phase 3 (building the web app)** — the core modules are built and you are reviewing/refining them. After that comes the security-and-deploy step, then mobile, then a side-by-side trial run before we switch over for good.

**Build pace / AI model note:**
- **Until 22 June 2026** — the fast *Fable* model is available, so all the heavy lifting (data migration, core web build, mobile rewiring) is being pushed to finish inside this window.
- **After 22 June 2026** — *Opus 4.8* handles the hard parts, *Sonnet 4.6* is the everyday workhorse. The remaining phases (mobile polish, parallel-run, cutover) are mostly your testing time and need very little AI.

---

## Timeline view (Gantt-ish)

Each block is a phase. `███` = done, `▓▓▓` = in progress (where we are now), `░░░` = not started yet. The dashed line marks the **22 June Fable deadline**.

```
                         FABLE WINDOW (fast model)        │  OPUS / SONNET
                         ──────── to 22 Jun ───────────── │ ───────────────►
 Phase 0  Accounts & access    ████████████▓                │
 Phase 1  Cleanup              ████                         │
 Phase 2  Supabase + data      ░░░███████▓                  │   (RLS security left)
 Phase 3  Web core         ◄── YOU ARE HERE ─►  ▓▓▓▓▓▓▓▓▓▓  │
 Phase 4  Admin panel                    ▓▓▓▓▓▓             │   (mostly built in P3)
 Phase 5  Netlify deploy                          ░░░       │
 Phase 6  Mobile repair                           ░░░░░░░░  │░░░░░░░░
 Phase 7  Parallel-run & cutover                           │░░░░░░░░░░░░░░░░░░►
                                                            │
                                            22 Jun ─────────┘
```

> **Reading it:** Phases 1 and 2's data work are finished. Phase 3 is the active phase. Phases 4 and 5 are next and small. Phase 6 (mobile) and Phase 7 (trial + switchover) extend past the Fable deadline and run on Opus/Sonnet — that's fine, because they're light on AI and heavy on your real-world testing.

---

## Phase-by-phase detail

### Phase 0 — Accounts & access
*The keys and logins we need before any building can happen.*

| | |
|---|---|
| **Goal** | Have all the accounts and access tokens in hand: GitHub (code), Supabase (database), Netlify (hosting), DigitalOcean (old system). |
| **Key deliverables** | GitHub repo connected · Supabase + Netlify access tokens received & verified · DigitalOcean access for the data pull. |
| **Status** | ✅ **Mostly done** — GitHub, Supabase (org "AltLeads"), Netlify, and DigitalOcean access are all in hand and verified. Remaining items are tied to later phases: Apple Developer + Google Play access and the Android signing key for Phase 6 mobile. |

### Phase 1 — Cleanup
*Tidy up the messy vendor codebase so we build on a clean floor.*

| | |
|---|---|
| **Goal** | Archive the old vendor code as read-only reference, organise documents, lock away secrets, start from a clean commit. |
| **Key deliverables** | Old code moved to `old-code/` · docs to `docs/` · secrets to a private `.credentials/` vault · clean starting commit. |
| **Status** | ✅ **Done** (2026-06-11). Bonus finding: the leaked database password belonged to an old throwaway copy that no longer exists, so no emergency password change was needed — the live system was never at risk. |

### Phase 2 — Supabase migration (database + real data)
*Move the real production data into the new database, safely, without touching the live system.*

| | |
|---|---|
| **Goal** | Stand up the new Supabase database and copy across all the real data, with the numbers checked to prove nothing was lost. |
| **Key deliverables** | New Supabase database built · **all real data copied (65 tables, ~108,000 rows)** · every table's row count matched against the original ✓ · the new web app already showing real leads, meetings and wishlist. |
| **Status** | ✅ **Data done** (2026-06-12) — and the live system was never touched: we copied from a temporary fork, verified, then can delete it. **One important item still open:** the database access-permission rules ("who can see what") are not yet switched on. This is a hard requirement before the site can go live (see the Phase 5 gate below). |

### Phase 3 — Web core  ◄── **CURRENT PHASE**
*Build the actual web application: the screens your team uses every day.*

| | |
|---|---|
| **Goal** | A working web CRM with login and all the core modules running on real data: Dashboard, Leads (with the Activity / Lead-Report / Meeting workspace tabs), Meetings, Wishlist, Notifications, Settings — plus the filters and Excel exports the vendor charged ₹96k for. |
| **Key deliverables** | Secure login (Supabase Auth) ✅ · Leads module with list, filters, Excel export, detail page, add/edit ✅ · Meetings, Wishlist, Notifications, Settings built on real data ✅ · the 7+7 filters and Excel exports built in as standard ✅ · the HubSpot-style Lead workspace (header + info panel + 3 tabs where agents fill in info) — in progress. |
| **Status** | ▓ **In progress.** Login works and is verified. The core modules are built on real data and wired together. You have started reviewing them. Refinements underway from your feedback (the data-accuracy and pagination fixes are in; lead editing fixed). Next: finish the detailed Lead workspace, then a design-match pass against the Figma mockups. |

### Phase 4 — Admin panel
*The control room: manage users, roles, projects, clients.*

| | |
|---|---|
| **Goal** | An admin area (visible only to ADMIN users) to manage users, roles, projects, clients, designations and access. |
| **Key deliverables** | Users / Projects / Clients / Reference-data tabs with real editing · ADMIN-only access. |
| **Status** | ▓ **Largely built already** as part of the Phase 3 work (Admin tabs exist with real edits, gated to ADMIN). Remaining: polish and confirm role/access management once the security rules (Phase 2/5) are switched on. |

### Phase 5 — Netlify deploy
*Put the web app on the internet so the team can reach it.*

| | |
|---|---|
| **Goal** | Publish the web app to a live web address, with auto-deploy from GitHub for the first push (then switched to manual deploys, per your instruction). |
| **Key deliverables** | Live site on Netlify · GitHub auto-deploy for the first publish, then **auto-deploy turned off** — future deploys are manual, done by you, one click. |
| **Status** | ⛔ **Not started — and gated.** **Hard gate: the database access-permission rules (RLS) from Phase 2 MUST be switched on before anything goes live.** Today the new app is local-only (on the build PC), so this is safe; it must not reach the internet until those rules are on. The first deploy happens only after you explicitly say "go." |

### Phase 6 — Mobile repair
*Fix and reconnect the existing phone app to the new system.*

| | |
|---|---|
| **Goal** | Repair the existing React Native mobile app, point it at the new Supabase backend, and get it building for both Android and iPhone. |
| **Key deliverables** | Recreate the two missing files the vendor withheld · rewire the app to the new backend · Android signing sorted · iPhone build via a cloud Mac (since you're on Windows). |
| **Status** | ⛔ **Not started.** Watch-items: the vendor may withhold the Android signing key and Apple/Play access over the unpaid final invoice — we have a fallback recovery route through Google/Apple support. iPhone builds need a Mac, which you can borrow or run in the cloud. |

### Phase 7 — Parallel-run & cutover
*Run new and old side by side, prove it works, then switch over for good.*

| | |
|---|---|
| **Goal** | Run the new system alongside the old one so the team can trust it, fix anything that surfaces, then switch fully to the new system and retire the old DigitalOcean servers. |
| **Key deliverables** | 1–2 weeks of real-world team testing on the new system while the old one still runs · issues fixed · final go-live (cutover) · old MySQL + droplet retired · old database firewall pruned. |
| **Status** | ⛔ **Not started.** This is mostly **your team's testing time** — very little AI work. The old system keeps running untouched until you're confident, so there's no risk during the trial. |

---

## Milestones

The big checkpoints, in order. ✓ = reached.

- ✅ **Rebuild approved & stack locked** — Supabase + React/Vite/Netlify + repaired mobile app (2026-06-11).
- ✅ **Old code cleaned & archived** — clean starting point (2026-06-11).
- ✅ **Real data live in the new database** — 65 tables, ~108,000 rows, every row count matched, live system never touched (2026-06-12).
- ✅ **Secure login working** — team members log in via Supabase Auth, with their real roles (2026-06-12).
- ✅ **Core web modules built on real data** — Dashboard, Leads, Meetings, Wishlist, Notifications, Admin, Settings (2026-06-12).
- 🟡 **Web app reviewed & refined** — *in progress now* (your review + the Lead workspace + design-match pass).
- ⬜ **Security rules switched on (RLS)** — the must-do gate before going live.
- ⬜ **First Netlify deploy** — web app reachable on the internet (only on your "go").
- ⬜ **Mobile app reconnected & building** — Android + iPhone.
- ⬜ **Parallel run starts** — team tries the new system alongside the old.
- ⬜ **Go-live / cutover** — switch fully to the new system.
- ⬜ **Old DigitalOcean retired** — last step; final cost savings realised.

---

## Where we are, in one line

> **We have a working web CRM running on your real data, currently under your review. The next gate is switching on the security rules, then the first live deploy.** Heavy AI build is being finished inside the Fable window (to 22 June); after that, Opus/Sonnet handle the lighter remaining work (mobile, trial run, cutover).

---

*Note on dates: this roadmap shows status and sequence, not fixed calendar dates. The only hard date is the 22 June 2026 Fable model deadline. Remaining time estimates (rough, AI build time only): Phase 3 finish ~ a few more hours, Phase 4 ~4–6h, Phase 5 ~1h, Phase 6 ~6–10h, Phase 7 ~1–2 weeks of your testing. TBD — confirm calendar dates with owner.*
