import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { AppShell } from '../components/layout/AppShell';
import { MeetingStatusBadge } from '../components/meeting/MeetingStatusBadge';
import {
  fetchMeetings,
  formatDate,
  formatTime,
  type MeetingRow,
} from '../data/meetings';
import { useAuth } from '../contexts/AuthContext';
import { useIsSalesShell } from '../contexts/SalesShellContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { useRowSelection } from '../components/ui/useRowSelection';
import { ExportButton } from '../components/ui/ExportButton';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { Skeleton } from '../components/ui/Skeleton';
import {
  ColumnCustomizer,
  defaultColumnPrefs,
  reconcileColumns,
} from '../components/ui/ColumnCustomizer';
import { ViewSwitcher, useViewMode } from '../components/ui/ViewSwitcher';
import { CardGrid, CardShell } from '../components/ui/CardGrid';
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
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignMeetingsBulk, fetchAssignableUsers } from '../data/assignment';
import type { UserOption } from '../data/wishlist';
import { useToast } from '../components/ui/Toast';

const columnHelper = createColumnHelper<MeetingRow>();
const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ */
/* Column catalogue (used by ColumnCustomizer + ExportButton)          */
/* ------------------------------------------------------------------ */

// ColDef is parameterised on Row but ColumnCustomizer only needs key/header/defaultVisible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_COLUMNS: ColDef<any>[] = [
  { key: 'company',     header: 'Company / Lead',  defaultVisible: true },
  { key: 'client',      header: 'Client',           defaultVisible: true },
  { key: 'meetingDate', header: 'Meeting',          defaultVisible: true },
  { key: 'mode',        header: 'Mode',             defaultVisible: true },
  { key: 'salesperson', header: 'Salesperson',      defaultVisible: true },
  { key: 'agent',       header: 'Agent',            defaultVisible: true },
  { key: 'confirmed',   header: 'Confirmed',        defaultVisible: true },
  { key: 'status',      header: 'Status',           defaultVisible: true },
];

const EXPORT_COLUMNS: ExportColumn<MeetingRow>[] = [
  { key: 'leadNumber',  header: 'Lead #' },
  { key: 'leadName',    header: 'Lead Name' },
  { key: 'company',     header: 'Company' },
  { key: 'client',      header: 'Client' },
  { key: 'industry',    header: 'Industry' },
  { key: 'city',        header: 'City' },
  { key: 'meetingDate', header: 'Meeting Date', accessor: (r) => r.meetingDate ? formatDate(r.meetingDate) : '' },
  { key: 'meetingTime', header: 'Meeting Time', accessor: (r) => r.meetingTime ? formatTime(r.meetingTime) : '' },
  { key: 'mode',        header: 'Mode' },
  { key: 'status',      header: 'Status' },
  { key: 'leadStage',   header: 'Lead Stage' },
  { key: 'confirmed',   header: 'Confirmed', accessor: (r) => r.confirmed ? 'Yes' : 'No' },
  { key: 'salesperson', header: 'Salesperson' },
  { key: 'agent',       header: 'Agent' },
  { key: 'contact',     header: 'Contact Number' },
  { key: 'leadGenDate', header: 'Lead Generated', accessor: (r) => r.leadGenDate ? formatDate(r.leadGenDate) : '' },
];

/* ------------------------------------------------------------------ */
/* Company avatar — deterministic tinted initials                      */
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

/* ------------------------------------------------------------------ */
/* Filters — the 7 small-CR filters + search                           */
/* ------------------------------------------------------------------ */

interface Filters {
  search: string;
  leadDateFrom: string;
  leadDateTo: string;
  agent: string[];
  industry: string[];
  city: string[];
  meetingDateFrom: string;
  meetingDateTo: string;
  salesperson: string[];
  status: string[];
}

const defaultFilters: Filters = {
  search: '',
  leadDateFrom: '',
  leadDateTo: '',
  agent: [],
  industry: [],
  city: [],
  meetingDateFrom: '',
  meetingDateTo: '',
  salesperson: [],
  status: [],
};

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

