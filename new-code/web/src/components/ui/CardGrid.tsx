/**
 * CardGrid — generic responsive grid of clickable record cards, the "Grid" view
 * counterpart to the list-page tables. Reused on Leads / Companies / Contacts /
 * Meetings via the ViewSwitcher.
 *
 * Each page maps its filtered + paginated rows into the grid and supplies a
 * `renderCard` describing how each row becomes a card. Card click does the SAME
 * thing as a row click on that page (navigate to detail, or open a preview).
 *
 * Two ways to use it:
 *  1) Pass `renderCard` for full control over a card's body.
 *  2) Pass a field-config card via the exported `CardShell` helper for the common
 *     "avatar + name + a few fields + a status/owner chip" layout.
 *
 * Props:
 *   rows        the (already filtered + paginated) rows to render
 *   getKey      stable React key for a row
 *   renderCard  render a row as card content (wrap in <CardShell> for the
 *               standard look, or return any node)
 *   onCardClick optional click handler (page wires it to navigate / preview)
 *   columns     optional responsive column cap (default 3)
 *   emptyLabel  optional message when there are no rows
 */

import React from 'react';
import { StatusBadge } from './StatusBadge';

/* ------------------------------------------------------------------ */
/*  Shared avatar (initials in a deterministic tint) — matches lists   */
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

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function tintOf(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export function CardAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const tint = name ? tintOf(name) : { bg: '#F3F4F6', text: '#9CA3AF' };
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        background: tint.bg,
        color: tint.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {name ? initialsOf(name) : '—'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  CardShell — the standard card layout (avatar + name + fields + chip)*/
/* ------------------------------------------------------------------ */

export interface CardField {
  label: string;
  value: React.ReactNode;
}

interface CardShellProps {
  /** Primary name (drives avatar + heading). */
  name: string;
  /** Optional secondary line under the name (e.g. company, designation). */
  subtitle?: React.ReactNode;
  /** 3–5 key fields. Falsy values render an em-dash. */
  fields?: CardField[];
  /** Optional status/owner chip — pass a string to render a StatusBadge, or a node. */
  chip?: React.ReactNode;
  /** Small tag rendered next to the name (e.g. a DEMO badge). */
  tag?: React.ReactNode;
}

/** Standard card body — wrap in this from a page's renderCard for a uniform look. */
export function CardShell({ name, subtitle, fields, chip, tag }: CardShellProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <CardAvatar name={name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              title={name || undefined}
              style={{
                fontWeight: 600,
                color: '#18181b',
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name || <span style={{ color: '#d1d5db' }}>—</span>}
            </span>
            {tag}
          </div>
          {subtitle != null && subtitle !== '' && (
            <div
              style={{
                fontSize: 12,
                color: '#9ca3af',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {typeof chip === 'string' ? <StatusBadge value={chip} /> : chip}
      </div>

      {fields && fields.length > 0 && (
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 12px',
          }}
        >
          {fields.map((f, i) => (
            <div key={`${f.label}-${i}`} style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                  marginBottom: 1,
                }}
              >
                {f.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-gray-700)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={typeof f.value === 'string' ? f.value : undefined}
              >
                {f.value === '' || f.value == null
                  ? <span style={{ color: '#d1d5db' }}>—</span>
                  : f.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  CardGrid                                                            */
/* ------------------------------------------------------------------ */

interface CardGridProps<Row> {
  rows: Row[];
  getKey: (row: Row) => React.Key;
  renderCard: (row: Row) => React.ReactNode;
  onCardClick?: (row: Row) => void;
  /** Max columns at the widest breakpoint (default 3). */
  columns?: 2 | 3 | 4;
  emptyLabel?: string;
}

export function CardGrid<Row>({
  rows,
  getKey,
  renderCard,
  onCardClick,
  columns = 3,
  emptyLabel = 'Nothing to show.',
}: CardGridProps<Row>) {
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

  // Responsive 1 → 2 → up-to-`columns` columns via auto-fill min track sizing.
  const minCol = columns >= 4 ? 240 : columns === 3 ? 280 : 320;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        gap: 12,
      }}
    >
      {rows.map((row) => {
        const clickable = !!onCardClick;
        return (
          <div
            key={getKey(row)}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onCardClick!(row) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCardClick!(row);
                    }
                  }
                : undefined
            }
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: 14,
              cursor: clickable ? 'pointer' : 'default',
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#1A7EE8';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {renderCard(row)}
          </div>
        );
      })}
    </div>
  );
}

export default CardGrid;
