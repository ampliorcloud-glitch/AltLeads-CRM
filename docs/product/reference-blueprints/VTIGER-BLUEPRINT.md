# Vtiger CRM — Architecture & Feature Blueprint

> **Purpose:** Read-only teardown of Vtiger CRM (open-source PHP edition) for AltLeads CRM reference.
> All paths are relative to the Vtiger source root at `E:\reference code for crm\vtigercrm`.
> Do NOT copy code — translate patterns only (different stack, different license).

---

## 1. Stack & Code Organization

**Runtime:** PHP (legacy procedural + OOP hybrid). No modern framework — vtiger invented its own micro-MVC conventions on top of a SugarCRM-derived base.

**MVC layout — per module:**
```
modules/<Module>/
  <Module>.php          ← "entity" class (CRMEntity subclass) — DB queries, field lists, related-list methods
  models/
    Module.php          ← Module-level model (metadata, field definitions, permissions checks)
    Record.php          ← Record-level model (CRUD helpers, computed values)
    ListView.php        ← List-view data model
    DetailView.php      ← Detail-view data model
  views/
    Detail.php          ← Detail view controller (renders Smarty template)
    Edit.php            ← Edit view controller
    ConvertLead.php     ← Custom views for specific actions
  actions/
    Save.php            ← POST handler (save record)
    TransferOwnership.php
  handlers/
    LeadHandler.php     ← Event hooks (before/after save, delete)
  dashboards/           ← Dashboard widget classes
  uitypes/              ← Custom field rendering overrides per module
```

**Base classes:**
- `modules/Vtiger/CRMEntity.php` — the root entity base. Every module entity inherits from this. It owns `create_list_query`, `getNonAdminAccessControlQuery`, the join pattern against `vtiger_crmentity`.
- `vtlib/Vtiger/Module.php` (class `Vtiger_Module`) — API for defining/modifying modules programmatically: `setRelatedList()`, relation types (`ONE_TO_MANY`, `MANY_TO_MANY`), field management.
- `vtlib/Vtiger/Field.php` (class `Vtiger_Field`) — creates/manages fields, picklist values, role-picklist associations.
- `vtlib/Vtiger/Profile.php` — profile-level capability management.

**Database schema convention (`vtiger_*`):**
- Every CRM entity has a row in `vtiger_crmentity` (the universal entity table: `crmid`, `setype`, `smownerid`, `smcreatorid`, `modifiedtime`, `createdtime`, `deleted`).
- Entity data is **split across multiple physical tables** joined on the primary key:
  - Leads: `vtiger_leaddetails` (core) + `vtiger_leadsubdetails` + `vtiger_leadaddress` + `vtiger_leadscf` (custom fields)
  - Contacts: `vtiger_contactdetails` + `vtiger_contactaddress` + `vtiger_contactsubdetails` + `vtiger_contactscf` + `vtiger_customerdetails`
  - Accounts: `vtiger_account` + `vtiger_accountbillads` + `vtiger_accountshipads` + `vtiger_accountscf`
  - Potentials: `vtiger_potential` + `vtiger_potentialscf`
- The `*scf` suffix = "custom fields" table — all admin-added custom fields land here in type-specific columns.
- Fields metadata lives in `vtiger_field` (fieldname, uitype, columnname, tablename, block, presence, mandatory, quickcreate, etc.).
- Module registry: `vtiger_tab` (tabid, name, presence, tabsequence).

**Routing:** `index.php?module=Leads&view=ConvertLead&record=123` → dispatcher loads `modules/Leads/views/ConvertLead.php` → `Leads_ConvertLead_View::process()`.

**Templating:** Smarty templates in `layouts/` (not studied in depth; views assign variables then call `$viewer->view('ConvertLead.tpl', $moduleName)`).

---

## 2. Core Data Model

### Lead (`vtiger_leaddetails`)
Primary fields: `leadid`, `salutation`, `firstname`, `lastname`, `company`, `email`, `phone`, `designation`, `leadsource`, `leadstatus`, `rating`, `industry`, `annualrevenue`, `website`, `converted` (0/1 flag).
Sub-table `vtiger_leadsubdetails`: `website`, `fax`, `mobile`, `secondaryemail`, `referredby`, `campaign`.
Address table `vtiger_leadaddress`: `leadaddressid`, `phone`, `mobile`, `fax`, `city`, `state`, `country`, `zip`.
Sort fields: `lastname`, `firstname`, `email`, `phone`, `company`, `smownerid`, `website`.

