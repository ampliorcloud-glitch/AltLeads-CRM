# AltLeads CRM — Operating Guide (read this first, every session)

> This file auto-loads into every chat. It tells any new Claude how to pick up where the last one left off, and the standards to follow. **Owner: Mohit (non-technical).** Keep it current.

## 0. Resume protocol (do this at the start of every session)
1. Read **`REBUILD_LOG.md`** (repo root) — the running state / source of truth. Newest entries are at the bottom of the Session Log.
2. Skim **`docs/product/VISION.md`** (north-star) + **`docs/product/INTERNAL-LAUNCH-PLAN.md`** (where we are → launch) + **`docs/product/SALES-PORTAL.md`** (priority #2).
3. Open the backlog: **`docs/AltLeads-Backlog-Tracker.xlsx`** (Jira-style; regenerate with `node new-code/web/scripts/gen-backlog-tracker.cjs`).
4. **Recover past asks** — regenerate the chat archive (`node new-code/web/scripts/gen-conversation-log.cjs`) and read/grep **`docs/CONVERSATION-LOG.md`** whenever Ankit references something he asked "before"/"earlier"/"yesterday". It holds every message + reply across all sessions (gitignored, local-only — contains pasted secrets). Don't rely only on the compaction summary.
5. Then continue the work. Don't re-derive decisions already in `docs/product/DECISIONS.md`.

## 1. What this is
Our own outreach CRM (TypeScript + React/Vite + Supabase), replacing a vendor's Java/MySQL system. **Live at `crm.altleads.com`** (one combined Node app: web build + email/notify + admin API, on Hostinger, git auto-deploy from the `AltLeads-CRM` repo). North-star: an **ecosystem** (CRM web + Chrome extension + mobile) that captures everything and powers an AI "superpower" (see VISION.md).

## 2. The non-negotiable standards (how we work here)
- **Capture every new requirement/decision IMMEDIATELY** in: `REBUILD_LOG.md` (always) + the right `docs/product/` doc (PRD / VISION / DECISIONS / SALES-PORTAL / ACCESS-CONTROL-MODEL / UX-REDESIGN / BULK-IMPORT-EXPORT) + the **backlog tracker** (add an ALT-### ticket, re-run the generator). Owner treats docs as the durable memory across chats — if it's only in chat, it's lost.
- **Deploys are MANUAL (launch posture).** Commit locally; **push to `main` only when the owner says "push"** (push auto-deploys to production). Push command: `git push altleads clean-main:main` (local branch is `clean-main`, remote is `main`).
- **Outreach-only north-star:** the team UPDATES records (call/email outcomes, status, notes, feedback); they do **not** create data. Hide "create" from outreach roles; admin maintains data in bulk.
- **Orchestrator pattern:** main chat plans/decides; delegate heavy/bulk work to sub-agents (Agent tool). Explain everything in plain language (owner is non-technical — no SQL/CLI assumptions).
- **Post progress updates during long work** — short check-ins as you go, not silence until the end.
- **Never commit secrets.** They live in gitignored `.credentials/`. `*.sql`, `*.xlsx`, `*.pdf` are gitignored (migrations are preserved as tracked `.js`/`.cjs` appliers; tracker/decks regenerate from their generators/HTML).
- **Don't do destructive or production-facing actions** (deletes, deploys, password rotation, live RLS changes) without showing the owner first. Validate RLS changes with throwaway role logins before applying to prod.

## 3. Key facts
- Supabase project ref `puvozfhypqbwbmbhrhcr` (URL `https://puvozfhypqbwbmbhrhcr.supabase.co`). PG conn + tokens in `.credentials/`.
- Roles (`role_master`): 1=ADMIN, 2=TEAM_LEAD, 3=AGENT, 4=SALES_HEAD, 5=SALES_PERSON, 6=QC. `is_web=false` for sales roles.
- Auth: Supabase Auth + `profiles` (id=auth.uid, user_id bigint, role text); login/reset via notify-service service-role endpoints. **Only ~1 of 111 users had a login**; admin bulk-provisions logins.
- Lead↔salesperson = `lead_report.user_id` (NOT `created_by`, which is the internal owner).
- Test emails go to `ankit.s@amplior.com` (NOT mohit).

## 4. Current phase (update as it moves; full detail in REBUILD_LOG)
- **Built & live.** Internal launch is gated on owner decisions (see DECISIONS.md) + clearing the **write-path/ownership blocker** (agents must edit records ASSIGNED to them, not created — data was bulk-migrated). Then: role posture → bulk logins → access validation → email sign-off.
- **Priority order:** (1) internal reachout → (2) client/sales portal → (3) Chrome extension → (4) market-mapping → (5) AI. Then integrations (own workflow + APIs + MCP).
- Sales Portal: shell shipped (2nd login `/sales` + guards); next = downline hierarchy + RLS scoping (validate before prod) + feedback CRUD (built) + Sales-Head-adds-Sales-Person + executive dashboard.

## 5. Where things live
- `new-code/web` — React/Vite web app. `new-code/notify-service` — Express (email + admin/user endpoints). `new-code/migration` — DB migration appliers (`.js`/`.cjs`; raw `.sql` are gitignored).
- `docs/product/` — PRD, VISION, DECISIONS, INTERNAL-LAUNCH-PLAN, PRODUCT-GUIDE, SALES-PORTAL, ACCESS-CONTROL-MODEL, UX-REDESIGN, BULK-IMPORT-EXPORT, AI-PGVECTOR-PLAN, + leadership decks (`deck-*.html` → render with `render-decks.cjs`).
- `docs/` — ARCHITECTURE, SECURITY-AUDIT, QA-AUDIT, USER-STORIES-AND-FLOWS, DESIGN-SYSTEM, the `.xlsx` backlog tracker.
- `old-code/` — archived vendor codebases (READ-ONLY reference; the mobile sales app is `old-code/amplior-mobile-app-main`).
- Memory: `~/.claude/.../memory/` (MEMORY.md index + per-fact files).
