# EspoCRM Architecture Blueprint

> Read-only teardown produced from source at `E:\reference code for crm\espocrm`.
> Sources examined: `application/Espo/Modules/Crm/Resources/metadata/entityDefs/` (8 entities),
> `clientDefs/` (Lead, Opportunity), `layouts/` (Lead detail, Opportunity list, Case defaultSidePanel),
> `Core/Acl/` (DefaultOwnershipChecker, DefaultTable, Table), `Hooks/Common/Formula.php`,
> scopes metadata for all CRM entities.
> Generated: 2026-06-29.

---

## 1. Stack and Code Organisation

EspoCRM is a **PHP 8 monolith** (Slim-style DI container, custom ORM) with a **Backbone.js + Handlebars SPA** front-end. The entire schema, API surface, and UI are driven by a layered **metadata system** — not by imperative code.

### The three metadata layers

| Layer | Path pattern | Purpose |
|---|---|---|
| `entityDefs` | `Resources/metadata/entityDefs/<Entity>.json` | Field types, field constraints, relationship links, DB indexes, text-filter fields, optional OCC flag |
| `clientDefs` | `Resources/metadata/clientDefs/<Entity>.json` | Controller class, view overrides, side panels, bottom panels, filter lists, boolean filters, kanban flag, relationship panel config, icon/colour |
| `layouts` | `Resources/layouts/<Entity>/<type>.json` | Column/row configuration for every rendered surface: `list`, `detail`, `detailSmall`, `filters`, `massUpdate`, `relationships`, `sidePanels*`, `defaultSidePanel`, `listSmall`, `listForAccount`, etc. |

A fourth layer — `scopes` metadata — controls which ACL actions apply to each entity (`entity`, `acl`, `aclPortal`, `aclLevelList`, `aclPortalLevelList`, `stream`, `importable`, `customizable`).

### How metadata drives the ORM and API

- The ORM reads `entityDefs` at boot and generates the relational schema (MySQL/MariaDB). Fields with `"notStorable": true` are computed-only (e.g. `duration`, `amountWeightedConverted`, `acceptanceStatus`). Computed fields declare their SQL expression inline via `"select": { "select": "EXPR" }` and their filter translation via `"where": { "=": { "whereClause": ... } }` — effectively inline query builder DSL.
- Every many-to-many uses a named `relationName` junction table (e.g. `entityTeam`, `entityCollaborator`, `AccountContact`, `ContactMeeting`, `MeetingUser`). Additional junction columns (e.g. `status` for acceptance, `role` for contact role) are declared in `"additionalColumns"`.
- The REST API is auto-generated from entityDefs — no separate route files. CRUD endpoints, list, search, mass-update, and relationship management all come for free.
- `optimisticConcurrencyControl: true` on Account, Opportunity, Case, Task — server rejects a save if another write happened since the client loaded the record.

---

## 2. Core CRM Data Model

### Lead
Fields: `personName` (firstName/lastName composite), `salutationName`, `title`, `status` (New → Assigned → In Process → Converted → Recycled → Dead), `source` (enum: Call/Email/Web Site/Campaign/…), `industry` (references Account.industry), `opportunityAmount` (currency), `emailAddress`, `phoneNumber` (multi-type: Mobile/Office/Home/Fax), `doNotCall`, `address`, `accountName` (plain varchar, not a link).

Key links: `assignedUser` (belongsTo User), `teams` (hasMany via `entityTeam`), `meetings`/`calls` (hasMany with acceptance status column), `tasks`/`emails`/`cases` (hasChildren/parent pattern), `campaign` (belongsTo), `targetLists`, `documents`, `createdAccount`/`createdContact`/`createdOpportunity` (populated on conversion).

**Lead conversion** is a first-class feature declared in entityDefs via `"convertEntityList": ["Account", "Contact", "Opportunity"]` and `"convertFields"` mapping (e.g. Lead.source → Opportunity.leadSource, Lead.address → Account.billingAddress). Conversion sets `convertedAt`, locks the lead, and populates the three `created*` back-links.

