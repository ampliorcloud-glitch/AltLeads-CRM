# Odoo Community CRM — Architecture Blueprint

> Reverse-engineered from source at `E:\reference code for crm\odoo`.
> All file paths are relative to that root. Read date: 2026-06-29.
> Purpose: durable reference for AltLeads product decisions. Do NOT copy code (LGPL).

---

## 1. Stack & Code Organization

**Runtime:** Python 3 + own ORM (`odoo.fields`, `odoo.models`) backed by PostgreSQL. Frontend uses OWL (Own Web Library, a reactive JS framework) + QWeb XML templates. No external ORM (SQLAlchemy, etc.) — Odoo's ORM generates SQL internally and surfaces a Python record-set API.

**Module / addon structure** (observed in `addons/crm/`, `addons/mail/`, `addons/sales_team/`, `addons/base_automation/`):

```
addons/<module>/
  __manifest__.py          # name, version, depends, data files list
  __init__.py              # imports models/, controllers/, wizards/
  models/                  # Python model classes (one file per model, roughly)
  views/                   # XML view definitions (list, form, kanban, search)
  security/                # XML: res.groups definitions + ir.rule record rules
  data/                    # XML seed data (stages, lost-reasons, cron jobs, mail subtypes)
  wizard/                  # transient models + views for dialogs (e.g. merge, convert)
  report/                  # XML report views
  static/src/              # JS/OWL components, SCSS
```

**Key framework concepts:**
- **Model inheritance via `_inherit`**: a model can extend another (`class CrmTeam(_inherit=['mail.thread', 'crm.team'])`) — both "extension" (adds fields to same table) and "delegation" (separate table) patterns exist. The CRM `crm.team` is defined in `sales_team/models/crm_team.py` and extended in `crm/models/crm_team.py`.
- **Mixin pattern**: `mail.thread`, `mail.activity.mixin`, `utm.mixin`, `format.address.mixin` etc. are abstract models mixed into concrete models via `_inherit`. The `CrmLead` class inherits six mixins (line 88-95 of `crm/models/crm_lead.py`).
- **Computed fields**: `compute='_method_name'`, optionally `store=True` (materialized) or `readonly=False` (user-editable computed default). Tracking (`tracking=N`) logs field changes to the chatter automatically.
- **XML data files**: security rules, view definitions, demo data, cron jobs, and mail templates are all XML, loaded on module install/upgrade. Views are stored in the database as `ir.ui.view` records.
- **`ir.*` registry models**: `ir.model`, `ir.model.fields`, `ir.rule`, `ir.actions.server`, `ir.cron` — Odoo's meta-layer. Everything (models, fields, menus, actions) is introspectable at runtime from the database.

---

## 2. Core CRM Data Model

### `crm.lead` — the central record (`addons/crm/models/crm_lead.py`)

Single table holds both **Leads** and **Opportunities**, distinguished by `type = Selection([('lead','Lead'),('opportunity','Opportunity')])`. This unified model means list/kanban views can filter by type; converting a lead to an opportunity is just a write to `type` plus linking a `partner_id`.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `name` | Char | Opportunity name; auto-computed from partner if blank |
| `type` | Selection | `'lead'` or `'opportunity'`; controls which pipeline UI appears |
| `stage_id` | Many2one → `crm.stage` | Current pipeline stage; domain-filtered by `team_id` |
| `user_id` | Many2one → `res.users` | Salesperson (owner); triggers `date_open` on first set |
| `team_id` | Many2one → `crm.team` | Sales team; auto-computed from `user_id` membership |
| `partner_id` | Many2one → `res.partner` | Linked contact (optional on lead, usually set on opportunity) |
| `partner_name` / `contact_name` | Char | Denormalized from partner for pre-conversion leads |
| `email_from` / `phone` | Char | Synced bidirectionally with `partner_id.email`/`phone` |
| `priority` | Selection | 0-3 (Low/Medium/High/Very High); affects default sort |
| `expected_revenue` | Monetary | Deal value |
| `recurring_revenue` + `recurring_plan` | Monetary + Many2one | MRR/ARR support |
| `probability` | Float | Manual or AI-automated win probability (0-100) |
| `automated_probability` | Float | ML-computed from `crm.lead.scoring.frequency` table |
| `won_status` | Selection | `won/lost/pending` — computed from `stage_id.is_won` + `active` |
| `lost_reason_id` | Many2one → `crm.lost.reason` | Required on archive-as-lost |
| `active` | Boolean | False = archived; combined with `probability=0` means "lost" |
| `date_open` | Datetime | Assignment date (when `user_id` first set) |
| `date_closed` | Datetime | Set on won/lost |
| `date_deadline` | Date | Expected closing |
| `day_open` / `day_close` | Float | KPI: days to assign / days to close (computed) |
| `date_last_stage_update` | Datetime | Used for "rotting" detection |
| `tag_ids` | Many2many → `crm.tag` | Classification tags |
| `lead_properties` | Properties | Dynamic custom fields; definition stored on `team_id.lead_properties_definition` |
| `campaign_id` / `medium_id` / `source_id` | Many2one (UTM) | Marketing attribution |
| `calendar_event_ids` | One2many → `calendar.event` | Meetings linked via `opportunity_id` |
| `duplicate_lead_ids` | Many2many (computed) | Potential duplicate detection by email domain |
| `color` | Integer | Kanban color index |
| `referred` | Char | "Referred by" free text |