function DateRangeFilter({
  label,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: {
  label: string;
  fromValue: string;
  toValue: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={fromValue}
          onChange={(e) => onFromChange(e.target.value)}
          style={{ ...inputBase, width: 130 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
        />
        <span className="text-zinc-400" style={{ fontSize: 11 }}>to</span>
        <input
          type="date"
          value={toValue}
          onChange={(e) => onToChange(e.target.value)}
          style={{ ...inputBase, width: 130 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MeetingsPage() {
  const navigate = useNavigate();
  const { profile, canReassign } = useAuth();
  const userId = profile?.user_id ?? null;
  const toast = useToast();

  // In the Sales Portal shell, open the "mobile-ditto" sales meeting record
  // (/sales/meetings/:id) — never the internal /meetings/:id screen (ALT-275).
  // Mirrors LeadsPage's isSalesShell/leadBase pattern.
  const isSalesShell = useIsSalesShell();
  const meetingBase = isSalesShell ? '/sales/meetings' : '/meetings';

  // Global project scope (owner ask #8). When a project is selected (not "All"),
  // pre-filter to that project — composed (AND) with every page filter/search,
  // and a no-op when selectedProjectId is null. A meeting's project comes from its
  // lead (lead_master.project_id), now surfaced as MeetingRow.projectId in
  // src/data/meetings.ts, matched on the same numeric id useProjectScope returns.
  const { selectedProjectId } = useProjectScope();

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);

  // Column visibility/order — seeded from defaults; ColumnCustomizer loads saved view on mount.
  const [colPrefs, setColPrefs] = useState<ColumnPref[]>(() => defaultColumnPrefs(ALL_COLUMNS));

  const sel = useRowSelection<string>();

  // Table / Grid view (persisted per user + entity in localStorage).
  const [view, setView] = useViewMode('meetings', userId);

  const [allMeetings, setAllMeetings] = useState<MeetingRow[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  // Bulk reassign (ALT-291) — reassigns each selected meeting's underlying lead.
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  const openBulkReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    setReassignOwners(await fetchAssignableUsers(null));
  };
  const handleBulkReassign = async (newUserId: number) => {
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignMeetingsBulk(ids, newUserId, profile?.user_id != null ? String(profile.user_id) : '');
    setReassignSaving(false);
    if (res.ok === 0 && res.error) { setReassignError(res.error); return; }
    setShowReassign(false);
    sel.clear();
    setReloadKey((k) => k + 1);
    toast.success(
      res.failed > 0
        ? `Reassigned ${res.ok}; ${res.failed} skipped.`
        : `Reassigned ${res.ok} meeting${res.ok === 1 ? '' : 's'} — the new owner was notified.`,
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMeetings().then((result) => {
      if (cancelled) return;
      setAllMeetings(result.meetings);
      setAgents(result.agents);
      setSalespeople(result.salespeople);
      setStatuses(result.statuses);
      setIndustries(result.industries);
      setCities(result.cities);
      setLoadError(result.error);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoadError('Could not load meetings.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '',
  );

  const filteredData = useMemo(() => {
    return allMeetings.filter((m) => {
      // Global project scope (AND with every page filter). null = "All projects".
      if (selectedProjectId != null && m.projectId !== selectedProjectId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          m.name, m.leadName, m.leadNumber, m.company, m.client,
          m.agent, m.salesperson, m.status, m.mode, m.contact,
          m.industry, m.city, m.leadStage,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.leadDateFrom) {
        if (!m.leadGenDate || m.leadGenDate < filters.leadDateFrom) return false;
      }
      if (filters.leadDateTo) {
        if (!m.leadGenDate || m.leadGenDate > filters.leadDateTo) return false;
      }
      if (filters.meetingDateFrom) {
        if (!m.meetingDate || m.meetingDate < filters.meetingDateFrom) return false;
      }
      if (filters.meetingDateTo) {
        if (!m.meetingDate || m.meetingDate > filters.meetingDateTo) return false;
      }
      if (filters.agent.length && !filters.agent.includes(m.agent)) return false;
      if (filters.industry.length && !filters.industry.includes(m.industry)) return false;
      if (filters.city.length && !filters.city.includes(m.city)) return false;
      if (filters.salesperson.length && !filters.salesperson.includes(m.salesperson)) return false;
      if (filters.status.length && !filters.status.includes(m.status)) return false;
      return true;
    });
  }, [filters, allMeetings, selectedProjectId]);

  // Meetings hidden ONLY because their lead carries no project_id while a project is
  // scoped — surfaced as a note so the filter never looks like missing data
  // (review ALT-273B: NULL project_id rows silently hidden).
  const noProjectHidden = useMemo(
    () => (selectedProjectId == null ? 0 : allMeetings.filter((m) => m.projectId == null).length),
    [selectedProjectId, allMeetings],
  );

  // Visible column keys in display order (driven by colPrefs).
  const visibleKeys = useMemo(
    () => colPrefs.filter((p) => p.visible).map((p) => p.key),
    [colPrefs],
  );

  // Export columns: never leak a column the user has hidden in the customizer.
  // Keys present in the column catalogue must be visible to be exported;
  // export-only extras (Lead #, Industry, City, etc.) that are not
  // customizer-controlled are always included.
  const customizerKeys = useMemo(() => new Set(ALL_COLUMNS.map((c) => c.key)), []);
  const activeExportColumns = useMemo<ExportColumn<MeetingRow>[]>(() => {
    const visible = new Set(visibleKeys);
    return EXPORT_COLUMNS.filter(
      (c) => !customizerKeys.has(c.key) || visible.has(c.key),
    );
  }, [visibleKeys, customizerKeys]);

  // Full column map (key -> TanStack column definition).
  const allColumnDefs = useMemo(
    () => ({
      company: columnHelper.accessor('company', {
        id: 'company',
        header: 'Company / Lead',
        cell: (info) => {
          const company = info.getValue() || info.row.original.leadName || info.row.original.name || '';
          return (
            <div className="flex items-center gap-2 min-w-0">
              <CompanyAvatar name={company} />
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 200 }}>
                  {company || <span className="text-zinc-400">Unlinked meeting</span>}
                </p>
                <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 200 }}>
                  {[info.row.original.leadName, info.row.original.city].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          );
        },
      }),
      client: columnHelper.accessor('client', {
        id: 'client',
        header: 'Client',
        cell: (info) => (
          <span className="text-zinc-600 truncate" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      meetingDate: columnHelper.accessor('meetingDate', {
        id: 'meetingDate',
        header: 'Meeting',
        cell: (info) => (
          <div className="whitespace-nowrap">
            <p className="text-zinc-700" style={{ fontSize: 13 }}>
              {info.getValue() ? formatDate(info.getValue()) : <span className="text-zinc-300">—</span>}
            </p>
            <p className="text-zinc-400" style={{ fontSize: 11 }}>
              {info.row.original.meetingTime ? formatTime(info.row.original.meetingTime) : ''}
            </p>
          </div>
        ),
      }),
      mode: columnHelper.accessor('mode', {
        id: 'mode',
        header: 'Mode',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      salesperson: columnHelper.accessor('salesperson', {
        id: 'salesperson',
        header: 'Salesperson',
        cell: (info) => (
          <span className="text-zinc-700 truncate" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      agent: columnHelper.accessor('agent', {
        id: 'agent',
        header: 'Agent',
        cell: (info) => (
          <span className="text-zinc-700" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      confirmed: columnHelper.accessor('confirmed', {
        id: 'confirmed',
        header: 'Confirmed',
        cell: (info) =>
          info.getValue() ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                background: '#F0FDF4',
                color: '#16A34A',
                borderRadius: 4,
                padding: '2px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle2 size={11} /> Yes
            </span>
          ) : (
            <span className="text-zinc-400" style={{ fontSize: 13 }}>—</span>
          ),
      }),
      status: columnHelper.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => <MeetingStatusBadge status={info.getValue()} />,
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Checkbox column is built inside the table columns memo (needs sel, not table ref).
  const columns = useMemo(() => {
    const checkboxCol = columnHelper.display({
      id: '__select',
      header: ({ table: t }) => {
        const pageIds = t.getRowModel().rows.map((r) => r.original.id);
        const allSel = sel.allSelected(pageIds);
        return (
          <input
            type="checkbox"
            checked={allSel}
            onChange={() => sel.toggleAll(pageIds)}
            style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
            aria-label={allSel ? 'Deselect all meetings on this page' : 'Select all meetings on this page'}
          />
        );
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={sel.isSelected(row.original.id)}
          onChange={(e) => { e.stopPropagation(); sel.toggle(row.original.id); }}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
          aria-label={`Select ${row.original.company || row.original.leadName || row.original.name || 'meeting'}`}
        />
      ),
      size: 36,
    });
    const dataCols = visibleKeys
      .map((key) => allColumnDefs[key as keyof typeof allColumnDefs])
      .filter(Boolean);
    return [checkboxCol, ...dataCols];
  }, [visibleKeys, allColumnDefs, sel]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex, pageSize: PAGE_SIZE })
        : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const rowsOnPage = table.getRowModel().rows;
  const firstRow = filteredData.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const lastRow = Math.min((pageIndex + 1) * PAGE_SIZE, filteredData.length);


  return (
    <AppShell title="Meetings">
      <div className="space-y-3">
        {/* Filter panel */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
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
                  placeholder="Company, lead, salesperson..."
                  style={{ ...inputBase, paddingLeft: 26, width: 210 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                />
              </div>
            </div>

            <DateRangeFilter
              label="Lead Generated"
              fromValue={filters.leadDateFrom}
              toValue={filters.leadDateTo}
              onFromChange={(v) => setFilter('leadDateFrom', v)}
              onToChange={(v) => setFilter('leadDateTo', v)}
            />
            <DateRangeFilter
              label="Meeting Date"
              fromValue={filters.meetingDateFrom}
              toValue={filters.meetingDateTo}
              onFromChange={(v) => setFilter('meetingDateFrom', v)}
              onToChange={(v) => setFilter('meetingDateTo', v)}
            />

            <MultiSelectFilter
              label="Agent"
              selected={filters.agent}
              onChange={(v) => setFilter('agent', v)}
              options={agents}
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
            <MultiSelectFilter
              label="Sales Person / Head"
              selected={filters.salesperson}
              onChange={(v) => setFilter('salesperson', v)}
              options={salespeople}
            />
            <MultiSelectFilter
              label="Meeting Status"
              selected={filters.status}
              onChange={(v) => setFilter('status', v)}
              options={statuses}
            />
          </div>
        </div>

        {/* Toolbar row: count + actions */}
        <div className="flex items-center justify-between">
          <p className="text-zinc-400" style={{ fontSize: 12 }}>
            {loading ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                Loading meetings...
              </span>
            ) : loadError ? (
              <span className="text-red-500">{loadError}</span>
            ) : (
              <>
                {sel.count > 0 && (
                  <span className="font-medium text-zinc-700 mr-2">{sel.count} selected ·</span>
                )}
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allMeetings.length}</span> meetings
                {noProjectHidden > 0 && (
                  <span className="text-zinc-400" title="These meetings' leads have no project assigned, so they're hidden while a project is selected.">
                    {' · '}{noProjectHidden} with no project hidden
                  </span>
                )}
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilters(defaultFilters); setPageIndex(0); }}
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
            {canReassign && sel.count > 0 && (
              <button
                onClick={openBulkReassign}
                className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-md transition-colors"
                style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                title="Reassign the selected meetings' leads to a salesperson"
              >
                <UserCheck size={14} />
                Reassign ({sel.count})
              </button>
            )}
            <ViewSwitcher value={view} onChange={setView} />
            <ColumnCustomizer
              entity="meetings"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={colPrefs}
              onChange={(next) => setColPrefs(reconcileColumns(next, ALL_COLUMNS))}
            />
            <ExportButton
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows={filteredData as any[]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              columns={activeExportColumns as any[]}
              filename="amplior-crm-meetings"
              selectedIds={sel.selectedIds}
              idKey="id"
              disabled={loading || filteredData.length === 0}
            />
          </div>
        </div>

        {/* Grid (card) view */}
        {view === 'grid' && !loading && !loadError && (
          <CardGrid<MeetingRow>
            rows={rowsOnPage.map((r) => r.original)}
            getKey={(row) => row.id}
            onCardClick={(row) => navigate(`${meetingBase}/${row.id}`)}
            emptyLabel={hasActiveFilters ? 'No meetings match the current filters.' : 'No meetings found.'}
            renderCard={(row) => {
              const title = row.name || row.company || row.leadName || '';
              return (
                <CardShell
                  name={title}
                  subtitle={[row.company, row.city].filter(Boolean).join(' · ') || undefined}
                  chip={<MeetingStatusBadge status={row.status} />}
                  fields={[
                    { label: 'Company', value: row.company ?? '' },
                    { label: 'Meeting Date', value: row.meetingDate ? formatDate(row.meetingDate) : '' },
                    { label: 'Salesperson', value: row.salesperson ?? '' },
                    { label: 'Status', value: row.status ?? '' },
                  ]}
                />
              );
            }}
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
                        className="px-4 py-2.5 text-left whitespace-nowrap select-none"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1A7EE8',
                          borderBottom: '2px solid #1A7EE8',
                          cursor: canSort ? 'pointer' : 'default',
                          // Sticky header (ALT-318): white background on the cell so body
                          // rows can't show through under the sticky header.
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          background: '#FFFFFF',
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
                    <tr key={`sk-${r}`} style={{ borderBottom: '1px solid #F4F4F5', height: 40 }}>
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
                ) : rowsOnPage.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
                        <div
                          className="rounded-full bg-zinc-100 flex items-center justify-center"
                          style={{ width: 40, height: 40 }}
                        >
                          <CalendarDays size={18} strokeWidth={1.5} className="text-zinc-400" />
                        </div>
                        <p style={{ fontSize: 13 }}>
                          {hasActiveFilters ? 'No meetings match the current filters.' : 'No meetings found.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rowsOnPage.map((row) => {
                    const isSelected = sel.isSelected(row.original.id);
                    return (
                      <tr
                        key={row.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open meeting for ${row.original.company || row.original.leadName || row.original.name || 'meeting'}`}
                        onClick={() => navigate(`${meetingBase}/${row.original.id}`)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            navigate(`${meetingBase}/${row.original.id}`);
                          }
                        }}
                        className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors last:border-0 cursor-pointer"
                        style={{ height: 40, background: isSelected ? '#EBF4FD' : undefined }}
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
          {!loading && !loadError && filteredData.length > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5" style={{ background: '#F9FAFB' }}>
              <p className="text-zinc-500" style={{ fontSize: 12 }}>
                Showing <span className="font-medium text-zinc-700">{firstRow}</span>–
                <span className="font-medium text-zinc-700">{lastRow}</span> of{' '}
                <span className="font-medium text-zinc-700">{filteredData.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500" style={{ fontSize: 12 }}>
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex items-center justify-center border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28 }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex items-center justify-center border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28 }}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Grid-view pagination footer (table view has its own footer above) */}
        {view === 'grid' && !loading && !loadError && filteredData.length > 0 && (
          <div className="flex items-center justify-between border border-zinc-200 rounded-lg px-4 py-2.5" style={{ background: '#F9FAFB' }}>
            <p className="text-zinc-500" style={{ fontSize: 12 }}>
              Showing <span className="font-medium text-zinc-700">{firstRow}</span>–
              <span className="font-medium text-zinc-700">{lastRow}</span> of{' '}
              <span className="font-medium text-zinc-700">{filteredData.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500" style={{ fontSize: 12 }}>Page {pageIndex + 1} of {pageCount}</span>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="flex items-center justify-center border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ width: 28, height: 28 }}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="flex items-center justify-center border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ width: 28, height: 28 }}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showReassign && (
        <ReassignModal
          entityLabel="Meeting"
          ownerLabel="Salesperson"
          count={sel.count}
          currentOwnerId={null}
          owners={reassignOwners}
          saving={reassignSaving}
          error={reassignError}
          onConfirm={handleBulkReassign}
          onClose={() => setShowReassign(false)}
        />
      )}
    </AppShell>
  );
}

export default MeetingsPage;