Leads are **pre-conversion prospects**. The `converted=1` flag is set after Lead Conversion; converted leads are excluded from the default list view query (`vtiger_leaddetails.converted=0`).

### Contact (`vtiger_contactdetails`)
Primary fields: `contactid`, `salutation`, `firstname`, `lastname`, `title`, `department`, `email`, `phone`, `mobile`, `fax`, `accountid` (FK → `vtiger_account`).
Sub-table `vtiger_contactsubdetails`: `assistant`, `otherphone`, `homephone`, `birthday`, `portal`, `portalpassword`.
Address: `vtiger_contactaddress` (mailing + other address sets).
Customer portal fields in `vtiger_customerdetails`.

Contacts are **always linked to an Account** via `accountid`. They can relate to Potentials, Quotes, SalesOrders, Invoices, HelpDesk tickets, Campaigns, Assets, Calendar events, Documents, Products, Vendors.

### Account (`vtiger_account`)
Primary fields: `accountid`, `accountname`, `phone`, `website`, `fax`, `email1`, `industry`, `account_type`, `rating`, `annualrevenue`, `employees`, `ownership`, `tickersymbol`, `parentid` (self-reference for account hierarchy).
Addresses: `vtiger_accountbillads`, `vtiger_accountshipads` (billing + shipping).
Relates to: Contacts, Potentials, Quotes, SalesOrders, Invoices, HelpDesk, Products, Calendar, Documents, Campaigns, Assets, Project, PurchaseOrder.

The `parentid` self-join enables a **multi-level account hierarchy** exposed via `views/AccountHierarchy.php`.

### Potential / Opportunity (`vtiger_potential`)
Primary fields: `potentialid`, `potentialname`, `related_to` (FK → `vtiger_account`), `contact_id` (FK → `vtiger_contactdetails`), `amount`, `closingdate`, `sales_stage`, `probability`, `campaign_id`, `leadsource`, `opportunity_type`.
Sort fields: `potentialname`, `amount`, `closingdate`, `smownerid`, `accountname`.

Potentials always link to one Account and optionally one Contact. Sales Stage is a role-scoped picklist. Dashboard widgets include Forecast, Funnel, GroupedBySalesPerson, GroupedBySalesStage.

### Lead Conversion (Lead → Contact + Account + Potential)
Class `Leads_ConvertLead_View` in `modules/Leads/views/ConvertLead.php` (GET renders form) + `modules/Leads/views/SaveConvertLead.php` (POST executes).

The conversion flow:
1. Shows Lead fields mapped to Account fields + Contact fields (via `getConvertLeadFields()` / `getAccountFieldsForLeadConvert()`).
2. Checks `Users_Privileges_Model::isPermitted('Accounts', 'CreateView')` — skips Account block if no permission.
3. Maps Lead→Account and Lead→Contact fields using `getConvertLeadMappedField($fieldName, $moduleName)`.
4. Optionally creates a linked Potential with `related_to` (Account) and `contact_id` (new Contact).
5. Sets `vtiger_leaddetails.converted = 1` on the source Lead.

This is the canonical "lead qualification" flow — a single atomic UI action that creates up to 3 records and links them.

---

## 3. Multi-tenancy / Access Control

Vtiger is **single-tenant** (one org per install). Access control is achieved through a 3-layer system:

### Roles (`vtiger_role`)
- Table: `vtiger_role` (`roleid`, `rolename`, `parentid`, `depth`, `description`).
- Roles form a **tree** (parent/child via `parentid`). Users inherit permissions from ancestor roles.
- `modules/Settings/Roles/models/Module.php` — base table is `vtiger_role`.
- Each role is linked to one or more Profiles.

### Profiles (`vtiger_profile`, `vtiger_profile2tab`, `vtiger_profile2field`)
- A Profile controls: which **modules** a role can access and which **actions** (View, Edit, Delete, Import, Export, Create) are allowed per module.
- At the field level, `vtiger_profile2field` stores per-field permission: `INACTIVE=0`, `READONLY=1`, `READWRITE=2` (`Settings_Profiles_Record_Model` constants).
- `vtiger_role2profile` maps roles → profiles (many-to-many; a user inherits the intersection).