**Clever design choices:**
- **Unified Lead + Opportunity** in one table eliminates a join when converting; conversion is just a field write plus partner creation.
- **Bidirectional partner sync**: `email_from`/`phone` are computed from `partner_id` but also have inverses that push back to the partner — with a "ribbon" warning when they diverge (`partner_email_update`, `partner_phone_update` flags).
- **Rotting threshold per stage** (`crm_stage.rotting_threshold_days`): each stage can define how many days without update constitutes a stale record; no global setting needed.
- **AI probability** is stored separately from manual probability so users can see both and choose to re-align.
- **`lead_properties` via `fields.Properties`**: a JSON column whose schema (`PropertiesDefinition`) lives on the team record — so each sales team can define different custom fields for its leads without schema migrations.

### `crm.stage` (`addons/crm/models/crm_stage.py`)

| Field | Notes |
|---|---|
| `name` | Translatable stage label |
| `sequence` | Ordering (lower = earlier) |
| `is_won` | Boolean; setting this cascades `probability=100` to all leads in stage |
| `fold` | Whether column is folded by default in kanban |
| `team_ids` | Many2many → `crm.team`; stages can be shared across teams or team-specific |
| `rotting_threshold_days` | Per-stage staleness threshold |
| `requirements` | Tooltip text for stage entry criteria |

Stages are **global-by-default** (no `team_ids`), or team-scoped via `team_ids`. Lead `stage_id` domain filters: `['|', ('team_ids', '=', False), ('team_ids', 'in', team_id)]` — a lead only sees stages for its team or global stages.

### `res.partner` — unified company + contact model (`odoo/addons/base/models/res_partner.py`)

The single most important design decision in Odoo CRM: **one table for both companies and individual contacts**, distinguished by `is_company = Boolean`. Hierarchy via `parent_id` (self-referential Many2one): a contact's parent is its company.

| Field | Notes |
|---|---|
| `name` | Person or company name |
| `is_company` | Boolean; True = company record |
| `parent_id` | Many2one → `res.partner`; contact's employer company |
| `child_ids` | One2many inverse; company's contacts |
| `commercial_partner_id` | Computed: topmost company in hierarchy |
| `complete_name` | Computed: "Company / Contact" display |
| `email`, `phone`, `mobile` | Contact info |
| `street`, `city`, `zip`, `country_id` | Full address |
| `user_id` | Salesperson responsible |
| `category_id` | Many2many tags |
| `vat` | Tax ID (validated per country) |
| `lang` | Language for email/doc generation |
| `ref` | Internal reference |

**No separate "Account" vs "Contact" objects** (unlike Salesforce). One model, two roles, parent-child hierarchy. This simplifies queries but requires careful filtering (`is_company=True` for company lookups).

### `crm.team` (`addons/sales_team/models/crm_team.py` + `addons/crm/models/crm_team.py`)

Base definition in `sales_team`; CRM-specific extension adds leads/opportunities logic.

| Field | Notes |
|---|---|
| `name` | Team name |
| `user_id` | Team leader |
| `member_ids` | Many2many → `res.users` (computed from `crm_team_member_ids`) |
| `crm_team_member_ids` | One2many → `crm.team.member`; membership records with quotas |
| `company_id` | Optional company scoping |
| `use_leads` / `use_opportunities` | Feature flags per team |
| `alias_id` | Email alias; incoming mail auto-creates leads for this team |
| `assignment_domain` | Char (domain expression); filters which leads this team can receive in auto-assignment |
| `assignment_max` | Computed: sum of member assignment_max — monthly lead capacity |
| `lead_properties_definition` | PropertiesDefinition; schema for per-team custom fields on leads |

### `crm.team.member` (`addons/crm/models/crm_team_member.py`)

Junction model between team and user, with assignment metadata:

- `crm_team_id` → `crm.team`
- `user_id` → `res.users`
- `assignment_max` (Integer): monthly lead capacity for this member
- `assignment_domain` / `assignment_domain_preferred`: filter domains for lead routing
- `lead_month_count`: how many leads assigned this month
- `assignment_optout`: skip this member in auto-assignment

### `mail.activity` (`addons/mail/models/mail_activity.py`)

Activities are **future tasks on records**, not log entries. They are unlinked (deleted) when marked done, and a chatter message is posted as the completion record.

