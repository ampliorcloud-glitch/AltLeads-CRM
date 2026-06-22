import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { AppShell } from '../components/layout/AppShell';
import { fetchWishlist, fmtLongDate, type WishlistItem } from '../data/wishlist';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { useRowSelection } from '../components/ui/useRowSelection';
import { ExportButton } from '../components/ui/ExportButton';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { ColumnCustomizer, defaultColumnPrefs, reconcileColumns } from '../components/ui/ColumnCustomizer';
import { ViewSwitcher, useViewMode } from '../components/ui/ViewSwitcher';
import { CardGrid, CardShell } from '../components/ui/CardGrid';
import { GenericKanban, type KanbanColumnDef } from '../components/kanban/GenericKanban';
import { Skeleton } from '../components/ui/Skeleton';
import { RecordPreviewPanel } from '../components/common/RecordPreviewPanel';
import { WishlistPreview } from '../components/wishlist/WishlistPreview';
import type { ColumnPref } from '../data/views';
import type { ColumnDef as UIColumnDef, ExportColumn } from '../components/ui/columns';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const columnHelper = createColumnHelper<WishlistItem>();

const PAGE_SIZE = 25;

/* ── company avatar — deterministic tinted initials ─────────────────── */

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
  const tint = name ? avatarTint(name) : { bg: '#F3F4F6', text: '#9CA3AF' };
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

interface Filters {
  search: string;
  status: string[];
  agent: string[];
  teamLead: string[];
  industry: string[];
  city: string[];
}

const defaultFilters: Filters = {
  search: '',
  status: [],
  agent: [],
  teamLead: [],
  industry: [],
  city: [],
};

/* ── shared input style ─────────────────────────────────────────────────── */

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '5px 8px',
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  background: '#fff',
  color: '#18181b',
  outline: 'none',
  height: 30,
  transition: 'border-color 0.15s',
};

/* ── status badge (muted tinted) ────────────────────────────────────────── */

const statusStyles: Record<string, { bg: string; text: string; ring: string }> = {
  'WishList': { bg: '#eff6ff', text: '#1d4ed8', ring: '#bfdbfe' },
  'Converted To Lead': { bg: '#f0fdf4', text: '#15803d', ring: '#bbf7d0' },
};
const statusDefault = { bg: '#f4f4f5', text: '#52525b', ring: '#d4d4d8' };

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusDefault;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        boxShadow: `inset 0 0 0 1px ${s.ring}`,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        padding: '2px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {status || '—'}
    </span>
  );
}

/* ── Column catalogue (for ColumnCustomizer + ExportButton) ─────────────── */

const ALL_COLUMNS: UIColumnDef[] = [
  { key: 'company',     header: 'Company',        defaultVisible: true },
  { key: 'contactName', header: 'Contact',         defaultVisible: true },
  { key: 'industry',    header: 'Industry',        defaultVisible: true },
  { key: 'city',        header: 'City',            defaultVisible: true },
  { key: 'agent',       header: 'Assigned Agent',  defaultVisible: true },
  { key: 'teamLead',    header: 'Team Lead',       defaultVisible: true },
  { key: 'status',      header: 'Status',          defaultVisible: true },
  { key: 'createdDate', header: 'Added',           defaultVisible: true },
  { key: 'state',       header: 'State',           defaultVisible: false },
  { key: 'pincode',     header: 'Pincode',         defaultVisible: false },
  { key: 'phone',       header: 'Phone',           defaultVisible: false },
  { key: 'description', header: 'Notes',           defaultVisible: false },
  { key: 'lastUpdated', header: 'Last Updated',    defaultVisible: false },
];

const EXPORT_COLUMNS: ExportColumn<WishlistItem>[] = ALL_COLUMNS.map((c) => ({
  key: c.key,
  header: c.header,
  accessor: (c.key === 'createdDate' || c.key === 'lastUpdated')
    ? (row: WishlistItem) => fmtLongDate(row[c.key as keyof WishlistItem] as string)
    : undefined,
}));

/* ── main page ──────────────────────────────────────────────────────────── */

