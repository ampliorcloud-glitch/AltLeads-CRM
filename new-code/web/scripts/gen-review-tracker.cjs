/**
 * gen-review-tracker.cjs
 * ======================
 * Generates docs/Amplior-Review-Hub.xlsx — the ONE place for everything that
 * needs the owner: decisions to make, built work to review, and risks to know.
 *
 * Why a tracker (not an MD file): the owner asked for review items in a single
 * filterable place he can scan and act on, that Claude can also keep updating.
 * The .xlsx is gitignored (like the backlog) and regenerated from this tracked
 * script — so THIS file is the durable source of truth.
 *
 * Usage:  cd new-code/web && node scripts/gen-review-tracker.cjs
 *
 * To update: edit the DECISIONS / REVIEW / RISKS arrays below and re-run.
 */

'use strict';

const XLSX = require('xlsx');
const path = require('path');

const OUT_PATH = path.resolve(__dirname, '../../../docs/Amplior-Review-Hub.xlsx');
const UPDATED = '2026-06-25';

/* ─── 1. DECISIONS NEEDED (waiting on Ankit, the PM; business-level escalates to Mohit, CEO) ─
   [id, item, plainQuestion, options, whyItMatters, status, priority]          */
const DECISIONS = [
  ['DEC-09', 'Gate the LIVE site until security lands — URGENT',
    'crm.altleads.com is publicly reachable while the database security (RLS) is OFF and the anonymous key can read personal data. The advisor flags this as an active exposure right now. I cannot change the live deployment without your go.',
    'A) Put the live site behind a hard login wall / take it offline until RLS lands (I prepare it, you approve the push) · B) Accept the risk and leave it open',
    'A leaked/inspected key could expose every client\'s contact data (incl. HungerBox). For an outreach vendor whose product IS client data, one incident ends trust. Highest-urgency item on this list.',
    'Awaiting you', 'P0'],
  ['DEC-01', 'ONE feedback model (D2)',
    'We have feedback in a few places. Do you want ONE unified way clients + sales give/See feedback? I owe you a plain-language explainer first.',
    'A) I write the 6th-grade explainer + recover your earlier client-portal feedback tweaks, then you decide · B) Keep as-is for now',
    'Feedback is how clients judge lead quality and how you prove ROI for retainers. Fragmented = confusing + weak proof.',
    'Awaiting you', 'P1'],
  ['DEC-02', 'Remove the Meeting module? (D1/E2)',
    'You floated folding "Meetings" into Leads + a linked task + one "due today" queue, instead of a separate module.',
    'A) Fold into Leads (simpler, one place) · B) Keep Meetings separate · C) I spec both side-by-side first',
    'Changes core navigation + every meeting flow. Cheaper to decide before more is built on the current shape.',
    'Awaiting you', 'P1'],
  ['DEC-03', 'Ownership / assignee schema fix (ALT-349) — LAUNCH BLOCKER',
    'Records were bulk-imported, so the "owner" column points at the importer, not the real assignee. Agents can edit the wrong rows / not their own. Needs a DB fix + a safe test on throwaway logins before prod.',
    'A) Give the go — I prepare the migration + validate on test logins + show you before applying · B) Hold',
    'This is THE thing blocking a trustworthy internal launch. Until fixed, who-can-edit-what is wrong.',
    'Awaiting you', 'P0'],
  ['DEC-04', 'Lock security before AI (ALT-353)',
    'Some tables are not fully locked down (no FORCE RLS; broad anonymous access on data with personal info).',
    'A) Approve the lockdown migration (validated on test logins first) · B) Hold',
    'PII exposure risk + it gates the embeddings/AI work. Should be done before any AI capture.',
    'Awaiting you', 'P0'],
  ['DEC-05', 'Status cleanup (ALT-350/351)',
    'Status fields are free text and already messy (one field has 24+ spellings of ~4 things). Fix = controlled dropdowns + cleanup.',
    'A) Approve the cleanup + dropdown enforcement · B) Hold',
    'Messy statuses break every report, filter, and the dashboard funnel. Compounds daily.',
    'Awaiting you', 'P1'],
  ['DEC-06', 'Masking of email/phone (ALT-345)',
    'Sensitive contact details should be masked + revealed per permission, enforced at the database (your Q4 ruling). Not built yet — and it must be DB-enforced, not faked in the screen.',
    'A) Approve the DB-enforced masking design + who-can-reveal rules · B) Hold',
    'Client/PII trust + your explicit ruling. A screen-only mask is not real protection.',
    'Awaiting you', 'P1'],
  ['DEC-07', 'Save View — local now or wait for the full access model?',
    'Saved filter "views" — you bundled this with the per-project access modes (A4). I can ship a quick personal version now, but it will likely need to become shareable/server-backed later.',
    'A) Ship the quick personal (local) version now · B) Wait and build it once, server-backed, with the access model',
    'Nice productivity win; small rework risk if built twice.',
    'Awaiting you', 'P2'],
  ['DEC-08', 'When do we push the built-but-unpushed work?',
    'Several finished, build-green commits are sitting locally (not deployed): the QC fix batch + the ALT-361..364 + ALT-368/369 UX work.',
    'A) Pick an evening/weekend to push (your Q6 posture) · B) Keep holding',
    'The longer good work sits unpushed, the bigger the eventual deploy + merge risk.',
    'Awaiting you', 'P1'],
];