| Field | Notes |
|---|---|
| `res_model_id` / `res_id` | Polymorphic link to any model record |
| `activity_type_id` | Many2one → `mail.activity.type` |
| `summary` | Short label |
| `note` | HTML description |
| `date_deadline` | Due date (required) |
| `user_id` | Assigned to |
| `state` | Computed: `overdue/today/planned/done` |
| `feedback` | Text entered when marking done |
| `automated` | Boolean; system-created vs user-created |

Activity types (`mail.activity.type`): Email, Call, Meeting, Document, etc. — extensible. Type has `category` (for icon/color), `decoration_type`, and optional `res_model` to restrict to a specific model.

---

## 3. Multi-tenancy / Access Control

Odoo uses **three interlocking layers**: ACL (model-level CRUD matrix), `ir.rule` (row-level domain filter), and `res.groups` (role).

### Groups (roles) — `addons/crm/security/crm_security.xml` + `addons/sales_team/`

```
sales_team.group_sale_salesman        — basic salesperson
sales_team.group_sale_salesman_all_leads  — can see all leads (not just own)
sales_team.group_sale_manager         — full access, team config
crm.group_use_lead                    — show "Leads" menu (feature flag)
crm.group_use_recurring_revenues      — show MRR fields
```

Groups form an implicit hierarchy (manager implies salesman); this is declared in the group XML.

### Record Rules (`ir.rule`) — `addons/crm/security/crm_security.xml`

Record rules are **row-level security** evaluated as PostgreSQL WHERE clauses appended to every query for users in the specified group. They combine with AND (if multiple rules match a group) or OR (rules for different groups).

```xml
<!-- Salespeople only see own leads OR unassigned leads -->
<record id="crm_rule_personal_lead" model="ir.rule">
  <field name="domain_force">['|',('user_id','=',user.id),('user_id','=',False)]</field>
  <field name="groups" eval="[(4, ref('sales_team.group_sale_salesman'))]"/>
</record>

<!-- Managers / "all leads" group see everything -->
<record id="crm_rule_all_lead" model="ir.rule">
  <field name="domain_force">[(1,'=',1)]</field>  <!-- always true -->
  <field name="groups" eval="[(4, ref('sales_team.group_sale_salesman_all_leads'))]"/>
</record>

<!-- Multi-company: leads scoped to user's active companies -->
<record id="crm_lead_company_rule" model="ir.rule">
  <field name="domain_force">[('company_id', 'in', company_ids + [False])]</field>
  <!-- no groups = global rule, applies to everyone -->
</record>
```

**How `ir.rule` works** (`odoo/addons/base/models/ir_rule.py`):
- `domain_force` is a Python expression evaluated with context `{'user': env.user, 'company_ids': [active company IDs], 'company_id': primary company}`.
- `perm_read/perm_write/perm_create/perm_unlink`: which operations the rule restricts.
- Rules without `groups` = global (apply to all users).
- Rules are OR-combined across groups a user belongs to, AND-combined when multiple rules apply to the same group.
- The ORM appends the domain as a SQL JOIN / WHERE clause — transparent to application code.

### Multi-company

- Every record with `company_id` gets a global rule `[('company_id', 'in', company_ids + [False])]` — the `+ [False]` allows records with no company to be seen by everyone.
- Users can belong to multiple companies (`company_ids`); the "active" company set (`company_ids` in domain context) determines visibility.
- Teams can be company-scoped; stages can be global or team-scoped.

### Comparison to AltLeads project-scoped RLS

| Odoo | AltLeads |
|---|---|
| `company_id` on records, global ir.rule | `project_id` on `lead_report`; RLS policy filters by project membership |
| `user_id` = salesperson owner | `lead_report.user_id` = assigned agent |
| Groups = `ir.rule` groups field | Roles in `role_master` (1=ADMIN…6=QC) |
| Salesman sees own OR unassigned | Agent sees assigned to them OR team-visible |
| Multi-company = separate filter layer | No multi-company; project = tenant boundary |
| Stages global OR team-scoped | Statuses global (no per-project stage definitions yet) |

AltLeads' `project` boundary is functionally equivalent to Odoo's `company_id` + team combination but is a single concept. The key difference: Odoo's `ir.rule` is evaluated server-side in SQL (zero leakage risk); AltLeads uses Supabase RLS policies which are also server-side Postgres policies — architecturally equivalent.

---

## 4. Activity / Communication Model

### `mail.thread` — the chatter backbone (`addons/mail/models/mail_thread.py`)

`MailThread` is an **abstract model** mixed into any record that needs communication history. `CrmLead` inherits it via `mail.thread.cc`, `mail.thread.blacklist`, `mail.thread.phone`.

Key capabilities:
- `message_ids` (One2many → `mail.message`): all messages, notes, field-change logs on a record.
- `message_post(body, subtype, partner_ids, ...)`: sends a message and notifies followers.
- Incoming email routing: each team can have an `alias_id` (email alias); inbound emails are parsed and create/update leads via `message_new()` / `message_update()`.
- **Field-change tracking**: fields with `tracking=N` (integer = display order in chatter) auto-log changes as `mail.tracking.value` records linked to a chatter message.

