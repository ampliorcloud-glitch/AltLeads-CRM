/**
 * bulkActions.ts — multi-record list actions (ALT-291).
 *
 * "Add to project" upserts a per-project status row for each selected
 * company/contact (company_project_status / contact_project_status). Because
 * those rows ARE the project membership, upserting an (id, project) row with no
 * status simply enrolls the record in the project — the data-prep step before a
 * project's records are worked. Reuses the audited single-record upserts so RLS,
 * history (interaction), and the 42501 friendly-message all behave identically.
 */
import { upsertCompanyStatus, upsertContactStatus } from './projectStatus';

export interface BulkResult {
  ok: number;
  failed: number;
  error: string | null;
}

async function addToProjectLoop(
  ids: number[],
  projectId: number,
  actor: string | null,
  kind: 'company' | 'contact',
): Promise<BulkResult> {
  let ok = 0;
  let failed = 0;
  let firstErr: string | null = null;
  for (const id of ids) {
    const res =
      kind === 'company'
        ? await upsertCompanyStatus(id, projectId, {}, actor)
        : await upsertContactStatus(id, projectId, {}, actor);
    if (res.error) {
      failed += 1;
      if (!firstErr) firstErr = res.error;
    } else {
      ok += 1;
    }
  }
  return {
    ok,
    failed,
    error: failed > 0 ? firstErr ?? `${failed} could not be added (no permission).` : null,
  };
}

/** Enroll selected companies into a project (creates their company_project_status row). */
export function addCompaniesToProject(ids: number[], projectId: number, actor: string | null): Promise<BulkResult> {
  return addToProjectLoop(ids, projectId, actor, 'company');
}

/** Enroll selected contacts into a project (creates their contact_project_status row). */
export function addContactsToProject(ids: number[], projectId: number, actor: string | null): Promise<BulkResult> {
  return addToProjectLoop(ids, projectId, actor, 'contact');
}

/**
 * Set the per-project status on each selected record (Step E, universal pass).
 *
 * Reuses the same audited single-record upserts as add-to-project, so RLS,
 * history (interaction), and the 42501 friendly-message all behave identically.
 * Mirrors addToProjectLoop's partial-result + friendly-error bubbling.
 */
async function setStatusLoop(
  ids: number[],
  projectId: number,
  status: string,
  actor: string | null,
  kind: 'company' | 'contact',
): Promise<BulkResult> {
  let ok = 0;
  let failed = 0;
  let firstErr: string | null = null;
  for (const id of ids) {
    const res =
      kind === 'company'
        ? await upsertCompanyStatus(id, projectId, { account_status: status }, actor)
        : await upsertContactStatus(id, projectId, { contact_status: status }, actor);
    if (res.error) {
      failed += 1;
      if (!firstErr) firstErr = res.error;
    } else {
      ok += 1;
    }
  }
  return {
    ok,
    failed,
    error: failed > 0 ? firstErr ?? `${failed} could not be updated (no permission).` : null,
  };
}

/** Set account_status on the selected companies (per-project). */
export function setCompaniesStatus(
  ids: number[],
  projectId: number,
  status: string,
  actor: string | null,
): Promise<BulkResult> {
  return setStatusLoop(ids, projectId, status, actor, 'company');
}

/** Set contact_status on the selected contacts (per-project). */
export function setContactsStatus(
  ids: number[],
  projectId: number,
  status: string,
  actor: string | null,
): Promise<BulkResult> {
  return setStatusLoop(ids, projectId, status, actor, 'contact');
}