export function WishlistPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const userId = profile?.user_id ?? null;

  // Global project scope (owner ask #8). null = "All projects" (no extra filter).
  // NOTE: Wishlist rows are NOT project-scoped at the data layer — the `wishlist`
  // table has no project_id, and WishlistItem carries no project field (see
  // data/wishlist.ts header: "There is NO project_id on a wishlist; the Team Lead
  // IS assign_tl"). So there is no reliable project field to filter by here.
  // Per the contract, a wrong filter that hides records is worse than none, so we
  // leave the list UNFILTERED by project regardless of selectedProjectId.
  // TODO(owner #8): if/when wishlist rows gain a project association (e.g. a
  // project_id column on `wishlist`), surface it on WishlistItem and AND it into
  // the filteredData predicate below: `selectedProjectId == null ||
  // item.projectId === selectedProjectId`.
  const { selectedProjectId, projects: scopeProjects } = useProjectScope();
  // Not used to filter rows (no project field) — only to show a note so the global
  // switcher's reach is never ambiguous here (review ALT-273B nit).
  const scopedProjectName =
    selectedProjectId != null
      ? scopeProjects.find((p) => p.project_id === selectedProjectId)?.project_name ?? null
      : null;

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  // Column customizer state — seeded from defaults, overridden by saved view on mount.
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() =>
    defaultColumnPrefs(ALL_COLUMNS)
  );

  const [allItems, setAllItems] = useState<WishlistItem[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [teamLeads, setTeamLeads] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  // Row selection
  const sel = useRowSelection<string>();

  // Table / Grid / Kanban view (persisted per user + entity in localStorage).
  const [view, setView] = useViewMode('wishlist', userId);

  // Right-hand preview drawer (ALT-327/328) — row click opens a compact mini
  // record instead of navigating away; "Open full record →" deep-links to the page.
  const [previewId, setPreviewId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchWishlist().then((result) => {
      if (cancelled) return;
      setAllItems(result.items);
      setAgents(result.agents);
      setTeamLeads(result.teamLeads);
      setIndustries(result.industries);
      setCities(result.cities);
      setStatuses(result.statuses);
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
    return allItems.filter((item) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          item.company, item.contactName, item.designation,
          item.industry, item.city, item.state, item.agent, item.teamLead,
          item.status, item.phone, item.pincode,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.status.length && !filters.status.includes(item.status)) return false;
      if (filters.agent.length && !filters.agent.includes(item.agent)) return false;
      if (filters.teamLead.length && !filters.teamLead.includes(item.teamLead)) return false;
      if (filters.industry.length && !filters.industry.includes(item.industry)) return false;
      if (filters.city.length && !filters.city.includes(item.city)) return false;
      return true;
    });
  }, [filters, allItems]);

  // Derive visible column keys in display order from columnPrefs
  const visibleKeys = useMemo(
    () => columnPrefs.filter((p) => p.visible).map((p) => p.key),
    [columnPrefs]
  );

  // Keep a ref to the current page's rows for the header checkbox (avoids stale closure)
  const table_data_ref = React.useRef<WishlistItem[]>([]);

  // Build TanStack columns from visible keys
  const columns = useMemo(() => {
    // Checkbox column is always first
    const checkboxCol = columnHelper.display({
      id: '__select',
      header: () => {
        const pageIds = table_data_ref.current.map((r) => r.id);
        const allSel = pageIds.length > 0 && sel.allSelected(pageIds);
        return (
          <input
            type="checkbox"
            checked={allSel}
            onChange={() => sel.toggleAll(pageIds)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer', width: 14, height: 14 }}
            aria-label="Select all on page"
          />
        );
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={sel.isSelected(row.original.id)}
          onChange={() => sel.toggle(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer', width: 14, height: 14 }}
          aria-label={`Select ${row.original.company || row.original.contactName || 'company'}`}
        />
      ),
    });

    const dataCols = visibleKeys.map((key) => {
      switch (key) {
        case 'company':
          return columnHelper.accessor('company', {
            id: 'company',
            header: 'Company',
            cell: (info) => {
              const name = info.getValue() || '';
              return (
                <div className="flex items-center gap-2 min-w-0">
                  <CompanyAvatar name={name} />
                  <span className="font-medium text-zinc-900 truncate" style={{ fontSize: 13 }}>
                    {name || <span className="text-zinc-400">—</span>}
                  </span>
                </div>
              );
            },
          });
        case 'contactName':
          return columnHelper.accessor('contactName', {
            id: 'contactName',
            header: 'Contact',
            cell: (info) => (
              <div>
                <p className="text-zinc-800" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-zinc-300">—</span>}
                </p>
                {info.row.original.designation && (
                  <p className="text-zinc-400" style={{ fontSize: 11 }}>{info.row.original.designation}</p>
                )}
              </div>
            ),
          });
        case 'industry':
          return columnHelper.accessor('industry', {
            id: 'industry',
            header: 'Industry',
            cell: (info) => (
              <span className="text-zinc-600" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'city':
          return columnHelper.accessor('city', {
            id: 'city',
            header: 'City',
            cell: (info) => (
              <span className="text-zinc-600" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'state':
          return columnHelper.accessor('state', {
            id: 'state',
            header: 'State',
            cell: (info) => (
              <span className="text-zinc-600" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'agent':
          return columnHelper.accessor('agent', {
            id: 'agent',
            header: 'Assigned Agent',
            cell: (info) => (
              <span className="text-zinc-700" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'teamLead':
          return columnHelper.accessor('teamLead', {
            id: 'teamLead',
            header: 'Team Lead',
            cell: (info) => (
              <span className="text-zinc-700" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'status':
          return columnHelper.accessor('status', {
            id: 'status',
            header: 'Status',
            cell: (info) => <StatusBadge status={info.getValue()} />,
          });
        case 'createdDate':
          return columnHelper.accessor('createdDate', {
            id: 'createdDate',
            header: 'Added',
            cell: (info) => (
              <span className="text-zinc-500 whitespace-nowrap" style={{ fontSize: 13 }}>
                {info.getValue() ? fmtLongDate(info.getValue()) : '—'}
              </span>
            ),
          });
        case 'lastUpdated':
          return columnHelper.accessor('lastUpdated', {
            id: 'lastUpdated',
            header: 'Last Updated',
            cell: (info) => (
              <span className="text-zinc-500 whitespace-nowrap" style={{ fontSize: 13 }}>
                {info.getValue() ? fmtLongDate(info.getValue()) : '—'}
              </span>
            ),
          });
        case 'pincode':
          return columnHelper.accessor('pincode', {
            id: 'pincode',
            header: 'Pincode',
            cell: (info) => (
              <span className="text-zinc-600" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'phone':
          return columnHelper.accessor('phone', {
            id: 'phone',
            header: 'Phone',
            cell: (info) => (
              <span className="text-zinc-600" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        case 'description':
          return columnHelper.accessor('description', {
            id: 'description',
            header: 'Notes',
            cell: (info) => (
              <span className="text-zinc-600 truncate max-w-xs block" style={{ fontSize: 13 }}>
                {info.getValue() || <span className="text-zinc-300">—</span>}
              </span>
            ),
          });
        default:
          return null;
      }
    }).filter(Boolean);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [checkboxCol, ...dataCols] as any[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeys, sel.selectedIds]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Update ref with current page rows after each render
  table_data_ref.current = table.getRowModel().rows.map((r) => r.original);

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const rowCount = filteredData.length;
  const rangeStart = rowCount === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = Math.min((pageIndex + 1) * PAGE_SIZE, rowCount);

  // Export columns filtered to currently visible keys (plus always-export fields)
  const activeExportColumns = useMemo(
    () => EXPORT_COLUMNS.filter((c) => visibleKeys.includes(c.key)),
    [visibleKeys]
  );

  // Grid / Kanban use the full filtered set (boards/cards aren't paginated).
  const allFilteredRows = filteredData;

  // Kanban (Board) view — group filtered wishlist entries by status. Columns are
  // the known statuses (those present) + an "Unset" bucket for blanks. Card click
  // opens the same preview drawer the row uses.
  const kanbanColumns = useMemo<KanbanColumnDef[]>(() => {
    const present = new Set<string>();
    let hasUnset = false;
    for (const i of allFilteredRows) {
      if (i.status) present.add(i.status);
      else hasUnset = true;
    }
    const cols: KanbanColumnDef[] = [];
    for (const s of statuses) {
      if (present.has(s)) { cols.push({ key: s, label: s }); present.delete(s); }
    }
    for (const s of [...present].sort()) cols.push({ key: s, label: s });
    if (hasUnset) cols.push({ key: '__unset', label: 'Unset' });
    return cols;
  }, [allFilteredRows, statuses]);

  const itemsByStatus = useMemo(() => {
    const map = new Map<string, WishlistItem[]>();
    for (const c of kanbanColumns) map.set(c.key, []);
    for (const i of allFilteredRows) {
      map.get(i.status || '__unset')?.push(i);
    }
    return map;
  }, [allFilteredRows, kanbanColumns]);

  return (
    <AppShell title="Wishlist">
      <div className="space-y-3">
        {/* Filter panel */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search size={13} className="absolute text-zinc-400 pointer-events-none" style={{ left: 8 }} />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Company, contact, city..."
                  style={{ ...inputBase, paddingLeft: 26, width: 230 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                />
              </div>
            </div>

            <MultiSelectFilter
              label="Status"
              selected={filters.status}
              onChange={(v) => setFilter('status', v)}
              options={statuses}
            />
            <MultiSelectFilter
              label="Assigned Agent"
              selected={filters.agent}
              onChange={(v) => setFilter('agent', v)}
              options={agents}
            />
            <MultiSelectFilter
              label="Team Lead"
              selected={filters.teamLead}
              onChange={(v) => setFilter('teamLead', v)}
              options={teamLeads}
            />
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
          </div>
        </div>

        {/* Toolbar: count + actions */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-zinc-400" style={{ fontSize: 12 }}>
            {loading ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                Loading wishlist...
              </span>
            ) : loadError ? (
              <span className="text-red-500">{loadError}</span>
            ) : (
              <>
                <span className="font-medium text-zinc-700">{rowCount}</span> of{' '}
                <span className="font-medium text-zinc-700">{allItems.length}</span> companies
                {scopedProjectName && (
                  <span className="text-zinc-400" title="Wishlist entries aren't tied to a project, so the selected project doesn't filter this list.">
                    {' · '}not filtered by project
                  </span>
                )}
                {sel.count > 0 && (
                  <span className="ml-2 text-zinc-500">
                    · <span className="font-medium text-zinc-700">{sel.count}</span> selected
                    <button
                      onClick={() => sel.clear()}
                      className="ml-1.5 text-zinc-400 hover:text-zinc-700 transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      Clear
                    </button>
                  </span>
                )}
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilters(defaultFilters); setPagination((p) => ({ ...p, pageIndex: 0 })); sel.clear(); }}
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
            {/* Table / Grid / Kanban view switcher */}
            <ViewSwitcher value={view} onChange={setView} />
            <ColumnCustomizer
              entity="wishlist"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={(next) => setColumnPrefs(reconcileColumns(next, ALL_COLUMNS))}
            />
            <ExportButton
              rows={filteredData as unknown as Record<string, unknown>[]}
              columns={activeExportColumns as unknown as ExportColumn<Record<string, unknown>>[]}
              filename="amplior-crm-wishlist"
              selectedIds={sel.selectedIds}
              idKey="id"
              disabled={loading || rowCount === 0}
            />
          </div>
        </div>

        {/* Kanban (Board) view — grouped by status; cards open the preview drawer */}
        {view === 'kanban' && !loading && !loadError && (
          <GenericKanban<WishlistItem>
            columns={kanbanColumns}
            itemsByColumn={itemsByStatus}
            getKey={(row) => row.id}
            getCardLabel={(row) => `Open ${row.company || row.contactName || 'company'}`}
            onCardClick={(row) => setPreviewId(row.wishlistId)}
            renderCard={(row) => (
              <CardShell
                name={row.company || ''}
                subtitle={row.contactName || undefined}
                chip={<StatusBadge status={row.status} />}
                fields={[
                  { label: 'Industry', value: row.industry ?? '' },
                  { label: 'City', value: row.city ?? '' },
                  { label: 'Agent', value: row.agent ?? '' },
                  { label: 'Team Lead', value: row.teamLead ?? '' },
                ]}
              />
            )}
          />
        )}

        {/* Grid (card) view */}
        {view === 'grid' && !loading && !loadError && (
          <CardGrid<WishlistItem>
            rows={allFilteredRows}
            getKey={(row) => row.id}
            onCardClick={(row) => setPreviewId(row.wishlistId)}
            emptyLabel={hasActiveFilters ? 'No companies match the current filters.' : 'No companies in the wishlist yet.'}
            renderCard={(row) => (
              <CardShell
                name={row.company || ''}
                subtitle={row.contactName || undefined}
                chip={<StatusBadge status={row.status} />}
                fields={[
                  { label: 'Industry', value: row.industry ?? '' },
                  { label: 'City', value: row.city ?? '' },
                  { label: 'Agent', value: row.agent ?? '' },
                  { label: 'Team Lead', value: row.teamLead ?? '' },
                ]}
              />
            )}
          />
        )}

        {/* Table */}
        {(view === 'table' || loading || loadError) && (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} style={{ borderBottom: '2px solid #E5E7EB', background: '#FFFFFF' }}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.id !== '__select' && header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                      <th
                        key={header.id}
                        role={canSort ? 'button' : undefined}
                        tabIndex={canSort ? 0 : undefined}
                        aria-sort={
                          sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : canSort ? 'none' : undefined
                        }
                        className="px-4 py-2.5 text-left whitespace-nowrap select-none"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: header.id === '__select' ? '#9CA3AF' : '#1A7EE8',
                          borderBottom: '2px solid #1A7EE8',
                          cursor: canSort ? 'pointer' : 'default',
                          width: header.id === '__select' ? 40 : undefined,
                          // Sticky header (ALT-318): white background on the cell so body
                          // rows can't show through under the sticky header.
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          background: '#FFFFFF',
                        }}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
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
                              asc: <ChevronUp size={11} />,
                              desc: <ChevronDown size={11} />,
                            }[sortDir as string] ?? (
                              <ChevronsUpDown size={11} style={{ color: '#9CA3AF' }} />
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
                    <tr key={`sk-${r}`} style={{ borderBottom: '1px solid var(--color-gray-100)', height: 40 }}>
                      {columns.map((_c, c) => (
                        <td key={c} className="px-4 align-middle">
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
                            fontSize: 13, fontWeight: 500, color: '#1A7EE8',
                            border: '1px solid #d4d4d8', borderRadius: 6,
                            background: '#fff', padding: '6px 14px', cursor: 'pointer',
                          }}
                        >
                          <RefreshCw size={13} /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleKeys.length + 1} className="px-4 py-12 text-center" style={{ fontSize: 13 }}>
                      <div className="flex flex-col items-center gap-2 text-zinc-400">
                        <Building2 size={22} className="text-zinc-300" />
                        {allItems.length === 0
                          ? 'No companies in the wishlist yet.'
                          : 'No companies match the current filters.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const isSelected = sel.isSelected(row.original.id);
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Preview ${row.original.company || row.original.contactName || 'company'}`}
                        onClick={() => setPreviewId(row.original.wishlistId)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            setPreviewId(row.original.wishlistId);
                          }
                        }}
                        className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors last:border-0 cursor-pointer"
                        style={{
                          height: 40,
                          background: isSelected ? '#EFF6FF' : undefined,
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 align-middle whitespace-nowrap">
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
          {!loading && !loadError && rowCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200" style={{ background: '#F9FAFB' }}>
              <span className="text-zinc-400" style={{ fontSize: 12 }}>
                Showing <span className="text-zinc-600 font-medium">{rangeStart}</span>–
                <span className="text-zinc-600 font-medium">{rangeEnd}</span> of{' '}
                <span className="text-zinc-600 font-medium">{rowCount}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex items-center gap-1 border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: 12, padding: '3px 8px', height: 28 }}
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <span className="text-zinc-500 px-2" style={{ fontSize: 12 }}>
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex items-center gap-1 border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: 12, padding: '3px 8px', height: 28 }}
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Right-hand preview drawer — view-oriented mini record (ALT-327/328). */}
      {previewId != null && (
        <RecordPreviewPanel
          title="Wishlist"
          onClose={() => setPreviewId(null)}
          onOpenFull={() => navigate(`/wishlist/${previewId}`)}
        >
          <WishlistPreview wishlistId={previewId} />
        </RecordPreviewPanel>
      )}
    </AppShell>
  );
}

export default WishlistPage;