### `mail.followers` (`addons/mail/models/mail_followers.py`)

```python
class MailFollowers(models.Model):
    res_model = fields.Char(...)   # e.g. 'crm.lead'
    res_id    = fields.Many2oneReference(...)
    partner_id = fields.Many2one('res.partner', ...)
    subtype_ids = fields.Many2many('mail.message.subtype', ...)
```

- **Followers are per-record, per-partner** — a partner can follow a lead and receive notifications.
- `subtype_ids`: controls which notification types the follower receives (e.g., only stage changes, not every note).
- The record creator is auto-subscribed as a follower (controllable via `mail_create_nosubscribe` context key).
- **Followers vs. Collaborators**: in Odoo, a "follower" is anyone who should receive notifications — they are not necessarily assigned work. The `user_id` (salesperson) is the single owner; followers are the notification list. There is no native "collaborator" role with edit rights (that would require custom security).

### `mail.activity` + `mail.activity.mixin` — scheduled activities

As described in section 2. The mixin (`addons/mail/models/mail_activity_mixin.py`) adds:
- `activity_ids` One2many to the record
- `activity_state`: computed (`overdue/today/planned`) — drives kanban color coding
- `activity_date_deadline`: next upcoming deadline
- `my_activity_date_deadline`: deadline of activities assigned to current user (used for sort/search)

**Activities are prospective** (things to do); **chatter messages are retrospective** (things done). When an activity is marked done, it is deleted and a message is posted to the chatter capturing the feedback. This is a clean separation.

**Activity Plans** (`mail.activity.plan` + `mail.activity.plan_template`): a named sequence of activities that can be applied at once to a record (e.g., "Onboarding Plan" = Call + Demo + Proposal). Plans are defined in `addons/mail/models/mail_activity_plan.py`.

### `mail.message` + subtypes

- `mail.message.subtype` categorizes messages: "Stage Changed", "New Lead", "Note", "Sent Email", etc.
- Subtypes control follower notifications: followers subscribe to specific subtypes.
- `mail_message_subtype_data.xml` in `addons/crm/data/` registers CRM-specific subtypes.

### Email routing

- `mail.alias` (`alias_name@company.example.com`): each team has one. Incoming email to the alias creates a `crm.lead` with `team_id` set.
- The `mail.alias.mixin` mixin wires a model to an alias domain.
- `fetchmail` polling or SMTP push feeds inbound emails into the router.

---

## 5. Automation / Workflow Engine

### `base.automation` (`addons/base_automation/models/base_automation.py`)

The core automation model. Fields:

| Field | Notes |
|---|---|
| `name` | Rule name |
| `model_id` | Which model to watch |
| `trigger` | When to fire (see below) |
| `filter_domain` | Additional domain filter: only apply to matching records |
| `filter_pre_domain` | Pre-update domain: condition that must be true BEFORE the write |
| `action_server_ids` | One2many → `ir.actions.server`; what to DO |
| `active` | Enable/disable |
| `last_run` | For time-based triggers |

**Trigger types** (from `base_automation.py` lines 80-111):

```python
CREATE_TRIGGERS = ['on_create', 'on_create_or_write', 'on_priority_set',
                   'on_stage_set', 'on_state_set', 'on_tag_set', 'on_user_set']

WRITE_TRIGGERS  = ['on_write', 'on_archive', 'on_unarchive',
                   'on_create_or_write', 'on_priority_set', 'on_stage_set',
                   'on_state_set', 'on_tag_set', 'on_user_set']

TIME_TRIGGERS   = ['on_time', 'on_time_created', 'on_time_updated']

MAIL_TRIGGERS   = ['on_message_received', 'on_message_sent']

# Plus: 'on_unlink', 'on_change' (UI only), 'on_webhook'
```

- **`on_stage_set`** with `trg_field_ref` pointing to a specific stage: fires when lead moves to that stage. This is the most common CRM automation pattern.
- **`on_time`** with `trg_date_id` (a date field) + `trg_date_range` (offset): e.g., "5 days after `date_deadline`" — the cron scans and fires. Uses `trg_date_range_type` (minutes/hours/days/months) and optional calendar for working-days calculation.
- **`on_webhook`**: a URL is generated (`url` field); third-party POSTs to it; automation fires with the payload.
- **`filter_pre_domain`**: enables "field changed FROM value X" semantics — check old state with pre-domain, new state with `filter_domain`.

### `ir.actions.server` — what automations DO

Server actions are the action side. Types include:
- `code` — execute Python code snippet
- `object_write` — update fields on matched records
- `object_create` — create related records
- `mail_post` — post a message / send email
- `followers` — add/remove followers
- `next_activity` — schedule an activity

### `ir.cron` — scheduled tasks

- CRM uses `ir_cron_data.xml` to register cron jobs: lead assignment (`_cron_assign_leads`), automated probability updates, rotting detection.
- Cron entries have `interval_number` + `interval_type` (minutes/hours/days/weeks/months) and call a model method.

