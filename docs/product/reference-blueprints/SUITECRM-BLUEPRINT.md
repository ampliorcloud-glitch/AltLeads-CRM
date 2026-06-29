# SuiteCRM Architecture Blueprint
**Source:** `E:\reference code for crm\suitecrm` (git branch: hotfix)
**Purpose:** Reverse-engineering reference for AltLeads CRM — do NOT copy code (AGPL); translate patterns into TS/React/Supabase.

---

## 1. Stack & Code Organization

### Technology Stack
- **Language:** PHP 7.x/8.x (class-based, no framework; uses SugarCRM's proprietary MVC)
- **Templating:** Smarty (`.tpl` files) for all views
- **Database:** MySQL (schema defined entirely via PHP `$dictionary` arrays — no migrations as SQL files)
- **Authentication:** Session-based (custom `SugarSession`)
- **REST API:** `/Api/V8/` — Slim framework, JSON:API spec, OAuth2 (`AccessTokenEntity`, `ClientEntity`), routes in `Api/V8/Config/routes.php`
- **Frontend:** jQuery + vanilla JS (no modern framework); dashlets use lightweight widget pattern

### Directory Layout
```
suitecrm/
  modules/            ← One directory per module (600+ modules total)
    Accounts/
      vardefs.php     ← Field + relationship definitions (the "schema")
      Account.php     ← Bean class (business logic)
      metadata/
        detailviewdefs.php   ← field layout for Detail view
        editviewdefs.php     ← field layout for Edit view
        listviewdefs.php     ← columns for list view
        searchdefs.php       ← advanced search fields
        SearchFields.php     ← search field metadata
        subpaneldefs.php     ← which subpanels appear on the detail view
        subpanels/           ← column layout for each subpanel
          default.php
      views/
        view.list.php        ← controller for list
        view.detail.php      ← controller for detail
      language/
        en_us.lang.php       ← all label strings
  include/
    SugarObjects/
      templates/      ← Base object templates (mixins/traits in PHP OOP)
        basic/        ← Template: Basic (id, dates, deleted, created_by, modified_by)
        person/       ← Template: Person (first_name, last_name, salutation, all address fields, phone fields)
        company/      ← Template: Company (name, phone_office, website, industry, address block)
        sale/         ← Template: Sale (amount, currency, date_closed, probability, sales_stage)
        issue/        ← Template: Issue (case_number, priority, status, resolution)
        file/         ← Template: File (filename, file_mime_type, file_url)
      implements/
        assignable/   ← Mixin: adds assigned_user_id, assigned_user_name
        security_groups/ ← Mixin: plugs SecurityGroup M2M onto any module
  Api/
    V8/               ← REST API v8 (JSON:API, OAuth2)
  DynamicFields/      ← Studio custom-field engine (also at modules/DynamicFields/)
```

### VardefManager — the Schema Engine
Every module calls `VardefManager::createVardef($module, $beanName, $templates)` at the bottom of its `vardefs.php`. This merges the named SugarObject templates into the module's `$dictionary` array. For example, `Accounts/vardefs.php` calls:

```php
VardefManager::createVardef('Accounts', 'Account', ['default', 'assignable', 'security_groups', 'company']);
```

- `default` = the `basic` template (id, timestamps, created_by, modified_by, deleted)
- `assignable` = adds `assigned_user_id`, `assigned_user_name`, `assigned_user_link`
- `security_groups` = adds SecurityGroup M2M link
- `company`/`person`/`sale` = domain-specific field sets

This gives every standard bean: `id` (UUID), `date_entered`, `date_modified`, `created_by`, `modified_user_id`, `deleted` (soft-delete flag), `name`.

### Relationship Types in Vardefs
- `one-to-many` — FK on the RHS table (e.g. `account_id` on `contacts`)
- `many-to-many` — join table (e.g. `calls_contacts`, `meetings_users`)
- `relationship_role_column` + `relationship_role_column_value` — polymorphic FK pattern: the join column `parent_type` discriminates which module (`Accounts`, `Contacts`, `Opportunities`, etc.) the `parent_id` FK points to

---

## 2. Core CRM Data Model

### Account (`modules/Accounts/vardefs.php` → table `accounts`)
Extends templates: `default`, `assignable`, `security_groups`, `company`.

**Key native fields:**
- `parent_id` / `parent_name` — self-referential parent Account (hierarchy via `member_accounts` one-to-many)
- `sic_code` — SIC industry code
- `campaign_id` / `campaign_name` — originating Campaign
- `audited = true`, `duplicate_merge = true`, `unified_search = true`, `full_text_search = true`
- `optimistic_locking = true` — ETags-style guard on save

**Inherits from `company` template:** `name`, `phone_office`, `phone_fax`, `website`, `industry`, `account_type`, `rating`, `employees`, `annual_revenue`, `ticker_symbol`, `ownership`, `billing_address_*`, `shipping_address_*`

**Relationship links (all `source: non-db`):**
- `contacts` → `accounts_contacts` (M2M via join table)
- `opportunities` → `accounts_opportunities` (one-to-many)
- `leads` → `account_leads` (one-to-many)
- `cases` → `account_cases` (one-to-many)
- `tasks`, `notes`, `meetings`, `calls`, `emails` → polymorphic via `parent_type`/`parent_id`
- `documents` → `documents_accounts` (M2M)
- `bugs` → `accounts_bugs` (M2M)
- `campaigns` → `account_campaign_log` (one-to-many via `campaign_log`)
- `members` / `member_of` → `member_accounts` self-referential
- `aos_quotes`, `aos_invoices`, `aos_contracts` → quote/invoice/contract modules
- `project` → `projects_accounts`
- `email_addresses`, `email_addresses_primary` → `EmailAddress` module (normalised email table)

### Contact (`modules/Contacts/vardefs.php` → table `contacts`)
Extends: `default`, `assignable`, `security_groups`, `person`.

**Key native fields:**
- `account_id` / `account_name` → relate to Accounts (via `accounts_contacts` M2M)
- `reports_to_id` / `report_to_name` → self-referential hierarchy via `contact_direct_reports`
- `lead_source` (enum: `lead_source_dom`)
- `birthdate` (date)
- `opportunity_role` / `opportunity_role_fields` — relationship field on `opportunities_contacts` M2M storing the contact's role in each opportunity
- `sync_contact` — Outlook sync flag
- `joomla_account_id`, `portal_user_type` — portal/customer access fields
- `c_accept_status_fields`, `m_accept_status_fields` — per-Call/Meeting accept status stored on the M2M join

**Inherits from `person` template:** `first_name`, `last_name`, `salutation`, `title`, `department`, `phone_work`, `phone_mobile`, `phone_other`, `phone_fax`, `phone_home`, `email1`, `email2`, `primary_address_*`, `alt_address_*`, `description`, `do_not_call`, `email_opt_out`, `invalid_email`

**Key relationships:** `opportunities` (M2M with role field), `cases` (M2M), `bugs` (M2M), `calls`, `meetings`, `tasks`, `notes`, `emails`, `documents`, `leads` (converted-from), `fp_events_contacts` (event attendance), `aop_case_updates`, `aos_quotes`, `aos_invoices`, `aos_contracts`, `user_sync`

### Lead (`modules/Leads/vardefs.php` → table `leads`)
Extends: `default`, `assignable`, `security_groups`, `person`.

**Key native fields:**
- `converted` (bool) — set to `1` when Lead is converted
- `contact_id`, `account_id`, `opportunity_id` — FKs filled after conversion
- `status` (enum: `lead_status_dom`)
- `lead_source` / `lead_source_description` (enum + text)
- `refered_by` (varchar)
- `account_name`, `account_description` — flat text copies (Lead has no FK to Accounts before conversion)
- `opportunity_name`, `opportunity_amount` — flat text copies
- `campaign_id` → Campaign attribution
- `portal_name`, `portal_app` — web-to-lead portal origin
- `website` (url)
- `reports_to_id` → self-referential hierarchy

**Key relationships:** `contacts`, `accounts`, `opportunity`, `calls`, `meetings`, `tasks`, `notes`, `emails`, `campaigns`, `prospect_lists`, `fp_events_leads_1`

### Opportunity (`modules/Opportunities/vardefs.php` → table `opportunities`)
Extends: `default`, `assignable`, `security_groups`.

**Key native fields:**
- `name` (required)
- `account_id` / `account_name` (required, relate to Accounts)
- `opportunity_type` (enum: `opportunity_type_dom` — Existing Business, New Business)
- `lead_source` (enum)
- `amount` / `amount_usdollar` (currency type — stored in native + USD)
- `currency_id` — multi-currency support
- `date_closed` (required date)
- `sales_stage` (required enum: `sales_stage_dom` — Prospecting, Qualification, Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost)
- `probability` (int 0–100, maps to sales_stage by default)
- `next_step` (varchar)
- `campaign_id`

**Key relationships:** `contacts` (M2M with `contact_role` relationship field), `tasks`, `notes`, `meetings`, `calls`, `emails`, `documents`, `leads`, `project`, `currencies`, `aos_quotes`, `aos_contracts`

### Lead Conversion Flow (`modules/Leads/metadata/convertdefs.php`)
SuiteCRM's `view.convertlead.php` presents a wizard with collapsible sections for each target module. Each section can: create a new record (`default_action = 'create'`), or select an existing one. The `convertdefs.php` file defines per-module panels:

- **Contacts** — required; `copyData: true` (pre-fills from Lead fields)
- **Accounts** — required; `copyData: true`; links to Contact via `accounts_contacts`
- **Opportunities** — optional; `copyData: true`
- **Notes** — optional; `copyData: false`
- **Calls** — optional; `copyData: false`
- **Meetings** — optional; `copyData: false`
- **Tasks** — optional; `copyData: false`

After conversion: `Lead.converted = 1`, and `Lead.contact_id`, `Lead.account_id`, `Lead.opportunity_id` are set to the newly created record IDs.

---

## 3. Multi-tenancy / Access Control

### Two Complementary Layers

#### Layer 1 — ACLRoles (module-level permission matrix)
Source: `modules/ACLRoles/vardefs.php`, `modules/ACLActions/actiondefs.php`

- A **Role** (`acl_roles` table) has a `name` and a list of **ACLActions** (one row per module × action in `acl_actions` table)
- Roles are linked to **Users** via `acl_roles_users` M2M
- Roles are linked to **SecurityGroups** via `securitygroups_acl_roles` M2M
- Permission levels defined in `actiondefs.php`:

  | Constant | Value | Meaning |
  |---|---|---|
  | `ACL_ALLOW_ALL` | 90 | Access all records |
  | `ACL_ALLOW_OWNER` | 75 | Access only own records (assigned_user_id = current user) |
  | `ACL_ALLOW_NONE` | -99 | No access |
  | `ACL_ALLOW_ENABLED` | 89 | Module access enabled |
  | `ACL_ALLOW_DISABLED` | -98 | Module access disabled |
  | `ACL_ALLOW_ADMIN` | 99 | Admin-only |
  | `ACL_ALLOW_DEFAULT` | 0 | Inherit system default |

- **Actions controlled per module:** `access`, `view`, `list`, `edit`, `delete`, `import`, `export`, `massupdate`
- The `ACL_ALLOW_OWNER` level is the key record-level gate: the bean's `bean_implements('ACL')` method must return true, and the SugarCRM core then compares `assigned_user_id` to the logged-in user.

#### Layer 2 — SecurityGroups (group-level record visibility)
Source: `modules/SecurityGroups/vardefs.php`

- A **SecurityGroup** (`securitygroups` table) is a named group of users + an ACLRole
- Records get associated to one or more groups via `securitygroups_records` M2M (auto-populated on save by the SecurityGroups plugin)
- `noninheritable` flag controls whether new child records inherit parent's groups
- `primary_group` flag on the user↔group relationship controls which group a user's new records default to
- Users see only records in groups they belong to (enforced at query time by adding a join to `securitygroups_records`)
- `AOW_WorkFlow` and `AOW_Action` both set `disable_row_level_security = true` — workflow runs server-side without group restriction

#### Comparison to AltLeads Project-Scoped RLS
SuiteCRM's model is role + group based. AltLeads uses Supabase RLS policies gated on `project_id` (the tenant boundary). The equivalent mapping:
- SuiteCRM's **SecurityGroup** ≈ AltLeads' **project** (tenant isolation unit)
- SuiteCRM's **ACLRole actions** ≈ AltLeads' role constants (ADMIN=1, TEAM_LEAD=2, AGENT=3, etc.)
- SuiteCRM's `ACL_ALLOW_OWNER` ≈ AltLeads' `lead_report.user_id = auth.uid()` RLS policy
- Key difference: SuiteCRM can assign a record to multiple groups simultaneously; AltLeads' `lead_report` table gives each lead a single owner per project

---

## 4. Activity / Communication Model

### Activity Modules

All four activity modules use the polymorphic `parent_type` / `parent_id` pattern, linking activities to any CRM record. The five distinct modules are:

#### Calls (`modules/Calls/vardefs.php` → table `calls`)
- `name` (subject), `status` (Planned/Held/Not Held), `direction` (Inbound/Outbound)
- `date_start` / `date_end` (datetimecombo), `duration_hours` / `duration_minutes`
- `parent_type` / `parent_id` — polymorphic link to Account/Contact/Lead/Opportunity/Case/etc.
- `reminder_time` / `email_reminder_time` — pre-call alert configuration
- `repeat_type`, `repeat_interval`, `repeat_dow`, `repeat_until`, `repeat_count`, `repeat_parent_id` — **recurring calls** (Daily/Weekly/Monthly/Yearly)
- `recurring_source` — which system generated the recurrence
- `reschedule_count` / `reschedule_history` — tracks rescheduling events
- `calls_reschedule` link → `Calls_Reschedule` module
- `outlook_id` — Outlook sync
- Many-to-many with Users (`calls_users`) — multiple invitees with per-user `accept_status`
- Many-to-many with Contacts (`calls_contacts`), Leads (`calls_leads`)

#### Meetings (`modules/Meetings/vardefs.php` → table `meetings`)
- Same duration/date/reminder/repeat fields as Calls
- `location` (varchar)
- `type` (enum `eapm_list` — WebEx, Sugar, GoToMeeting integration hooks via EAPM)
- `join_url`, `host_url`, `displayed_url` — web conferencing integration
- `external_id` — third-party meeting API ID
- `sequence` — iCalendar update sequence number
- `gsync_id`, `gsync_lastsync` — Google Calendar sync
- Many-to-many with Users (`meetings_users`), Contacts (`meetings_contacts`), Leads (`meetings_leads`)
- `calendar_account_meetings` → `CalendarAccount` module

#### Tasks (`modules/Tasks/vardefs.php` → table `tasks`)
- `name` (subject), `status` (Not Started/In Progress/Completed/Pending Input/Deferred), `priority` (High/Medium/Low)
- `date_due` / `date_start` (datetimecombo), `date_due_flag` / `date_start_flag` (checkboxes for "no date")
- `contact_id` / `contact_name` — direct FK to Contact (not just parent_type)
- `parent_type` / `parent_id` — polymorphic to Account/Opportunity/Case/Bug/Lead
- No recurrence (Tasks are one-shot)
- Links: `contacts`, `accounts`, `opportunities`, `cases`, `bugs`, `leads`, `projects`, `project_tasks`, `aos_contracts`

#### Notes (`modules/Notes/vardefs.php` → table `notes`)
- `name` (subject), `description` (full text)
- `filename` / `file_mime_type` / `file_url` — **attachment storage** (notes double as attachments)
- `portal_flag` — created via customer portal
- `embed_flag` — embedded inline in email
- `contact_id` — direct FK to Contact
- `parent_type` / `parent_id` — polymorphic
- Links to all activity modules (calls_notes, meetings_notes, tasks_notes) enabling notes on activities

#### Emails (`modules/Emails/` — not read in full but linked from all core modules)
- Linked via relationships: `emails_accounts_rel`, `emails_contacts_rel`, `emails_leads_rel`, `emails_opportunities_rel`
- SuiteCRM has a full Inbound Email module (`modules/InboundEmail/`) for IMAP polling and auto-linking
- Outbound emails via SMTP configuration per user
- Email templates via `modules/EmailTemplates/`

### Activity History vs. Upcoming Activities
SuiteCRM divides activities into two logical buckets on the Account/Contact detail view subpanels:
- **History** — past calls (`status = 'Held'`), past meetings, notes, sent emails
- **Activities** (open/future) — planned/in-progress calls, meetings, tasks not yet completed
This is implemented in the `subpaneldefs.php` as two separate subpanel definitions pulling from the same modules with different status filters.

---

## 5. Automation / Workflow Engine

### AOW (Advanced OpenWorkflow) — `modules/AOW_WorkFlow/`, `modules/AOW_Actions/`, `modules/AOW_Conditions/`, `modules/AOW_Processed/`

#### Data Model
- `AOW_WorkFlow` (`aow_workflow` table) — one workflow definition
  - `flow_module` (enum: any CRM module) — the triggering module
  - `status` (Active/Inactive)
  - `run_when` — trigger timing: `Always` | `On_Save` | `In_Scheduler` | `Create`
  - `flow_run_on` (enum: `aow_run_on_list`) — New Records Only / Modified Records Only / All Records
  - `multiple_runs` (bool) — whether a record can trigger the same workflow more than once
  - `run_on_import` (bool)
  - Links to `AOW_Conditions` (one-to-many) and `AOW_Actions` (one-to-many)
  - `AOW_Processed` (one-to-many) — audit log of runs

- `AOW_Conditions` (`aow_conditions` table) — each row is one condition check
  - `aow_workflow_id` FK
  - `field`, `operator`, `value`, `field_type` — the condition expression
  - Supported operators: `Equal_To`, `Not_Equal_To`, `Greater_Than`, `Less_Than`, `Greater_Than_or_Equal_To`, `Less_Than_or_Equal_To`, `Contains`, `Starts_With`, `Ends_With`, `is_null`

- `AOW_Actions` (`aow_actions` table) — each row is one action to execute
  - `aow_workflow_id` FK
  - `action_type` determines which action class runs
  - `action_class` stored as serialized PHP parameters

#### Built-in Action Types (`modules/AOW_Actions/actions.php`)
Four native action types:
1. **CreateRecord** (`actionCreateRecord.php`) — create a new bean of any module; supports Round-Robin assignment of the new record to a list of users
2. **ModifyRecord** (`actionModifyRecord.php`) — update fields on the triggering record
3. **SendEmail** (`actionSendEmail.php`) — send an email using an EmailTemplate; supports variable substitution from the bean
4. **ComputeField** (`actionComputeField.php`) — formula-based field calculation (uses `FormulaCalculator.php`)

Extensible via `custom/modules/AOW_Actions/Ext/Actions/actions.ext.php`.

#### Trigger Mechanism
- `On_Save` / `Always` — hooks into SugarBean's `after_save` logic hook; `AOW_WorkFlow::run_flows_for_bean($bean)` queries `aow_workflow` for active workflows where `flow_module = $bean->module_dir`
- `In_Scheduler` / `Create` — run via a cron scheduler job that queries all active workflows of the matching `run_when` type and iterates records

#### Other Automation Modules
- `modules/AOW_Processed/` — tracks which records have been processed by which workflow (prevents duplicate runs when `multiple_runs = false`)

---

## 6. Customization — Studio / DynamicFields / Module Builder

### Studio (in-app field/layout editor)
Studio is accessed at Admin → Studio and operates on the existing modules. It writes customizations to `custom/Extension/modules/<Module>/Ext/Vardefs/` and `custom/modules/<Module>/metadata/`.

### DynamicFields — Custom Field Engine (`modules/DynamicFields/`)
When Studio creates a custom field it uses the DynamicField system. Field types are implemented as PHP template classes:

| Template Class | Studio Field Type |
|---|---|
| `TemplateBoolean` | Checkbox |
| `TemplateCurrency` | Currency |
| `TemplateDate` | Date |
| `TemplateDatetimecombo` | Date/Time |
| `TemplateDecimal` | Decimal |
| `TemplateDynamicenum` | Dynamic Dropdown |
| `TemplateEmail` | Email |
| `TemplateEncrypt` | Encrypted |
| `TemplateEnum` | Dropdown |
| `TemplateFloat` | Float |
| `TemplateHTML` | HTML |
| `TemplateId` | ID |
| `TemplateIFrame` | IFrame |
| `TemplateImage` | Image |
| `TemplateInt` | Integer |
| `TemplateMultiEnum` | Multi-Select Dropdown |
| `TemplateParent` | Relate (polymorphic) |
| `TemplatePhone` | Phone |
| `TemplateRadioEnum` | Radio Button |
| `TemplateRelatedTextField` | Related Text Field (pull a field from a related record) |
| `TemplateText` | Text (varchar) |
| `TemplateTextArea` | Text Area |
| `TemplateURL` | URL |
| `TemplateWysiwyg` | WYSIWYG HTML Editor |
| `TemplateAddress` | Address (compound: street/city/state/zip/country) |
| `TemplateCronSchedule` | Cron Schedule (used by schedulers) |

Custom fields are stored in `fields_meta_data` table and merged into the module's vardef at runtime. The `custom_fields` column in the module's actual table holds the data (with `c_` prefix convention).

### Module Builder
Admin → Module Builder allows creating entire new custom modules from scratch, with choice of base template (Company, Person, Basic, Sale, Issue, File). Generates: vardefs.php, Bean.php, all metadata files, language files. Can be published to the module system or packaged as an installable zip.

### Dropdown Editor
Admin → Dropdown Editor manages `$app_list_strings` enum option lists. Any custom enum field references a dropdown key defined here.

---

## 7. Full Feature Inventory

### Core CRM Modules
- **Accounts** — company/organization records; hierarchical (member_of / members); full activity subpanels; multi-email; campaign attribution; quotes/invoices/contracts links
- **Contacts** — person records; linked to Account; direct-report hierarchy; Outlook sync; portal user; opportunity roles; event attendance
- **Leads** — pre-conversion person+company; Lead Conversion wizard (creates Contact+Account+Opportunity+activities); web-to-lead forms; campaign attribution
- **Opportunities** — pipeline records; multi-currency; sales stage + probability; linked to Account + Contacts (with roles); close date; quotes and contracts
- **Cases** — support tickets linked to Account; priority/severity/status/resolution; customer portal visibility; SLA tracking via AOP module

### Activity Modules
- **Calls** — inbound/outbound; duration; status (Planned/Held/Not Held); reminders; recurring; reschedule history; multi-invitee with accept status; Outlook sync
- **Meetings** — with location; recurring; WebEx/GoToMeeting integration via EAPM (External API Manager); Google Calendar sync; iCalendar sequence; accept status per invitee
- **Tasks** — due date + start date; priority; status; linked to Contact + any parent module
- **Notes** — subject + rich text description + file attachments; portal flag; linked to Contact + any parent module
- **Emails** — full email client (compose/send/receive); IMAP inbound; template support; linked to records on send/receive; email archive

### Campaign & Marketing
- **Campaigns** — email/newsletter/teaser/test/mail/webex campaign types; campaign wizard
- **ProspectLists** — target/test/exemption/seed lists; linked to Contacts/Leads/Accounts/Users
- **Prospects (Targets)** — lightweight lead-type for campaign targeting before full Lead creation
- **EmailTemplates** — HTML/text dual format; variable substitution; trackers
- **Campaign Log** — per-record campaign activity log (sent/clicked/opened/bounced/opted-out)
- **Trackers** — URL tracking for click-through metrics in campaigns

### Sales Productivity
- **AOS_Quotes** (Advanced OpenSales) — quotation builder with line items, tax, shipping, discount; linked to Account/Contact/Opportunity
- **AOS_Invoices** — invoice from quote; billing Account/Contact
- **AOS_Contracts** — contract management with start/end dates; linked to Account/Opportunity/Contacts
- **AOS_Products** (Product Catalog) — product/service catalog with pricing
- **AOS_Product_Categories** — product catalog taxonomy
- **AOS_PDF_Templates** — generate PDF documents from any module record (quotes, invoices, contracts, etc.)

### Projects
- **Project** — project header with description, assigned_to, start/end dates; linked to Accounts/Contacts/Opportunities
- **ProjectTask** — task within a project; dependencies; assigned_to; gantt chart data
- **AM_ProjectTemplates** — reusable project + task templates; gantt chart; dependency management

### Support / Bug Tracker
- **Bugs** — bug tracker with severity, priority, status, resolution, fix_in_ver, found_in_ver; linked to Accounts/Contacts/Cases
- **AOP_Cases_Quotes** — portal-side case updates module
- **AOP_Case_Updates** — individual update entries on a Case (portal thread)

### Reporting
- **Reports** (AOR_Reports) — Advanced OpenReports; row/summation/summation with details/matrix types; conditions, group-by, charts (line/bar/pie); scheduled email delivery; export to CSV/PDF
- **AOR_Conditions** — report filter conditions
- **AOR_Fields** — report column definitions
- **AOR_Charts** — chart configuration per report

### Events & Calendar
- **FP_events** (FoodPool Events module) — event management; invitation/accept workflow; linked to Contacts/Leads
- **FP_Event_Locations** — event venue data
- **Calendar** — unified calendar view across Calls/Meetings/Tasks; personal + shared calendars

### Customer Portal (Joomla-based)
- Contacts can have `joomla_account_id`, `portal_user_type` — giving them access to a self-service portal
- Cases and Notes have `portal_flag` controlling customer visibility
- `AOP_Case_Updates` feeds the portal case thread

### External Integrations
- **EAPM** (External API Manager) — manages credentials for: WebEx, GoToMeeting, Google, iCal, IBM SmartCloud, Jive (stored in `eapm` table)
- **OAuth2** — `/Api/V8/` supports OAuth2 for REST API; `AccessTokenRepository`, `RefreshTokenRepository` in `Api/V8/OAuth2/`
- **Outlook Plugin** — Calls/Meetings/Contacts sync via `outlook_id` and `sync_contact` fields
- **Google Calendar** — Meetings have `gsync_id` / `gsync_lastsync` for bi-directional sync

### Administration
- **Studio** — in-app layout/field editor (no code required)
- **Module Builder** — create custom modules
- **Dropdown Editor** — manage enum option lists
- **Roles (ACLRoles)** — per-module action permission matrix
- **SecurityGroups** — record-level group visibility
- **Users** — user management; roles assignment; license keys; preferences
- **Import** — CSV import for all major modules; mapping + de-dup options
- **Repair** — rebuild metadata cache, repair DB schema, clear cache
- **Schedulers** — cron-driven background jobs (campaign emails, workflow runs, reports)
- **Password Management** — complexity rules; reset email
- **Themes** — SuiteP default theme; admin-configurable colour/logo
- **Currency** — multi-currency with conversion rates
- **Taxes** — tax group management for AOS modules

### Search & Discovery
- **Global Search / Unified Search** — searches across all `unified_search = true` modules simultaneously; `full_text_search = true` enables ElasticSearch/FTS integration
- **Advanced Search** — per-module; `searchdefs.php` defines available search fields; supports range searches (date ranges, numeric ranges)
- **Saved Searches** — users save named search parameter sets per module; stored in `saved_search` table; recall from list view search bar

### Misc
- **Reminders** — popup + email reminders for Calls/Meetings; stored in `reminders` table
- **Calls_Reschedule** — tracks reschedule events on Calls (count + history log)
- **Documents** — document repository; revisions; linked to Accounts/Contacts/Opportunities/Cases
- **DocumentRevisions** — version history for Documents
- **History subpanel** — aggregated cross-module activity log on record detail view (calls + meetings + notes + emails filtered by status/date)
- **Recently Viewed** — `tracker` table records which records each user recently viewed
- **Duplicates Detection** — `duplicate_merge = true` on modules enables duplication detection on create; merge UI in list view
- **Audit Trail** — `audited = true` on modules/fields writes to `<module>_audit` table on change

---

## 8. UI/UX Patterns

### List View (`listviewdefs.php`)
- Each column defined with `key`, `label`, `width`, `link` (hyperlink?), `sortable`, `default` (shown by default)
- Supports `massupdate` flag per column — column is selectable for mass-update
- Checkbox column for multi-select; bulk action buttons (Delete, Mass Update, Export, Merge)
- Inline edit capability per field (click-to-edit without leaving list)
- Column sorting via GET param; pagination

### Detail View / Edit View (`detailviewdefs.php`, `editviewdefs.php`)
- Grid layout: `panels` → rows → `[column, column]`; `maxColumns` (typically 2)
- `widths` per panel — label width / field width percentages
- Fields can be `readonly`, `required`, hidden in specific views via `studio` array
- **QuickCreate** (`quickcreatedefs.php`) — simplified create form usable from subpanel "Create" buttons
- **Popup** (`popupdefs.php`) — selector popup (relate field lookups)
- `optimistic_locking = true` on most beans — prevents two users overwriting each other on concurrent edits

### Subpanels (`subpaneldefs.php` + `subpanels/default.php`)
Each module's `subpaneldefs.php` defines `subpanel_setup` array — one entry per subpanel shown on the Detail View. Each entry references a subpanel definition file that specifies:
- `module` — which module to pull from
- `subpanel_name` — which column layout file to use
- `sort_order`, `sort_by`
- `title_key` — display label
- `get_subpanel_data` — either a link name from vardefs or a custom function

Accounts module example: `activities` (open calls+meetings+tasks), `history` (held calls+meetings+notes+emails), `contacts`, `opportunities`, `leads`, `cases`, `bugs`, `documents`, `aos_quotes`, `aos_invoices`, `aos_contracts`, `members`

### Search (`searchdefs.php`, `SearchFields.php`)
- `searchdefs.php` — defines which fields appear in Basic and Advanced search panels
- `SearchFields.php` — defines search operators per field
- Range search for date/numeric fields via `enable_range_search = true` and `options = 'date_range_search_dom'`
- Saved Searches stored in `saved_search` table; user can save current search params as a named preset

### Dashlets
- Dashboard homepage shows configurable dashlets (mini-widgets)
- Each module that supports it has `Dashlets/` subdirectory with a `.meta.php` (column/sort config) and `.php` (rendering class)
- Built-in dashlet types: Saved Search list view, chart, iframe, RSS feed, calendar
- `AM_ProjectTemplates`, `AOW_WorkFlow`, `AOW_Processed` all have dashlet definitions

### Popup/Relate
- Relate fields (`type: relate`) open a popup window for record selection
- `popupdefs.php` defines popup columns and search fields
- Used extensively for `account_name` on Contact, `report_to_name` on Contact, `contact_name` on Tasks/Notes

---

## 9. What AltLeads Appears to Be MISSING

These are specific SuiteCRM capabilities with no evident AltLeads equivalent, assessed as of the context provided.

### 9.1 Formal Pipeline / Deals Module
SuiteCRM has `Opportunities` as a first-class module with: `sales_stage`, `amount`, `date_closed`, `probability`, `next_step`, and currency support. AltLeads context mentions "building next: deals/pipeline" — this is confirmed absent. Without it there is no structured revenue forecasting, no funnel-stage reporting, and no amount-weighted pipeline view.

### 9.2 Multi-Currency Support
SuiteCRM: `amount` + `amount_usdollar` stored separately; `currency_id` FK to `currencies` table with conversion rates; all monetary fields dual-stored. AltLeads: no indication of multi-currency or even a single currency field on any entity.

### 9.3 Recurring Activities
SuiteCRM Calls and Meetings have full recurrence: `repeat_type` (Daily/Weekly/Monthly/Yearly), `repeat_interval`, `repeat_dow`, `repeat_count`, `repeat_until`, `repeat_parent_id` linking instances to the series root. AltLeads' `meeting_master` and `interaction` tables likely have no recurrence model.

### 9.4 Call Reschedule Tracking
SuiteCRM tracks every reschedule event in `Calls_Reschedule` module with a `reschedule_count` and history log. AltLeads' `interaction` log records call outcomes but has no built-in rescheduling/reschedule-counter concept.

### 9.5 Lead Conversion Wizard
SuiteCRM's `convertdefs.php` + `view.convertlead.php` provide a structured wizard that simultaneously creates Contact + Account + Opportunity + optional activities from a Lead, with field pre-population. AltLeads currently has no formal lead-to-deal conversion flow; `lead_master` stays a `lead_master` with no promotion pathway.

### 9.6 Document Repository with Versioning
SuiteCRM has `Documents` + `DocumentRevisions` modules — full file upload, revision history, linked to all major modules. AltLeads has no document/file storage layer.

### 9.7 Full Email Client + Inbound Email
SuiteCRM ships a complete in-app email composer, IMAP inbound polling (`modules/InboundEmail/`), and auto-linking of inbound emails to Contacts/Accounts. AltLeads has email sending via notify-service but no inbound email parsing or in-app email client.

### 9.8 Campaigns & Marketing
SuiteCRM has a complete campaign engine: ProspectLists, campaign wizards, HTML email templates, campaign log, click trackers, suppression lists. AltLeads: none of this exists.

### 9.9 Quotes / Invoices / Contracts (AOS modules)
SuiteCRM's Advanced OpenSales modules handle: product catalog (`AOS_Products`), configurable line-item quoting (`AOS_Quotes`), invoice generation from quotes (`AOS_Invoices`), contract management (`AOS_Contracts`), PDF generation. AltLeads: no commercial/transactional layer at all.

### 9.10 Project Management (AM_ProjectTemplates, Project, ProjectTask)
Full Gantt chart project module with dependencies. AltLeads has a `task` table but no multi-task project with dependencies, milestones, or Gantt.

### 9.11 Bug/Issue Tracker
SuiteCRM has `Bugs` linked to Accounts/Contacts/Cases. AltLeads has no issue tracking module.

### 9.12 Customer Portal
SuiteCRM has Joomla-integrated portal: Contacts can log in and view/update Cases, read Knowledge Base articles. AltLeads has a "Sales Portal" (different purpose — internal) but no customer-facing self-service portal.

### 9.13 Reports Engine (AOR_Reports)
SuiteCRM has a full no-code report builder with conditions, grouping, charts, scheduled CSV/PDF email delivery. AltLeads has list views with filters and export but no configurable cross-module reporting engine.

### 9.14 Automation / Workflow (AOW)
SuiteCRM's AOW engine fires on any module save or by cron, evaluates conditions on bean fields, and executes actions (Create Record, Modify Record, Send Email, Compute Field). AltLeads context mentions "building next: automation event-spine" — the engine is on the roadmap but absent.

### 9.15 Custom Fields via Studio / DynamicFields
SuiteCRM's Studio lets non-technical admins add custom fields to any module without code. AltLeads context mentions "custom fields/metadata" as upcoming — not yet built.

### 9.16 Global Unified Search with Full-Text
SuiteCRM: `unified_search = true` enables cross-module global search; `full_text_search = true` enables ElasticSearch integration. AltLeads: search is per-module (companies, contacts, leads); no cross-module unified search.

### 9.17 Events Module (FP_Events)
SuiteCRM has full event management (invite tracking, accept/attend status, linked to Contacts/Leads). AltLeads: no events module.

### 9.18 Contact Hierarchy (reports_to)
SuiteCRM Contacts and Leads have `reports_to_id` — a self-referential hierarchy (org chart). AltLeads' `contact_master` has no organisational hierarchy.

### 9.19 Opportunity Contact Roles
SuiteCRM's `opportunities_contacts` M2M stores a `contact_role` field (e.g. Decision Maker, Influencer, Champion). AltLeads has no contact-role concept on any multi-party relationship.

### 9.20 Inbound Calling / VoIP Hooks
SuiteCRM's Calls module can mark direction (Inbound/Outbound) and has Outlook/calendar sync. No native VoIP CTI but the data model supports it. AltLeads' `interaction` log captures call outcomes but has no CTI or inbound-call model.

---

## 10. Reverse-Engineering Feasibility

### Patterns That Port Well to TS/React/Supabase

#### Vardef-style schema registry → JSON/TypeScript schema
The concept of a central `$dictionary` per module — defining fields with type, required, audited, searchable, importable — translates directly to a TypeScript object or JSON schema per table. AltLeads already has implicit "vardefs" in the form of Supabase table definitions. Formalising this as a `schema-registry.ts` with per-table metadata would enable automated UI generation (forms from schema) — very high ROI.

#### `parent_type` / `parent_id` polymorphic pattern
SuiteCRM uses `parent_type` (varchar) + `parent_id` (UUID) throughout activities to link them to any module. Supabase doesn't have polymorphic FKs natively but the pattern is simple: one `entity_type` column (enum or varchar) + one `entity_id` (UUID) column + a check constraint. AltLeads' `interaction` table uses a variant of this. Formalising it as the universal "link any record to any record" primitive would unblock the cross-module associations roadmap item.

#### SugarObject templates as TypeScript mixins / Supabase view functions
The `basic`, `assignable`, `person`, `company` templates are really just field sets that many tables share. In Supabase: common columns (`id`, `created_at`, `updated_at`, `created_by`, `deleted_at`) are already present on all tables. The `person` template (first_name, last_name, salutation, phone, address) could be extracted as a Postgres composite type or simply documented as a required column set for any "person-like" entity. The value is not in the infrastructure — it's in the documentation standard.

#### ACLActions permission matrix → Supabase RLS policies + role checks
SuiteCRM's `ACL_ALLOW_ALL` / `ACL_ALLOW_OWNER` / `ACL_ALLOW_NONE` per action per module is expressible as RLS policies. AltLeads already has this for the `lead_report` table. The missing dimension is explicit action-level control (export=false, massupdate=false for certain roles) — currently AltLeads enforces these at the React component level, not at DB level. Adding a `role_permissions` table with `(role, module, action, allowed)` rows and wrapping RLS accordingly would be a meaningful improvement for the SALES_PERSON / QC roles.

#### AOW Workflow engine → Supabase edge functions + pg_cron
The AOW pattern (trigger table: `aow_workflow`; condition rows: `aow_conditions`; action rows: `aow_actions`; processed log: `aow_processed`) is a clean data-driven automation model. Porting this to Supabase:
- `automation_workflows` table (equivalent to `aow_workflow`)
- `automation_conditions` + `automation_actions` child tables
- Supabase Database Webhooks or pg_triggers fire on record save; Edge Functions evaluate conditions and execute actions
- `automation_runs` for the processed log
This is the highest-ROI architecture pattern from SuiteCRM for AltLeads' roadmap "event-spine".

#### Lead Conversion Wizard → server-side transaction
SuiteCRM's conversion wizard runs in a single PHP transaction creating Contact + Account + Opportunity from a Lead. In Supabase: a single Postgres function (`CALL convert_lead(lead_id, ...)`) or an Edge Function can atomically insert into `contact_master`, `company_master`, `lead_report` (now status=Converted), and optionally a `deals` table. Very clean port.

#### DynamicFields / Studio → JSONB `custom_fields` column per table
SuiteCRM stores custom field values in the module table itself (via schema ALTER). For AltLeads, the simpler and more Supabase-idiomatic approach is:
- Add a `custom_fields JSONB` column to `lead_master`, `company_master`, `contact_master`
- Store field definitions in a `field_metadata` table: `(table_name, field_key, field_label, field_type, options, required, visible_roles[])`
- UI reads `field_metadata` and renders dynamic form sections; validates against schema on save
- This avoids DDL on every admin field-add and is trivially searchable via `@>` operator

#### Subpanel pattern → configurable related-record widgets
SuiteCRM's subpanel configuration (which related modules appear on a record's detail view, and in which column order) translates to a React component pattern where each detail page composes configurable `<RelatedRecordPanel module="Calls" filter={...} />` blocks. AltLeads' in-record activity hub is already doing this for interactions/tasks. The formalisation is: a `subpanel_config` table per `(module, context_module)` defining which panels appear and their sort order — allows admin-level layout config without code deploys.

