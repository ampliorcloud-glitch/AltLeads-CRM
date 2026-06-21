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
  type PaginationState,
} from '@tanstack/react-table';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import { fetchLeadsFallback, type RealLead } from '../data/realLeads';
import { useAuth } from '../contexts/AuthContext';
import { useIsSalesShell } from '../contexts/SalesShellContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { useRowSelection } from '../components/ui/useRowSelection';
import { ExportButton } from '../components/ui/ExportButton';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { formatDate } from '../data/meetings';
import { Skeleton } from '../components/ui/Skeleton';
import {
  ColumnCustomizer,
  defaultColumnPrefs,
  reconcileColumns,
} from '../components/ui/ColumnCustomizer';
import type { ColumnDef as ColDef, ExportColumn } from '../components/ui/columns';
import type { ColumnPref } from '../data/views';
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const columnHelper = createColumnHelper<RealLead>();

/* ------------------------------------------------------------------
   Company avatar — initials in a brand-tinted circle (Figma Leads list)
------------------------------------------------------------------ */

// Soft, muted tint palette (light bg + readable text) keyed deterministically
// off the company name so each company keeps a stable color.
const AVATAR_TINTS: { bg: string; text: string }[] = [
  { bg: '#EBF4FD', text: '#1A7EE8' }, // brand blue
  { bg: '#F5F3FF', text: '#7C3AED' }, // purple
  { bg: '#ECFEFF', text: '#0891B2' }, // cyan
  { bg: '#F0FDF4', text: '#16A34A' }, // green
  { bg: '#FFF7ED', text: '#EA580C' }, // orange
  { bg: '#FEF2F2', text: '#DC2626' }, // red
  { bg: '#FFFBEB', text: '#D97706' }, // amber
  { bg: '#EFF6FF', text: '#1D4ED8' }, // indigo-blue
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

interface Filters {
  search: string;
  leadDateFrom: string;
  leadDateTo: string;
  // Multi-value facets (OR within a facet; empty array = no filter).
  agentName: string[];
  industry: string[];
  city: string[];
  project: string[];
  source: string[];
  meetingDateFrom: string;
  meetingDateTo: string;
  stage: string[];
}

const defaultFilters: Filters = {
  search: '',
  leadDateFrom: '',
  leadDateTo: '',
  agentName: [],
  industry: [],
  city: [],
  project: [],
  source: [],
  meetingDateFrom: '',
  meetingDateTo: '',
  stage: [],
};

/* ------------------------------------------------------------------
   Column catalogue (all lead columns; drives ColumnCustomizer + ExportButton)
------------------------------------------------------------------ */

const ALL_COLUMNS: ColDef[] = [
  { key: 'company',          header: 'Company',        defaultVisible: true },
  { key: 'contactName',      header: 'Contact',        defaultVisible: true },
  { key: 'project',          header: 'Project',        defaultVisible: true },
  { key: 'city',             header: 'City',           defaultVisible: true },
  { key: 'agent',            header: 'Agent',          defaultVisible: true },
  { key: 'source',           header: 'Source',         defaultVisible: true },
  { key: 'stage',            header: 'Stage',          defaultVisible: true },
  { key: 'meetingDate',      header: 'Meeting Date',   defaultVisible: true },
  { key: 'lastUpdated',      header: 'Last Updated',   defaultVisible: true },
  { key: 'leadNumber',       header: 'Lead #',         defaultVisible: false },
  { key: 'contactEmail',     header: 'Email',          defaultVisible: false },
  { key: 'contactPhone',     header: 'Phone',          defaultVisible: false },
  { key: 'industry',         header: 'Industry',       defaultVisible: false },
  { key: 'leadGeneratedDate',header: 'Lead Generated', defaultVisible: false },
];

// Export column definitions (maps keys to flat values for xlsx/csv)
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'leadNumber',        header: 'Lead #' },
  { key: 'company',           header: 'Company' },
  { key: 'contactName',       header: 'Contact Name' },
  { key: 'contactEmail',      header: 'Contact Email' },
  { key: 'contactPhone',      header: 'Contact Phone' },
  { key: 'industry',          header: 'Industry' },
  { key: 'city',              header: 'City' },
  { key: 'agent',             header: 'Agent' },
  { key: 'project',           header: 'Project' },
  { key: 'source',            header: 'Source' },
  { key: 'stage',             header: 'Stage' },
  { key: 'meetingDate',       header: 'Meeting Date',   accessor: (r) => r.meetingDate ?? '' },
  { key: 'leadGeneratedDate', header: 'Lead Generated' },
  { key: 'lastUpdated',       header: 'Last Updated' },
];