### Lead Assignment Engine (`addons/crm/models/crm_team.py`)

A sophisticated rule-based assignment system:
1. `_allocate_leads()`: distributes unassigned leads across teams by weighted random selection based on `assignment_max` (team capacity). Merges duplicates during allocation.
2. `_assign_and_convert_leads()`: within each team, distributes leads among members using round-robin weighted by quota; members with `assignment_domain_preferred` get priority leads first.
3. Converts leads to opportunities as part of assignment (`convert_opportunity()`).
4. Runs via `_cron_assign_leads()` on a daily cron, or on-demand via `action_assign_leads()`.

---

## 6. Customization

### Dynamic custom fields via `fields.Properties`

`CrmLead.lead_properties = fields.Properties('Properties', definition='team_id.lead_properties_definition')` (line 114-116, `crm_lead.py`).

`PropertiesDefinition` (from `odoo/addons/base/models/properties_base_definition.py`) stores a JSON schema of field definitions on the parent record (here `crm.team`). Each team defines its own set of custom fields; the JSON is stored in a JSONB-like column on leads. UI renders these dynamically. Field types supported: text, integer, boolean, date, selection, many2one, tags.

This is a **metadata-driven custom field system** without requiring database schema migrations — the trade-off is that custom fields cannot be indexed efficiently and can't be used in complex SQL joins.

### Odoo Studio (Enterprise only — not in Community source)

Community edition does NOT include Studio. Custom fields in Community must be added by Python developers via model inheritance or via the Properties field above.

### `ir.model.fields` — runtime field introspection

Every field defined in Python models is registered in `ir.model.fields`. Admin users can browse fields at Settings > Technical > Database Structure. Computed fields, required flags, field types, and labels are all stored. This powers dynamic UI (searches, exports, filters) without hardcoding field names in views.

### Views are data (`ir.ui.view`)

All view definitions (list, form, kanban, search) are stored in the database as `ir.ui.view` records loaded from XML. This means they can be overridden or extended by other modules using `inherit_id` + XPath without modifying the original file — the extensibility model. In Studio (Enterprise), views can be edited via UI.

### Saved filters / favorites (`ir.filters`)

Users can save their filter+groupby combinations as "Favorites" on any list/search view. These are `ir.filters` records scoped to a model, user (or shared). This is the end-user search-customization layer.

---

## 7. Full Feature Inventory

**Pipeline / Leads:**
- Dual mode: Leads queue (pre-qualification) + Opportunities pipeline, togglable per team
- Kanban pipeline with drag-and-drop stage transitions
- List view with inline editing
- Stage-specific requirements (tooltip hints for entry criteria)
- Won / Lost actions with reason codes (`crm.lost.reason`)
- Restore (un-lose) a lead
- "Rotting" detection: stage-level threshold; highlights stale records in kanban
- Duplicate detection by email domain (`_get_lead_duplicates`); surface count on record
- Merge duplicates wizard (`crm_merge_opportunities_views.xml`); field-level merge with priority selection
- Convert Lead → Opportunity wizard (creates/links `res.partner`)
- Bulk convert / assign in mass wizard (`crm_lead_to_opportunity_mass_views.xml`)

**Scoring / Analytics:**
- AI win probability (`automated_probability`) via Bayesian scoring frequency table (`crm.lead.scoring.frequency`)
- Manual probability override with re-align button
- Prorated revenue = `probability * expected_revenue`
- MRR / recurring revenue support (`recurring_plan`, `recurring_revenue_monthly`)
- Days-to-assign and days-to-close KPIs
- Activity report view (`crm_activity_report_views.xml`) — cross-lead activity analytics
- Opportunity forecast view

**Assignment:**
- Team-level capacity (`assignment_max` = sum of member quotas)
- Per-member capacity (`assignment_max`) + preferred-domain routing
- Auto-assign cron (daily) with weighted round-robin
- Deduplication during assignment
- Manual assign trigger per team

**Communication:**
- Email alias per team (inbound email → lead creation)
- Chatter: messages, notes, field-change log, file attachments
- Followers with per-subtype subscriptions
- CC field on leads (`mail.thread.cc`)
- Email blacklist integration (`mail.thread.blacklist`)
- Phone validation (`mail.thread.phone`)
- Scheduled activities: Call, Email, Meeting, Document, etc.
- Activity plans: multi-step activity templates
- Calendar integration: meetings linked to leads via `calendar_event_ids`
- Scheduled/deferred message sending (`mail.scheduled_message`)
- Push notifications (web push, mobile)
- Real-time discuss (bus/websocket via `ir.websocket`)

**Team Management:**
- Multiple sales teams; one team leader
- Team-scoped stages, pipelines, email aliases
- Team performance digest (`digest.py`)
- Dashboard with team stats

**Data Quality / Import:**
- Phone sanitization and quality flag (`phone_state`)
- Email normalization and quality flag (`email_state`)
- UTM tracking (campaign, medium, source) on leads
- "Referred by" field