/* ─── 2. AWAITING REVIEW (built + green, NOT pushed — needs your eyes) ───────
   [id, whatWasBuilt, whereCommitFiles, whatToCheck, pushed, notes]            */
const REVIEW = [
  ['ALT-368', '"Select all N matching" on every list', 'commit eea34d5',
    'Tick a whole page → blue bar offers selecting all filtered rows for bulk reassign/status/export.', 'No', 'Safe, no DB.'],
  ['ALT-369', 'Filters + search survive a refresh', 'commit eea34d5',
    'Filter a list, refresh — your filters come back. "Clear filters" still resets.', 'No', 'Per-browser, no DB.'],
  ['ALT-361', 'Inline status: no more "select a project first"', 'commit e4e4a67',
    'Editing a company/contact status uses the chosen project / auto-resolves single-project records.', 'No', ''],
  ['ALT-362', 'QC can approve + must give a reject reason', 'commit e4e4a67',
    'QC role reaches the Approvals queue; rejecting a report requires a comment.', 'No', ''],
  ['ALT-363', 'Reassign reason + "Assign to me"', 'commit e4e4a67',
    'Optional reason when a lead is reassigned; new records default to you as owner.', 'No', ''],
  ['ALT-364', 'UX polish batch', 'commit e4e4a67',
    'Grid tooltips + frozen name column; tap-to-call/email + copy in previews; search clear-×; password show/hide; contrast.', 'No', ''],
  ['QC-FIX', 'Autonomous QC fix pass', 'commit 23509a3',
    'Safe fixes across grid/data/pages/dashboard from the harsh-QC review.', 'No', 'Detail in REBUILD_LOG.'],
  ['DOC-1', 'SCHEMA-AUDIT.md', 'docs/SCHEMA-AUDIT.md',
    'Read the headline: ownership split = launch blocker; statuses corrupted; no FORCE RLS.', 'n/a', 'Drives DEC-03..06.'],
  ['DOC-2', 'EMBEDDING-PLAN.md', 'docs/product/EMBEDDING-PLAN.md',
    'The why/what/how/when of AI embeddings — capture from now (cheap) vs backfill (lossy).', 'n/a', ''],
  ['OS-1', 'product-os/ operating system', 'product-os/',
    'The new "start here" + how Claude works as PM. Tell me if the way-of-working matches what you want.', 'n/a', 'You asked for this.'],
  ['DISC-1', 'Discovery synthesis (market + advisor reality-check)', 'product-os/DISCOVERY-2026-06-25.md',
    'The honest outside view: as a pure CRM we lose; the moat is the client ROI/feedback portal. Plus the advisor\'s brutal truths that redirected the build queue to foundation-readiness.', 'n/a', 'Read the "brutal truths" + "real-need verdict".'],
];