### Contact
Fields: personName, salutationName, emailAddress, phoneNumber, address, `doNotCall`, `opportunityRole` (computed from junction column), `accountIsInactive` (computed), `hasPortalUser` (computed SQL EXISTS), `originalLead` (linkOne back to source Lead).

Key links: `account` (primary belongsTo), `accounts` (hasMany — a contact can belong to multiple accounts with per-link `role` and `isInactive` columns), `opportunities` (hasMany with junction role column), `meetings`/`calls`/`tasks`/`emails` (hasChildren), `cases`, `portalUser` (hasOne — each contact can be a portal user).

### Account
Fields: `name`, `website`, `emailAddress`, `phoneNumber`, `type` (Customer/Investor/Partner/Reseller), `industry` (full industry taxonomy, ~50 values), `sicCode`, `billingAddress`, `shippingAddress`, `isLocked` (read-only, audited), `campaign`, `assignedUser`, `teams`.

Key links: `contacts` (hasMany with role/isInactive columns), `contactsPrimary` (filtered view), `opportunities`, `cases`, `documents`, `meetings`/`calls`/`tasks`/`emails` (both hasChildren via parent and hasMany via foreign key — dual-path), `portalUsers` (hasMany User), `originalLead`.

Account has `"optimisticConcurrencyControl": true`.

### Opportunity
Fields: `name`, `amount` (required currency), `amountWeightedConverted` (computed: `amount * probability / 100` with live currency-rate join), `stage` (Prospecting → Qualification → Proposal → Negotiation → Closed Won/Lost), `lastStage`, `probability` (0–100), `leadSource`, `closeDate` (required date), `campaign`, `contact` (primary), `contacts` (linkMultiple with per-link `role`).

Stage has a `probabilityMap` embedded in entityDefs so changing stage auto-suggests probability. `optimisticConcurrencyControl: true`. Kanban view enabled via clientDefs `"kanbanViewMode": true`.

### Meeting
Fields: `name`, `status` (Planned/Held/Not Held), `dateStart` (datetimeOptional), `dateEnd`, `duration` (computed TIMESTAMPDIFF), `isAllDay`, `reminders` (jsonArray, stored separately), `parent` (linkParent: Account/Lead/Contact/Opportunity/Case), `account` (read-only auto-derived), `uid`, `joinUrl`, `externalService`.

Attendees: `users` (hasMany User), `contacts` (hasMany Contact), `leads` (hasMany Lead) — each with a junction `status` column mapped to `acceptanceStatus` (None/Accepted/Tentative/Declined). Three separate junction tables: `MeetingUser`, `ContactMeeting`, `LeadMeeting`.

### Call
Identical structure to Meeting but adds `direction` (Outbound/Inbound) and duration options in seconds rather than hours. Junction tables: `CallUser`, `CallContact`, `CallLead`. Stored via `Espo\Core\Repositories\Event`.

### Task
Fields: `name`, `status` (Not Started/Started/Completed/Canceled/Deferred), `priority` (Low/Normal/High/Urgent), `dateStart`, `dateEnd`, `dateCompleted`, `isOverdue` (computed), `reminders`, `description` (with attachments), `parent` (linkParent: Account/Contact/Lead/Opportunity/Case).

Task is notable for having **`collaborators`** (linkMultiple User via `entityCollaborator` relation) — up to 30 collaborators, rendered with the `views/fields/collaborators` view. `optimisticConcurrencyControl: true`.

### Case
Fields: `name`, `number` (autoincrement), `status` (New/Assigned/Pending/Closed/Rejected/Duplicate), `priority`, `type` (Question/Incident/Problem), `account`, `lead`, `contact` (primary), `contacts` (hasMany), `inboundEmail`, `isInternal`, `attachments`.

Case also has `collaborators` (same pattern as Task, max 30). Full-text search enabled. `optimisticConcurrencyControl: true`. Linked to KnowledgeBaseArticle (hasMany `articles`).

---

## 3. Multi-Tenancy / Access Control