**Search / Filters:**
- Full-text search with trigram index on `name`, `contact_name`, `partner_name`, `email_from`
- Filter by team, salesperson, stage, priority, deadline, activity state, won/lost
- Group by: stage, salesperson, team, country, source, campaign
- Activity-deadline sort (custom `search_fetch` override for `my_activity_date_deadline`)
- Saved favorites (`ir.filters`)

**Security:**
- Per-role record rules (own leads vs all leads vs manager view)
- Multi-company data isolation
- Per-operation permissions (read/write/create/delete independently controllable per rule)

---

## 8. UI/UX Patterns

**View types** (from `crm_lead_views.xml` and kanban/list/form XML files):

- **List view**: sortable columns, optional inline edit, group-by headers with aggregates (sum of expected_revenue per group), optional column hide/show.
- **Kanban view** (`crm_lead_views.xml`): columns = stages; cards show priority stars, activity status badge, expected revenue, salesperson avatar. Progress bar per column via `crm_column_progress.xml`. Fold empty columns automatically.
- **Form view**: ribbon badges (Lost/Won/Archived). Smart buttons in `oe_button_box` (Meetings count, Duplicate count). Stage status bar at top with `rotting_statusbar_duration` widget showing time-in-stage. Inline partner creation. Chatter + activity widget at bottom.
- **Forecast view**: a kanban variant grouped by `date_deadline` month for pipeline forecasting.
- **Activity report**: pivot/graph view for cross-record activity analysis.
- **Calendar view**: leads displayed as calendar events by `date_deadline`.

**Search bar patterns:**
- Unified search box with type-ahead suggestions for filter types.
- Facet chips for active filters (removable).
- "Favorites" dropdown for saved searches.
- Group-by and filter dropdowns.

**Activity widget (chatter):**
- Timeline of messages + activities in reverse-chronological order.
- "Log note" vs "Send message" (note = internal only, message = emails followers).
- Activity scheduling inline with type picker, due date, assignee.
- "Mark as done" inline with feedback field.

**Kanban activity badge:**
- Small colored circle on kanban cards: green (planned), orange (today), red (overdue). Uses `activity_state` from `MailActivityMixin`.

**Rotting widget:**
- `rotting_statusbar_duration` on the stage status bar in form view: shows how long the record has been in the current stage and highlights if past the threshold.

**Priority stars:**
- 1-3 star widget (`priority` field) for quick lead prioritization directly from list/kanban.

**Ribbon badges:**
- `web_ribbon` widget shows "Won" / "Lost" / "Archived" overlays on the form card, driven by `won_status` and `active`.

**Rainbow man effect:**
- When marking a lead as Won, a celebratory animation fires if the deal meets certain criteria (largest deal in last 31 days, etc.) — see `action_set_won_rainbowman()`.

---

## 9. What AltLeads Appears to Be Missing

This section is candid and specific. Sources: AltLeads context block + confirmed Odoo patterns above.

### 9.1 Deals / Opportunity Pipeline with Revenue Tracking

**Odoo has:** `expected_revenue`, `probability`, `prorated_revenue`, `recurring_revenue` + `recurring_plan`, `date_deadline`, `won_status` (won/lost/pending), `lost_reason_id`, `date_closed`, `day_open`, `day_close`.

**AltLeads missing:** No deal value, no win probability, no revenue forecast, no won/lost lifecycle on leads. The `lead_report` entity tracks per-project status/owner but has no financial dimension. For a sales CRM, win probability and expected revenue are core to pipeline management.

### 9.2 Lead → Opportunity Lifecycle Distinction

**Odoo has:** `type = Selection(['lead','opportunity'])`. Leads are unqualified inbound; opportunities are qualified and have revenue/probability. Conversion is a first-class action with a wizard.

**AltLeads missing:** Single lead entity; no pre-qualification "lead" vs. post-conversion "opportunity" distinction. AltLeads is outreach-first (agents create calls, not inbound leads), so the distinction is less critical — but the concept of a "qualified deal" separate from a raw lead is absent.

### 9.3 Collaborators / Secondary Ownership

**Odoo has:** `mail.followers` — any partner can follow any record and receive notifications. The system supports multiple people being notified without making them "owners."

**AltLeads status:** Building (`collaborators/secondary-owners` listed as next in backlog). No follower subscription mechanism yet. All notifications appear to go to primary owner only.

### 9.4 AI / Automated Win Probability

**Odoo has:** Bayesian `automated_probability` computed from `crm.lead.scoring.frequency` — tracks win/loss rates by field combinations (country, source, stage) and updates a probability score on every lead. Users can see both automated and manual probability.

**AltLeads missing:** No scoring model. Planned (see AI-PGVECTOR-PLAN) but not built. This is a meaningful differentiator for pipeline management.

### 9.5 Email Alias / Inbound Email → Lead Creation

**Odoo has:** `mail.alias` per team; inbound SMTP creates records automatically. Leads can originate from email replies, contact forms, etc.

