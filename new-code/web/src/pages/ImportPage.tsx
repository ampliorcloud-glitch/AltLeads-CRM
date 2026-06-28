/**
 * ImportPage — admin-only entry point for the in-app Import Wizard (ALT-399).
 *
 * Role-gating: this page is admin-only. Two layers, matching how /admin is
 * handled elsewhere in the app:
 *   1. App.tsx wraps the route in <AdminRoute> (session + isAdmin) — see App.tsx.
 *   2. The page itself re-checks isAdmin and shows a calm "admins only" notice
 *      if a non-admin somehow lands here (defence in depth).
 * The sidebar nav entry is also flagged adminOnly so non-admins never see it.
 *
 * The wizard is FRONTEND-ONLY: no Supabase writes happen anywhere here. The
 * final "Import" action is intentionally disabled until the server-side admin
 * import endpoint exists.
 */
import { useState } from 'react';
import { Upload, ShieldAlert } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { ImportWizard } from '../components/import/ImportWizard';

export function ImportPage() {
  const { isAdmin } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!isAdmin) {
    return (
      <AppShell title="Import">
        <div className="max-w-2xl mx-auto">
          <div
            className="bg-white border border-zinc-200 rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-500"
            style={{ fontSize: 13, padding: '48px 16px', textAlign: 'center' }}
          >
            <ShieldAlert size={22} style={{ color: '#9ca3af' }} />
            Importing data is restricted to administrators.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Import">
      <div className="max-w-2xl mx-auto space-y-4">
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
            }}
          >
            <span style={{ display: 'block', width: 4, height: 20, background: '#1A7EE8', borderRadius: 2, flexShrink: 0 }} />
            <Upload size={15} strokeWidth={1.75} style={{ color: '#6B7280' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
              Import data
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-zinc-500" style={{ fontSize: 13, lineHeight: 1.55 }}>
              Bring Companies, Contacts or Leads in from a CSV or Excel file. The wizard
              maps your columns to the right fields, validates each row, and shows you
              exactly what will import and what will be skipped — before anything is saved.
            </p>
            <div
              style={{
                fontSize: 12, color: '#1e40af', background: '#EFF6FF',
                border: '1px solid #BFDBFE', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5,
              }}
            >
              Preview-only for now: the wizard validates and lets you download a cleaned
              file, but saving records is pending the admin import endpoint (coming soon).
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                padding: '7px 14px', height: 34, borderRadius: 6, border: 'none',
                background: '#1A7EE8', color: '#fff', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1568C8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8'; }}
            >
              <Upload size={14} /> Start an import
            </button>
          </div>
        </div>
      </div>

      {wizardOpen && <ImportWizard onClose={() => setWizardOpen(false)} />}
    </AppShell>
  );
}

export default ImportPage;
