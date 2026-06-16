import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Globe,
  MapPin,
  Building2,
  Hash,
  Mail,
  Link2,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import {
  fetchCompanyById,
  fetchCompanyContacts,
  fetchCompanyDeals,
  fetchProjects,
  type Company,
  type CompanyContact,
  type CompanyDeal,
  type ProjectOption,
} from '../data/companies';

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function fullUrl(webUrl: string): string {
  if (!webUrl) return '';
  return /^https?:\/\//.test(webUrl) ? webUrl : `https://${webUrl}`;
}

type TabKey = 'contacts' | 'deals' | 'activity';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'deals', label: 'Deals' },
  { key: 'activity', label: 'Activity' },
];

/* ------------------------------------------------------------------
   Project selector — display-only for now. // TODO ownership
------------------------------------------------------------------ */
function ProjectSelector({ projects }: { projects: ProjectOption[] }) {
  const [value, setValue] = useState('');
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          fontSize: 12,
          padding: '5px 28px 5px 10px',
          border: '1px solid var(--border-input)',
          borderRadius: 'var(--radius-btn, 6px)',
          background: 'var(--color-surface)',
          color: 'var(--color-gray-700)',
          cursor: 'pointer',
          height: 30,
          appearance: 'none',
        }}
        title="Project (display-only)"
      >
        <option value="">Project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute text-zinc-400 pointer-events-none" style={{ right: 9 }} />
    </div>
  );
}

/* ------------------------------------------------------------------
   Meta item in the header (icon + value)
------------------------------------------------------------------ */
function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-zinc-500" style={{ fontSize: 13 }}>
      <span className="text-zinc-400">{icon}</span>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------
   CONTACTS tab — grouped by city
