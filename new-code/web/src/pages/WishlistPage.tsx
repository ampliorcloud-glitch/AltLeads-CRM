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
import * as XLSX from 'xlsx';
import { AppShell } from '../components/layout/AppShell';
import { fetchWishlist, fmtLongDate, type WishlistItem } from '../data/wishlist';
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
  Building2,
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
  status: string;
  agent: string;
  teamLead: string;
  industry: string;
  city: string;
}

const defaultFilters: Filters = {
  search: '',
  status: '',
  agent: '',
  teamLead: '',
  industry: '',
  city: '',
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

/* ── filters ────────────────────────────────────────────────────────────── */

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
    <div className="flex flex-col gap-1" style={{ minWidth: 150 }}>
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

/* ── main page ──────────────────────────────────────────────────────────── */

export function WishlistPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [allItems, setAllItems] = useState<WishlistItem[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [teamLeads, setTeamLeads] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

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
      if (filters.status && item.status !== filters.status) return false;
      if (filters.agent && item.agent !== filters.agent) return false;
      if (filters.teamLead && item.teamLead !== filters.teamLead) return false;
      if (filters.industry && item.industry !== filters.industry) return false;
      if (filters.city && item.city !== filters.city) return false;
      return true;
    });
  }, [filters, allItems]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('company', {
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
      }),
      columnHelper.accessor('contactName', {
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
      }),
      columnHelper.accessor('industry', {
        header: 'Industry',
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
        header: 'Assigned Agent',
        cell: (info) => (
          <span className="text-zinc-700" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('teamLead', {
        header: 'Team Lead',
        cell: (info) => (
          <span className="text-zinc-700" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-zinc-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('createdDate', {
        header: 'Added',
        cell: (info) => (
          <span className="text-zinc-500 whitespace-nowrap" style={{ fontSize: 13 }}>
            {info.getValue() ? fmtLongDate(info.getValue()) : '—'}
          </span>
        ),
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
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleExport = () => {
    const rows = filteredData.map((i) => ({
      Company: i.company,
      'Contact Name': i.contactName,
      Designation: i.designation,
      Industry: i.industry,
      City: i.city,
      State: i.state,
      Pincode: i.pincode,
      Phone: i.phone,
      'Assigned Agent': i.agent,
      'Team Lead': i.teamLead,
      Status: i.status,
      Notes: i.description,
      'Added': i.createdDate,
      'Last Updated': i.lastUpdated,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wishlist');
    XLSX.writeFile(wb, 'amplior-crm-wishlist.xlsx');
  };

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const rowCount = filteredData.length;
  const rangeStart = rowCount === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = Math.min((pageIndex + 1) * PAGE_SIZE, rowCount);

  return (
    <AppShell title="Wishlist">
      <div className="space-y-3">
        {/* Live data banner */}
        {!bannerDismissed && (
          <div
            className="flex items-center justify-between px-4 rounded-lg border border-zinc-200"
            style={{ background: '#f4f4f5', height: 36 }}
          >
            <p className="text-zinc-600" style={{ fontSize: 12 }}>
              Target companies sales reps want to pursue — live Supabase data, read-only preview.
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

            <SelectFilter
              label="Status"
              value={filters.status}
              onChange={(v) => setFilter('status', v)}
              options={statuses}
            />
            <SelectFilter
              label="Assigned Agent"
              value={filters.agent}
              onChange={(v) => setFilter('agent', v)}
              options={agents}
            />
            <SelectFilter
              label="Team Lead"
              value={filters.teamLead}
              onChange={(v) => setFilter('teamLead', v)}
              options={teamLeads}
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
          </div>
        </div>

        {/* Toolbar: count + actions */}
        <div className="flex items-center justify-between">
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
          <button
            onClick={handleExport}
            disabled={loading || rowCount === 0}
            className="flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 12, padding: '5px 12px', height: 30 }}
          >
            <Download size={13} strokeWidth={1.75} />
            Export to Excel
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
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center" style={{ fontSize: 13 }}>
                      <div className="flex flex-col items-center gap-2 text-zinc-400">
                        <Building2 size={22} className="text-zinc-300" />
                        {allItems.length === 0
                          ? 'No companies in the wishlist yet.'
                          : 'No companies match the current filters.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/wishlist/${row.original.wishlistId}`)}
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
          {!loading && rowCount > 0 && (
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
      </div>
    </AppShell>
  );
}

export default WishlistPage;