#### Saved Searches → AltLeads Saved Views
SuiteCRM stores saved searches in a `saved_search` table (`name`, `module`, `search_type`, `contents` as serialised params). AltLeads already has "advanced filters + saved views" per CLAUDE.md. Direct parity exists — no gap here.

### Patterns That Are PHP/Sugar-Specific — Not Worth Copying

#### SugarBean PHP class hierarchy
Every SuiteCRM module extends a PHP class chain (`Account extends Company extends SugarObject extends SugarBean`). The dynamic property loading, `_get()` / `_set()` magic, relationship loading via `get_linked_beans()`, and `mark_deleted()` pattern are all deep PHP-isms with no TypeScript equivalent. AltLeads uses PostgREST + Supabase client SDK which is a fundamentally different access model.

#### Smarty templating
All views are Smarty `.tpl` files with PHP code-behind view controllers. The entire UI layer is obsolete; AltLeads already has a modern React/Vite stack.

#### Relationship metadata in PHP arrays
SuiteCRM's relationship engine — where `$dictionary['Account']['relationships']['member_accounts'] = [...]` both defines the schema AND generates SQL JOIN queries at runtime — is a clever PHP hack. In Postgres, foreign keys + RLS policies + views replace this entire layer cleanly. No value in porting the machinery; only the data model patterns matter.