------------------------------------------------------------------ */
function ContactsTab({ contacts, companyId }: { contacts: CompanyContact[]; companyId: string }) {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const map = new Map<string, CompanyContact[]>();
    contacts.forEach((c) => {
      const key = c.city || 'No city';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [contacts]);

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Building2 size={28} className="text-zinc-300" />
        <p className="text-zinc-500" style={{ fontSize: 14 }}>No contacts yet for this company.</p>
        <button
          onClick={() => navigate(`/contacts/new?company=${companyId}`)}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
          style={{ fontSize: 13 }}
        >
          <Plus size={14} />
          Add Contact
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([city, items]) => (
        <div key={city}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={13} className="text-zinc-400" />
            <h4 className="font-semibold text-zinc-700" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {city}
            </h4>
            <span className="text-zinc-300" style={{ fontSize: 12 }}>({items.length})</span>
          </div>
          <div className="space-y-2">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-4 rounded-lg px-4 py-3"
                style={{ border: '1px solid var(--border-color)', background: 'var(--color-surface)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-zinc-900" style={{ fontSize: 14 }}>
                      {c.fullName || <span className="text-zinc-400">Unnamed contact</span>}
                    </p>
                    {c.designation && (
                      <span className="text-zinc-500" style={{ fontSize: 12 }}>· {c.designation}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-zinc-500 hover:text-blue-600" style={{ fontSize: 12 }}>
                        <Mail size={12} /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1 text-zinc-500" style={{ fontSize: 12 }}>
                        {c.phone}
                      </span>
                    )}
                    {c.linkedin && (
                      <a href={fullUrl(c.linkedin)} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-zinc-500 hover:text-blue-600" style={{ fontSize: 12 }}>
                        <Link2 size={12} /> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   DEALS tab
------------------------------------------------------------------ */
function DealsTab({ deals }: { deals: CompanyDeal[] }) {
  const navigate = useNavigate();
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Hash size={28} className="text-zinc-300" />
        <p className="text-zinc-500" style={{ fontSize: 14 }}>No deals linked to this company yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {deals.map((d) => (
        <div
          key={d.id}
          onClick={() => navigate(`/leads/${d.id}`)}
          className="flex items-center justify-between gap-4 rounded-lg px-4 py-3 cursor-pointer transition-colors"
          style={{ border: '1px solid var(--border-color)', background: 'var(--color-surface)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
        >
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 14 }}>
              {d.leadName || <span className="text-zinc-400">Untitled deal</span>}
            </p>
            {d.leadNumber && (
              <p className="text-zinc-400 font-mono" style={{ fontSize: 11 }}>{d.leadNumber}</p>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <StageBadge stage={d.stage} />
            <span className="text-zinc-400" style={{ fontSize: 12 }}>{d.createdDate || '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   ACTIVITY tab — placeholder
------------------------------------------------------------------ */
function ActivityTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Loader2 size={26} className="text-zinc-300" />
      <p className="text-zinc-500" style={{ fontSize: 14 }}>Activity log coming with the interaction module</p>
    </div>
  );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */
export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const companyId = Number(id);

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [deals, setDeals] = useState<CompanyDeal[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabKey>('contacts');

  useEffect(() => {
    let cancelled = false;
    if (!companyId) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const co = await fetchCompanyById(companyId);
      if (cancelled) return;
      if (!co) { setNotFound(true); setLoading(false); return; }
      setCompany(co);
      const [c, d, p] = await Promise.all([
        fetchCompanyContacts(companyId),
        fetchCompanyDeals(companyId),
        fetchProjects(),
      ]);
      if (cancelled) return;
      setContacts(c);
      setDeals(d);
      setProjects(p);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading) {
    return (
      <AppShell title="Company">
        <div className="flex items-center justify-center h-64 gap-2 text-zinc-400">
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading company...</span>
        </div>
      </AppShell>
    );
  }

  if (notFound || !company) {
    return (
      <AppShell title="Company">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
          <AlertCircle size={24} />
          <p style={{ fontSize: 14 }}>Company not found.</p>
          <button onClick={() => navigate('/companies')} className="text-blue-600 hover:text-blue-700 font-medium" style={{ fontSize: 13 }}>
            Back to Companies
          </button>
        </div>
      </AppShell>
    );
  }

  const website = fullUrl(company.webUrl || company.domainClean);

  return (
    <AppShell title="Company">
      <div className="space-y-4 max-w-[1200px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-zinc-400" style={{ fontSize: 12 }}>
          <button onClick={() => navigate('/companies')} className="flex items-center gap-1 hover:text-zinc-700 transition-colors">
            <ArrowLeft size={13} />
            Companies
          </button>
          <ChevronRight size={11} />
          <span className="text-zinc-600 truncate" style={{ maxWidth: 320 }}>{company.name}</span>
        </div>

        {/* HubSpot-style header */}
        <div className="bg-white border border-zinc-200 rounded-lg px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <span
                aria-hidden
                style={{
                  width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 700,
                  background: 'var(--color-brand-light)', color: 'var(--color-brand)',
                  border: '1px solid rgba(26,126,232,0.20)',
                }}
              >
                {companyInitials(company.name)}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-semibold text-zinc-900" style={{ fontSize: 20, lineHeight: 1.2 }}>{company.name}</h1>
                  {company.isDemo && (
                    <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Demo
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap">
                  {company.domainClean && (
                    <MetaItem icon={<Globe size={13} />}>
                      <a href={website} target="_blank" rel="noreferrer noopener" className="hover:underline" style={{ color: 'var(--color-brand)' }}>
                        {company.domainClean}
                      </a>
                    </MetaItem>
                  )}
                  {company.industry && <MetaItem icon={<Building2 size={13} />}>{company.industry}</MetaItem>}
                  {company.city && <MetaItem icon={<MapPin size={13} />}>{company.city}</MetaItem>}
                  {company.cin && <MetaItem icon={<Hash size={13} />}>CIN {company.cin}</MetaItem>}
                </div>
              </div>
            </div>

            {/* Right block: owner + project selector */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ProjectSelector projects={projects} />
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400" style={{ fontSize: 11 }}>Owner</span>
                {/* Owner is always "Unassigned" for now. // TODO ownership */}
                <span className="text-zinc-600 font-medium" style={{ fontSize: 12 }}>{company.owner}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs card */}
        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="flex items-center justify-between px-3 border-b border-zinc-200">
            <div className="flex items-center">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                const count = t.key === 'contacts' ? contacts.length : t.key === 'deals' ? deals.length : null;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className="relative font-medium transition-colors"
                    style={{ fontSize: 13, padding: '12px 14px', color: isActive ? '#1A7EE8' : '#6B7280' }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#6B7280'; }}
                  >
                    {t.label}{count != null ? ` (${count})` : ''}
                    {isActive && (
                      <span style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, background: '#1A7EE8', borderRadius: '2px 2px 0 0' }} />
                    )}
                  </button>
                );
              })}
            </div>
            {tab === 'contacts' && (
              <button
                onClick={() => navigate(`/contacts/new?company=${company.id}`)}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                style={{ fontSize: 12, paddingRight: 6 }}
              >
                <Plus size={13} />
                Add Contact
              </button>
            )}
          </div>

          <div className="p-4">
            {tab === 'contacts' && <ContactsTab contacts={contacts} companyId={company.id} />}
            {tab === 'deals' && <DealsTab deals={deals} />}
            {tab === 'activity' && <ActivityTab />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default CompanyDetailPage;
