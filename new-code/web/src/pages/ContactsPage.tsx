import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { fetchAllContacts, type Contact } from '../data/contacts';
import {
  fetchContactStatuses,
  upsertContactStatus,
  type ContactStatusLite,
} from '../data/projectStatus';
import { fetchOptions, type DropdownOption } from '../data/dropdowns';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { useRowSelection } from '../components/ui/useRowSelection';
import { ExportButton } from '../components/ui/ExportButton';
import { ColumnCustomizer, defaultColumnPrefs } from '../components/ui/ColumnCustomizer';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import type { ColumnDef, ExportColumn } from '../components/ui/columns';
import type { ColumnPref } from '../data/views';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  Plus,
  Link2,
  RefreshCw,
  AlertCircle,
  UserCheck,
  FolderPlus,
} from 'lucide-react';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignContactsBulk, fetchAssignableUsers } from '../data/assignment';
import { BulkProjectModal } from '../components/common/BulkProjectModal';
import { addContactsToProject } from '../data/bulkActions';
import type { UserOption } from '../data/wishlist';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const AVATAR_TINTS: { bg: string; text: string }[] = [
  { bg: '#EBF4FD', text: '#1A7EE8' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFEFF', text: '#0891B2' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#FEF2F2', text: '#DC2626' },
  { bg: '#FFFBEB', text: '#D97706' },
  { bg: '#EFF6FF', text: '#1D4ED8' },
];

function avatarTint(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function ContactAvatar({ name }: { name: string }) {
  const tint = name ? avatarTint(name) : { bg: '#F3F4F6', text: '#9CA3AF' };
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: tint.bg,
        color: tint.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {name ? contactInitials(name) : '?'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Input style                                                         */
/* ------------------------------------------------------------------ */

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '5px 8px',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--color-surface)',
  color: 'var(--color-gray-900)',
  outline: 'none',
  height: 30,
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

/* ------------------------------------------------------------------ */
/*  Filters                                                             */
/* ------------------------------------------------------------------ */

interface Filters {
  search: string;
  company: string[]; // multi-value (OR; empty = all)
  city: string[];    // multi-value (OR; empty = all)
  hasLinkedin: string; // 'yes' | 'no' | ''
  showDemo: string;    // 'all' | 'real' | 'demo'
}

const defaultFilters: Filters = {
  search: '',
  company: [],
  city: [],
  hasLinkedin: '',
  showDemo: 'real',
};

/* ------------------------------------------------------------------ */
/*  Column catalogue                                                    */
/* ------------------------------------------------------------------ */

// ContactRow is a Contact enriched with per-project status fields.
// The index signature lets it satisfy Record<string,unknown> for the shared
// generic components (ColumnCustomizer, ExportButton).
interface ContactRow extends Contact, ContactStatusLite {
  [key: string]: unknown;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'full_name',       header: 'Name',           defaultVisible: true },
  { key: 'company_name',    header: 'Company',        defaultVisible: true },
  { key: 'city_name',       header: 'City',           defaultVisible: true },
  { key: 'email',           header: 'Email',          defaultVisible: true },
  { key: 'linkedin_url',    header: 'LinkedIn',       defaultVisible: true },
  { key: 'phone_combined',  header: 'Phone',          defaultVisible: true },
  { key: 'contact_status',  header: 'Contact Status', defaultVisible: true },
  { key: 'description',     header: 'Description',    defaultVisible: true },
  { key: 'comments',        header: 'Comments',       defaultVisible: true },
  // Hidden by default — reachable via customizer
  { key: 'designation',     header: 'Designation',    defaultVisible: false },
  { key: 'mobile_no',       header: 'Mobile',         defaultVisible: false },
  { key: 'alt_mobile_no',   header: 'Alt Phone',      defaultVisible: false },
];

// Export columns for the ExportButton — use accessors for computed/enriched cells.
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'full_name',      header: 'Name' },
  { key: 'company_name',   header: 'Company' },
  { key: 'city_name',      header: 'City' },
  { key: 'email',          header: 'Email' },
  { key: 'linkedin_url',   header: 'LinkedIn' },
  { key: 'mobile_no',      header: 'Mobile' },
  { key: 'alt_mobile_no',  header: 'Alt Phone' },
  { key: 'designation',    header: 'Designation' },
  { key: 'contact_status', header: 'Contact Status' },
  { key: 'description',    header: 'Description' },
  { key: 'comments',       header: 'Comments' },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/* ------------------------------------------------------------------ */
/*  Inline status cell                                                  */
/* ------------------------------------------------------------------ */

interface InlineStatusCellProps {
  contactId: number;
  projectId: number | null;
  current: string | null;
  options: DropdownOption[];
  actorId: string | null;
  onUpdated: (contactId: number, newStatus: string | null) => void;
}

function InlineStatusCell({
  contactId, projectId, current, options, actorId, onUpdated,
}: InlineStatusCellProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setEditing(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  async function handleChange(value: string) {
    if (!projectId) return;
    setBusy(true);
    const newStatus = value === '' ? null : value;
    const { error } = await upsertContactStatus(contactId, projectId, { contact_status: newStatus }, actorId);
    setBusy(false);
    setEditing(false);
    // Surface failures instead of silently flipping the badge (e.g. RLS 42501
    // "you can only edit records you own"). Only update on success.
    if (error) { toast.error(error); return; }
    onUpdated(contactId, newStatus);
    toast.success('Status updated');
  }

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); if (projectId) setEditing(true); }}
        title={projectId ? 'Click to change status' : 'Select a project first'}
        style={{ cursor: projectId ? 'pointer' : 'default', display: 'inline-block' }}
      >
        <StatusBadge value={current} category="contact_status" />
      </span>
    );
  }

  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block' }}>
      <select
        autoFocus
        value={current ?? ''}
        disabled={busy}
        onChange={(e) => void handleChange(e.target.value)}
        style={{ ...inputBase, height: 26, fontSize: 12, paddingRight: 24, cursor: 'pointer' }}
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.option_id} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort state                                                          */
/* ------------------------------------------------------------------ */