/* ─── 3. RISKS (advisor / security flags to keep visible) ───────────────────
   [id, risk, severity, area, ownerGated, nextStep]                            */
const RISKS = [
  ['RSK-01', 'Ownership split (created_by ≠ real assignee) — edit permissions are wrong', 'Critical', 'Data / Security', 'Yes', 'DEC-03 / ALT-349'],
  ['RSK-02', 'No FORCE RLS + broad anonymous grants on tables with personal info', 'Critical', 'Security', 'Yes', 'DEC-04 / ALT-353'],
  ['RSK-03', 'Statuses are free text and already corrupted — breaks reports + funnel', 'High', 'Data', 'Yes', 'DEC-05 / ALT-350/351'],
  ['RSK-04', 'No real masking of email/phone yet (must be DB-enforced)', 'High', 'Security / Privacy', 'Yes', 'DEC-06 / ALT-345'],
  ['RSK-05', 'Finished work sitting unpushed — deploy/merge risk grows over time', 'Medium', 'Delivery', 'No', 'DEC-08 (pick a push window)'],
  ['RSK-07', 'LIVE site reachable while RLS is off — active PII exposure right now', 'Critical', 'Security', 'Yes', 'DEC-09 (gate the live URL)'],
  ['RSK-08', 'Inline "create company" writes placeholder values into NOT-NULL columns — manufactures the exact data corruption we are trying to fix', 'High', 'Data', 'No', 'Hide/disable it (FE) — Build Cycle 1'],
  ['RSK-09', 'Assignment write-path (apply-assignment-rls.cjs) never applied — agents cannot safely edit their own records', 'Critical', 'Data / Product', 'Yes', 'Prep + throwaway-login validation now; apply on owner go'],
  ['RSK-06', 'Single 1.6MB JS bundle (no code-splitting) — slow first load as app grows', 'Low', 'Performance', 'No', 'Backlog: route-level code-split'],
];

/* ─── SHEET BUILDER ─────────────────────────────────────────────────────────*/
function buildSheet(headers, widths, rows) {
  const ws = {};
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = {
      v: h, t: 's',
      s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1A7EE8' } } },
    };
  });
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = { v: cell == null ? '' : String(cell), t: 's' };
    });
  });
  const lastR = rows.length, lastC = headers.length - 1;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: lastC } });
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  ws['!sheetViews'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: lastC } }) };
  return ws;
}

const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['ID', 'Item', 'Plain-language question', 'Options', 'Why it matters', 'Status', 'Priority'],
  [9, 34, 60, 60, 50, 14, 9], DECISIONS), 'Decisions Needed');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['ID', 'What was built', 'Where', 'What to check', 'Pushed?', 'Notes'],
  [9, 38, 26, 64, 9, 26], REVIEW), 'Awaiting Review');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['ID', 'Risk', 'Severity', 'Area', 'Owner-gated?', 'Next step'],
  [9, 64, 11, 20, 13, 26], RISKS), 'Risks');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['How to use this Review Hub'],
  [100],
  [
    [`Updated ${UPDATED}. Regenerate: cd new-code/web && node scripts/gen-review-tracker.cjs`],
    ['Three tabs: (1) Decisions Needed = your calls; (2) Awaiting Review = built + green, not pushed; (3) Risks = what to know.'],
    ['Claude keeps this current and NEVER pushes / never touches the production database without your explicit go-ahead.'],
    ['Backlog of all tickets lives in AltLeads-Backlog-Tracker.xlsx. The way-of-working lives in product-os/.'],
  ]), 'Legend');

XLSX.writeFile(wb, OUT_PATH);
console.log('✓ Wrote ' + OUT_PATH);
console.log(`  Decisions: ${DECISIONS.length} · Awaiting review: ${REVIEW.length} · Risks: ${RISKS.length}`);
