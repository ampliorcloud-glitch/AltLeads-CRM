/**
 * Recycle Bin data layer (ALT-400) — admin-only.
 *
 * Tables covered (soft-delete confirmed via merge.ts + admin.ts):
 *   company_master  — deleted_date / deleted_by confirmed (merge.ts:273, companies.ts:177)
 *   contact_master  — deleted_date / deleted_by confirmed (merge.ts:330, admin.ts:165)
 *
 * Excluded (only deleted_date filter is present in the codebase; deleted_by write
 * not confirmed for these tables — do not include until verified against live schema):
 *   lead_master     — meeting_master
 *
 * NOTE(ALT-400): validate restore against RLS on a throwaway admin login before
 * relying on it in prod.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type RecycleBinEntity = 'company' | 'contact';

export interface DeletedRecord {
  /** Primary key as string for uniformity. */
  id: string;
  /** Display name (company_name or contact full_name). */
  name: string;
  deleted_date: string;
  /** Resolved full_name of deleting user, or the raw id if resolution fails. */
  deleted_by: string;
}

export interface FetchDeletedResult {
  records: DeletedRecord[];
  /** True when the result was clipped at the hard limit and more rows exist. */
  truncated: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LIMIT = 500;

/* ------------------------------------------------------------------ */
/*  User-name resolver (shared by both entity fetchers)               */
/* ------------------------------------------------------------------ */

async function resolveUserNames(
  ids: string[],
): Promise<Map<string, string>> {
  const numericIds = [...new Set(ids)]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numericIds.length === 0) return new Map();

  const { data } = await supabase
    .from('user_master')
    .select('user_id, full_name')
    .in('user_id', numericIds);

  const map = new Map<string, string>();
  ((data ?? []) as { user_id: number; full_name: string | null }[]).forEach((u) =>
    map.set(String(u.user_id), u.full_name?.trim() || String(u.user_id)),
  );
  return map;
}

/* ------------------------------------------------------------------ */
/*  fetchDeleted                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch soft-deleted records for the given entity (WHERE deleted_date IS NOT NULL).
 * Returns up to LIMIT rows, ordered newest-first. `truncated` is set when
 * more rows exist beyond the limit.
 */
export async function fetchDeleted(
  entity: RecycleBinEntity,
): Promise<FetchDeletedResult> {
  const empty: FetchDeletedResult = { records: [], truncated: false, error: null };

  if (entity === 'company') {
    const { data, error } = await supabase
      .from('company_master')
      .select('company_id, company_name, deleted_date, deleted_by')
      .not('deleted_date', 'is', null)
      .order('deleted_date', { ascending: false, nullsFirst: false })
      .limit(LIMIT + 1); // fetch one extra to detect truncation

    if (error) return { ...empty, error: humanizeWriteError(error) };

    const rows = (data ?? []) as {
      company_id: number;
      company_name: string | null;
      deleted_date: string;
      deleted_by: string | null;
    }[];

    const truncated = rows.length > LIMIT;
    const trimmed = truncated ? rows.slice(0, LIMIT) : rows;

    const deletedByIds = trimmed
      .map((r) => r.deleted_by)
      .filter((v): v is string => v != null && v.trim() !== '');
    const nameMap = await resolveUserNames(deletedByIds);

    const records: DeletedRecord[] = trimmed.map((r) => ({
      id: String(r.company_id),
      name: r.company_name?.trim() || `Company #${r.company_id}`,
      deleted_date: r.deleted_date,
      deleted_by: r.deleted_by
        ? (nameMap.get(r.deleted_by.trim()) ?? r.deleted_by.trim())
        : '—',
    }));

    return { records, truncated, error: null };
  }

  if (entity === 'contact') {
    const { data, error } = await supabase
      .from('contact_master')
      .select('contact_id, full_name, deleted_date, deleted_by')
      .not('deleted_date', 'is', null)
      .order('deleted_date', { ascending: false, nullsFirst: false })
      .limit(LIMIT + 1);

    if (error) return { ...empty, error: humanizeWriteError(error) };

    const rows = (data ?? []) as {
      contact_id: number;
      full_name: string | null;
      deleted_date: string;
      deleted_by: string | null;
    }[];

    const truncated = rows.length > LIMIT;
    const trimmed = truncated ? rows.slice(0, LIMIT) : rows;

    const deletedByIds = trimmed
      .map((r) => r.deleted_by)
      .filter((v): v is string => v != null && v.trim() !== '');
    const nameMap = await resolveUserNames(deletedByIds);

    const records: DeletedRecord[] = trimmed.map((r) => ({
      id: String(r.contact_id),
      name: r.full_name?.trim() || `Contact #${r.contact_id}`,
      deleted_date: r.deleted_date,
      deleted_by: r.deleted_by
        ? (nameMap.get(r.deleted_by.trim()) ?? r.deleted_by.trim())
        : '—',
    }));

    return { records, truncated, error: null };
  }

  return { ...empty, error: `Unknown entity: ${entity as string}` };
}

/* ------------------------------------------------------------------ */
/*  restoreRecord                                                      */
/* ------------------------------------------------------------------ */

/**
 * Restore a soft-deleted record by clearing deleted_date / deleted_by and
 * stamping updated_by / updated_date.
 *
 * NOTE(ALT-400): validate restore against RLS on a throwaway admin login before
 * relying on it in prod.
 *
 * Returns { error: string | null } — null means success.
 * Maps 42501 RLS errors to a friendly message via humanizeWriteError.
 */
export async function restoreRecord(
  entity: RecycleBinEntity,
  id: string,
  actor: string,
): Promise<{ error: string | null }> {
  const patch = {
    deleted_date: null,
    deleted_by: null,
    updated_by: actor,
    updated_date: new Date().toISOString(),
  };

  if (entity === 'company') {
    const { error } = await supabase
      .from('company_master')
      .update(patch)
      .eq('company_id', Number(id));
    return { error: error ? humanizeWriteError(error) : null };
  }

  if (entity === 'contact') {
    const { error } = await supabase
      .from('contact_master')
      .update(patch)
      .eq('contact_id', Number(id));
    return { error: error ? humanizeWriteError(error) : null };
  }

  return { error: `Unknown entity: ${entity as string}` };
}