type SortKey = keyof ContactRow | 'phone_combined' | null;
interface SortState { key: SortKey; dir: 'asc' | 'desc' }

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function ContactsPage() {
  const navigate = useNavigate();
  const { profile, canCreateData, canReassign } = useAuth();
  const userId = profile?.user_id ?? null;
  const toast = useToast();
  // actorId is numeric user_id as text for audit columns
  const actorId = userId != null ? String(userId) : null;

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the contacts-load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortState>({ key: 'full_name', dir: 'asc' });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Per-project status map: contact_id -> ContactStatusLite.
  // The project here drives the per-project STATUS column. Contacts are cross-project
  // entities (no project_id on the row), so we don't row-filter by project — but the
  // local picker is SEEDED + KEPT IN SYNC with the global project switcher so a
  // multi-project user sees one consistent project, not two competing controls
  // (review ALT-273B M8). The user may still override it locally for the status view.
  const { selectedProjectId, projects } = useProjectScope();
  const [projectId, setProjectId] = useState<number | null>(selectedProjectId);

  // Bulk reassign (ALT-291) — per-project owner_user_id for the selected contacts.
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Bulk add-to-project (ALT-291).
  const [showAddProject, setShowAddProject] = useState(false);
  const [addProjectSaving, setAddProjectSaving] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);

  const openBulkReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    setReassignOwners(await fetchAssignableUsers(null));
  };
  const handleBulkReassign = async (newUserId: number) => {
    if (projectId == null) { setReassignError('Select a project first (top-bar selector).'); return; }
    const ids = [...sel.selectedIds];
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignContactsBulk(ids, projectId, newUserId, profile?.user_id != null ? String(profile.user_id) : '');
    setReassignSaving(false);
    if (res.ok === 0 && res.error) { setReassignError(res.error); return; }
    setShowReassign(false);
    sel.clear();
    toast.success(
      res.failed > 0
        ? `Reassigned ${res.ok}; ${res.failed} skipped (no permission).`
        : `Reassigned ${res.ok} contact${res.ok === 1 ? '' : 's'} — the new owner was notified.`,
    );
  };
  const handleAddToProject = async (targetProjectId: number) => {
    const ids = [...sel.selectedIds];
    setAddProjectSaving(true);
    setAddProjectError(null);
    const res = await addContactsToProject(ids, targetProjectId, profile?.user_id != null ? String(profile.user_id) : '');
    setAddProjectSaving(false);
    if (res.ok === 0 && res.error) { setAddProjectError(res.error); return; }
    setShowAddProject(false);
    sel.clear();
    toast.success(
      res.failed > 0
        ? `Added ${res.ok}; ${res.failed} skipped (no permission).`
        : `Added ${res.ok} contact${res.ok === 1 ? '' : 's'} to the project.`,
    );
  };
  useEffect(() => { setProjectId(selectedProjectId); }, [selectedProjectId]);
  const [statusMap, setStatusMap] = useState<Record<number, ContactStatusLite>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  // contact_status dropdown options
  const [statusOptions, setStatusOptions] = useState<DropdownOption[]>([]);

  // Column customizer state
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() => defaultColumnPrefs(ALL_COLUMNS));

  // Row selection
  const sel = useRowSelection<number>();

  // Load contacts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchAllContacts().then(({ contacts, error }) => {
      if (cancelled) return;
      setAllContacts(contacts);
      setLoadError(error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Load contact_status dropdown options once
  useEffect(() => {
    fetchOptions('contact_status').then(setStatusOptions);
  }, []);

  // Load per-project statuses whenever project or contacts change
  useEffect(() => {
    if (!projectId || allContacts.length === 0) {
      setStatusMap({});
      return;
    }
    let cancelled = false;
    setStatusLoading(true);
    const ids = allContacts.map((c) => c.contact_id);
    fetchContactStatuses(projectId, ids).then((map) => {
      if (cancelled) return;
      setStatusMap(map);
      setStatusLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId, allContacts]);

  // TODO visibility: per-project status/notes are owner + admin only (security pass).

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  };

  // Unique companies and cities for filter dropdowns
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    allContacts.forEach((c) => { if (c.company_name) set.add(c.company_name); });
    return Array.from(set).sort();
  }, [allContacts]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    allContacts.forEach((c) => { if (c.city_name) set.add(c.city_name); });
    return Array.from(set).sort();
  }, [allContacts]);

  // Filtered data
  const filteredData = useMemo<ContactRow[]>(() => {
    const filtered = allContacts.filter((c) => {
      if (filters.showDemo === 'real' && c.is_demo) return false;
      if (filters.showDemo === 'demo' && !c.is_demo) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          c.full_name, c.email, c.mobile_no, c.designation, c.company_name, c.city_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      if (filters.company.length && !filters.company.includes(c.company_name ?? '')) return false;
      if (filters.city.length && !filters.city.includes(c.city_name ?? '')) return false;
      if (filters.hasLinkedin === 'yes' && !c.linkedin_url) return false;
      if (filters.hasLinkedin === 'no' && c.linkedin_url) return false;

      return true;
    });

    // Merge per-project status
    const enriched: ContactRow[] = filtered.map((c) => {
      const ps = statusMap[c.contact_id];
      return {
        ...c,
        contact_status: ps?.contact_status ?? null,
        description: ps?.description ?? null,
        comments: ps?.comments ?? null,
      };
    });

    // Sort
    if (sort.key) {
      const key = sort.key;
      enriched.sort((a, b) => {
        let av: unknown;
        let bv: unknown;
        if (key === 'phone_combined') {
          av = a.mobile_no ?? a.alt_mobile_no ?? '';
          bv = b.mobile_no ?? b.alt_mobile_no ?? '';
        } else {
          av = (a as Record<string, unknown>)[key as string];
          bv = (b as Record<string, unknown>)[key as string];
        }
        const as = (av ?? '').toString().toLowerCase();
        const bs = (bv ?? '').toString().toLowerCase();
        if (as < bs) return sort.dir === 'asc' ? -1 : 1;
        if (as > bs) return sort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return enriched;
  }, [allContacts, filters, statusMap, sort]);

  // Pagination
  const totalRows = filteredData.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pageRows = filteredData.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const firstRow = totalRows === 0 ? 0 : safePage * pageSize + 1;
  const lastRow = Math.min((safePage + 1) * pageSize, totalRows);

  const hasActiveFilters = filters.search !== '' || filters.company.length > 0 ||
    filters.city.length > 0 || filters.hasLinkedin !== '' || filters.showDemo !== 'real';

  // Visible page contact ids (for select-all on current page)
  const pageIds = pageRows.map((r) => r.contact_id);

  // Inline status update handler
  function handleStatusUpdated(contactId: number, newStatus: string | null) {
    setStatusMap((prev) => ({
      ...prev,
      [contactId]: {
        contact_status: newStatus,
        description: prev[contactId]?.description ?? null,
        comments: prev[contactId]?.comments ?? null,
      },
    }));
  }

  // Sorting toggle
  function handleSort(key: SortKey) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
    setPageIndex(0);
  }

  // Column visibility lookup
  const visibleKeys = useMemo(() => {
    const set = new Set(columnPrefs.filter((c) => c.visible).map((c) => c.key));
    return set;
  }, [columnPrefs]);

  // Export columns filtered to currently visible columns (in pref order)
  const exportColumns = useMemo<ExportColumn<ContactRow>[]>(() => {
    return columnPrefs
      .filter((p) => p.visible)
      .flatMap((p) => {
        const col = EXPORT_COLUMNS.find((ec) => ec.key === p.key);
        return col ? [col] : [];
      });
  }, [columnPrefs]);

  /* -------------------------------------------------------- render -- */

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <span style={{ color: '#d1d5db', marginLeft: 2 }}>↕</span>;
    return sort.dir === 'asc'
      ? <ChevronUp size={11} style={{ color: '#1A7EE8' }} />
      : <ChevronDown size={11} style={{ color: '#1A7EE8' }} />;
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 13,
    color: '#1A7EE8',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    borderBottom: '2px solid #1A7EE8',
    // Sticky header (ALT-318): background on the cell (not just the row) so body
    // rows can't show through under the sticky header while the body scrolls.
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: 'var(--color-surface)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0 14px',
    fontSize: 13,
    color: 'var(--color-gray-700)',
    verticalAlign: 'middle',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  // Compute number of visible columns + checkbox col
  const visibleColCount = columnPrefs.filter((p) => p.visible).length + 1; // +1 for checkbox

  return (
    <AppShell title="Contacts">
      <div className="space-y-3">

        {/* Filter panel */}
        <div className="rounded-lg p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search size={13} className="absolute text-zinc-400 pointer-events-none" style={{ left: 8 }} />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Name, email, phone, company..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 10, width: 220 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilter('search', '')}
                    aria-label="Clear search"
                    title="Clear search"
                    className="absolute text-zinc-400 hover:text-zinc-700"
                    style={{ right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Company filter (multi-select) */}
            <MultiSelectFilter
              label="Company"
              selected={filters.company}
              onChange={(v) => setFilter('company', v)}
              options={companyOptions}
              minWidth={160}
            />

            {/* City filter (multi-select) */}
            <MultiSelectFilter
              label="City"
              selected={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cityOptions}
            />

            {/* LinkedIn filter */}
            <div className="flex flex-col gap-1" style={{ minWidth: 120 }}>
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>LinkedIn</label>
              <select
                value={filters.hasLinkedin}
                onChange={(e) => setFilter('hasLinkedin', e.target.value)}
                style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              >
                <option value="">All</option>
                <option value="yes">Has LinkedIn</option>
                <option value="no">No LinkedIn</option>
              </select>
            </div>

            {/* Demo filter */}
            <div className="flex flex-col gap-1" style={{ minWidth: 110 }}>
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Data type</label>
              <select
                value={filters.showDemo}
                onChange={(e) => setFilter('showDemo', e.target.value)}
                style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              >
                <option value="real">Real only</option>
                <option value="demo">Demo only</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* Project selector (for per-project status columns) */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Project</label>
              <ProjectSelect value={projectId} onChange={setProjectId} />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-zinc-400" style={{ fontSize: 12 }}>
            {loading ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                Loading contacts...
              </span>
            ) : loadError ? (
              <span className="text-red-500">{loadError}</span>
            ) : (
              <>
                {sel.count > 0 && (
                  <span className="text-zinc-700 font-medium mr-2">{sel.count} selected</span>
                )}
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allContacts.length}</span> contacts
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilters(defaultFilters); setPageIndex(0); sel.clear(); }}
                    className="ml-3 text-zinc-400 hover:text-zinc-700 transition-colors"
                    style={{ fontSize: 12 }}
                  >
                    Clear filters
                  </button>
                )}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {/* Bulk reassign selected contacts (ALT-291) — needs an active project */}
            {canReassign && sel.count > 0 && projectId != null && (
              <button
                onClick={openBulkReassign}
                className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-md transition-colors"
                style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                title="Assign the selected contacts (in this project) to a salesperson"
              >
                <UserCheck size={14} />
                Reassign ({sel.count})
              </button>
            )}

            {/* Bulk add-to-project (ALT-291) */}
            {canReassign && sel.count > 0 && (
              <button
                onClick={() => { setAddProjectError(null); setShowAddProject(true); }}
                className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-md transition-colors"
                style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                title="Add the selected contacts to a project"
              >
                <FolderPlus size={14} />
                Add to project ({sel.count})
              </button>
            )}

            {/* Export — uses ExportButton with visible columns */}
            <ExportButton<ContactRow>
              rows={filteredData}
              columns={exportColumns}
              filename="amplior-contacts"
              selectedIds={sel.selectedIds}
              idKey="contact_id"
              disabled={loading || filteredData.length === 0}
            />

            {/* Column customizer */}
            <ColumnCustomizer
              entity="contacts"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={setColumnPrefs}
            />

            {/* Create is admin-only by default (ADR-21); hidden from outreach roles. */}
            {canCreateData && (
            <button
              onClick={() => navigate('/contacts/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--color-brand)',
                color: '#fff',
                fontWeight: 500,
                borderRadius: 'var(--radius-btn)',
                border: 'none',
                fontSize: 12,
                padding: '5px 12px',
                height: 30,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
            >
              <Plus size={13} strokeWidth={2.25} />
              New Contact
            </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1A7EE8', background: 'var(--color-surface)' }}>
                  {/* Checkbox column */}
                  <th style={{ ...thStyle, width: 36, paddingLeft: 14, paddingRight: 8 }}>
                    <input
                      type="checkbox"
                      checked={pageIds.length > 0 && sel.allSelected(pageIds)}
                      onChange={() => sel.toggleAll(pageIds)}
                      title="Select / deselect page"
                      aria-label={pageIds.length > 0 && sel.allSelected(pageIds) ? 'Deselect all contacts on this page' : 'Select all contacts on this page'}
                      style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
                    />
                  </th>

                  {/* Dynamic columns */}
                  {columnPrefs.filter((p) => p.visible).map((p) => {
                    const col = ALL_COLUMNS.find((c) => c.key === p.key);
                    const isSortable = !['linkedin_url', 'phone_combined', 'contact_status', 'description', 'comments'].includes(p.key);
                    const isSorted = isSortable && sort.key === p.key;
                    return (
                      <th
                        key={p.key}
                        role={isSortable ? 'button' : undefined}
                        tabIndex={isSortable ? 0 : undefined}
                        aria-sort={
                          isSorted
                            ? (sort.dir === 'asc' ? 'ascending' : 'descending')
                            : isSortable ? 'none' : undefined
                        }
                        style={{
                          ...thStyle,
                          cursor: isSortable ? 'pointer' : 'default',
                        }}
                        onClick={isSortable ? () => handleSort(p.key as SortKey) : undefined}
                        onKeyDown={isSortable ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSort(p.key as SortKey);
                          }
                        } : undefined}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {col?.header ?? p.key}
                          {isSortable && sortIcon(p.key as SortKey)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  // Skeleton rows aligned to the visible columns (ALT-200).
                  Array.from({ length: 8 }).map((_, r) => (
                    <tr key={`sk-${r}`} style={{ borderBottom: '1px solid var(--color-gray-100)', height: 48 }}>
                      {Array.from({ length: visibleColCount }).map((_c, c) => (
                        <td key={c} style={{ padding: c === 0 ? '0 8px 0 14px' : '0 14px' }}>
                          <Skeleton height={12} width={c === 0 ? 16 : `${48 + ((r + c) % 4) * 12}%`} radius={4} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  // Error state with Retry (ALT-215 #12).
                  <tr>
                    <td colSpan={visibleColCount} className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center justify-center gap-3" style={{ fontSize: 13 }}>
                        <AlertCircle size={22} className="text-red-400" />
                        <span className="text-zinc-600">{loadError}</span>
                        <button
                          type="button"
                          onClick={() => setReloadKey((k) => k + 1)}
                          className="inline-flex items-center gap-1.5"
                          style={{
                            fontSize: 13, fontWeight: 500, color: 'var(--color-brand)',
                            border: '1px solid var(--border-input)', borderRadius: 'var(--radius-btn)',
                            background: 'var(--color-surface)', padding: '6px 14px', cursor: 'pointer',
                          }}
                        >
                          <RefreshCw size={13} /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColCount} className="px-4 py-10 text-center text-zinc-400" style={{ fontSize: 13 }}>
                      {hasActiveFilters ? (
                        <span className="inline-flex items-center gap-2">
                          No contacts match the current filters.
                          <button
                            type="button"
                            onClick={() => setFilters(defaultFilters)}
                            style={{ color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}
                          >
                            Clear filters
                          </button>
                        </span>
                      ) : (
                        'No contacts yet.'
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const isSelected = sel.isSelected(row.contact_id);
                    return (
                      <tr
                        key={row.contact_id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${row.full_name || row.company_name || 'contact'}`}
                        onClick={() => navigate(`/contacts/${row.contact_id}`)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            navigate(`/contacts/${row.contact_id}`);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-gray-100)',
                          height: 48,
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                          background: isSelected ? '#EBF4FD' : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isSelected ? '#EBF4FD' : '';
                        }}
                      >
                        {/* Checkbox */}
                        <td
                          style={{ padding: '0 8px 0 14px', verticalAlign: 'middle', width: 36 }}
                          onClick={(e) => { e.stopPropagation(); sel.toggle(row.contact_id); }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => sel.toggle(row.contact_id)}
                            aria-label={`Select ${row.full_name || row.company_name || 'contact'}`}
                            style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
                          />
                        </td>

                        {/* Dynamic cells */}
                        {columnPrefs.filter((p) => p.visible).map((p) => {
                          switch (p.key) {
                            case 'full_name':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 220 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <ContactAvatar name={row.full_name ?? ''} />
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span title={row.full_name || undefined} style={{ fontWeight: 500, color: '#18181b', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                          {row.full_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                        </span>
                                        {row.is_demo && (
                                          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 3, padding: '1px 5px' }}>DEMO</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              );

                            case 'company_name':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.company_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'city_name':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.city_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'email':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 220 }}>
                                  {row.email || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'linkedin_url': {
                              const url = row.linkedin_url;
                              return (
                                <td key={p.key} style={{ ...tdStyle, width: 60, textAlign: 'center' }}>
                                  {url ? (
                                    <a
                                      href={url.startsWith('http') ? url : `https://linkedin.com/in/${url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ color: '#0A66C2', display: 'inline-flex', alignItems: 'center' }}
                                    >
                                      <Link2 size={14} />
                                    </a>
                                  ) : (
                                    <span style={{ color: '#e5e7eb' }}>—</span>
                                  )}
                                </td>
                              );
                            }

                            case 'phone_combined':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {row.mobile_no && (
                                      <span style={{ fontSize: 13, color: 'var(--color-gray-700)' }}>{row.mobile_no}</span>
                                    )}
                                    {row.alt_mobile_no && (
                                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{row.alt_mobile_no}</span>
                                    )}
                                    {!row.mobile_no && !row.alt_mobile_no && (
                                      <span style={{ color: '#d1d5db' }}>—</span>
                                    )}
                                  </div>
                                </td>
                              );

                            case 'contact_status':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  {statusLoading ? (
                                    <Loader2 size={12} className="animate-spin text-zinc-300" />
                                  ) : (
                                    <InlineStatusCell
                                      contactId={row.contact_id}
                                      projectId={projectId}
                                      current={row.contact_status}
                                      options={statusOptions}
                                      actorId={actorId}
                                      onUpdated={handleStatusUpdated}
                                    />
                                  )}
                                </td>
                              );

                            case 'description':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 200 }}>
                                  {row.description
                                    ? <span title={row.description}>{row.description}</span>
                                    : <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'comments':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 200 }}>
                                  {row.comments
                                    ? <span title={row.comments}>{row.comments}</span>
                                    : <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'designation':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  {row.designation || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'mobile_no':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.mobile_no || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'alt_mobile_no':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.alt_mobile_no || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            default:
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {String((row as Record<string, unknown>)[p.key] ?? '—')}
                                </td>
                              );
                          }
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {!loading && !loadError && totalRows > 0 && (
            <div
              className="flex items-center justify-between px-4"
              style={{ height: 44, background: 'var(--color-gray-50)', borderTop: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-zinc-500" style={{ fontSize: 12 }}>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
                  style={{ ...inputBase, height: 28, paddingRight: 22, cursor: 'pointer', fontSize: 12 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                >
                  {PAGE_SIZE_OPTIONS.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500" style={{ fontSize: 12 }}>
                  Showing <span className="font-medium text-zinc-700">{firstRow}</span>–
                  <span className="font-medium text-zinc-700">{lastRow}</span> of{' '}
                  <span className="font-medium text-zinc-700">{totalRows}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                    disabled={safePage === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: safePage === 0 ? 'not-allowed' : 'pointer',
                      opacity: safePage === 0 ? 0.4 : 1,
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--color-gray-500)' }}>
                    Page <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{safePage + 1}</span> of{' '}
                    <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{pageCount}</span>
                  </span>
                  <button
                    onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                    disabled={safePage >= pageCount - 1}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: safePage >= pageCount - 1 ? 'not-allowed' : 'pointer',
                      opacity: safePage >= pageCount - 1 ? 0.4 : 1,
                    }}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showReassign && (
        <ReassignModal
          entityLabel="Contact"
          ownerLabel="Owner"
          count={sel.count}
          currentOwnerId={null}
          owners={reassignOwners}
          saving={reassignSaving}
          error={reassignError}
          onConfirm={handleBulkReassign}
          onClose={() => setShowReassign(false)}
        />
      )}

      {showAddProject && (
        <BulkProjectModal
          entityLabel="Contact"
          count={sel.count}
          projects={projects}
          saving={addProjectSaving}
          error={addProjectError}
          onConfirm={handleAddToProject}
          onClose={() => setShowAddProject(false)}
        />
      )}
    </AppShell>
  );
}

export default ContactsPage;
