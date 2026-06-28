'use strict';
/**
 * importEngine.js — server-side bulk upsert engine for the Import Wizard (DEC-14)
 *
 * Called exclusively from writeGateway.js handlers (company.import, contact.import,
 * lead.import).  Uses the service-role Supabase client (bypasses RLS).  Never called
 * from the browser.
 *
 * ── Upsert keys (per entity) ─────────────────────────────────────────────────
 *   company  → record_id (company_id) else domain_clean (derived from website/domain)
 *   contact  → record_id (contact_id) else email (lower-trimmed)
 *   lead     → record_id (lead_id)     — no domain/email fallback for leads
 *
 * ── Chunk contract ───────────────────────────────────────────────────────────
 *   Callers MUST send ≤ MAX_CHUNK_ROWS rows per call.  The UI chunks at 500 rows;
 *   this module enforces the same cap server-side and throws GatewayValidationError
 *   if exceeded.
 *
 * ── Undo / batch history ──────────────────────────────────────────────────────
 *   Every call writes one import_batch row (counts only; undo payload in import_row).
 *   For UPDATED rows: the prior values of the columns being changed are captured in
 *   import_row.undo_payload (jsonb) BEFORE the update executes.
 *   For INSERTED rows: undo_payload = { inserted: true } — the undo deleter uses this.
 *   Rows that were skipped/errored are still logged with status='skipped'|'error'.
 *
 * ── Event spine ───────────────────────────────────────────────────────────────
 *   After a successful write we leave a stub marker.  Wire it to eventBus.emitEvent
 *   only when the event-spine is validated (see TODO below).
 *
 * ── Column safety ─────────────────────────────────────────────────────────────
 *   Only columns in WRITABLE_COLUMNS[entity] are ever written.  Any key in the
 *   mapped row that is NOT in the whitelist is silently dropped before the write.
 *   This prevents accidental clobbering of system columns (created_by, is_demo, etc.).
 *
 * ── Discovered schema (live DB — read via PG read-only, 2026-06-28) ──────────
 *
 *   company_master
 *     PK: company_id bigint NOT NULL
 *     Unique match key (fallback): domain_clean text
 *     Writable cols: company_name varchar NOT NULL, company_web_url varchar,
 *       domain_clean text, cin_number varchar, email varchar, linkedin_url varchar,
 *       company_size bigint, description varchar, city_id integer (→city_master),
 *       industry_id bigint, sector_id bigint, sub_industry_id bigint, turnover_id bigint
 *     System cols (NOT writable by import): company_id, created_by, created_date,
 *       deleted_by, deleted_date, updated_by, updated_date, is_demo, is_lead,
 *       is_wishlist, company_image, logo_url, lead_name, designation, domain_id
 *
 *   contact_master
 *     PK: contact_id bigint NOT NULL
 *     Unique match key (fallback): email text (lower-trimmed)
 *     Writable cols: full_name text, email text, mobile_no text, alt_mobile_no text,
 *       designation text, linkedin_url text, linkedin_clean text, company_id bigint
 *       (→company_master), city_id bigint (→city_master)
 *     System cols (NOT writable): contact_id, is_demo, created_by, created_date,
 *       updated_by, updated_date, deleted_by, deleted_date, source_lead_id
 *
 *   lead_master
 *     PK: lead_id bigint NOT NULL
 *     No domain/email fallback — Record-ID only for leads
 *     Writable cols: lead_name text, email text, mobile_no varchar, alt_mobile_no varchar,
 *       designation text, description text, stage varchar, linkedin_url varchar,
 *       title varchar, value text, area_of_interest text, role_and_resp text,
 *       company_id bigint, contact_id bigint, project_id bigint
 *     System cols (NOT writable): lead_id, lead_number, created_by, created_date,
 *       updated_by, updated_date, deleted_by, deleted_date, is_demo, is_closed,
 *       agent_id, address_id, client_assoc_id, lead_designation_id, location_id,
 *       source_id, report_url
 *
 *   import_batch, import_row — see apply-import-batches.cjs (STAGED migration)
 */

const MAX_CHUNK_ROWS = 500;