EspoCRM uses a **Role + Team** ACL model, not tenant-level isolation.

### ACL levels (from `DefaultTable.php`)

Actions: `read`, `stream`, `edit`, `delete`, `create`.
Levels (ordered most to least permissive): `all` > `team` > `own` > `no` (plus `yes` for boolean actions like `create`).
Field-level: `yes` or `no` per action (read/edit).

When a user has multiple roles, levels are **merged to the most permissive** (lowest index in the ordered list). Admin users always get `all` on everything unless explicitly disabled.

### How ownership is evaluated (`DefaultOwnershipChecker.php`)

1. **own**: Check `assignedUserId` == current user. If entity has `assignedUsers` (linkMultiple), check membership. Fallback to `createdById` only if `assignedUserId` is absent.
2. **team**: Check intersection of `entity.teamsIds` and `user.teamsIds`.
3. **shared** (read/stream only): Check if user is in `entity.collaboratorsIds` (linkMultiple via `entityCollaborator`). This is the **collaborators** mechanism — it grants read and stream access without full team membership.

### Roles and Teams

- A user can belong to multiple Teams. Each entity carries a `teams` linkMultiple. A user's effective team is the union of all team memberships.
- A Role defines per-scope and per-field levels. Multiple roles merge. Admin bypasses all role checks.
- `scopes` metadata controls which actions a scope exposes (e.g. `"aclActionList"`) and the allowed levels (e.g. `"aclLevelList"`). Some scopes omit `own` (e.g. `Team` only allows `all`/`team`/`no`). Email scope additionally allows `own`.
- Portal users get a separate `aclPortalLevelList` per scope (e.g. Case portal: `all/contact/own/no`; Contact portal: `all/account/contact/no`). This enables customer self-service portals with account-scoped visibility.

### Comparison with AltLeads RLS

| Dimension | EspoCRM | AltLeads |
|---|---|---|
| Isolation boundary | None (single schema, filtered by roles/teams) | `project_id` (Postgres RLS, true tenant isolation) |
| Owner field | `assignedUserId` (explicit; fallback `createdById`) | `lead_report.user_id` (assignment; `created_by` ≠ owner) |
| Team scoping | `entityTeam` junction, teams on user | No team layer yet |
| Collaborators | `entityCollaborator` junction, read+stream only | Building |
| Field-level ACL | Yes, per-field read/edit | Not present |
| Portal ACL | Account/contact-scoped levels | Sales portal (building) |
| OCC | Per-entity flag, server-side check | ALT-378 (dark flag) |

EspoCRM's ACL is richer in role granularity but has no hard tenant boundary — everything is in one schema filtered by PHP. AltLeads's Postgres RLS provides true isolation per project, which is more robust for multi-client SaaS.

---

## 4. Activity / Communication Model

### Activities vs History

EspoCRM defines activities as **future/in-progress** records and history as **past** ones, split by status:
- Meeting with status `Planned` → Activity. Meeting with status `Held`/`Not Held` → History.
- Call same pattern.
- Task: `Not Started`/`Started` → Activity; `Completed`/`Canceled`/`Deferred` → History (via `notActualOptions`).
- Email: Draft → Activity (`activityStatusList`); Archived/Sent → History (`historyStatusList`) — defined in Email scopes metadata.

In `clientDefs`, both `sidePanels` and `bottomPanels` reference the `"activities"` and `"history"` panels using the `"reference"` shorthand — the panel system resolves these to reusable panel definitions.

### Stream (chatter)

The Stream is an entity-level activity feed. Entities with `"stream": true` in scopes (Lead, Contact, Account, Opportunity, Case, Meeting, Call, Task) show a Stream panel where users can post notes, @mention colleagues, and see automated field-change notifications.

Stream notes are stored as `Note` entities (`Tools/Stream/NoteUtil.php`, `NoteAccessControl.php`). Notes have types: Post (manual text), Update (field change audit), Create, Relate, etc. Users can `follow` records; followers receive notifications when the Stream is updated.

### Email integration