### Sharing Access (`vtiger_def_org_share`, `vtiger_sharing_rules`)
- `Settings_SharingAccess_Module_Model` wraps `vtiger_def_org_share` — the **default org-level sharing** per module.
- Permission modes: `PUBLIC=2` (everyone can see all records), `READ_ONLY=0`, `READ_CREATE=1`, `PRIVATE=3` (owner-only).
- When PRIVATE, additional **Sharing Rules** in `vtiger_sharing_rules` define exceptions: "Role X can read Role Y's records", "Group A can read/write Group B's records".
- `RuleMember` model references `vtiger_role`, groups, and individual users as rule participants.

### Runtime access enforcement
`CRMEntity.getNonAdminAccessControlQuery()` injects SQL `WHERE` clauses based on cached privilege files per user (`user_privileges/user_privileges_<uid>.php`, `user_privileges/sharing_privileges_<uid>.php`). These flat PHP files are regenerated on role/profile changes — a pre-computed permission cache.

### Groups
`vtiger_groups` — named user groups. Records can be assigned to a group (smownerid = groupid). Sharing rules can target groups.

---

## 4. Activity / Communication Model

### Calendar / Activities (`vtiger_activity`)
Module `Calendar` handles both **Tasks** and **Events** (differentiated by `activitytype` field: `Call`, `Meeting`, `Task`).
- Table: `vtiger_activity` (`activityid`, `subject`, `activitytype`, `date_start`, `time_start`, `due_date`, `status`, `priority`, `visibility`, `duration_hours`, `location`, `recurringtype`).
- Linked to parent CRM entities via `vtiger_seactivityrel` (`crmid` → any entity, `activityid`).
- Linked to contacts via `vtiger_cntactivityrel` (`contactid`, `activityid`).
- Repeat/recurring events handled by `RepeatEvents.php` with `recurringtype` picklist.
- iCal import/export: `iCalExport.php`, `iCalImport.php`, full RFC 2445 support.
- Activity reminder via cron (`SendReminder.bat` / `actions/ActivityReminder.php`).

### ModComments
Separate module for **in-record comments** (threaded). Not deeply studied but present as a standalone module with its own `vtiger_modcomments` table — comments link to any crmid.

### Emails (`vtiger_activity` with type=Emails)
Emails are stored as activity records (`activitytype='Emails'`) in `vtiger_activity`, linked via `vtiger_seactivityrel`. Module `Emails` handles compose, templates, and inbound parsing. `vtiger_emaildetails` stores email-specific metadata (from, to, cc, bcc, messageid). Supports IMAP/POP3 mailbox scanning.

---

## 5. Automation / Workflow Engine

Module: `modules/com_vtiger_workflow/`. Fully custom event-driven engine.

### Storage tables
- `com_vtiger_workflows` — workflow definitions: `workflow_id`, `module_name`, `summary`, `test` (JSON condition array), `execution_condition`, `status`, `schtypeid`, `schtime`, `schdayofmonth`, `schdayofweek`, `schannualdates`, `nexttrigger_time`, `workflowname`.
- `com_vtiger_workflowtasks` — tasks serialized as PHP objects: `task_id`, `workflow_id`, `summary`, `task` (serialized PHP).
- `com_vtiger_workflowtask_queue` — execution queue for async task processing.

### Execution triggers (`VTWorkflowManager`)
- `ON_FIRST_SAVE = 1` — fires once on record creation.
- `ONCE = 2` — fires once ever per record (even after edits).
- `ON_EVERY_SAVE = 3` — fires on every save.
- `ON_MODIFY = 4` — fires only when record changes.
- `ON_SCHEDULE = 6` — time-based cron trigger (`WorkflowScheduler.inc` queries `nexttrigger_time`).
- `MANUAL = 7` — user-triggered from UI.

### Conditions (`VTJsonCondition`)
Conditions are stored as JSON arrays in `com_vtiger_workflows.test`. The `VTExpressionEvaluater` evaluates expression-language conditions against entity field values. `VTConditionalExpression` handles compound AND/OR logic.