/* ------------------------------------------------------------------
   Filter sub-components
------------------------------------------------------------------ */

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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/* ------------------------------------------------------------------
   Main page
------------------------------------------------------------------ */

export function LeadsPage() {
  const navigate = useNavigate();
  const { profile, canCreateData } = useAuth();
  const userId = profile?.user_id ?? null;
  // When reused inside the Sales Portal, keep navigation within /sales/*.
  const isSalesShell = useIsSalesShell();
  const leadBase = isSalesShell ? '/sales/leads' : '/leads';

  // Global project scope (owner ask #8). When a project is selected (not "All"),
  // the list additionally pre-filters to that project. We match on the NUMERIC
  // lead.projectId (lead_master.project_id) — the same stable id useProjectScope
  // returns — NOT the display name, so duplicate/blank project names and any drift
  // between the two `project` queries can never hide or mismatch records.
  // selectedProjectId === null = "All projects" → no project filter (unchanged).
  //
  // IGNORED in the Sales Portal (isSalesShell): the project switcher is an internal
  // control that sales users can't see (it's hidden for non-internal roles), so
  // applying its scope there would silently narrow their leads with no way to clear
  // it (review ALT-273B M2). The sales portal scopes by assignment, not by project.
  const { selectedProjectId } = useProjectScope();
  const projectScopeId = isSalesShell ? null : selectedProjectId;

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  // Column visibility / order state (seeded from catalogue defaults)
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() =>
    defaultColumnPrefs(ALL_COLUMNS),
  );

  // Row multi-selection
  const sel = useRowSelection<string>();

  const [allLeads, setAllLeads] = useState<RealLead[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchLeadsFallback().then((result) => {
      if (cancelled) return;
      setAllLeads(result.leads);
      setIndustries(result.industries);
      setCities(result.cities);
      setAgents(result.agents);
      setProjects(result.projects);
      setSources(result.sources);
      setStages(result.stages);
      setLoadError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Any filter change resets to the first page.
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '',
  );

  const filteredData = useMemo(() => {
    return allLeads.filter((lead) => {
      // Global project scope (AND with every page filter). null = "All projects"
      // → no project filter. Otherwise match the lead's numeric project id.
      if (projectScopeId != null && lead.projectId !== projectScopeId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          lead.company, lead.contactName, lead.contactEmail, lead.contactPhone,
          lead.leadNumber, lead.industry, lead.city, lead.agent,
          lead.project, lead.source, lead.stage,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.leadDateFrom && lead.leadGeneratedDate < filters.leadDateFrom) return false;
      if (filters.leadDateTo && lead.leadGeneratedDate > filters.leadDateTo) return false;
      // Multi-value facets: empty array = no filter; otherwise the row must match any selected value.
      if (filters.agentName.length && !filters.agentName.includes(lead.agent)) return false;
      if (filters.industry.length && !filters.industry.includes(lead.industry)) return false;
      if (filters.city.length && !filters.city.includes(lead.city)) return false;
      if (filters.project.length && !filters.project.includes(lead.project)) return false;
      if (filters.source.length && !filters.source.includes(lead.source)) return false;
      if (filters.meetingDateFrom) {
        if (!lead.meetingDate || lead.meetingDate < filters.meetingDateFrom) return false;
      }
      if (filters.meetingDateTo) {
        if (!lead.meetingDate || lead.meetingDate > filters.meetingDateTo) return false;
      }
      if (filters.stage.length && !filters.stage.includes(lead.stage)) return false;
      return true;
    });
  }, [filters, allLeads, projectScopeId]);

  // How many leads are hidden ONLY because they carry no project_id while a project
  // is scoped — surfaced as a small note so a project filter never looks like missing
  // data (review ALT-273B: NULL project_id rows silently hidden).
  const noProjectHidden = useMemo(
    () => (projectScopeId == null ? 0 : allLeads.filter((l) => l.projectId == null).length),
    [projectScopeId, allLeads],
  );

  // Derive the ordered, visibility-filtered set of column keys from prefs.
  const visibleKeys = useMemo(
    () => columnPrefs.filter((p) => p.visible).map((p) => p.key),
    [columnPrefs],
  );

  // Build TanStack columns dynamically from visible prefs.
  const columns = useMemo(() => {
    // Checkbox column (always first, not in column catalogue)
    const checkboxCol = columnHelper.display({
      id: '__select',
      header: ({ table: t }) => {
        const pageIds = t.getRowModel().rows.map((r) => r.original.id);
        const allChecked = pageIds.length > 0 && sel.allSelected(pageIds);
        return (
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => sel.toggleAll(pageIds)}
            onClick={(e) => e.stopPropagation()}
            title={allChecked ? 'Deselect all on page' : 'Select all on page'}
            aria-label={allChecked ? 'Deselect all leads on this page' : 'Select all leads on this page'}
            style={{ cursor: 'pointer', accentColor: 'var(--color-brand)' }}
          />
        );
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={sel.isSelected(row.original.id)}
          onChange={() => sel.toggle(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.original.company || row.original.contactName || 'lead'}`}
          style={{ cursor: 'pointer', accentColor: 'var(--color-brand)' }}
        />
      ),
      size: 40,
    });

    // Data columns — map each visible key to its TanStack column definition.
    const dataCols = visibleKeys
      .map((key) => {
        switch (key) {
          case 'company':
            return columnHelper.accessor('company', {
              id: 'company',
              header: 'Company',
              cell: (info) => {
                const name = info.getValue() ?? '';
                const sub = info.row.original.city || info.row.original.industry || '';
                return (
                  <div className="flex items-center gap-2.5">
                    <CompanyAvatar name={name} />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={name || undefined}>
                        {name || <span className="text-zinc-400">—</span>}
                      </p>
                      {sub && (
                        <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 200 }} title={sub}>{sub}</p>
                      )}
                    </div>
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
                  <p className="text-zinc-800" style={{ fontSize: 13 }}>{info.getValue() || '—'}</p>
                  <p className="text-zinc-400" style={{ fontSize: 11 }}>{info.row.original.contactPhone || ''}</p>
                </div>
              ),
            });
          case 'project':
            return columnHelper.accessor('project', {
              id: 'project',
              header: 'Project',
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
          case 'agent':
            return columnHelper.accessor('agent', {
              id: 'agent',
              header: 'Agent',
              cell: (info) => (
                <span className="text-zinc-700" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-zinc-300">—</span>}
                </span>
              ),
            });
          case 'source':
            return columnHelper.accessor('source', {
              id: 'source',
              header: 'Source',
              cell: (info) => (
                <span className="text-zinc-600" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-zinc-300">—</span>}
                </span>
              ),
            });
          case 'stage':
            return columnHelper.accessor('stage', {
              id: 'stage',
              header: 'Stage',
              cell: (info) => <StageBadge stage={info.getValue()} />,
            });
          case 'meetingDate':
            return columnHelper.accessor('meetingDate', {
              id: 'meetingDate',
              header: 'Meeting Date',
              cell: (info) => (
                <span className="text-zinc-500" style={{ fontSize: 13 }}>{info.getValue() ? formatDate(info.getValue()) : <span className="text-zinc-300">—</span>}</span>
              ),
            });
          case 'lastUpdated':
            return columnHelper.accessor('lastUpdated', {
              id: 'lastUpdated',
              header: 'Last Updated',
              cell: (info) => (
                <span className="text-zinc-400" style={{ fontSize: 13 }}>{info.getValue() ? formatDate(info.getValue()) : <span className="text-zinc-300">—</span>}</span>
              ),
            });
          case 'leadNumber':
            return columnHelper.accessor('leadNumber', {
              id: 'leadNumber',
              header: 'Lead #',
              cell: (info) => (
                <span className="text-zinc-500 font-mono" style={{ fontSize: 12 }}>{info.getValue() || '—'}</span>
              ),
            });
          case 'contactEmail':
            return columnHelper.accessor('contactEmail', {
              id: 'contactEmail',
              header: 'Email',
              cell: (info) => (
                <span className="text-zinc-600" style={{ fontSize: 13 }}>{info.getValue() || '—'}</span>
              ),
            });
          case 'contactPhone':
            return columnHelper.accessor('contactPhone', {
              id: 'contactPhone',
              header: 'Phone',
              cell: (info) => (
                <span className="text-zinc-600" style={{ fontSize: 13 }}>{info.getValue() || '—'}</span>
              ),
            });
          case 'industry':
            return columnHelper.accessor('industry', {
              id: 'industry',
              header: 'Industry',
              cell: (info) => (
                <span className="text-zinc-600" style={{ fontSize: 13 }}>{info.getValue() || '—'}</span>
              ),
            });
          case 'leadGeneratedDate':
            return columnHelper.accessor('leadGeneratedDate', {
              id: 'leadGeneratedDate',
              header: 'Lead Generated',
              cell: (info) => (
                <span className="text-zinc-500" style={{ fontSize: 13 }}>{info.getValue() ? formatDate(info.getValue()) : <span className="text-zinc-300">—</span>}</span>
              ),
            });
          default:
            return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c != null);

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
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Pagination display values.
  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  // Export columns limited to visible ones (in display order)
  const exportColumns = useMemo<ExportColumn[]>(() => {
    const exportMap = new Map(EXPORT_COLUMNS.map((c) => [c.key, c]));
    return visibleKeys
      .map((k) => exportMap.get(k))
      .filter((c): c is ExportColumn => c != null);
  }, [visibleKeys]);

  return (
    <AppShell title="Leads">
      <div className="space-y-3">
        {/* Filter panel */}
        <div className="rounded-lg p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search
                  size={13}
                  className="absolute text-zinc-400 pointer-events-none"
                  style={{ left: 8 }}
                />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Company, contact, lead #..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 10, width: 210 }}
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
              selected={filters.agentName}
              onChange={(v) => setFilter('agentName', v)}
              options={agents}
            />
            <MultiSelectFilter
              label="Project"
              selected={filters.project}
              onChange={(v) => setFilter('project', v)}
              options={projects}
            />
            <MultiSelectFilter
              label="City"
              selected={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cities}
            />
            <MultiSelectFilter
              label="Source"
              selected={filters.source}
              onChange={(v) => setFilter('source', v)}
              options={sources}
            />
            <MultiSelectFilter
              label="Industry"
              selected={filters.industry}
              onChange={(v) => setFilter('industry', v)}
              options={industries}
            />
            <MultiSelectFilter
              label="Stage"
              selected={filters.stage}
              onChange={(v) => setFilter('stage', v)}
              options={stages}
            />
          </div>
        </div>

        {/* Toolbar row: count + actions */}
        <div className="flex items-center justify-between">
          <p className="text-zinc-400" style={{ fontSize: 12 }}>
            {loading ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                Loading leads...
              </span>
            ) : loadError ? (
              <span className="text-red-500">{loadError}</span>
            ) : (
              <>
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allLeads.length}</span> leads
                {noProjectHidden > 0 && (
                  <span className="text-zinc-400" title="These leads have no project assigned, so they're hidden while a project is selected.">
                    {' · '}{noProjectHidden} with no project hidden
                  </span>
                )}
                {sel.count > 0 && (
                  <>
                    {' ·'}{' '}
                    <span className="font-medium text-zinc-700">{sel.count}</span> selected
                    <button
                      onClick={() => sel.clear()}
                      className="ml-2 text-zinc-400 hover:text-zinc-700 transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      Clear
                    </button>
                  </>
                )}
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilters(defaultFilters); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
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
            {/* Column customizer */}
            <ColumnCustomizer
              entity="leads"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={(next) => setColumnPrefs(reconcileColumns(next, ALL_COLUMNS))}
            />

            {/* Export (selected rows or all filtered rows) */}
            <ExportButton
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows={filteredData as any[]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              columns={exportColumns as any[]}
              filename="amplior-crm-leads"
              selectedIds={sel.selectedIds}
              idKey="id"
              disabled={loading || filteredData.length === 0}
            />

            {/* Create is admin-only by default (ADR-21); hidden from outreach roles. */}
            {canCreateData && (
            <button
              onClick={() => navigate('/leads/new')}
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
              New Lead
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
                          padding: header.id === '__select' ? '11px 12px' : '11px 16px',
                          textAlign: 'left',
                          fontWeight: 500,
                          fontSize: 12,
                          color: 'var(--color-gray-500)',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          cursor: canSort ? 'pointer' : 'default',
                          width: header.id === '__select' ? 40 : undefined,
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
                        <td key={c} style={{ padding: c === 0 ? '0 12px' : '0 16px' }}>
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
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center text-zinc-400"
                      style={{ fontSize: 13 }}
                    >
                      {hasActiveFilters ? (
                        <span className="inline-flex items-center gap-2">
                          No leads match the current filters.
                          <button
                            type="button"
                            onClick={() => setFilters(defaultFilters)}
                            style={{ color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}
                          >
                            Clear filters
                          </button>
                        </span>
                      ) : (
                        'No leads yet.'
                      )}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ${row.original.company || row.original.contactName || 'lead'}`}
                      onClick={() => navigate(`${leadBase}/${row.original.id}`)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                          e.preventDefault();
                          navigate(`${leadBase}/${row.original.id}`);
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--color-gray-100)',
                        height: 44,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                        background: sel.isSelected(row.original.id) ? 'var(--color-brand-subtle, #EBF4FD)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!sel.isSelected(row.original.id)) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = sel.isSelected(row.original.id)
                          ? 'var(--color-brand-subtle, #EBF4FD)'
                          : '';
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="align-middle whitespace-nowrap"
                          style={{ padding: cell.column.id === '__select' ? '0 12px' : '0 16px' }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
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
    </AppShell>
  );
}

export default LeadsPage;