Emails attach to records via the `parent` linkParent or via explicit `account`/`contact` foreign keys. Inbound email parsing auto-creates Cases. MassEmail and Campaign entities drive bulk outreach with tracking URLs and log records (`CampaignLogRecord`).

---

## 5. Automation / Workflow Engine

### Formula (community edition — present in source)

Formula is EspoCRM's **expression language** for computed fields and before-save hooks. Evidence:
- `Core/Formula/` contains a full `Parser.php`, `Processor.php`, `Manager.php`, function library (`Functions/`), variable handling, while/if control flow.
- `Hooks/Common/Formula.php` fires on every `beforeSave` — reads `formula.<EntityType>.beforeSaveScriptList` and `beforeSaveCustomScript` from metadata, then runs each script against the entity.
- Formula expressions appear directly in entityDefs for computed fields: e.g. `amountWeightedConverted` uses the inline DSL `"DIV:(MUL:(amount, probability, amountCurrencyRate.rate), 100)"`.
- Admin UI (Field Manager) lets non-developers write Formula scripts for fields. There is also a `Tools/Formula/Service.php` and `SyntaxCheckResult.php`.

Formula covers: field computation, conditional logic, setting field values on save, cross-field validation, math, string ops, date ops, entity-attribute reads.

### Workflows / BPM (Advanced Pack — enterprise, not in community source)

Workflow and BPM modules are referenced by the scope `Formula.json` (there is a `scopes/Formula.json` entry) but the full Workflow/BPM modules are not present in the community source at this path. These are sold as the **Advanced Pack**. They provide:
- Event-triggered workflows (on record create/update, on scheduled time)
- Action types: send email, create record, update record, run formula, create notification, apply assignment rules
- BPM process builder (BPMN-like) for multi-step approval/routing flows

AltLeads's planned "automation event-spine" maps to this tier.

---

## 6. Customisation

### Custom fields via metadata

The admin Field Manager UI creates custom fields by writing to `custom/Espo/Custom/Resources/metadata/entityDefs/<Entity>.json` (a `custom/` overlay layer that merges with core metadata at runtime). Each field gets a `type`, optional `view` override, and any flags (`required`, `audited`, `isPersonalData`, etc.).

Field types available: varchar, text, email, phone, url, date, datetime, datetimeOptional, int, float, currency, currencyConverted, bool, enum, multiEnum, link, linkMultiple, linkOne, linkParent, address, attachmentMultiple, jsonArray, jsonObject, foreign, autoincrement, duration, personName, and more.

### Dynamic Logic

`dynamicLogic` (declared in entityDefs or via admin UI) controls field visibility, required state, and read-only state based on other field values at runtime (client-side). For example: show `shippingAddress` only when a checkbox is checked. Fields explicitly set `"dynamicLogicDisabled": true` (e.g. `reminders`, `externalService`) to opt out.

### Layout Manager

All layout JSON files under `layouts/` are editable via the admin Layout Manager UI. Custom layouts are saved to `custom/` overlays. Named layout types include: `list`, `listSmall`, `listDashlet`, `detail`, `detailSmall`, `detailConvert`, `filters`, `massUpdate`, `relationships`, `sidePanelsDetail`, `defaultSidePanel`, `bottomPanelsDetail`, `listForAccount`, `listForContact`, `kanban`.

### Custom entities

The Entity Manager (admin UI) creates new entity types entirely through metadata — generates entityDefs, clientDefs, layouts, and scopes JSON — without writing PHP. Relationships between entities are also added through this UI.

---

## 7. Full Feature Inventory

**Core CRM**
- Lead management with full lifecycle (New → Converted) and formal conversion wizard creating Account + Contact + Opportunity
- Contact management with multi-account membership (a contact at multiple companies, each with a role and active/inactive flag)
- Account management with billing/shipping addresses, SIC code, type taxonomy
- Opportunity pipeline with probability, weighted amount, stage-to-probability auto-mapping, close date, multi-contact support with per-contact role (Decision Maker/Evaluator/Influencer)
- Case management with auto-increment case numbers, priority/type, inbound email integration, Knowledge Base linking

