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
import { fetchAllContacts, type Contact } from '../data/contacts';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Plus,
  Link2,
} from 'lucide-react';

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
  company: string;
  city: string;
  hasLinkedin: string; // 'yes' | 'no' | ''
  showDemo: string;    // 'all' | 'real' | 'demo'
}

const defaultFilters: Filters = {
  search: '',
  company: '',
  city: '',
  hasLinkedin: '',
  showDemo: 'real',
};

/* ------------------------------------------------------------------ */
/*  Column helper                                                        */
/* ------------------------------------------------------------------ */

const columnHelper = createColumnHelper<Contact>();

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function ContactsPage() {
  const navigate = useNavigate();
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllContacts().then(({ contacts, error }) => {
      if (cancelled) return;
      setAllContacts(contacts);
      setLoadError(error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
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

  const filteredData = useMemo(() => {
    return allContacts.filter((c) => {
      // Demo filter
      if (filters.showDemo === 'real' && c.is_demo) return false;
      if (filters.showDemo === 'demo' && !c.is_demo) return false;

      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          c.full_name, c.email, c.mobile_no, c.designation, c.company_name, c.city_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      // Company
      if (filters.company && c.company_name !== filters.company) return false;

      // City
      if (filters.city && c.city_name !== filters.city) return false;

      // Has LinkedIn
      if (filters.hasLinkedin === 'yes' && !c.linkedin_url) return false;
      if (filters.hasLinkedin === 'no' && c.linkedin_url) return false;

      return true;
    });
  }, [allContacts, filters]);

  const hasActiveFilters = filters.search !== '' || filters.company !== '' ||
    filters.city !== '' || filters.hasLinkedin !== '' || filters.showDemo !== 'real';

  const columns = useMemo(() => [
    columnHelper.accessor('full_name', {
      header: 'Contact',
      cell: (info) => {
        const name = info.getValue() ?? '';
        const isDemo = info.row.original.is_demo;
        return (
          <div className="flex items-center gap-2.5">
            <ContactAvatar name={name} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 180 }}>
                  {name || <span className="text-zinc-400">—</span>}
                </p>
                {isDemo && (
                  <span style={{
                    fontSize: 9, fontWeight: 600, letterSpacing: 0.4,
                    background: '#F3F4F6', color: '#9CA3AF',
                    borderRadius: 3, padding: '1px 5px',
                  }}>DEMO</span>
                )}
              </div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('designation', {
      header: 'Designation',
      cell: (info) => (
        <span className="text-zinc-600 truncate" style={{ fontSize: 13, display: 'block', maxWidth: 160 }}>
          {info.getValue() || <span className="text-zinc-300">—</span>}
        </span>
      ),
    }),
    columnHelper.accessor('company_name', {
      header: 'Company',
      cell: (info) => (
        <span className="text-zinc-700 truncate" style={{ fontSize: 13, display: 'block', maxWidth: 180 }}>
          {info.getValue() || <span className="text-zinc-300">—</span>}
        </span>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => (
        <span className="text-zinc-600 truncate" style={{ fontSize: 13, display: 'block', maxWidth: 200 }}>
          {info.getValue() || <span className="text-zinc-300">—</span>}
        </span>
      ),
    }),
    columnHelper.accessor('mobile_no', {
      header: 'Phone',
      cell: (info) => (
        <span className="text-zinc-600" style={{ fontSize: 13 }}>
          {info.getValue() || <span className="text-zinc-300">—</span>}
        </span>
      ),
    }),
    columnHelper.accessor('linkedin_url', {
      header: 'LinkedIn',
      enableSorting: false,
      cell: (info) => {
        const url = info.getValue();
        if (!url) return <span className="text-zinc-200" style={{ fontSize: 13 }}>—</span>;
        const href = url.startsWith('http') ? url : `https://linkedin.com/in/${url}`;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#0A66C2', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Link2 size={14} />
          </a>
        );
      },
    }),
  ], []);

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
      Name: c.full_name,
      Designation: c.designation ?? '',
      Company: c.company_name ?? '',
      Email: c.email ?? '',
      Phone: c.mobile_no ?? '',
      'Alt Phone': c.alt_mobile_no ?? '',
      City: c.city_name ?? '',
      LinkedIn: c.linkedin_url ?? '',
      Demo: c.is_demo ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'amplior-contacts.xlsx');
  };

  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

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
                  style={{ ...inputBase, paddingLeft: 26, width: 220 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                />
              </div>
            </div>

            {/* Company filter */}
            <div className="flex flex-col gap-1" style={{ minWidth: 160 }}>
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>Company</label>
              <select
                value={filters.company}
                onChange={(e) => setFilter('company', e.target.value)}
                style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              >
                <option value="">All companies</option>
                {companyOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* City filter */}
            <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
              <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>City</label>
              <select
                value={filters.city}
                onChange={(e) => setFilter('city', e.target.value)}
                style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              >
                <option value="">All cities</option>
                {cityOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

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
                <span className="font-medium text-zinc-700">{filteredData.length}</span> of{' '}
                <span className="font-medium text-zinc-700">{allContacts.length}</span> contacts
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
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} style={{ borderBottom: '2px solid #1A7EE8', background: 'var(--color-surface)' }}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontWeight: 600,
                          fontSize: 13,
                          color: '#1A7EE8',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          borderBottom: '2px solid #1A7EE8',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() &&
                            ({
                              asc: <ChevronUp size={11} style={{ color: '#1A7EE8' }} />,
                              desc: <ChevronDown size={11} style={{ color: '#1A7EE8' }} />,
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
                        Loading contacts...
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-400" style={{ fontSize: 13 }}>
                      No contacts match the current filters.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/contacts/${row.original.contact_id}`)}
                      style={{
                        borderBottom: '1px solid var(--color-gray-100)',
                        height: 48,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} style={{ padding: '0 16px' }} className="align-middle whitespace-nowrap">
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
                  onChange={(e) => { table.setPageSize(Number(e.target.value)); table.setPageIndex(0); }}
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

export default ContactsPage;
