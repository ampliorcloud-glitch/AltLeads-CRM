# `reference/` — open-source CRM/ERP study references (READ-ONLY, gitignored)

This folder holds **open-source codebases we study for inspiration** while building our own CRM. It is **gitignored** (only this README is tracked) — these are large, third-party, and **not part of our product**. We read them for **data models, workflow engines, and feature breadth** — we do **NOT** copy code (different stacks; respect their licenses).

> Why open-source refs: unlike closed HubSpot/Zoho (which we can only reverse-engineer from behavior), here we can read the actual implementation. Cheaper + deeper than web research — **research subagents should grep these first** before going to the web.

## Drop the source into these subfolders (Ankit pastes them)
- `reference/odoo/` — **Odoo** (Python + own ORM + OWL/QWeb JS, Postgres). LGPLv3 Community.
- `reference/suitecrm/` — **SuiteCRM** (PHP, fork of SugarCRM). AGPLv3.
- `reference/erpnext/` — **ERPNext / Frappe** (Python + Frappe framework, MariaDB). GPLv3.

## What to mine in each (map to our roadmap)
| We're building | Best reference |
|---|---|
| In-record activity hub + task auto-complete + cadence (ALT-466/467) | **Odoo `addons/mail`** (chatter/activities), SuiteCRM Activities, ERPNext Communication/ToDo |
| Lead/pipeline/stages, Deals (DEC-11), Blueprint engine (ALT-426) | **Odoo `addons/crm`**, SuiteCRM Opportunities, ERPNext CRM (Lead→Opportunity) |
| Companies/Contacts model, associations (ALT-442), DNC/feasibility | **Odoo `res.partner`** (`addons/base`), SuiteCRM Accounts/Contacts, ERPNext Customer/Contact/Address |
| Custom fields / metadata (DEC-12) | **Odoo Studio / `ir.model.fields`**, SuiteCRM Studio, **ERPNext Custom Field / DocType** (esp. strong here) |
| Automation / workflow (event-spine) | **Odoo automated actions / server actions**, SuiteCRM Workflow, ERPNext Notification/Server Script |
| Role/team access + downline (ACCESS-CONTROL-MODEL) | **Odoo `sales_team` + record rules**, SuiteCRM Security Groups/Roles, ERPNext Role Permission Manager + User Permissions |
| Import + dedup (DEC-14) | Odoo base_import, ERPNext Data Import |

## Rules for anyone (incl. subagents) using these
1. **Read-only.** Never edit, never import into our build, never copy verbatim. Translate *patterns* into our TS/React/Supabase stack.
2. **License hygiene.** AGPL/GPL/LGPL — studying is fine; copying source into our product is not. Cite the idea, write our own code.
3. Prefer **grepping the mapped modules above** over reading whole trees (these repos are huge / mostly irrelevant to CRM).
4. When a reference informs a decision, capture the *takeaway* in the relevant `docs/product/` doc — not a copy of their code.