**Activities**
- Meetings with calendar view, all-day support, iCal UID, external service integration (Zoom etc.), join URL, acceptance status per attendee (None/Accepted/Tentative/Declined)
- Calls with inbound/outbound direction, duration, same attendee acceptance model
- Tasks with priority, due date, overdue detection, reminders, collaborators
- Reminders via email/popup with time-offset configuration

**Communication**
- Full email client (IMAP/SMTP per user, shared inbound accounts, group mailboxes)
- Email-to-Case auto-creation from inbound email
- Mass Email campaigns with target lists, opt-out management, tracking URLs, open/click log records
- Campaign management with lead/contact/account targeting, campaign log
- Email templates with variable substitution

**Productivity**
- Stream (chatter) on all main entities with post, @mention, follow, automated change notes
- Calendar with day/week/month views, shared calendars, working time calendar
- Global activity feed
- Dashlets and dashboards (configurable per user)
- Knowledge Base with categories, articles, portal exposure

**Admin and customisation**
- Entity Manager (create custom entities, fields, relationships via UI)
- Field Manager (add custom fields to existing entities, write Formula scripts)
- Layout Manager (drag-drop column/row editing for every layout type)
- Role and Team manager (granular per-scope, per-field, per-action levels)
- Import engine (CSV, field mapping, dedup)
- Export (filtered lists to CSV/XLSX)
- Lead Capture API endpoints (web-to-lead forms)
- Portal user provisioning per Contact (each Contact can get a portal login)
- Webhooks (outbound event triggers)
- Scheduled jobs

**Developer/integration**
- REST API auto-generated from entityDefs
- Formula scripting language (before-save hooks, field computation)
- Dynamic Logic (client-side conditional field visibility/required)
- Optimistic Concurrency Control per entity
- Metadata overlay/custom layer for non-destructive customisation
- Extension package system

---

## 8. UI/UX Patterns

### Layout system

Every rendered surface uses a named JSON layout file. The `detail` layout is an array of panels; each panel is `{ "label": "...", "rows": [[field, field], ...] }`. Fields are `{ "name": "fieldName" }` optionally with `"fullWidth": true`, `"hidden": true`. `false` in a row means empty cell.

The `list` layout is a flat array of column descriptors with `name`, optional `link` (make it a hyperlink), `width`, `align`, `hidden`.

The `defaultSidePanel` layout for Case shows `assignedUser`, `teams`, `collaborators`, `isInternal` — the three ownership/access fields always surface together in the right sidebar.

`sidePanelsDetail` and `sidePanelsDetailSmall` in clientDefs define which panels appear in the right column of detail view. Common references: `"activities"`, `"history"`, `"tasks"`, `"convertedTo"` (Lead-specific).

`bottomPanels` lists panels that appear below the main form — used for relationship grids (contacts list on Opportunity, etc.). The same panel can appear in both sidePanels (compact) and bottomPanels (expanded) with `"disabled": true` on one to suppress duplication.

### Kanban

Opportunity has `"kanbanViewMode": true` in clientDefs and a `recordViews.kanban` override. The kanban groups by `stage`. Any entity with a status-type enum field can get a kanban view.

### Saved filters and search

