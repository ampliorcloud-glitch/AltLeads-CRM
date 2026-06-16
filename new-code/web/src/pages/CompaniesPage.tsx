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
import { fetchCompanies, type Company } from '../data/companies';
import {
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from 'lucide-react';

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
  industry: string;
  city: string;
}

const defaultFilters: Filters = { search: '', industry: '', city: '' };

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
    <div className="flex flex-col gap-1" style={{ minWidth: 150 }}>
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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function fullUrl(webUrl: string): string {
  if (!webUrl) return '';
  return /^https?:\/\//.test(webUrl) ? webUrl : `https://${webUrl}`;
}

export function CompaniesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCompanies().then((result) => {
      if (cancelled) return;
      setAllCompanies(result.companies);
      setIndustries(result.industries);
      setCities(result.cities);
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
    return allCompanies.filter((c) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [c.name, c.domainClean, c.cin, c.industry, c.city, c.email]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.industry && c.industry !== filters.industry) return false;
      if (filters.city && c.city !== filters.city) return false;
      return true;
    });
  }, [filters, allCompanies]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Company',
        cell: (info) => {
          const name = info.getValue() ?? '';
          const row = info.row.original;
          return (
            <div className="flex items-center gap-2.5">
              <CompanyAvatar name={name} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 220 }}>
                    {name || <span className="text-zinc-400">—</span>}
                  </p>
                  {row.isDemo && <DemoTag />}
                </div>
                {row.city && (
                  <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 220 }}>{row.city}</p>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('domainClean', {
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
      columnHelper.accessor('cin', {
        header: 'CIN',
        cell: (info) => (
          <span className="text-zinc-500 font-mono" style={{ fontSize: 12 }}>
            {info.getValue() || <span className="text-zinc-300 font-sans">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('owner', {
        header: 'Owner',
        // Owner is always "Unassigned" for now. // TODO ownership
        cell: (info) => (
          <span className="text-zinc-400" style={{ fontSize: 13 }}>{info.getValue()}</span>
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
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleExport = () => {
    const rows = filteredData.map((c) => ({
      Company: c.name,
      Domain: c.domainClean,
      Website: c.webUrl,
      Industry: c.industry,
      City: c.city,
      CIN: c.cin,
      Size: c.size ?? '',
      Email: c.email,
      LinkedIn: c.linkedin,
      Owner: c.owner, // Unassigned // TODO ownership
      Demo: c.isDemo ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Companies');
    XLSX.writeFile(wb, 'amplior-crm-companies.xlsx');
  };

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
                  style={{ ...inputBase, paddingLeft: 26, width: 240 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                />
              </div>
            </div>

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
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allCompanies.length}</span> companies
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
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-400" style={{ fontSize: 13 }}>
                      No companies match the current filters.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/companies/${row.original.id}`)}
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

export default CompaniesPage;
