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
import { ListToolbar } from '../components/ui/ListToolbar';
import { SelectAllMatchingBar } from '../components/ui/SelectAllMatchingBar';
import { useListFilters } from '../lib/listFilters';
import { EditableGrid, type EditableColumn } from '../components/ui/EditableGrid';
import { CardShell } from '../components/ui/CardGrid';
import { GenericKanban } from '../components/kanban/GenericKanban';
import {
  KanbanGroupBySelect,
  buildKanbanGrouping,
  type KanbanGroupDef,
} from '../components/kanban/KanbanGroupBySelect';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
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

  // Persisted across refresh per browser (ALT-369).
  const [filters, setFilters] = useListFilters<Filters>('wishlist', defaultFilters);
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
  // Kanban "Group by" field (ALT-338) — default = status (the original fixed field).
  const [kanbanGroupBy, setKanbanGroupBy] = useState<string>('status');

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

  const clearFilters = () => {
    setFilters(defaultFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    sel.clear();
  };

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

  // "Select all N matching" bar (ALT-331) — page-scoped vs full-filtered counts.
  // allMatchingIds = every id in the full filtered set. pageRowIds = the ids the
  // user can actually see & select right now: the current page in Table view, or
  // the whole filtered set in Grid/Kanban (those views aren't paginated).
  const allMatchingIds = useMemo(() => filteredData.map((r) => r.id), [filteredData]);
  const pageRowIds = useMemo(
    () => (view === 'table' ? table.getRowModel().rows.map((r) => r.original.id) : allMatchingIds),
    [view, allMatchingIds, table, sorting, pagination],
  );
  const pageSelectedCount = useMemo(
    () => pageRowIds.filter((id) => sel.isSelected(id)).length,
    [pageRowIds, sel],
  );

  // Kanban (Board) view — selectable "Group by" field (ALT-338). Default = status
  // (the original fixed grouping): its lanes reuse the canonical status order so
  // the board looks identical to before. City / Industry / Agent / Team Lead
  // derive their lanes from the distinct values present on the wishlist rows.
  const kanbanGroupOptions = useMemo<KanbanGroupDef<WishlistItem>[]>(() => [
    {
      key: 'status',
      label: 'Status',
      getGroup: (i) => i.status || null,
      lanes: statuses
        .filter((s) => allFilteredRows.some((i) => i.status === s))
        .map((s) => ({ key: s, label: s })),
    },
    { key: 'city', label: 'City', getGroup: (i) => i.city || null },
    { key: 'industry', label: 'Industry', getGroup: (i) => i.industry || null },
    { key: 'agent', label: 'Agent', getGroup: (i) => i.agent || null },
    { key: 'teamLead', label: 'Team Lead', getGroup: (i) => i.teamLead || null },
  ], [statuses, allFilteredRows]);

  const { columns: kanbanColumns, itemsByColumn: itemsByGroup } = useMemo(() => {
    const group = kanbanGroupOptions.find((o) => o.key === kanbanGroupBy) ?? kanbanGroupOptions[0];
    return buildKanbanGrouping<WishlistItem>(allFilteredRows, group, 'Unset');
  }, [allFilteredRows, kanbanGroupOptions, kanbanGroupBy]);

  // Keep the kanban "Group by" selection valid: if the selected field is no longer
  // in the current options, reset to the first option so the <select> value can't
  // desync from the rendered board (mirrors Contacts/Companies).
  useEffect(() => {
    if (!kanbanGroupOptions.some((o) => o.key === kanbanGroupBy)) {
      setKanbanGroupBy(kanbanGroupOptions[0].key);
    }
  }, [kanbanGroupOptions, kanbanGroupBy]);

  /* ----------------------------------------------------------------- */
  /*  EditableGrid columns (ALT-331) — mirror the visible Table columns. */
  /*  Wishlist has NO safe inline writers, so EVERY column is read-only: */
  /*  status renders as the existing StatusBadge, company/contact reuse  */
  /*  the table's cell markup, dates use fmtLongDate. The Grid here is    */
  /*  just a denser, selectable view (no inline edit / no bulk toolbar).  */
  /* ----------------------------------------------------------------- */
  const EDITABLE_COLUMNS = useMemo<EditableColumn<WishlistItem>[]>(() => {
    const catalogue: Record<string, EditableColumn<WishlistItem>> = {
      company: {
        key: 'company',
        header: 'Company',
        getValue: (r) => r.company ?? '',
        render: (r) => {
          const name = r.company || '';
          return (
            <div className="flex items-center gap-2 min-w-0">
              <CompanyAvatar name={name} />
              <span className="font-medium text-zinc-900 truncate" style={{ fontSize: 13 }}>
                {name || <span className="text-zinc-400">—</span>}
              </span>
            </div>
          );
        },
      },
      contactName: {
        key: 'contactName',
        header: 'Contact',
        getValue: (r) => r.contactName ?? '',
        render: (r) => (
          <div>
            <p className="text-zinc-800" style={{ fontSize: 13 }}>
              {r.contactName || <span className="text-zinc-300">—</span>}
            </p>
            {r.designation && (
              <p className="text-zinc-400" style={{ fontSize: 11 }}>{r.designation}</p>
            )}
          </div>
        ),
      },
      industry: { key: 'industry', header: 'Industry', getValue: (r) => r.industry ?? '' },
      city: { key: 'city', header: 'City', getValue: (r) => r.city ?? '' },
      state: { key: 'state', header: 'State', getValue: (r) => r.state ?? '' },
      agent: { key: 'agent', header: 'Assigned Agent', getValue: (r) => r.agent ?? '' },
      teamLead: { key: 'teamLead', header: 'Team Lead', getValue: (r) => r.teamLead ?? '' },
      status: {
        key: 'status',
        header: 'Status',
        width: 170,
        getValue: (r) => r.status ?? '',
        render: (r) => <StatusBadge status={r.status} />,
      },
      createdDate: {
        key: 'createdDate',
        header: 'Added',
        getValue: (r) => r.createdDate ?? '',
        render: (r) => (
          <span className="text-zinc-500 whitespace-nowrap" style={{ fontSize: 13 }}>
            {r.createdDate ? fmtLongDate(r.createdDate) : '—'}
          </span>
        ),
      },
      lastUpdated: {
        key: 'lastUpdated',
        header: 'Last Updated',
        getValue: (r) => r.lastUpdated ?? '',
        render: (r) => (
          <span className="text-zinc-500 whitespace-nowrap" style={{ fontSize: 13 }}>
            {r.lastUpdated ? fmtLongDate(r.lastUpdated) : '—'}
          </span>
        ),
      },
      pincode: { key: 'pincode', header: 'Pincode', getValue: (r) => r.pincode ?? '' },
      phone: { key: 'phone', header: 'Phone', getValue: (r) => r.phone ?? '' },
      description: { key: 'description', header: 'Notes', getValue: (r) => r.description ?? '' },
    };
    // Mirror the visible Table columns + order (visibleKeys), skipping unknowns.
    return visibleKeys.map((k) => catalogue[k]).filter(Boolean) as EditableColumn<WishlistItem>[];
  }, [visibleKeys]);

  // Grid uses the full filtered set; selection helpers operate over those ids.
  const gridVisibleIds = useMemo(() => allFilteredRows.map((r) => r.id), [allFilteredRows]);
  const gridSelectAllState: 'all' | 'some' | 'none' =
    gridVisibleIds.length > 0 && sel.allSelected(gridVisibleIds)
      ? 'all'
      : gridVisibleIds.some((id) => sel.isSelected(id))
        ? 'some'
        : 'none';

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
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 8, width: 230 }}
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

        {/* Toolbar (standardized via ListToolbar — ALT-333). Slots enforce the
            universal order: bulkActions → ViewSwitcher → Columns → Export →
            Create. Wishlist has no bulk actions and no create. */}
        <ListToolbar
          left={
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
                      onClick={clearFilters}
                      className="ml-3 text-zinc-400 hover:text-zinc-700 transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      Clear filters
                    </button>
                  )}
                </>
              )}
            </p>
          }
          bulkActions={null /* Wishlist has no bulk actions today */}
          viewSwitcher={<ViewSwitcher value={view} onChange={setView} />}
          columns={
            <ColumnCustomizer
              entity="wishlist"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={(next) => setColumnPrefs(reconcileColumns(next, ALL_COLUMNS))}
            />
          }
          exportButton={
            <ExportButton
              rows={filteredData as unknown as Record<string, unknown>[]}
              columns={activeExportColumns as unknown as ExportColumn<Record<string, unknown>>[]}
              filename="amplior-crm-wishlist"
              selectedIds={sel.selectedIds}
              idKey="id"
              disabled={loading || rowCount === 0}
            />
          }
          create={null}
        />

        {/* "Select all N matching" affordance — appears when the current page is
            fully selected but more filtered rows exist off-page (ALT-331). */}
        {!loading && !loadError && (
          <SelectAllMatchingBar
            noun="wishlist item"
            pageCount={pageRowIds.length}
            pageSelectedCount={pageSelectedCount}
            totalMatching={allMatchingIds.length}
            totalSelected={sel.count}
            onSelectAllMatching={() => sel.addAll(allMatchingIds)}
            onClear={() => sel.clear()}
          />
        )}

        {/* Kanban (Board) view — group-by field is selectable (ALT-338); cards
            open the same preview drawer the row uses. */}
        {view === 'kanban' && !loading && !loadError && (
          <div className="flex items-center" style={{ marginBottom: 8 }}>
            <KanbanGroupBySelect
              value={kanbanGroupBy}
              onChange={setKanbanGroupBy}
              options={kanbanGroupOptions}
            />
          </div>
        )}
        {view === 'kanban' && !loading && !loadError && (
          <GenericKanban<WishlistItem>
            columns={kanbanColumns}
            itemsByColumn={itemsByGroup}
            getKey={(row) => row.id}
            getCardLabel={(row) => `Open ${row.company || row.contactName || 'company'}`}
            onCardClick={(row) => setPreviewId(row.wishlistId)}
            isSelected={(item) => sel.isSelected(item.id)}
            onToggleSelect={(item) => sel.toggle(item.id)}
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

        {/* Grid view — spreadsheet-style EditableGrid (ALT-331/332), denser than
            the old card tiles. Wishlist has no safe inline writers, so every
            column is READ-ONLY (status badge / company + contact markup / dates
            via fmtLongDate). The leading checkbox wires to the shared selection
            for parity, even though there's no bulk toolbar here yet. Row open
            uses the same preview drawer as the table/cards. */}
        {view === 'grid' && !loading && !loadError && (
          <EditableGrid<WishlistItem>
            rows={allFilteredRows}
            getKey={(row) => row.id}
            columns={EDITABLE_COLUMNS}
            isSelected={(row) => sel.isSelected(row.id)}
            onToggleSelect={(row) => sel.toggle(row.id)}
            selectAllState={gridSelectAllState}
            onToggleSelectAll={() => sel.toggleAll(gridVisibleIds)}
            onOpenRow={(row) => setPreviewId(row.wishlistId)}
            emptyLabel="No wishlist items match."
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
                    <td colSpan={visibleKeys.length + 1} className="px-4 py-6">
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={<Building2 size={22} />}
                          title="No wishlist items match these filters"
                          message="Try widening or clearing the filters above to see more companies."
                          action={{ label: 'Clear filters', onClick: clearFilters }}
                        />
                      ) : (
                        <EmptyState
                          icon={<Building2 size={22} />}
                          title="No wishlist items yet"
                          message="Companies saved to the wishlist will show up here."
                        />
                      )}
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
          openFullHref={`/wishlist/${previewId}`}
        >
          <WishlistPreview wishlistId={previewId} />
        </RecordPreviewPanel>
      )}
    </AppShell>
  );
}

export default WishlistPage;