/* ── Writable column whitelists ────────────────────────────────────────────── */
// These are the ONLY columns the import engine will ever write.
// Anything else from the mapped payload is silently ignored.
const WRITABLE_COLUMNS = {
  company: new Set([
    'company_name', 'company_web_url', 'domain_clean', 'cin_number',
    'email', 'linkedin_url', 'company_size', 'description',
    'city_id', 'industry_id', 'sector_id', 'sub_industry_id', 'turnover_id',
  ]),
  contact: new Set([
    'full_name', 'email', 'mobile_no', 'alt_mobile_no', 'designation',
    'linkedin_url', 'linkedin_clean', 'company_id', 'city_id',
  ]),
  lead: new Set([
    'lead_name', 'email', 'mobile_no', 'alt_mobile_no', 'designation',
    'description', 'stage', 'linkedin_url', 'title', 'value',
    'area_of_interest', 'role_and_resp', 'company_id', 'contact_id', 'project_id',
  ]),
};

/* ── Table + PK config per entity ──────────────────────────────────────────── */
const ENTITY_CONFIG = {
  company: {
    table:       'company_master',
    pk:          'company_id',
    fallbackKey: 'domain_clean',   // used when record_id absent
    requiredNew: ['company_name'], // columns required to INSERT (not needed for UPDATE)
  },
  contact: {
    table:       'contact_master',
    pk:          'contact_id',
    fallbackKey: 'email',
    requiredNew: [],
  },
  lead: {
    table:       'lead_master',
    pk:          'lead_id',
    fallbackKey: null,             // leads: record_id is the ONLY match key
    requiredNew: [],
  },
};