### Task types (`tasks/`)
- `VTEmailTask` — send email using template + recipient expression. Has `executeImmediately=false` (always queued).
- `VTUpdateFieldsTask` — update field values on the triggering record.
- `VTCreateEntityTask` — create a new related entity (e.g., auto-create a Task when a Lead is saved).
- `VTCreateEventTask` — create a Calendar event.
- `VTCreateTodoTask` — create a Task activity.
- `VTSendNotificationTask` — internal notification.
- `VTSMSTask` — send SMS.
- `VTEntityMethodTask` — call an arbitrary method on the entity.

Tasks are serialized with PHP `serialize()` and stored as blobs — tightly coupled to PHP class names.

---

## 6. Customization

### Layout Editor (`modules/Settings/LayoutEditor`)
Admin UI to rearrange fields within **Blocks** on Detail/Edit views. Vtiger organizes fields into named blocks (e.g., "Lead Information", "Address Details"). Block metadata: `vtiger_blocks` (`blockid`, `tabid`, `blocklabel`, `sequence`, `show_title`, `display_status`). Field-block assignment: `vtiger_field.block` (FK → `vtiger_blocks`).

### Custom Fields
New fields added via admin → stored in `vtiger_field` and physically added as columns to the module's `*scf` custom-field table (`vtiger_leadscf`, `vtiger_accountscf`, etc.). Field types (`uitype` column): text, integer, date, datetime, picklist, multi-select, relate, url, email, phone, checkbox, currency, decimal, image. Module custom fields are schema-first — a real column is altered/added to the SCF table.

### Custom Views / Saved Filters (`CustomView` module)
`vtiger_customview` (`cvid`, `viewname`, `setdefault`, `status`, `userid`, `module`) — per-user or system saved views. `vtiger_cvcolumnlist` stores which columns appear. `vtiger_cvadvfilter` stores advanced filter conditions. Filter operators: `e` (equals), `n` (not equal), `s` (starts with), `ew` (ends with), `c` (contains), `k` (does not contain), `l`/`g` (less/greater than), `b`/`a` (before/after date), `bw` (between). Views have an approval flow (`actions/Approve.php`, `actions/Deny.php`) — non-admin-created views require admin approval.

### Picklists (`vtiger_picklist`, `vtiger_role2picklist`)
Each picklist field has a dedicated table (`vtiger_leadstatus`, `vtiger_leadsource`, etc.) + a registry entry in `vtiger_picklist`. Values are **role-scoped** via `vtiger_role2picklist` (`roleid`, `picklistvalueid`, `picklistid`, `sortid`) — each role sees a (potentially different) subset of picklist options. `Vtiger_Field::setPicklistValues()` handles creation and role association.

---

## 7. Full Feature Inventory

| Feature Area | Modules / Details |
|---|---|
| Core CRM | Leads, Contacts, Accounts, Potentials (Opportunities) |
| Activities | Calendar (Tasks + Events), Emails, ModComments |
| Sales pipeline | Potentials with sales_stage, probability, forecast dashboards |
| Marketing | Campaigns — links to Contacts/Accounts; campaign source on Potentials |
| Support | HelpDesk (Trouble Tickets), FAQ |
| Inventory / ERP lite | Products, Pricebooks, Quotes, SalesOrder, Invoice, PurchaseOrder |
| Service | Vendors, Services, ServiceContracts, Assets |
| Project management | Project module (linked to Accounts/Contacts) |
| Documents | Documents module with file attachments (`vtiger_senotesrel`) |
| Reporting | Reports module: tabular, summary, matrix reports; chart widgets; export CSV/PDF |
| Dashboards | Home dashboards with per-module widgets (Forecast, Funnel, TopPotentials, LeadsBySource) |
| Customization | Layout Editor, Custom Fields (schema-first SCF tables), Picklist Editor |
| Saved views | CustomView — per-user saved filters with advanced conditions + column picker |
| Automation | com_vtiger_workflow — event-driven + scheduled; 7 task types |
| Access control | Roles (tree) + Profiles (module+field permissions) + Sharing Rules |
| Import / Export | Per-module CSV import/export; duplicate-check on import |
| Duplicate detection | `handlers/CheckDuplicateHandler.php` — field-level duplicate check on save |
| Lead conversion | Atomic Lead → Contact + Account + Potential with field mapping |
| Account hierarchy | Parent account self-reference; `AccountHierarchy` view |
| Portal | `Portal` module — customer self-service portal (HelpDesk + Contacts) |
| RSS | Rss module — news feed widget |
| iCal | Calendar iCal import/export (RFC 2445 compliant) |
| OAuth2 | `Oauth2` module — API authentication |
| REST API | `include/Webservices/` — full CRUD REST API for all modules |
| PDF generation | `vtlib/Vtiger/PDF/` — PDF export for Quotes/Invoices using TCPDF |
| Cron / Scheduler | `vtlib/Vtiger/Cron.php` — cron task registry; workflow scheduler runs on each cron tick |
| Multi-language | `vtlib/Vtiger/Language.php` — full i18n, per-module language files |
| Groups | Named user groups; records assignable to groups |
| Audit trail | `vtiger_audit` — logs who changed what field (module-level opt-in) |
| Merge / Dedup | Not studied in depth but `CheckDuplicateHandler` suggests field-match dedup |