**AltLeads:** Outreach-focused; no inbound email routing. All leads are manually imported or outbound-initiated. This is by design but limits future marketing/inbound scenarios.

### 9.6 Activity Plans (Multi-step Sequences)

**Odoo has:** `mail.activity.plan` + `mail.activity.plan_template`: define a named sequence of activities (e.g., "Demo Follow-up = Day 1: Call, Day 3: Email, Day 7: Proposal"). Apply a whole plan to a record at once.

**AltLeads has:** Individual tasks and interactions in the activity hub. No concept of a plan/sequence template that auto-schedules multiple future activities. This is essentially a cadence feature.

### 9.7 Per-Stage Entry Requirements / Rotting Detection

**Odoo has:** `crm_stage.requirements` (tooltip for entry criteria), `rotting_threshold_days` per stage, computed `is_rotting` flag, `rotting_statusbar_duration` widget showing time-in-stage.

**AltLeads missing:** No per-stage requirements documentation, no staleness/rotting detection. Records can sit in a status indefinitely without any system signal.

### 9.8 Weighted / Rule-Based Auto-Assignment

**Odoo has:** Team-level capacity + per-member quotas + domain-based preferred assignments + daily cron that distributes and deduplicates. Lead allocation is proportional to team size.

**AltLeads has:** Bulk reassign (manual). No automated assignment engine, no capacity management, no round-robin or domain-filtered routing.

### 9.9 UTM / Marketing Attribution

**Odoo has:** `campaign_id`, `medium_id`, `source_id` (UTM mixin) on leads — tracks which campaign/channel generated the lead, with won/lost frequency tables used for ML probability scoring.

**AltLeads missing:** No marketing attribution on leads. Relevant if AltLeads ever adds inbound lead capture (web forms, advertising).

### 9.10 Revenue Analytics and Forecasting

**Odoo has:** Forecast kanban (leads grouped by closing month × probability), opportunity report (pivot/graph on revenue by stage/team/salesperson), digest emails with KPIs.

**AltLeads has:** Status/owner reporting per project; no revenue funnel, no forecast view.

### 9.11 Per-Team Custom Fields (Properties)

**Odoo has:** `lead_properties` (`fields.Properties`) — teams define their own custom field schemas without migrations. Stored as JSON, rendered dynamically.

**AltLeads status:** Custom fields/metadata listed as "building next." No per-project or per-team custom field definition exists yet.

### 9.12 Phone/Email Quality Flags

**Odoo has:** `phone_state` (correct/incorrect), `email_state` (correct/incorrect) — computed from validation rules. `phone_sanitized` (E.164 format), `email_normalized`. `mail.blacklist` integration.

**AltLeads:** Basic contact data but no quality/validation scoring on phone/email fields.

---

## 10. Reverse-Engineering Feasibility

### Patterns that port cleanly to TS/React/Supabase+RLS

**A. Row-level security via domain rules → Supabase RLS policies**
Odoo's `ir.rule` is semantically identical to Supabase RLS policies: both are server-side Postgres WHERE clauses appended to queries. Translating `['|', ('user_id','=',user.id), ('user_id','=',False)]` to `auth.uid() = user_id OR user_id IS NULL` is direct. AltLeads already does this. The multi-group OR-combination logic mirrors how Supabase evaluates multiple policies with `PERMISSIVE` mode.

**B. Unified partner model (company + contact, parent-child)**
The `res.partner` `parent_id` self-reference maps cleanly to adding `parent_company_id FK → company_master` on `contact_master` (or vice versa). AltLeads already has `company_master` and `contact_master` as separate tables — this is actually cleaner than Odoo's unified table for query simplicity. The key insight to adopt: always resolve the commercial/topmost company via a computed field or view, not at the application layer.

**C. Activity lifecycle (prospective vs. retrospective)**
Odoo's clean split — activities are future TODOs (deleted on completion + chatter message posted) vs. messages are historical records — is an excellent pattern. AltLeads' `task` (prospective) + `interaction` (retrospective) maps to this. The difference: Odoo's activities are polymorphic (point at any model); AltLeads' tasks/interactions appear to be lead-scoped. Expanding to fully polymorphic (`res_model`/`res_id` style) would enable tasks on companies, contacts, projects — a meaningful upgrade.

**D. Followers / notification subscriptions**
`mail.followers` (res_model, res_id, partner_id, subtype_ids) is a clean junction table. AltLeads can model this as `record_followers(model TEXT, record_id BIGINT, user_id BIGINT, notification_types TEXT[])` with a partial unique index. The subtype pattern (subscribe to specific event types, not all notifications) prevents notification fatigue and is worth copying.

**E. Stage/pipeline with `is_won` flag and per-stage rotting thresholds**
The `is_won` boolean on a stage is cleaner than hardcoding a "Won" status — any stage can be a win stage. Adding `rotting_threshold_days` to AltLeads' status/stage table is a one-column migration. Both are straightforward Postgres column additions.

