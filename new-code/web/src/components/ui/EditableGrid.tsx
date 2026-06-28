/**
 * EditableGrid — the REAL "Grid" view: an Excel/spreadsheet-style table whose
 * cells edit INLINE, right from the list, with no need to open a preview or the
 * full record (ALT-331). It replaces the read-only card "tiles" the Grid view
 * used to show.
 *
 * Universal by design: every list page (Leads / Companies / Contacts / Meetings /
 * Wishlist) feeds it the same shape — a `columns` config describing which cells
 * are read-only and which are editable (text or select) plus an `onSave` per
 * editable column. Saves reuse the page's existing audited writers (upsert*Status
 * / reassign* / …) so RLS, history and the 42501 friendly-error all behave the
 * same as everywhere else.
 *
 * Edit scope (Ankit's "safe editable set", ALT-331): pages mark status/stage,
 * owner, description, comments and editable text columns as `editable`; they
 * leave identifiers (name link), counts and timestamps read-only. Per-project
 * fields pass a `disabledReason` (e.g. "Select a project first") so the cell
 * stays read-only with a tooltip until a project is chosen.
 *
 * Multi-select parity (ALT-332): a leading checkbox column wires to the page's
 * shared `useRowSelection`, so the bulk toolbar works from the Grid too — not
 * just the Table.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ArrowUpRight, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

export type EditableCellType = 'text' | 'select';

export interface EditableColumn<Row> {
  /** Stable key (also the React key for the column). */
  key: string;
  header: string;
  /** Fixed px width; omit for auto. */
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** Raw value used to seed the editor + as the default display. */
  getValue: (row: Row) => string | number | null | undefined;
  /** Mark the cell editable. */
  editable?: boolean;
  /** 'text' (default) or 'select' when editable. */
  type?: EditableCellType;
  /** Options for a 'select' editor. */
  options?: { value: string; label: string }[];
  /** Persist a new value. Mirror the `{ error }` contract of the upsert writers. */
  onSave?: (row: Row, next: string) => Promise<{ error: string | null }>;
  /** Custom read-only renderer (e.g. name as link, a StatusBadge). Wins over getValue. */
  render?: (row: Row) => React.ReactNode;
  /**
   * When editing should be temporarily blocked for a row (e.g. no project
   * selected), return a reason — the cell renders read-only with that tooltip.
   */
  disabledReason?: (row: Row) => string | null;
}

interface EditableGridProps<Row> {
  rows: Row[];
  getKey: (row: Row) => React.Key;
  columns: EditableColumn<Row>[];
  /** Selection (optional — enables the leading checkbox column). */
  isSelected?: (row: Row) => boolean;
  onToggleSelect?: (row: Row) => void;
  selectAllState?: 'none' | 'some' | 'all';
  onToggleSelectAll?: () => void;
  /** Open the preview/detail for a row (renders a small ↗ open button per row). */
  onOpenRow?: (row: Row) => void;
  emptyLabel?: string;
}

const TH: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--color-gray-50, #FAFAFA)',
  borderBottom: '1px solid var(--border-color)',
  padding: '8px 10px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: '#6b7280',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
  padding: 0, // cells own their own padding so editors can fill
  fontSize: 13,
  color: 'var(--color-gray-700)',
  verticalAlign: 'middle',
  height: 40,
};

function toStr(v: string | number | null | undefined): string {
  return v == null ? '' : String(v);
}

