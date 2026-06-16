# Product Documentation — Amplior CRM Rebuild

> Product documentation for the Amplior CRM rebuild.

*Last updated 2026-06-13*

This folder holds the business-facing documents for the rebuild of the Amplior / Altleads CRM:
what the product must do, what's left to build, who can do what, what's in the database, how
we'll prove it works, the risks we're watching, and the decisions already made. Everything is
written in plain language for a non-technical owner, with small technical notes where they help.

**New here? Read in this order:** PRD (what we're building) → ROADMAP (the timeline) →
BACKLOG (what's left) → the rest as needed.

## The documents

| Document | What it is | Who should read it / when |
|---|---|---|
| [PRD.md](PRD.md) | Product Requirements — what the rebuilt CRM must do, for whom, and why. The big-picture definition of the product. | Owner and any builder, **first** — before starting or reviewing any module. |
| [BACKLOG.md](BACKLOG.md) | The single prioritized to-do list, organized by module: what's done, in progress, and left. | Owner and Claude, **every working session** — to pick the next task and track progress. |
| [ROADMAP.md](ROADMAP.md) | Phase-by-phase timeline of the whole rebuild — what each phase delivers and where we are today. | Owner, **for a status/timeline view**; anyone planning the work. |
| [ROLES-AND-PERMISSIONS.md](ROLES-AND-PERMISSIONS.md) | The six user roles and a matrix of exactly what each is allowed to do. Source of truth for the database security rules (RLS). | Owner and builder **before go-live** — and whenever security/access rules are designed. |
| [DATA-DICTIONARY.md](DATA-DICTIONARY.md) | Plain-language guide to the database — what each table and key column means and how tables connect. | Anyone working with the data — **when building a module, editing data, or tracing a field**. |
| [UAT-CHECKLIST.md](UAT-CHECKLIST.md) | The go-live gate: step-by-step tests comparing new vs old, module by module, with Pass/Fail. | The owner's team **during parallel-run testing**, before switching off the old system. |
| [RISK-REGISTER.md](RISK-REGISTER.md) | Everything that could go wrong, how likely/damaging, the mitigation, owner, and current status. | Owner, **for periodic review**; anyone weighing a risky step. |
| [DECISIONS.md](DECISIONS.md) | Running record of the important architecture and product decisions — what we chose, why, and what we rejected. | Anyone who asks "why did we do it this way?" — **before re-opening a settled question**. |
| [GLOSSARY.md](GLOSSARY.md) | Plain-language dictionary of the business and technical words used across the project. | Anyone, **anytime a term is unclear** while reading these docs or talking with the team. |

## Related documents (outside this folder)

| Document | What it is |
|---|---|
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Plain-language explanation of the new technical setup (Supabase, Netlify, no servers to manage). |
| [../USER-STORIES-AND-FLOWS.md](../USER-STORIES-AND-FLOWS.md) | The detailed step-by-step user journeys and screen flows the build follows (the "how each task works" spec). |
| [../../REBUILD_LOG.md](../../REBUILD_LOG.md) | The master project log — the full story, decisions, findings, phases, and current status. **Read this first each session.** |
