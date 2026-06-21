import React from 'react';

/**
 * StageBadge — flat colored pill matching Figma design system.
 * No inset ring; simple bg + text color pairs.
 * Border-radius: 4px (var(--radius-badge)).
 */

const stageStyles: Record<string, { bg: string; text: string }> = {
  // Real stages
  'Warm':                              { bg: '#EFF6FF', text: '#1D4ED8' },
  'Hot Prospect':                      { bg: '#FEF2F2', text: '#DC2626' },
  'New Meeting':                       { bg: '#F3F4F6', text: '#6B7280' },
  'Meeting Scheduled':                 { bg: '#F5F3FF', text: '#7C3AED' },
  'Meeting Confirmed':                 { bg: '#F0FDF4', text: '#16A34A' },
  'Meeting Successful':                { bg: '#F0FDF4', text: '#16A34A' },
  'Meeting Follow-Up':                 { bg: '#FFFBEB', text: '#D97706' },
  'Meeting Cancelled':                 { bg: '#FEF2F2', text: '#DC2626' },
  'Meeting Droped By Amplior':         { bg: '#FEF2F2', text: '#DC2626' },
  'Meeting Posponed by Lead':          { bg: '#FFFBEB', text: '#D97706' },
  'Meeting postponed by Salesperson':  { bg: '#FFFBEB', text: '#D97706' },
  'Meeting postponed by lead':         { bg: '#FFFBEB', text: '#D97706' },
  'Meeting cancelled by Altleads':     { bg: '#FEF2F2', text: '#DC2626' },
  'Meeting cancelled by sales team':   { bg: '#FEF2F2', text: '#DC2626' },
  'Meeting cancelled by Lead':         { bg: '#FEF2F2', text: '#DC2626' },
  // Legacy / Figma-visible stages
  'New':           { bg: '#F3F4F6', text: '#6B7280' },
  'Cold':          { bg: '#F3F4F6', text: '#6B7280' },
  'Contacted':     { bg: '#EFF6FF', text: '#1D4ED8' },
  'Engaged':       { bg: '#F5F3FF', text: '#7C3AED' },
  'Proposal Sent': { bg: '#FFFBEB', text: '#D97706' },
  'Negotiation':   { bg: '#FFF7ED', text: '#EA580C' },
  'Closed Won':    { bg: '#F0FDF4', text: '#16A34A' },
  'Won':           { bg: '#16A34A', text: '#FFFFFF' },   // solid green (Figma "Won" button)
  'Closed Lost':   { bg: '#FEF2F2', text: '#DC2626' },
  'Meeting':       { bg: '#ECFEFF', text: '#0891B2' },
  'Request Approval': { bg: '#FFF7ED', text: '#EA580C' },
};

const defaultStyle = { bg: '#F3F4F6', text: '#6B7280' };

interface StageBadgeProps {
  stage: string;
}

export function StageBadge({ stage }: StageBadgeProps) {
  const s = stageStyles[stage] ?? defaultStyle;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 'var(--radius-badge, 4px)',
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
      }}
    >
      {stage || '—'}
    </span>
  );
}