**F. Automation rule structure**
The `base.automation` trigger taxonomy is portable: create triggers, write triggers (with pre/post domain filtering), time-based (offset from a date field), and webhook triggers. AltLeads' planned "automation event-spine" should adopt similar vocabulary. The pre-domain (`filter_pre_domain`) / post-domain (`filter_domain`) pair for detecting "field changed FROM X TO Y" is worth copying exactly — it avoids storing old values separately.

**G. Per-member assignment quotas with round-robin**
The `crm.team.member` junction model with `assignment_max` + `assignment_domain` is directly portable as a column on a team-member junction table. Round-robin assignment can be implemented as a server-side Postgres function or a Node.js cron.

### Patterns that are Odoo-specific and NOT worth copying

**A. `ir.*` meta-layer (views as database records)**
Odoo stores views, menus, actions, and fields in the database (`ir.ui.view`, `ir.ui.menu`, `ir.actions.*`, `ir.model.fields`). This enables runtime view editing and module-based overrides. In AltLeads (React/Vite), views are compiled React components — this dynamic view system would require a complete view-renderer engine that is not practical to build and contradicts the fast-iteration advantage of a typed React frontend.

**B. Python ORM with mixin inheritance and `_inherit`**
Odoo's model inheritance system (protocol-based Python ORM that merges class hierarchies at runtime) is deeply Odoo-specific. The equivalent in TypeScript is composing hooks and utility functions. Do not try to replicate the mixin-at-ORM-level pattern; use React hook composition and PostgREST views/functions instead.

**C. QWeb / XML templates**
Odoo's QWeb server-side templating engine for emails and reports has no equivalent value in a React+Supabase stack. Use React components for UI and simple Handlebars/Mustache or template literals for email rendering in Node.

**D. `fields.Properties` (schemaless custom fields via JSON + PropertiesDefinition)**
While the concept (dynamic custom fields without migrations) is portable, Odoo's implementation is tightly coupled to the ORM's field introspection and UI rendering system. For AltLeads, the better approach for custom fields is a `metadata JSONB` column (already likely in use) or a `custom_field_definition` table + `custom_field_value` EAV table, with React rendering driven by the definition records. Supabase's JSONB indexing (`jsonb_path_ops`) makes JSONB custom fields searchable.

**E. Module/addon upgrade system**
Odoo's `--upgrade` and `_inherit` conflict resolution system manages schema migrations across addon updates. AltLeads uses explicit `.cjs` migration appliers — this is simpler and more appropriate for a single-product SaaS.

**F. Multi-company with `company_ids` context switching**
Odoo's multi-company mechanism (users switch active company context; all queries filtered by `allowed_company_ids`) is appropriate for an ERP used by resellers and holding companies. AltLeads' `project` boundary achieves the same tenant isolation more simply and should not be complicated with a multi-company layer.

**G. Email alias + fetchmail inbound routing**
Building an inbound email router (SMTP listener → parse → create record) is significant infrastructure. For AltLeads' current outreach-only posture, skip this. If inbound becomes needed, use a third-party service (Postmark Inbound, SendGrid Inbound Parse) that posts to a webhook — then AltLeads' future webhook-trigger automation can handle it.

### Overall Verdict

Odoo is a mature, comprehensive CRM/ERP with excellent data-model patterns — particularly in:
1. The unified partner model
2. The activity/chatter separation (prospective vs. retrospective)
3. The `ir.rule` row-level security model (directly analogous to Supabase RLS)
4. The `base.automation` trigger taxonomy (directly applicable to AltLeads' event-spine)
5. The per-stage rotting thresholds
6. The follower/subscription model

The framework infrastructure (ORM, view engine, module system) is entirely Odoo-specific and provides zero value to copy.

**Priority ports for AltLeads (ranked by impact/effort ratio):**
1. `is_won` flag on status + won/lost lifecycle with `lost_reason` — low effort, high pipeline value
2. Follower subscription model (junction table) — one migration, unlocks collaborators
3. Rotting threshold per status — one column on status table
4. `expected_revenue` + `probability` on leads — enables pipeline reporting
5. Activity plan templates (cadence sequences) — medium effort, high outreach-team value
6. Polymorphic tasks/interactions (`res_model`/`res_id`) — enables tasks on any entity
7. Automation trigger taxonomy (`on_stage_set`, `on_user_set`, `on_time`, `on_webhook`) — matches planned event-spine

---

*Generated from source read: `addons/crm/models/crm_lead.py`, `crm_stage.py`, `crm_team.py`, `crm_team_member.py`; `addons/mail/models/mail_thread.py`, `mail_followers.py`, `mail_activity.py`, `mail_activity_mixin.py`; `addons/sales_team/models/crm_team.py`; `addons/base_automation/models/base_automation.py`; `odoo/addons/base/models/res_partner.py`, `ir_rule.py`; `addons/crm/security/crm_security.xml`; `addons/crm/views/crm_lead_views.xml`.*
