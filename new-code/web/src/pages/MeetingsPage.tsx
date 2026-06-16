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
import * as XLSX from 'xlsx';
import { AppShell } from '../components/layout/AppShell';
import { MeetingStatusBadge } from '../components/meeting/MeetingStatusBadge';
import {
  fetchMeetings,
  buildMeetingExportRows,
  formatDate,
  formatTime,
  type MeetingRow,
} from '../data/meetings';
import {
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';

const columnHelper = createColumnHelper<MeetingRow>();
const PAGE_SIZE = 25;

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
  agent: string;
  industry: string;
  city: string;
  meetingDateFrom: string;
  meetingDateTo: string;
  salesperson: string;
  status: string;
}

const defaultFilters: Filters = {
  search: '',
  leadDateFrom: '',
  leadDateTo: '',
  agent: '',
  industry: '',
  city: '',
  meetingDateFrom: '',
  meetingDateTo: '',
  salesperson: '',
  status: '',
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
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MeetingsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [allMeetings, setAllMeetings] = useState<MeetingRow[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
    });
    return () => { cancelled = true; };
  }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const filteredData = useMemo(() => {
    return allMeetings.filter((m) => {
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
      if (filters.agent && m.agent !== filters.agent) return false;
      if (filters.industry && m.industry !== filters.industry) return false;
      if (filters.city && m.city !== filters.city) return false;
      if (filters.salesperson && m.salesperson !== filters.salesperson) return false;
      if (filters.status && m.status !== filters.status) return false;
      return true;
    });
  }, [filters, allMeetings]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('company', {
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
      columnHelper.accessor('client', {
        header: 'Client',
        cell: (info) => (
          <span className="text-zinc-600 truncate" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('meetingDate', {
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
      columnHelper.accessor('mode', {
        header: 'Mode',
        cell: (info) => (
          <span className="text-zinc-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('salesperson', {
        header: 'Salesperson',
        cell: (info) => (
          <span className="text-zinc-700 truncate" style={{ fontSize: 13 }}>
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
      columnHelper.accessor('confirmed', {
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
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <MeetingStatusBadge status={info.getValue()} />,
      }),
    ],
    []
  );

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

  const handleExport = async () => {
    setExporting(true);
    try {
      // Exports the FULL filtered set (every matching row), not just the visible page.
      const rows = await buildMeetingExportRows(filteredData);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Meetings');
      XLSX.writeFile(wb, 'amplior-crm-meetings.xlsx');
    } finally {
      setExporting(false);
    }
  };

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

            <SelectFilter
              label="Agent"
              value={filters.agent}
              onChange={(v) => setFilter('agent', v)}
              options={agents}
            />
            <SelectFilter
              label="Industry"
              value={filters.industry}
              onChange={(v) => setFilter('industry', v)}
              options={industries}
            />
            <SelectFilter
              label="City"
              value={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cities}
            />
            <SelectFilter
              label="Sales Person / Head"
              value={filters.salesperson}
              onChange={(v) => setFilter('salesperson', v)}
              options={salespeople}
            />
            <SelectFilter
              label="Meeting Status"
              value={filters.status}
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
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allMeetings.length}</span> meetings
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
          <button
            onClick={handleExport}
            disabled={loading || exporting || filteredData.length === 0}
            className="flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 12, padding: '5px 12px', height: 30 }}
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} strokeWidth={1.75} />}
            {exporting ? 'Preparing...' : 'Export to Excel'}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} style={{ borderBottom: '2px solid #E5E7EB', background: '#FFFFFF' }}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-2.5 text-left whitespace-nowrap select-none"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1A7EE8',
                          borderBottom: '2px solid #1A7EE8',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() &&
                            ({
                              asc: <ChevronUp size={11} />,
                              desc: <ChevronDown size={11} />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ChevronsUpDown size={11} style={{ color: '#9CA3AF' }} />
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
                  rowsOnPage.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/meetings/${row.original.id}`)}
                      className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors last:border-0 cursor-pointer"
                      style={{ height: 40 }}
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
      </div>
    </AppShell>
  );
}

export default MeetingsPage;
