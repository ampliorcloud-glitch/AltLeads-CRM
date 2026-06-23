/**
 * ReassignModal — generic "Change owner / Reassign" dialog (ALT-288).
 *
 * A single-owner picker generalized from the wishlist AssignModal. Used to
 * reassign the owner/assigned-person of a lead, meeting, company or contact.
 * Reuses the shared ModalShell (backdrop + focus-trap + ESC) so it matches the
 * rest of the app's modals.
 *
 * The CALLER decides who may open this (admin/manager only — see useAuth().
 * canReassign) and supplies the eligible owner list (data/assignment.ts
 * fetchAssignableUsers). This component is presentation only — it performs no
 * writes and no permission checks.
 */
import { useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import type { UserOption } from '../../data/wishlist';
import { ModalShell } from '../wishlist/AssignModal';

const selectCls =
  'w-full border border-zinc-300 rounded-md px-3 text-zinc-800 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

export function ReassignModal({
  /** Heading noun, e.g. "Lead", "Meeting", "Company". */
  entityLabel,
  /** Field label for the picker, e.g. "Salesperson", "Owner". */
  ownerLabel = 'Owner',
  /** How many records are being reassigned (>1 ⇒ bulk wording). */
  count = 1,
  currentOwnerId,
  owners,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  entityLabel: string;
  ownerLabel?: string;
  count?: number;
  currentOwnerId: number | null;
  owners: UserOption[];
  saving: boolean;
  error: string | null;
  onConfirm: (ownerId: number) => void;
  onClose: () => void;
}) {
  const [ownerId, setOwnerId] = useState<number | null>(currentOwnerId);

  // "Reassign" when a current owner exists (single record); bulk is always a (re)assign.
  const isBulk = count > 1;
  const isReassign = isBulk || currentOwnerId != null;
  const title = isBulk
    ? `Reassign ${count} ${entityLabel}s`
    : `${isReassign ? 'Reassign' : 'Assign'} ${entityLabel}`;

  return (
    <ModalShell title={title} icon={<UserCheck size={16} />} onClose={onClose}>
      <p className="text-zinc-500 mb-4" style={{ fontSize: 12 }}>
        {isBulk
          ? `Choose the new ${ownerLabel.toLowerCase()} for the ${count} selected ${entityLabel.toLowerCase()}s. They will be notified.`
          : `Choose the new ${ownerLabel.toLowerCase()} for this ${entityLabel.toLowerCase()}. They will be notified.`}
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="reassign-owner"
            className="block mb-1 text-zinc-600 font-medium"
            style={{ fontSize: 12 }}
          >
            {ownerLabel}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="reassign-owner"
            aria-required={true}
            value={ownerId ?? ''}
            onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : null)}
            className={selectCls}
            style={{ height: 36, fontSize: 13 }}
            disabled={saving}
          >
            <option value="">{`Select a ${ownerLabel.toLowerCase()}…`}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {owners.length === 0 && (
            <p className="text-zinc-400 mt-1" style={{ fontSize: 11 }}>
              No eligible people available.
            </p>
          )}
        </div>

        {error && (
          <p className="text-red-600" style={{ fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-zinc-100">
        <button
          onClick={onClose}
          disabled={saving}
          className="border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-700 font-medium rounded-md transition-colors disabled:opacity-50"
          style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
        >
          Cancel
        </button>
        <button
          onClick={() => ownerId != null && onConfirm(ownerId)}
          disabled={saving || ownerId == null || (!isBulk && ownerId === currentOwnerId)}
          className="inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          style={{ fontSize: 13, padding: '7px 14px', height: 34, background: 'var(--color-brand)' }}
          onMouseEnter={(e) => { if (!(saving || ownerId == null || (!isBulk && ownerId === currentOwnerId))) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {isReassign ? 'Reassign' : 'Assign'}
        </button>
      </div>
    </ModalShell>
  );
}
