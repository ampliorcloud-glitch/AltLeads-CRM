import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { AppShell } from '../components/layout/AppShell';
import { fetchCompanies, type Company } from '../data/companies';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { supabase } from '../lib/supabase';
import { useRowSelection } from '../components/ui/useRowSelection';
import { ExportButton } from '../components/ui/ExportButton';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { ColumnCustomizer, defaultColumnPrefs, reconcileColumns } from '../components/ui/ColumnCustomizer';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { Skeleton } from '../components/ui/Skeleton';
import type { ColumnDef as ColDef, ExportColumn } from '../components/ui/columns';
import type { ColumnPref } from '../data/views';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  AlertCircle,
  UserCheck,
  FolderPlus,
} from 'lucide-react';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignCompaniesBulk, fetchAssignableUsers } from '../data/assignment';
import { BulkProjectModal } from '../components/common/BulkProjectModal';
import { addCompaniesToProject } from '../data/bulkActions';
import type { UserOption } from '../data/wishlist';
import { useToast } from '../components/ui/Toast';

// TODO visibility: per-project status/notes are owner + admin only (security pass).

const columnHelper = createColumnHelper<Company>();

/* ------------------------------------------------------------------
   Company avatar — initials in a brand-tinted circle (matches Leads list)
------------------------------------------------------------------ */
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

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function avatarTint(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function CompanyAvatar({ name }: { name: string }) {
  const tint = name ? avatarTint(name) : { bg: 'var(--color-gray-100)', text: 'var(--color-gray-400)' };
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: tint.bg,
        color: tint.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}
    >
      {name ? companyInitials(name) : '—'}
    </span>
  );
}

/** Grey "DEMO" tag for is_demo rows. */
function DemoTag() {
  return (
    <span
      style={{
        background: '#F3F4F6',
        color: '#6B7280',
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 4,
        padding: '1px 6px',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        lineHeight: '16px',
      }}
    >
      Demo
    </span>
  );
}

interface Filters {
  search: string;
  industry: string[]; // multi-value (OR; empty = all)
  city: string[];     // multi-value (OR; empty = all)
}

const defaultFilters: Filters = { search: '', industry: [], city: [] };

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


const PAGE_SIZE_OPTIONS = [25, 50, 100];

function fullUrl(webUrl: string): string {
  if (!webUrl) return '';
  return /^https?:\/\//.test(webUrl) ? webUrl : `https://${webUrl}`;
}

/* ------------------------------------------------------------------
   Lightweight company status shape for the list (batch-fetched per page).
------------------------------------------------------------------ */
interface CompanyStatusLite {
  account_status: string | null;
}

/** Batch-fetch account statuses for an array of company_ids within one project. */
async function fetchCompanyStatuses(
  projectId: number,
  companyIds: number[],
): Promise<Record<number, CompanyStatusLite>> {
  const out: Record<number, CompanyStatusLite> = {};
  if (!projectId || companyIds.length === 0) return out;
  const CHUNK = 200;
  for (let i = 0; i < companyIds.length; i += CHUNK) {
    const slice = companyIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('company_project_status')
      .select('company_id, account_status')
      .eq('project_id', projectId)
      .in('company_id', slice);
    if (error) {
      console.error('[CompaniesPage] fetchCompanyStatuses error', error);
      continue;
    }
    for (const row of (data ?? []) as { company_id: number; account_status: string | null }[]) {
      out[row.company_id] = { account_status: row.account_status ?? null };
    }
  }
  return out;
}

/* ------------------------------------------------------------------
   Column catalogue — drives ColumnCustomizer + ExportButton.
   Keys must be stable; they are persisted in user_view_pref.
------------------------------------------------------------------ */
// ColDef used without a Row generic here — only key/header/defaultVisible are needed.
const ALL_COLUMNS: ColDef[] = [
  { key: 'name',          header: 'Company',        defaultVisible: true },
  { key: 'domainClean',   header: 'Domain',          defaultVisible: true },
  { key: 'industry',      header: 'Industry',        defaultVisible: true },
  { key: 'city',          header: 'City',            defaultVisible: true },
  { key: 'cin',           header: 'CIN',             defaultVisible: true },
  { key: 'owner',         header: 'Owner',           defaultVisible: true },
  { key: 'accountStatus', header: 'Account Status',  defaultVisible: true },
];