`filterList` in clientDefs declares named quick-filter tabs (e.g. Lead's `"actual"` and `"converted"` tabs). `boolFilterList` adds toggle chips (e.g. `"onlyMy"`). Users can also create personal saved search/filter combinations from the full filter panel.

### Stream panel

Shown on the right side of detail view for stream-enabled entities. Renders Note records with type badges (Post, Update, Relate). Users can reply, @mention (triggers notifications), and follow/unfollow. The stream is access-controlled: collaborators get read+stream access even without team membership.

---

## 9. What AltLeads Appears to be Missing

This is a candid gap analysis. AltLeads has solid foundations (list, detail, kanban, filters, saved views, merge/dedup, recycle bin, import engine, in-record activity hub, bulk reassign). The significant gaps against EspoCRM's surface area:

**1. Deals / Opportunity pipeline (highest priority gap)**
AltLeads has no deal entity. EspoCRM's Opportunity has stage, probability, weighted amount, close date, multi-contact roles, kanban by stage, `lastStage` tracking, and Closed Won/Lost funnel analytics. AltLeads is planning this but it does not exist yet.

**2. Multi-account contact membership**
In EspoCRM a Contact can belong to multiple Accounts with per-link role and active/inactive status (`AccountContact` junction with `role` and `isInactive` columns). AltLeads `contact_master` has a single company FK. This matters for contacts who switch companies or sit at multiple.

**3. Collaborators / secondary-owner pattern (formally)**
EspoCRM's `entityCollaborator` junction (Task, Case) grants read + stream access to named users without giving them full team membership. AltLeads is building this but it's not shipped. The formal data pattern: a dedicated `entityCollaborator` table, max-count cap (30), rendered via a specific `views/fields/collaborators` widget, and reflected in the ownership checker.

**4. Formal lead conversion wizard**
EspoCRM has a structured conversion flow (Lead → Account + Contact + Opportunity) with field mapping declared in entityDefs (`convertFields`), back-links (`createdAccount`, `createdContact`, `createdOpportunity`), and a `convertedAt` timestamp. AltLeads has lead status management but no conversion that creates downstream structured records.

**5. Formula / before-save scripting**
EspoCRM has a full expression language for computed fields and pre-save validation scripts, configurable by admins through the Field Manager. AltLeads has no equivalent admin-configurable automation at the field level. Business logic is hardcoded in service layer.

**6. Dynamic Logic (client-side conditional fields)**
Field visibility, required, and read-only driven by other field values at runtime. AltLeads has no equivalent — all fields are always visible/required or not. Needed for conditional qualifying questions, for example.

**7. Field-level ACL**
EspoCRM can mark individual fields as `read: no` or `edit: no` per role. AltLeads controls visibility at the page/component level, not the individual field level. This becomes important when e.g. salary or financial data should be hidden from agents but visible to managers.

**8. Stream / chatter**
EspoCRM's Stream on every record lets users post notes, @mention, follow, and see automatic change notifications. AltLeads has an activity hub (interaction log + tasks), but there is no free-form post/chatter capability or follower model. This is a collaboration gap.

**9. Knowledge Base**
Cases link to KnowledgeBaseArticle records. AltLeads has no knowledge base or article-linking concept.

**10. Workflows / BPM (event-triggered automation)**
EspoCRM Advanced Pack (enterprise) provides trigger-action workflows and BPMN process builder. AltLeads's planned "automation event-spine" covers the same ground but doesn't exist yet.

**11. Portal users per Contact**
EspoCRM allows each Contact to be provisioned a portal login, with account-scoped ACL (`all/account/contact/own/no`). AltLeads's sales portal gives a separate login to salespersons, but individual customer/contact self-service portal is not planned.

**12. Campaign / mass-email engine**
TargetList, Campaign, MassEmail, CampaignLogRecord, TrackingUrl, opt-out management. AltLeads has no outbound campaign management; it's an inbound-outreach tracking system.

**13. Reminders**
EspoCRM persists `reminders` as a jsonArray on Meeting/Call/Task (stored separately, with time-offset and popup/email type). AltLeads has no reminder or notification scheduling for activities.

**14. Acceptance status on activities**
Meeting/Call attendees (users, contacts, leads) each have an individual `acceptanceStatus` (Accepted/Tentative/Declined/None) stored in the junction table. AltLeads meeting records have no attendee acceptance model.

---

## 10. Reverse-Engineering Feasibility

### What ports well to React/Supabase

**Metadata-driven layouts (high ROI).** The three-layer pattern — entityDefs (schema), clientDefs (UI config), layouts (column/row JSON) — translates directly. Store the layout JSON in a `metadata` Postgres table or as static config files. The React renderer reads the layout and renders fields generically. This is exactly how admin-configurable list/detail columns should work. AltLeads already has layout-based list views; formalising the JSON config store would unlock admin-editable layouts and custom field rendering with zero per-entity code.

**Link types as a vocabulary (high ROI).** EspoCRM's link types (`belongsTo`, `hasMany`, `hasChildren`, `belongsToParent`, `hasOne`, `linkMultiple`, `linkOne`) are a clean vocabulary for describing relationships. Adopting this vocabulary in AltLeads's internal API/ORM layer would make it easier to add new entities and relationships without writing bespoke join logic every time.

**Collaborators pattern (medium ROI, building now).** The `entityCollaborator` junction with read-only ownership check is directly implementable as a Postgres join table + RLS policy that grants SELECT to users in the collaborators list. The AltLeads RLS already has the concept of project-scoped access; collaborators adds record-scoped sharing on top.

**Stage-to-probability map in entityDefs (low effort).** For the future Deals entity, embed the `probabilityMap` in the entity config so changing stage auto-fills probability. Pure frontend logic, no backend change needed.

**Formula-style computed fields (medium ROI).** Inline SQL expressions for computed fields (e.g. weighted amount, duration) map directly to Postgres generated columns or computed columns in PostgREST views. The pattern of declaring the computation in metadata rather than a service class is worth adopting.

**notActualOptions for status enums (easy win).** The concept of marking certain status values as `notActualOptions` (they appear in data but not in the "create new" dropdown) is a UX pattern AltLeads should steal immediately for statuses like Converted, Recycled, Dead — prevents agents accidentally selecting terminal states.

### What is Espo-specific / does not port

**PHP metadata merge at boot.** EspoCRM's `custom/` overlay that deep-merges JSON at PHP boot is clever but deeply tied to the PHP process. In the AltLeads React+Supabase world, the equivalent is a `metadata` table in Postgres with a row per entity+type+content, loaded at app init via a single API call. The concept ports; the mechanism must be rebuilt.

**Backbone.js view hierarchy.** EspoCRM's `views/`, `recordViews`, `sidePanels` are all Backbone View class references. They don't port at all — AltLeads uses React components. The layout JSON format can be adopted but the renderer must be React-native.

**Formula language.** EspoCRM's custom expression language is significant investment. For AltLeads the pragmatic equivalent is Postgres `DEFAULT` expressions and `GENERATED ALWAYS AS` columns for simple computations, plus a Supabase Edge Function for complex before-save logic. A full Formula interpreter would take months; start with the column-level computation pattern.

**Multi-role merge at table-build time.** The ACL table is assembled at login time from all a user's roles and cached. Supabase RLS runs per-query in Postgres and is simpler (project scoped). AltLeads's approach of having role as a single field per user and enforcing it in RLS policies is arguably cleaner for a smaller role set. Adopting EspoCRM's multi-role merge would require moving ACL computation out of RLS and into a custom middleware layer — not worth it for 6 roles.

### Overall verdict

EspoCRM is a very well-structured reference for **data model design** (entity relationships, junction table patterns, computed fields, conversion flows) and **UI configuration patterns** (layout JSON, side panel conventions, filter lists). Its ACL model provides a richer vocabulary than AltLeads currently has (team levels, field-level ACL, collaborators, portal scoping).

The highest-ROI ideas to take from this analysis:

1. **Formalise layout JSON as a config store** — enables admin-editable lists/detail layouts and custom field ordering without code deploys.
2. **`entityCollaborator` junction** — implement as planned, using the max-30 cap and read-only ownership semantics from EspoCRM.
3. **Deal entity modelled after Opportunity** — stage/probability/close-date/contacts-with-role pattern is proven.
4. **`notActualOptions` pattern for status enums** — prevent terminal statuses appearing in create/edit dropdowns.
5. **Field-level ACL in roles** — at minimum, a `hidden_fields` list per role to suppress sensitive columns.
6. **Acceptance status on meeting attendees** — store per-attendee RSVP in the junction table.

Avoid: porting Formula (use Postgres-native expressions instead), porting multi-role merge (keep single-role-per-user), porting Backbone views (already using React).