/* ------------------------------------------------------------------ */
/*  One editable cell — manages its own edit + save lifecycle          */
/* ------------------------------------------------------------------ */

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function EditableCell<Row>({ row, col }: { row: Row; col: EditableColumn<Row> }) {
  const toast = useToast();
  const original = toStr(col.getValue(row));
  const [value, setValue] = useState(original);
  const [state, setState] = useState<SaveState>('idle');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync if the row's underlying value changes (e.g. after a refetch).
  useEffect(() => {
    setValue(original);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const disabled = col.disabledReason ? col.disabledReason(row) : null;

  // Read-only path: custom render, or plain display.
  if (!col.editable || !col.onSave || disabled) {
    const content = col.render ? col.render(row) : (original || <span style={{ color: '#d1d5db' }}>—</span>);
    return (
      <div
        // Hover-to-read clipped text: tooltip the cell's own value (or the
        // disabled reason when blocked). Skip when render() owns a node.
        title={disabled || (!col.render && original ? original : undefined)}
        style={{
          padding: '0 10px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
          color: disabled ? '#9ca3af' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {content}
      </div>
    );
  }

  async function commit(next: string) {
    if (next === original) { setState('idle'); return; }
    setState('saving');
    const res = await col.onSave!(row, next);
    if (res.error) {
      setState('error');
      setValue(original); // revert
      toast.error(res.error);
      setTimeout(() => setState('idle'), 1200);
    } else {
      setState('saved');
      toast.success('Saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setState('idle'), 1500);
    }
  }

  const statusIcon =
    state === 'saving' ? <Loader2 size={13} className="animate-spin" style={{ color: '#9ca3af' }} />
    : state === 'saved' ? <Check size={13} style={{ color: '#16a34a' }} />
    : null;

  const cellWrap: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: '100%',
    padding: '0 6px',
  };

  if (col.type === 'select') {
    return (
      <div style={cellWrap}>
        <select
          value={value}
          onChange={(e) => { setValue(e.target.value); commit(e.target.value); }}
          disabled={state === 'saving'}
          style={{
            flex: 1,
            minWidth: 0,
            height: 28,
            border: '1px solid transparent',
            borderRadius: 6,
            background: 'transparent',
            fontSize: 13,
            color: 'var(--color-gray-700)',
            padding: '0 4px',
            cursor: 'pointer',
            outline: 'none',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1A7EE8'; (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <option value="">—</option>
          {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {statusIcon}
      </div>
    );
  }

  // text editor — looks like a cell, reveals a border on focus, saves on Enter/blur
  return (
    <div style={cellWrap}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
          else if (e.key === 'Escape') { setValue(original); (e.currentTarget as HTMLInputElement).blur(); }
        }}
        disabled={state === 'saving'}
        style={{
          flex: 1,
          minWidth: 0,
          height: 28,
          border: '1px solid transparent',
          borderRadius: 6,
          background: 'transparent',
          fontSize: 13,
          color: 'var(--color-gray-700)',
          padding: '0 6px',
          outline: 'none',
        }}
        onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1A7EE8'; (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; commit(value); }}
      />
      {statusIcon}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EditableGrid                                                        */
/* ------------------------------------------------------------------ */

export function EditableGrid<Row>({
  rows,
  getKey,
  columns,
  isSelected,
  onToggleSelect,
  selectAllState = 'none',
  onToggleSelectAll,
  onOpenRow,
  emptyLabel = 'Nothing to show.',
}: EditableGridProps<Row>) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const hasSelect = !!isSelected && !!onToggleSelect;

  // Run on EVERY render so unrelated re-renders can't repaint the checkbox as
  // not-indeterminate (the DOM `indeterminate` flag isn't expressible in JSX).
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectAllState === 'some';
  });

  if (rows.length === 0) {
    return (
      <div
        className="rounded-lg"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--border-color)',
          padding: '40px 16px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: 13,
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  // Frozen identity columns: the checkbox, the open-↗ button, and the first
  // data column stick to the left so the record name stays visible during
  // horizontal scroll. Offsets are the cumulative widths of the fixed leading
  // columns (header z=2 corner, body z=1, opaque bg so rows don't bleed through).
  const selectW = hasSelect ? 36 : 0;
  const openW = onOpenRow ? 32 : 0;
  const col0Left = selectW + openW;

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        overflow: 'auto',
        background: 'var(--color-surface)',
        maxHeight: 'calc(100vh - 300px)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            {hasSelect && (
              <th style={{ ...TH, width: 36, textAlign: 'center', position: 'sticky', left: 0, zIndex: 2 }}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={selectAllState === 'all'}
                  onChange={() => onToggleSelectAll && onToggleSelectAll()}
                  style={{ cursor: 'pointer' }}
                />
              </th>
            )}
            {onOpenRow && <th style={{ ...TH, width: 32, position: 'sticky', left: selectW, zIndex: 2 }} aria-label="Open" />}
            {columns.map((c, ci) => (
              <th
                key={c.key}
                style={{
                  ...TH, width: c.width, textAlign: c.align ?? 'left',
                  ...(ci === 0 ? { position: 'sticky' as const, left: col0Left, zIndex: 2 } : null),
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = hasSelect && isSelected!(row);
            const stickyBg = selected ? '#EFF6FF' : 'var(--color-surface)';
            return (
              <tr
                key={getKey(row)}
                style={{ background: selected ? '#EFF6FF' : undefined, transition: 'background 0.1s' }}
              >
                {hasSelect && (
                  <td style={{ ...TD, width: 36, textAlign: 'center', position: 'sticky', left: 0, zIndex: 1, background: stickyBg }}>
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={selected}
                      onChange={() => onToggleSelect!(row)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                )}
                {onOpenRow && (
                  <td style={{ ...TD, width: 32, textAlign: 'center', position: 'sticky', left: selectW, zIndex: 1, background: stickyBg }}>
                    <button
                      type="button"
                      title="Open record"
                      aria-label="Open record"
                      onClick={() => onOpenRow(row)}
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: '#9ca3af', display: 'inline-flex', alignItems: 'center', padding: 4,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1A7EE8'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; }}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                )}
                {columns.map((c, ci) => (
                  <td
                    key={c.key}
                    style={{
                      ...TD, width: c.width, textAlign: c.align ?? 'left',
                      ...(ci === 0 ? { position: 'sticky' as const, left: col0Left, zIndex: 1, background: stickyBg } : null),
                    }}
                  >
                    <EditableCell row={row} col={c} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default EditableGrid;