type ExportRow = Company & { accountStatus: string | null };

const EXPORT_COLUMNS: ExportColumn<ExportRow>[] = [
  { key: 'name',          header: 'Company' },
  { key: 'domainClean',   header: 'Domain' },
  { key: 'webUrl',        header: 'Website' },
  { key: 'industry',      header: 'Industry' },
  { key: 'city',          header: 'City' },
  { key: 'cin',           header: 'CIN' },
  { key: 'size',          header: 'Size',           accessor: (r) => r.size ?? '' },
  { key: 'email',         header: 'Email' },
  { key: 'linkedin',      header: 'LinkedIn' },
  { key: 'owner',         header: 'Owner' },
  { key: 'accountStatus', header: 'Account Status', accessor: (r) => r.accountStatus ?? '' },
  { key: 'isDemo',        header: 'Demo',           accessor: (r) => (r.isDemo ? 'Yes' : 'No') },
];

export function CompaniesPage() {
  const navigate = useNavigate();
  const { profile, canCreateData, canReassign } = useAuth();
  const userId = profile?.user_id ?? null;
  const toast = useToast();

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  // Project selection drives the per-project Account Status column. Companies are
  // cross-project entities (no project_id on the row), so we don't row-filter by
  // project — but this local picker is SEEDED + KEPT IN SYNC with the global project
  // switcher so a multi-project user sees one consistent project rather than two
  // competing controls (review ALT-273B M9). May still be overridden locally.
  const { selectedProjectId, projects } = useProjectScope();
  const [projectId, setProjectId] = useState<number | null>(selectedProjectId);

  // Bulk reassign (ALT-291) — per-project owner_user_id for the selected companies.
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Bulk add-to-project (ALT-291) — enroll selected companies into a project.
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
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignCompaniesBulk(ids, projectId, newUserId, profile?.user_id != null ? String(profile.user_id) : '');
    setReassignSaving(false);
    if (res.ok === 0 && res.error) { setReassignError(res.error); return; }
    setShowReassign(false);
    sel.clear();
    toast.success(
      res.failed > 0
        ? `Reassigned ${res.ok}; ${res.failed} skipped (no permission).`
        : `Reassigned ${res.ok} compan${res.ok === 1 ? 'y' : 'ies'} — the new owner was notified.`,
    );
  };
  const handleAddToProject = async (targetProjectId: number) => {
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    setAddProjectSaving(true);
    setAddProjectError(null);
    const res = await addCompaniesToProject(ids, targetProjectId, profile?.user_id != null ? String(profile.user_id) : '');
    setAddProjectSaving(false);
    if (res.ok === 0 && res.error) { setAddProjectError(res.error); return; }
    setShowAddProject(false);
    sel.clear();
    toast.success(
      res.failed > 0
        ? `Added ${res.ok}; ${res.failed} skipped (no permission).`
        : `Added ${res.ok} compan${res.ok === 1 ? 'y' : 'ies'} to the project.`,
    );
  };
  useEffect(() => { setProjectId(selectedProjectId); }, [selectedProjectId]);

  // Per-project statuses keyed by numeric company_id.
  const [statusMap, setStatusMap] = useState<Record<number, CompanyStatusLite>>({});
  const [statusLoading, setStatusLoading] = useState(false);

  // Column prefs driven by ColumnCustomizer.
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() => defaultColumnPrefs(ALL_COLUMNS));

  // Row selection.
  const sel = useRowSelection<string>();

  /* ---- load companies ---- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchCompanies().then((result) => {
      if (cancelled) return;
      setAllCompanies(result.companies);
      setIndustries(result.industries);
      setCities(result.cities);
      setLoadError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    sel.clear();
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '',
  );

  const filteredData = useMemo(() => {
    return allCompanies.filter((c) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [c.name, c.domainClean, c.cin, c.industry, c.city, c.email]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.industry.length && !filters.industry.includes(c.industry)) return false;
      if (filters.city.length && !filters.city.includes(c.city)) return false;
      return true;
    });
  }, [filters, allCompanies]);

  /* ---- augmented rows with accountStatus for export ---- */
  const exportRows = useMemo(
    () => filteredData.map((c) => ({
      ...c,
      accountStatus: statusMap[Number(c.id)]?.account_status ?? null,
    })),
    [filteredData, statusMap],
  );

  /* ---- batch-load statuses for the CURRENT PAGE rows when project changes ---- */
  const pageCompanyIds = useMemo(() => {
    // We compute this after the table is built; for now derive from filteredData + pagination.
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredData.slice(start, end).map((c) => Number(c.id));
  }, [filteredData, pagination.pageIndex, pagination.pageSize]);

  const loadStatuses = useCallback(async (pid: number, ids: number[]) => {
    if (!pid || ids.length === 0) return;
    setStatusLoading(true);
    const result = await fetchCompanyStatuses(pid, ids);
    setStatusMap((prev) => ({ ...prev, ...result }));
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    if (projectId == null) return;
    // Load statuses for ids not yet in the map.
    const missing = pageCompanyIds.filter((id) => !(id in statusMap));
    if (missing.length > 0) {
      loadStatuses(projectId, missing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageCompanyIds]);

  // When project changes, clear the cache and reload for current page.
  useEffect(() => {
    if (projectId == null) return;
    setStatusMap({});
    loadStatuses(projectId, pageCompanyIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /* ---- visible column keys (from prefs) ---- */
  const visibleKeys = useMemo(
    () => new Set(columnPrefs.filter((p) => p.visible).map((p) => p.key)),
    [columnPrefs],
  );

  /* ---- export columns: never leak a column the user has hidden in the
     customizer. Keys present in the column catalogue must be visible to be
     exported; export-only extras (Website/Email/LinkedIn/Size/Demo) that are
     not customizer-controlled are always included. ---- */
  const customizerKeys = useMemo(() => new Set(ALL_COLUMNS.map((c) => c.key)), []);
  const activeExportColumns = useMemo<ExportColumn<ExportRow>[]>(
    () =>
      EXPORT_COLUMNS.filter(
        (c) => !customizerKeys.has(c.key) || visibleKeys.has(c.key),
      ),
    [visibleKeys, customizerKeys],
  );

  /* ---- TanStack columns (filtered by prefs) ---- */
  const columns = useMemo(() => {
    const all = [
      // Checkbox column — always first, not managed by prefs.
      columnHelper.display({
        id: '__select',
        header: ({ table: t }) => {
          const pageRows = t.getRowModel().rows;
          const pageIds = pageRows.map((r) => r.original.id);
          const allSel = sel.allSelected(pageIds);
          return (
            <input
              type="checkbox"
              aria-label={allSel ? 'Deselect all companies on this page' : 'Select all companies on this page'}
              checked={allSel}
              onChange={() => sel.toggleAll(pageIds)}
              style={{ cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.name || 'company'}`}
            checked={sel.isSelected(row.original.id)}
            onChange={() => sel.toggle(row.original.id)}
            style={{ cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
        enableSorting: false,
      }),
      columnHelper.accessor('name', {
        id: 'name',
        header: 'Company',
        cell: (info) => {
          const name = info.getValue() ?? '';
          const row = info.row.original;
          return (
            <div className="flex items-center gap-2.5">
              <CompanyAvatar name={name} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 220 }} title={name || undefined}>
                    {name || <span className="text-zinc-400">—</span>}
                  </p>
                  {row.isDemo && <DemoTag />}
                </div>
                {row.city && (
                  <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 220 }} title={row.city}>{row.city}</p>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('domainClean', {
        id: 'domainClean',
        header: 'Domain',
        cell: (info) => {
          const domain = info.getValue() ?? '';
          const href = fullUrl(info.row.original.webUrl || domain);
          if (!domain) return <span className="text-zinc-300" style={{ fontSize: 13 }}>—</span>;
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 13, color: 'var(--color-brand)' }}
              className="hover:underline"
            >
              {domain}
            </a>
          );
        },
      }),
      columnHelper.accessor('industry', {
        id: 'industry',
        header: 'Industry',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('city', {
        id: 'city',
        header: 'City',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('cin', {
        id: 'cin',
        header: 'CIN',
        cell: (info) => (
          <span className="text-zinc-500 font-mono" style={{ fontSize: 12 }}>
            {info.getValue() || <span className="text-zinc-300 font-sans">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('owner', {
        id: 'owner',
        header: 'Owner',
        // Owner is always "Unassigned" for now. // TODO ownership
        cell: (info) => (
          <span className="text-zinc-400" style={{ fontSize: 13 }}>{info.getValue()}</span>
        ),
      }),
      // Account Status — per-project, batch-loaded for current page.
      columnHelper.display({
        id: 'accountStatus',
        header: 'Account Status',
        enableSorting: false,
        cell: ({ row }) => {
          const numId = Number(row.original.id);
          if (projectId == null) return <span className="text-zinc-300" style={{ fontSize: 12 }}>—</span>;
          if (statusLoading && !(numId in statusMap)) {
            return <Loader2 size={12} className="animate-spin text-zinc-300" />;
          }
          const status = statusMap[numId]?.account_status ?? null;
          return <StatusBadge value={status} category="account_status" />;
        },
      }),
    ];

    // Filter out columns that are hidden via prefs (keep __select always).
    return all.filter((col) => {
      const id = col.id ?? ('accessorKey' in col ? String(col.accessorKey) : '');
      if (id === '__select') return true;
      return visibleKeys.has(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeys, statusMap, statusLoading, projectId, sel]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <AppShell title="Companies">
      <div className="space-y-3">
        {/* Filter panel */}
        <div className="rounded-lg p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search size={13} className="absolute text-zinc-400 pointer-events-none" style={{ left: 8 }} />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Company, domain, CIN..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 10, width: 240 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
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

            <MultiSelectFilter
              label="Industry"
              selected={filters.industry}
              onChange={(v) => setFilter('industry', v)}
              options={industries}
            />
            <MultiSelectFilter
              label="City"
              selected={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cities}
            />

            {/* Project selector for per-project Account Status column */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Project</label>
              <ProjectSelect value={projectId} onChange={setProjectId} />
            </div>
          </div>
        </div>

        {/* Toolbar row: count + actions */}
        <div className="flex items-center justify-between">
          <p className="text-zinc-400" style={{ fontSize: 12 }}>
            {loading ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                Loading companies...
              </span>
            ) : loadError ? (
              <span className="text-red-500">{loadError}</span>
            ) : (
              <>
                {sel.count > 0 && (
                  <span className="font-medium text-zinc-700 mr-3">{sel.count} selected</span>
                )}
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allCompanies.length}</span> companies
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setFilters(defaultFilters);
                      setPagination((p) => ({ ...p, pageIndex: 0 }));
                      sel.clear();
                    }}
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
            {/* Bulk reassign selected companies (ALT-291) — needs an active project */}
            {canReassign && sel.count > 0 && projectId != null && (
              <button
                onClick={openBulkReassign}
                className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-md transition-colors"
                style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                title="Assign the selected companies (in this project) to a salesperson"
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
                title="Add the selected companies to a project"
              >
                <FolderPlus size={14} />
                Add to project ({sel.count})
              </button>
            )}

            {/* Column customizer */}
            <ColumnCustomizer
              entity="companies"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={(next) => setColumnPrefs(reconcileColumns(next, ALL_COLUMNS))}
            />

            {/* Export button — replaces old single Excel button */}
            <ExportButton
              rows={exportRows as unknown as Record<string, unknown>[]}
              columns={activeExportColumns as unknown as ExportColumn<Record<string, unknown>>[]}
              filename="amplior-crm-companies"
              selectedIds={sel.selectedIds}
              idKey="id"
              disabled={loading || filteredData.length === 0}
            />

            {/* Create is admin-only by default (ADR-21); hidden from outreach roles. */}
            {canCreateData && (
            <button
              onClick={() => navigate('/companies/new')}
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
              New Company
            </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--color-surface)' }}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                      <th
                        key={header.id}
                        role={canSort ? 'button' : undefined}
                        tabIndex={canSort ? 0 : undefined}
                        aria-sort={
                          sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : canSort ? 'none' : undefined
                        }
                        style={{
                          padding: header.id === '__select' ? '11px 8px 11px 16px' : '11px 16px',
                          textAlign: 'left',
                          fontWeight: 500,
                          fontSize: 12,
                          color: 'var(--color-gray-500)',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          cursor: canSort ? 'pointer' : 'default',
                          width: header.id === '__select' ? 40 : undefined,
                          // Sticky header (ALT-318): background + bottom border on the cell
                          // so body rows can't show through under the sticky header.
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          background: 'var(--color-surface)',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyDown={(e) => {
                          if (canSort && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            header.column.getToggleSortingHandler()?.(e);
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            ({
                              asc: <ChevronUp size={11} style={{ color: 'var(--color-brand)' }} />,
                              desc: <ChevronDown size={11} style={{ color: 'var(--color-brand)' }} />,
                            }[sortDir as string] ?? (
                              <ChevronsUpDown size={11} className="text-zinc-300" />
                            ))}
                        </div>
                      </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton rows aligned to the visible columns (ALT-200).
                  Array.from({ length: 8 }).map((_, r) => (
                    <tr key={`sk-${r}`} style={{ borderBottom: '1px solid var(--color-gray-100)', height: 44 }}>
                      {columns.map((_c, c) => (
                        <td key={c} style={{ padding: c === 0 ? '0 8px 0 16px' : '0 16px' }}>
                          <Skeleton height={12} width={c === 0 ? 16 : `${48 + ((r + c) % 4) * 12}%`} radius={4} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  // Error state with Retry (ALT-215 #12).
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center">
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
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-zinc-400" style={{ fontSize: 13 }}>
                      {hasActiveFilters ? (
                        <span className="inline-flex items-center gap-2">
                          No companies match the current filters.
                          <button
                            type="button"
                            onClick={() => setFilters(defaultFilters)}
                            style={{ color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}
                          >
                            Clear filters
                          </button>
                        </span>
                      ) : (
                        'No companies yet.'
                      )}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const isSelected = sel.isSelected(row.original.id);
                    return (
                      <tr
                        key={row.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${row.original.name || 'company'}`}
                        onClick={() => navigate(`/companies/${row.original.id}`)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            navigate(`/companies/${row.original.id}`);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-gray-100)',
                          height: 44,
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                          background: isSelected ? 'var(--color-brand-50, #EBF4FD)' : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--color-brand-50, #EBF4FD)' : '';
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="align-middle whitespace-nowrap"
                            style={{
                              padding: cell.column.id === '__select' ? '0 8px 0 16px' : '0 16px',
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
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
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value));
                    table.setPageIndex(0);
                  }}
                  style={{ ...inputBase, height: 28, paddingRight: 22, cursor: 'pointer', fontSize: 12 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                >
                  {PAGE_SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
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
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: !table.getCanPreviousPage() ? 'not-allowed' : 'pointer',
                      opacity: !table.getCanPreviousPage() ? 0.4 : 1,
                      transition: 'border-color 0.12s',
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--color-gray-500)' }}>
                    Page <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{pageIndex + 1}</span> of{' '}
                    <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{table.getPageCount()}</span>
                  </span>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: !table.getCanNextPage() ? 'not-allowed' : 'pointer',
                      opacity: !table.getCanNextPage() ? 0.4 : 1,
                      transition: 'border-color 0.12s',
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
          entityLabel="Company"
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
          entityLabel="Company"
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

export default CompaniesPage;