---

## 8. UI/UX Patterns

**List View (ListView):**
- Column-sortable tabular list with pagination.
- Column selector (customizable visible columns per user per module).
- Saved filters (CustomView) shown in a dropdown; user can create/edit/delete own filters.
- Mass actions: Mass Edit, Mass Delete, Mass Transfer Ownership, Export.
- Alpha search bar (jump to records starting with a letter).
- Quick Create from list view header (modal form with mandatory fields only).

**Detail View:**
- Read-only display organized into labelled Blocks (admin-configurable via Layout Editor).
- Related lists at the bottom — each is a tab or section showing linked records from other modules (Contacts on Account, Activities on Lead, etc.).
- Inline Edit on individual fields (double-click to edit without leaving the page).
- "More Detail" toggle to show/hide extended blocks.

**Edit View:**
- Same Block layout, editable.
- Relate fields use popup selector windows (`Popup` action) for picking related records.

**Kanban / Pipeline:**
- No dedicated Kanban board found in source. Pipeline visualization is done via dashboard widgets (Funnel chart, GroupedBySalesStage) rather than drag-and-drop Kanban.

**Dashboards (Home):**
- Home module aggregates configurable widgets per user. Widgets are PHP classes in each module's `dashboards/` directory. They render charts and top-N lists. Drag-and-drop layout via JavaScript.

**Quick Create:**
- Every module has `views/QuickCreateAjax.php` — a minimal form rendered in a modal, submitting only mandatory fields. Allows fast record creation from anywhere without leaving the current page.

**Popup Selector:**
- `action=Popup` mode renders a stripped-down list view in a browser popup for selecting related records. Used by Relate fields in edit forms.

**Search:**
- Basic search: single text field against `def_basicsearch_col`.
- Advanced Search: multi-field form, saved as CustomView.
- Global search across all modules via `vtiger_crmentity.label` text index.

---

## 9. What AltLeads appears to be MISSING

Based on the Vtiger feature set vs. AltLeads's current state (TypeScript/React/Supabase; entities: company_master, contact_master, lead_master, lead_report, meeting_master, task, interaction; roles: ADMIN/TEAM_LEAD/AGENT/SALES_HEAD/SALES_PERSON/QC):

