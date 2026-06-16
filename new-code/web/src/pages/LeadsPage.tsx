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
import * as XLSX from 'xlsx';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import { fetchLeadsFallback, type RealLead } from '../data/realLeads';
import {
  Search,
  Download,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
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
  agentName: string;
  industry: string;
  city: string;
  project: string;
  source: string;
  meetingDateFrom: string;
  meetingDateTo: string;
  stage: string;
}

const defaultFilters: Filters = {
  search: '',
  leadDateFrom: '',
  leadDateTo: '',
  agentName: '',
  industry: '',
  city: '',
  project: '',
  source: '',
  meetingDateFrom: '',
  meetingDateTo: '',
  stage: '',
};

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

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
      <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,126,232,0.12)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

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
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [allLeads, setAllLeads] = useState<RealLead[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Any filter change resets to the first page.
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const filteredData = useMemo(() => {
    return allLeads.filter((lead) => {
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
      if (filters.agentName && lead.agent !== filters.agentName) return false;
      if (filters.industry && lead.industry !== filters.industry) return false;
      if (filters.city && lead.city !== filters.city) return false;
      if (filters.project && lead.project !== filters.project) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.meetingDateFrom) {
        if (!lead.meetingDate || lead.meetingDate < filters.meetingDateFrom) return false;
      }
      if (filters.meetingDateTo) {
        if (!lead.meetingDate || lead.meetingDate > filters.meetingDateTo) return false;
      }
      if (filters.stage && lead.stage !== filters.stage) return false;
      return true;
    });
  }, [filters, allLeads]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('company', {
        header: 'Company',
        cell: (info) => {
          const name = info.getValue() ?? '';
          const sub = info.row.original.city || info.row.original.industry || '';
          return (
            <div className="flex items-center gap-2.5">
              <CompanyAvatar name={name} />
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 200 }}>
                  {name || <span className="text-zinc-400">—</span>}
                </p>
                {sub && (
                  <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 200 }}>{sub}</p>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('contactName', {
        header: 'Contact',
        cell: (info) => (
          <div>
            <p className="text-zinc-800" style={{ fontSize: 13 }}>{info.getValue() || '—'}</p>
            <p className="text-zinc-400" style={{ fontSize: 11 }}>{info.row.original.contactPhone || ''}</p>
          </div>
        ),
      }),
      columnHelper.accessor('project', {
        header: 'Project',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('city', {
        header: 'City',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('agent', {
        header: 'Agent',
        cell: (info) => (
          <span className="text-zinc-700" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('source', {
        header: 'Source',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('stage', {
        header: 'Stage',
        cell: (info) => <StageBadge stage={info.getValue()} />,
      }),
      columnHelper.accessor('meetingDate', {
        header: 'Meeting Date',
        cell: (info) => (
          <span className="text-zinc-500" style={{ fontSize: 13 }}>{info.getValue() ?? '—'}</span>
        ),
      }),
      columnHelper.accessor('lastUpdated', {
        header: 'Last Updated',
        cell: (info) => <span className="text-zinc-400" style={{ fontSize: 13 }}>{info.getValue()}</span>,
      }),
    ],
    []
  );

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

  const handleExport = () => {
    // Export the FULL filtered set (every matching row, not just the visible page).
    const rows = filteredData.map((l) => ({
      'Lead #': l.leadNumber,
      Company: l.company,
      'Contact Name': l.contactName,
      'Contact Email': l.contactEmail,
      'Contact Phone': l.contactPhone,
      Industry: l.industry,
      City: l.city,
      Agent: l.agent,
      Project: l.project,
      Source: l.source,
      Stage: l.stage,
      'Meeting Date': l.meetingDate ?? '',
      'Lead Generated': l.leadGeneratedDate,
      'Last Updated': l.lastUpdated,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'amplior-crm-leads.xlsx');
  };

  // Pagination display values.
  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  // navBtn is kept for compatibility — actual styles applied inline on buttons
  const navBtn = '';

  return (
    <AppShell title="Leads">
      <div className="space-y-3">
        {/* Live data banner */}
        {!bannerDismissed && (
          <div
            className="flex items-center justify-between px-4 rounded-lg"
            style={{ background: 'var(--color-gray-50)', border: '1px solid var(--border-color)', height: 36 }}
          >
            <p className="text-zinc-600" style={{ fontSize: 12 }}>
              Connected to live Supabase data — read-only preview.
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors ml-4"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

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

            <SelectFilter
              label="Agent"
              value={filters.agentName}
              onChange={(v) => setFilter('agentName', v)}
              options={agents}
            />
            <SelectFilter
              label="Project"
              value={filters.project}
              onChange={(v) => setFilter('project', v)}
              options={projects}
            />
            <SelectFilter
              label="City"
              value={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cities}
            />
            <SelectFilter
              label="Source"
              value={filters.source}
              onChange={(v) => setFilter('source', v)}
              options={sources}
            />
            <SelectFilter
              label="Industry"
              value={filters.industry}
              onChange={(v) => setFilter('industry', v)}
              options={industries}
            />
            <SelectFilter
              label="Stage"
              value={filters.stage}
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
            <button
              onClick={handleExport}
              disabled={loading || filteredData.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid var(--border-input)',
                background: 'var(--color-surface)',
                color: 'var(--color-gray-700)',
                fontWeight: 500,
                borderRadius: 'var(--radius-btn)',
                fontSize: 12,
                padding: '5px 12px',
                height: 30,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                opacity: (loading || filteredData.length === 0) ? 0.4 : 1,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; }}
            >
              <Download size={13} strokeWidth={1.75} />
              Export to Excel
            </button>
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
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--color-surface)' }}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{
                          padding: '11px 16px',
                          textAlign: 'left',
                          fontWeight: 500,
                          fontSize: 12,
                          color: 'var(--color-gray-500)',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() &&
                            ({
                              asc: <ChevronUp size={11} style={{ color: 'var(--color-brand)' }} />,
                              desc: <ChevronDown size={11} style={{ color: 'var(--color-brand)' }} />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ChevronsUpDown size={11} className="text-zinc-300" />
                            ))}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center">
                      <div className="flex items-center justify-center gap-2 text-zinc-400" style={{ fontSize: 13 }}>
                        <Loader2 size={16} className="animate-spin" />
                        Loading live data...
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-zinc-400"
                      style={{ fontSize: 13 }}
                    >
                      No leads match the current filters.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/leads/${row.original.id}`)}
                      style={{
                        borderBottom: '1px solid var(--color-gray-100)',
                        height: 44,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 align-middle whitespace-nowrap">
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
