/**
 * EmptyState — reusable, actionable empty-state block.
 *
 * A small presentational component for "nothing to show" moments: optional icon,
 * a title, a friendly message, and an optional next-action button. Styled to match
 * the app's neutral table/card surfaces (zinc text, brand-blue primary action).
 *
 * Purely presentational — it renders what it's given and calls `action.onClick`.
 * Drop it inside an existing empty container (e.g. a table cell's content).
 *
 *   <EmptyState
 *     title="No leads match these filters"
 *     message="Try widening or clearing the filters above."
 *     action={{ label: 'Clear filters', onClick: clearFilters }}
 *   />
 */
import React from 'react';
import type { ReactNode } from 'react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Optional leading icon (e.g. a lucide-react <Icon size={22} />). */
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '28px 16px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#F4F4F5',
            color: '#9CA3AF',
            marginBottom: 2,
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{title}</div>
      {message && (
        <div style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 360 }}>{message}</div>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-brand)',
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--border-input, #D1D5DB)',
            borderRadius: 'var(--radius-btn, 6px)',
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