| Gap | Vtiger Pattern | AltLeads Status |
|---|---|---|
| **Deals / Pipeline module** | `Potentials` with `sales_stage`, `amount`, `closingdate`, `probability`, campaign linkage, and full forecast dashboards | Building next — not yet live |
| **Lead Conversion flow** | Atomic Leads→Contact+Account+Potential with admin-configurable field mapping UI | No equivalent — leads exist as lead_master+lead_report but no conversion action creates Company+Contact+Deal atomically |
| **Account hierarchy** | `parentid` self-reference on `vtiger_account`; dedicated hierarchy view | `company_master` has no parent-child org hierarchy |
| **Role-scoped picklist values** | Each role sees a custom subset of every picklist (`vtiger_role2picklist`) | Picklists are global — no role-based value visibility |
| **Custom fields (schema-first)** | Admin can add any field type; physically added as column to SCF table | Planned (`custom fields/metadata` roadmap item) — not yet built |
| **Layout Editor / Block customization** | Admin rearranges fields into blocks per module without code | No equivalent; layout is hardcoded in React components |
| **Sharing Rules (record-level access)** | Per-module default (Public/Private) + exception rules between roles/groups | RLS is owner-based only (created_by or project scoping); no cross-role sharing rules |
| **Workflow / Automation engine** | 7 trigger types, expression conditions, 8+ task types, scheduler | Planned as "automation event-spine" — nothing shipped |
| **Campaigns / Marketing** | Full campaign module with contact/account membership, campaign source on Potentials | No marketing or campaign module |
| **Reports engine** | Tabular/summary/matrix reports, chart widgets, PDF export, scheduled delivery | No reporting module; export is CSV only |
| **HelpDesk / Support tickets** | Ticketing linked to Contacts/Accounts | No support/ticket module |
| **Customer portal** | Self-service portal for contacts to view/create support tickets | Planned (client/sales portal) — shell only |
| **Document management** | Attached files on any entity via `vtiger_senotesrel` | No document storage beyond interaction notes |
| **Inventory / ERP** | Products, Pricebooks, Quotes, SalesOrder, Invoice, PurchaseOrder | Out of scope for AltLeads's outreach CRM focus |
| **CustomView approval flow** | Non-admin saved views need admin approval before becoming available | AltLeads saved views (if built) have no approval mechanism |
| **Activity reminders (cron)** | Scheduled email reminders for due activities via cron | No scheduled reminder engine |
| **Audit trail** | Per-field change log | No field-level audit trail on records |
| **Groups** | User groups as record owners; group-based sharing rules | No user groups — only individual user ownership |
| **iCal integration** | Import/export RFC 2445 iCal from Calendar | No calendar sync |
| **Global search (label index)** | `vtiger_crmentity.label` full-text search across all entities | Per-module search only |

---

## 10. Reverse-engineering feasibility

**Verdict: High feasibility for behavioral patterns; low feasibility for direct code reuse.**

Vtiger's codebase is a PHP 5.x-era monolith forked from SugarCRM. The patterns are clear, the data model is well-documented by the code itself, and there are no obfuscated or encrypted sections. Everything relevant to our roadmap can be understood by reading the module PHP files — which this document now covers at sufficient depth.

**What translates directly to AltLeads (TypeScript/React/Supabase):**

1. **Entity-table split pattern** — Vtiger's `vtiger_crmentity` + `vtiger_leaddetails` is analogous to AltLeads's `lead_master` + `lead_report`. The pattern of a universal entity spine table + per-module detail table is already in use; continue it for Deals.

2. **Lead conversion UI flow** — The Leads→Contact+Account+Potential field-mapping form is the most borrowable single pattern. We can build a `ConvertLead`-style view that creates a Company+Contact+Deal from a lead_master record, mapping fields across entities, in one atomic Supabase transaction.

3. **CustomView filter schema** — `vtiger_cvadvfilter` operator set (`e`, `n`, `s`, `ew`, `c`, `l`, `g`, `b`, `a`, `bw`) maps cleanly to our advanced filter engine. The approval flow for non-admin views is worth considering for the Sales portal.

4. **Workflow trigger model** — The 7 execution conditions (`ON_FIRST_SAVE`, `ONCE`, `ON_EVERY_SAVE`, `ON_MODIFY`, `ON_SCHEDULE`, `MANUAL`) are the right abstraction for our planned automation event-spine. Model `com_vtiger_workflows.execution_condition` as an enum in our Postgres schema.

5. **Role-scoped picklist values** — The `vtiger_role2picklist` pattern (each role sees a subset of picklist values) is directly applicable when we add custom fields. Without this, agents in one team can set field values that others cannot.

**What NOT to replicate:**
- The physical SCF column-per-custom-field approach is fine for PHP but wrong for Postgres/Supabase. Use a JSONB `custom_fields` column or a `entity_field_values` EAV table instead.
- Task serialization as PHP `serialize()` blobs — use JSON.
- Flat PHP privilege cache files — use Supabase RLS + JWT claims.
- The popup-window relate-field selector — use autocomplete search inputs (already done in AltLeads).