#### Dropdown editor writing to `app_list_strings` PHP files
SuiteCRM manages enum option lists as PHP arrays written to disk. In Supabase, enum definitions belong in a `dropdown_options` table with `(key, value, label, sort_order)` rows.

#### Recurring activity recurrence-rules in raw DB columns
SuiteCRM stores `repeat_type`, `repeat_interval`, `repeat_dow`, `repeat_until`, `repeat_count` as flat DB columns. A cleaner TS/Postgres model uses an RFC 5545 RRULE string column + a Postgres function to expand occurrences, or uses a dedicated `recurrence_rules` JSONB column.

#### EAPM (External API Manager) credentials in DB
SuiteCRM stores WebEx/Google/GoToMeeting credentials per user in a DB table. For AltLeads, Supabase Vault or environment-level secrets are the right pattern.

### Overall Verdict

SuiteCRM is a battle-tested reference for **what a CRM must contain**. It is a poor reference for **how to build it** (PHP5-era OOP, Smarty templates, MySQL-specific hacks). The highest-ROI patterns to extract for AltLeads:

1. **Automation engine (AOW pattern)** — the condition/action/processed triple-table model is elegant and directly portable; this unblocks the AltLeads "event-spine" roadmap item
2. **DynamicFields as JSONB custom_fields** — the concept of admin-defined custom fields per module, translated to a `field_metadata` table + JSONB storage
3. **Formal Deals/Pipeline module** — Opportunity's `sales_stage`, `amount`, `probability`, `date_closed` model is well-proven; AltLeads needs a `deals` table with these exact fields
4. **Lead Conversion as a transaction** — atomic Lead→Contact+Account+Deal promotion via a single Postgres function
5. **Polymorphic `entity_type`/`entity_id` pattern** — universalise AltLeads' activity linking so any activity can link to any entity, not just `lead_report`
6. **ACL action matrix** — extend AltLeads' role system to include explicit per-module per-action toggles (not just read/write broadly) for Sales Portal role scoping
