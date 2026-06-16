import React, { useMemo, useState } from 'react';
import { Loader2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { ModalShell } from './AssignModal';
import type { WishlistDetail, WishlistLookups } from '../../data/wishlist';

const inputCls =
  'w-full border border-zinc-300 rounded-md px-3 text-zinc-800 placeholder-zinc-400 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block mb-1 text-zinc-600 font-medium" style={{ fontSize: 12 }}>
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export interface ConvertFormResult {
  clientAssocId: number;
  projectId: number | null;
  leadName: string;
  designation: string;
  email: string;
  mobileNo: string;
}

export function ConvertModal({
  item,
  lookups,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  item: WishlistDetail;
  lookups: WishlistLookups | null;
  saving: boolean;
  error: string | null;
  onConfirm: (form: ConvertFormResult) => void;
  onClose: () => void;
}) {
  const [clientAssocId, setClientAssocId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [leadName, setLeadName] = useState(item.contactName);
  const [designation, setDesignation] = useState(item.designation);
  const [email, setEmail] = useState('');
  const [mobileNo, setMobileNo] = useState(item.phone);
  const [touched, setTouched] = useState(false);

  // Q13: a wishlist on a project with NO Team Lead must NOT silently proceed.
  // Here the Team Lead IS wishlist.assign_tl, so "no TL" == assign_tl is null.
  // OWNER-DEFAULT: block the action with a clear message and route to Admin.
  const noTeamLead = item.assignTlId == null;

  // When a project is chosen, narrow / auto-pick the client it belongs to.
  const projectsForClient = useMemo(() => {
    if (!lookups) return [];
    if (clientAssocId == null) return lookups.projects;
    return lookups.projects.filter((p) => p.clientAssocId == null || p.clientAssocId === clientAssocId);
  }, [lookups, clientAssocId]);

  const handleProjectChange = (val: string) => {
    const pid = val ? Number(val) : null;
    setProjectId(pid);
    // auto-fill client from the project if not yet set
    if (pid != null && lookups) {
      const proj = lookups.projects.find((p) => p.id === pid);
      if (proj?.clientAssocId != null) setClientAssocId(proj.clientAssocId);
    }
  };

  const canSubmit =
    !noTeamLead &&
    clientAssocId != null &&
    leadName.trim() !== '' &&
    designation.trim() !== '' &&
    mobileNo.trim() !== '';

  const submit = () => {
    setTouched(true);
    if (!canSubmit || clientAssocId == null) return;
    onConfirm({
      clientAssocId,
      projectId,
      leadName: leadName.trim(),
      designation: designation.trim(),
      email: email.trim(),
      mobileNo: mobileNo.trim(),
    });
  };

  return (
    <ModalShell title="Convert to Lead" icon={<ArrowRightLeft size={16} />} onClose={onClose} width={520}>
      {noTeamLead ? (
        // Q13 block — no Team Lead on this wishlist's project.
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <span
            className="inline-flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, background: '#fffbeb', border: '1px solid #fde68a' }}
          >
            <AlertTriangle size={20} className="text-amber-600" />
          </span>
          <p className="font-medium text-zinc-800" style={{ fontSize: 14 }}>
            This project has no Team Lead
          </p>
          <p className="text-zinc-500" style={{ fontSize: 13, maxWidth: 360 }}>
            This wishlist item has no Team Lead to gate the quality check, so it cannot be converted yet.
            Contact Admin to assign a Team Lead.
          </p>
          <button
            onClick={onClose}
            className="border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-700 font-medium rounded-md transition-colors mt-1"
            style={{ fontSize: 13, padding: '7px 16px', height: 34 }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <p className="text-zinc-500 mb-4" style={{ fontSize: 12 }}>
            Create a lead from this wishlist. Source is fixed to <span className="font-medium text-zinc-700">Wishlist</span>.
            Pick the client association and project, then confirm the contact details.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>Client Association</Label>
                <select
                  value={clientAssocId ?? ''}
                  onChange={(e) => {
                    setClientAssocId(e.target.value ? Number(e.target.value) : null);
                    setProjectId(null);
                  }}
                  className={inputCls}
                  style={{ height: 36, fontSize: 13 }}
                  disabled={saving || !lookups}
                >
                  <option value="">Select client…</option>
                  {(lookups?.clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {touched && clientAssocId == null && (
                  <p className="text-red-600 mt-1" style={{ fontSize: 11 }}>
                    Client is required.
                  </p>
                )}
              </div>

              <div>
                <Label>Project</Label>
                <select
                  value={projectId ?? ''}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className={inputCls}
                  style={{ height: 36, fontSize: 13 }}
                  disabled={saving || !lookups}
                >
                  <option value="">Select project…</option>
                  {projectsForClient.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>Contact Name</Label>
                <input
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className={inputCls}
                  style={{ height: 36, fontSize: 13 }}
                  placeholder="Lead contact name"
                  disabled={saving}
                />
                {touched && leadName.trim() === '' && (
                  <p className="text-red-600 mt-1" style={{ fontSize: 11 }}>
                    Contact name is required.
                  </p>
                )}
              </div>
              <div>
                <Label required>Designation</Label>
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className={inputCls}
                  style={{ height: 36, fontSize: 13 }}
                  placeholder="e.g. Procurement Head"
                  disabled={saving}
                />
                {touched && designation.trim() === '' && (
                  <p className="text-red-600 mt-1" style={{ fontSize: 11 }}>
                    Designation is required.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>Phone</Label>
                <input
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  className={inputCls}
                  style={{ height: 36, fontSize: 13 }}
                  placeholder="10-digit phone"
                  disabled={saving}
                />
                {touched && mobileNo.trim() === '' && (
                  <p className="text-red-600 mt-1" style={{ fontSize: 11 }}>
                    Phone is required.
                  </p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  style={{ height: 36, fontSize: 13 }}
                  placeholder="contact@company.com"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 px-3 py-2.5" style={{ background: '#fafafa' }}>
              <p className="text-zinc-500" style={{ fontSize: 11 }}>
                Company <span className="text-zinc-800 font-medium">{item.company || '—'}</span>
                {item.city && (
                  <>
                    {' · '}
                    {item.city}
                  </>
                )}
                {' · Source '}
                <span className="text-zinc-800 font-medium">Wishlist</span>
              </p>
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
              onClick={submit}
              disabled={saving || !canSubmit}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
              style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Convert to Lead
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