/* ── Domain helper: derive domain_clean from a website string ────────────── */
function cleanDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/* ── Whitelist filter: drop any key not in the writable set ──────────────── */
function filterWritable(entity, rowObj) {
  const allowed = WRITABLE_COLUMNS[entity];
  const out = {};
  for (const [k, v] of Object.entries(rowObj)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/* ── Coerce empty strings to null so we don't write blank over real data ─── */
function coerceValues(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (typeof v === 'string' && v.trim() === '') ? null : v;
  }
  return out;
}

/* ── Core per-row processor ─────────────────────────────────────────────────
 *
 * Returns: { status: 'inserted'|'updated'|'skipped'|'error',
 *            recordId: number|null, undoPayload: object, errorMsg: string|null }
 */
async function processRow(admin, entity, cfg, rawRow, actor) {
  try {
    const now = new Date().toISOString();
    const actorStr = String(actor.userId ?? actor.authUid);

    // 1. Build the write object (whitelist + coerce)
    let writeData = filterWritable(entity, coerceValues(rawRow));

    // For companies: auto-derive domain_clean from website if not explicitly provided
    if (entity === 'company' && !writeData.domain_clean && writeData.company_web_url) {
      writeData.domain_clean = cleanDomain(writeData.company_web_url);
    }

    // 2. Determine the match key
    const recordId = rawRow.record_id ? Number(rawRow.record_id) : null;
    const fallbackValue = cfg.fallbackKey ? (rawRow[cfg.fallbackKey] || null) : null;

    if (!recordId && !fallbackValue) {
      return {
        status: 'skipped',
        recordId: null,
        undoPayload: null,
        errorMsg: `No match key: need record_id or ${cfg.fallbackKey ?? 'record_id'}`,
      };
    }

    // 3. Look up existing record
    let existingRow = null;
    let matchedId = null;

    if (recordId) {
      // Primary match: by record ID
      const { data, error } = await admin
        .from(cfg.table)
        .select(`${cfg.pk}, *`)
        .eq(cfg.pk, recordId)
        .is('deleted_date', null)
        .maybeSingle();
      if (error) throw new Error(`lookup by ${cfg.pk}: ${error.message}`);
      existingRow = data;
      matchedId = data ? data[cfg.pk] : null;
    } else if (cfg.fallbackKey && fallbackValue) {
      // Fallback match: by domain_clean or email
      const matchVal = cfg.fallbackKey === 'email'
        ? fallbackValue.toLowerCase().trim()
        : fallbackValue.toLowerCase().trim();

      const { data, error } = await admin
        .from(cfg.table)
        .select(`${cfg.pk}, *`)
        .eq(cfg.fallbackKey, matchVal)
        .is('deleted_date', null)
        .eq('is_demo', false)
        .limit(2); // grab 2 to detect ambiguity
      if (error) throw new Error(`lookup by ${cfg.fallbackKey}: ${error.message}`);

      if (data && data.length > 1) {
        return {
          status: 'skipped',
          recordId: null,
          undoPayload: null,
          errorMsg: `Ambiguous match on ${cfg.fallbackKey}="${fallbackValue}" — ${data.length} records found. Resolve by record_id.`,
        };
      }
      existingRow = (data && data.length === 1) ? data[0] : null;
      matchedId = existingRow ? existingRow[cfg.pk] : null;
    }

    if (existingRow) {
      // 4a. UPDATE — capture undo payload BEFORE writing

      // Only keep keys that actually have a value to write (don't clobber with nulls unless explicit)
      const updateData = {};
      const undoPayload = { [cfg.pk]: matchedId, _before: {} };

      for (const [k, v] of Object.entries(writeData)) {
        if (v !== null && v !== undefined) {
          undoPayload._before[k] = existingRow[k] ?? null;
          updateData[k] = v;
        }
        // null/empty values: skip (don't overwrite with blank — "skipBlanks" is always ON)
      }

      if (Object.keys(updateData).length === 0) {
        // Nothing to update (all values blank or already matching)
        return {
          status: 'skipped',
          recordId: matchedId,
          undoPayload: null,
          errorMsg: 'No non-blank values to update',
        };
      }

      updateData.updated_by   = actorStr;
      updateData.updated_date = now;

      const { error: updateError } = await admin
        .from(cfg.table)
        .update(updateData)
        .eq(cfg.pk, matchedId);

      if (updateError) throw new Error(`update: ${updateError.message}`);

      // TODO(event-spine): emitEvent({ type: `${entity}.import.updated`, aggregateType: entity, aggregateId: matchedId, actor })

      return { status: 'updated', recordId: matchedId, undoPayload, errorMsg: null };

    } else {
      // 4b. INSERT — no prior values to undo; record the new PK for undo-delete

      if (cfg.requiredNew.length > 0) {
        for (const req of cfg.requiredNew) {
          if (!writeData[req]) {
            return {
              status: 'skipped',
              recordId: null,
              undoPayload: null,
              errorMsg: `Required column "${req}" is missing or blank for new record`,
            };
          }
        }
      }

      const insertData = {
        ...writeData,
        created_by:   actorStr,
        created_date: now,
        is_demo:      false,
      };

      const { data: inserted, error: insertError } = await admin
        .from(cfg.table)
        .insert(insertData)
        .select(cfg.pk)
        .single();

      if (insertError) throw new Error(`insert: ${insertError.message}`);

      const newId = inserted ? inserted[cfg.pk] : null;

      // TODO(event-spine): emitEvent({ type: `${entity}.import.inserted`, aggregateType: entity, aggregateId: newId, actor })

      return {
        status: 'inserted',
        recordId: newId,
        undoPayload: { inserted: true, [cfg.pk]: newId },
        errorMsg: null,
      };
    }

  } catch (e) {
    return { status: 'error', recordId: null, undoPayload: null, errorMsg: e.message };
  }
}

/* ── writeBatchRecord: insert a row into import_batch + import_row ───────── */
async function writeBatchRecord(admin, { entity, actorUserId, filename, rowResults }) {
  const counts = { inserted: 0, updated: 0, skipped: 0, error: 0 };
  for (const r of rowResults) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = rowResults.length;
  const status = counts.error > 0 ? 'partial' : 'done';

  // Insert into import_batch
  let batchId = null;
  try {
    const { data, error } = await admin
      .from('import_batch')
      .insert({
        entity,
        actor_user_id: actorUserId,
        filename:      filename ?? null,
        total,
        inserted:      counts.inserted,
        updated:       counts.updated,
        skipped:       counts.skipped,
        error:         counts.error,
        status,
      })
      .select('id')
      .single();

    if (error) {
      // import_batch table may not exist yet (migration not applied). Log but don't fail the import.
      console.warn('[importEngine] import_batch insert skipped (table missing?):', error.message);
      return null;
    }
    batchId = data?.id ?? null;
  } catch (e) {
    console.warn('[importEngine] import_batch insert threw:', e.message);
    return null;
  }

  if (!batchId) return null;

  // Insert per-row detail into import_row (batch insert)
  const rowInserts = rowResults.map((r, i) => ({
    batch_id:     batchId,
    row_index:    i,
    status:       r.status,
    record_id:    r.recordId,
    undo_payload: r.undoPayload,
    error_msg:    r.errorMsg,
  }));

  // Chunk the row inserts to avoid huge single requests (import_row can be large)
  const BATCH_CHUNK = 200;
  for (let i = 0; i < rowInserts.length; i += BATCH_CHUNK) {
    const slice = rowInserts.slice(i, i + BATCH_CHUNK);
    const { error } = await admin.from('import_row').insert(slice);
    if (error) {
      console.warn('[importEngine] import_row insert failed:', error.message);
      break; // non-fatal: batch header already written
    }
  }

  return batchId;
}

/* ── undoBatch: reverse an import batch ─────────────────────────────────── */
async function undoBatch(admin, batchId, actor) {
  // 1. Load the batch header
  const { data: batch, error: batchErr } = await admin
    .from('import_batch')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();

  if (batchErr) throw new Error(`load batch: ${batchErr.message}`);
  if (!batch)   throw new Error(`batch #${batchId} not found`);
  if (batch.status === 'undone') throw new Error(`batch #${batchId} already undone`);

  const cfg = ENTITY_CONFIG[batch.entity];
  if (!cfg) throw new Error(`unknown entity "${batch.entity}" in batch`);

  const now = new Date().toISOString();
  const actorStr = String(actor.userId ?? actor.authUid);

  // 2. Load only the rows that succeeded (inserted or updated)
  const { data: rows, error: rowErr } = await admin
    .from('import_row')
    .select('*')
    .eq('batch_id', batchId)
    .in('status', ['inserted', 'updated']);

  if (rowErr) throw new Error(`load rows: ${rowErr.message}`);

  let undone = 0, failed = 0;
  const errors = [];

  for (const row of rows ?? []) {
    try {
      if (row.status === 'inserted' && row.undo_payload?.inserted) {
        // Undo insert = soft-delete (set deleted_date)
        const { error } = await admin
          .from(cfg.table)
          .update({ deleted_by: actorStr, deleted_date: now })
          .eq(cfg.pk, row.record_id);
        if (error) throw new Error(error.message);
      } else if (row.status === 'updated' && row.undo_payload?._before) {
        // Undo update = restore prior values
        const restore = {
          ...row.undo_payload._before,
          updated_by:   actorStr,
          updated_date: now,
        };
        const { error } = await admin
          .from(cfg.table)
          .update(restore)
          .eq(cfg.pk, row.record_id);
        if (error) throw new Error(error.message);
      }
      undone++;
    } catch (e) {
      failed++;
      errors.push(`row ${row.row_index}: ${e.message}`);
    }
  }

  // 3. Mark batch as undone
  await admin
    .from('import_batch')
    .update({ status: 'undone', updated_at: now })
    .eq('id', batchId);

  return { batchId, undone, failed, errors };
}

/* ── Main entry point: runImport ────────────────────────────────────────────
 *
 * Called by writeGateway action handlers.
 *
 * @param {SupabaseClient} admin    — service-role client
 * @param {object}         actor   — { authUid, userId, role }
 * @param {object}         payload — {
 *   entity:   'company' | 'contact' | 'lead',
 *   rows:     MappedRow[],  // ≤ MAX_CHUNK_ROWS; keys are target field names
 *   filename: string?,      // original filename for the batch record
 * }
 * @returns {{ batchId, total, inserted, updated, skipped, error, rowResults[] }}
 */
async function runImport(admin, actor, payload) {
  const { entity, rows, filename } = payload || {};

  if (!entity || !ENTITY_CONFIG[entity]) {
    throw Object.assign(new Error(`payload.entity must be one of: ${Object.keys(ENTITY_CONFIG).join(', ')}`), { name: 'GatewayValidationError' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error('payload.rows must be a non-empty array'), { name: 'GatewayValidationError' });
  }
  if (rows.length > MAX_CHUNK_ROWS) {
    throw Object.assign(new Error(`payload.rows exceeds MAX_CHUNK_ROWS (${MAX_CHUNK_ROWS}). Send smaller chunks.`), { name: 'GatewayValidationError' });
  }

  const cfg = ENTITY_CONFIG[entity];
  const rowResults = [];

  // Process rows sequentially to avoid hammering DB with parallel requests
  // (for 100k-contact file the UI will call this endpoint many times in chunks)
  for (const row of rows) {
    const result = await processRow(admin, entity, cfg, row, actor);
    rowResults.push(result);
  }

  // Write batch + row history record (non-fatal if import_batch doesn't exist yet)
  const batchId = await writeBatchRecord(admin, {
    entity,
    actorUserId: actor.userId,
    filename,
    rowResults,
  });

  const counts = { inserted: 0, updated: 0, skipped: 0, error: 0 };
  for (const r of rowResults) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return {
    batchId,
    total:    rows.length,
    inserted: counts.inserted,
    updated:  counts.updated,
    skipped:  counts.skipped,
    error:    counts.error,
    rowResults,
  };
}

module.exports = { runImport, undoBatch, MAX_CHUNK_ROWS, ENTITY_CONFIG, WRITABLE_COLUMNS };
