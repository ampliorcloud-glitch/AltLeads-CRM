/**
 * ImportWizard — the in-app, FRONTEND-ONLY Import Wizard (ALT-399).
 *
 * Steps: (1) pick entity + upload file → (2) map columns → (3) preview +
 * validation summary (with an expandable skipped-row list, ALT-418) →
 * (4) finish, where the primary "Import" action is DELIBERATELY DISABLED.
 *
 * IMPORTANT: this component performs NO database writes and never imports
 * anything. It parses, maps, validates, previews and lets the admin download a
 * cleaned/mapped CSV + a skipped-rows CSV. The actual write is gated on the
 * server-side admin import endpoint, which is a later, decision-gated piece —
 * hence the disabled final button. Reuses the shared ModalShell + Toast.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, Download, ChevronDown, ChevronRight, Lock,
} from 'lucide-react';
import { ModalShell } from '../wishlist/AssignModal';
import { useToast } from '../ui/Toast';
import { parseImportFile, ImportParseError, type ParsedFile } from '../../lib/importParse';
import {
  ENTITY_CATALOGS, getEntityDef, autoMap, unmappedHeaders, IGNORE_FIELD,
  type ColumnMapping, type EntityDef,
} from '../../lib/importMapping';
import { validateRows, type ValidationResult, type MappedRow } from '../../lib/importValidate';

type Step = 1 | 2 | 3 | 4;

const PREVIEW_ROWS = 5;

/* ── small CSV download helper (mirrors ExportButton's CSV path) ─────────── */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
function sanitize(s: string): string {
  return FORMULA_LEAD.test(s) ? `'${s}` : s;
}
function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const matrix = [headers, ...rows];
  const csv = matrix
    .map((line) =>
      line
        .map((cell) => {
          const s = sanitize(String(cell ?? ''));
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── shared inline styles to match the app ──────────────────────────────── */
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
  padding: '7px 14px', height: 34, borderRadius: 6, border: 'none',
  background: 'var(--color-brand)', color: '#fff', cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
  padding: '7px 14px', height: 34, borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff', color: '#374151', cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  fontSize: 13, height: 32, borderRadius: 6, border: '1px solid #d4d4d8',
  background: '#fff', color: '#18181b', padding: '0 8px',
};

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [entityKey, setEntityKey] = useState<string>(ENTITY_CATALOGS[0].key);
  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [skippedOpen, setSkippedOpen] = useState(false);

  const entity: EntityDef = getEntityDef(entityKey) ?? ENTITY_CATALOGS[0];

  /* ── parse a chosen file ─────────────────────────────────────────────── */
  async function handleFile(file: File) {
    setParsing(true);
    try {
      const result = await parseImportFile(file);
      setParsed(result);
      setFileName(file.name);
      setMappings(autoMap(result.headers, entity));
      if (result.truncated) {
        toast.warning(
          `Loaded the first ${result.rows.length.toLocaleString()} of ${result.totalRows.toLocaleString()} rows (preview cap).`,
        );
      } else {
        toast.success(`Loaded ${result.totalRows.toLocaleString()} rows.`);
      }
    } catch (e) {
      const msg = e instanceof ImportParseError ? e.message : 'We could not read that file.';
      toast.error(msg);
      setParsed(null);
      setFileName('');
    } finally {
      setParsing(false);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = ''; // allow re-selecting the same file
  }

  // Re-run auto-map if the entity changes after a file is already loaded.
  function onEntityChange(nextKey: string) {
    setEntityKey(nextKey);
    if (parsed) {
      const def = getEntityDef(nextKey) ?? ENTITY_CATALOGS[0];
      setMappings(autoMap(parsed.headers, def));
    }
  }

  function setMapping(sourceHeader: string, targetField: string) {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.sourceHeader === sourceHeader) return { ...m, targetField };
        // Keep target fields unique: if another column already held this field, free it.
        if (targetField !== IGNORE_FIELD && m.targetField === targetField) {
          return { ...m, targetField: IGNORE_FIELD };
        }
        return m;
      }),
    );
  }

  /* ── validation (memoised) ───────────────────────────────────────────── */
  const validation: ValidationResult | null = useMemo(() => {
    if (!parsed) return null;
    return validateRows(parsed.rows, mappings, entity);
  }, [parsed, mappings, entity]);

  const unmapped = useMemo(() => unmappedHeaders(mappings), [mappings]);

  /* ── downloads ───────────────────────────────────────────────────────── */
  function downloadCleaned() {
    if (!validation) return;
    const keys = validation.mappedFieldKeys;
    const headers = keys.map((k) => entity.fields.find((f) => f.key === k)?.label ?? k);
    const rows = validation.validRows.map((r: MappedRow) => keys.map((k) => r[k] ?? ''));
    downloadCsv(`${entity.key}-cleaned.csv`, headers, rows);
    toast.success(`Downloaded ${rows.length.toLocaleString()} cleaned rows.`);
  }
  function downloadSkipped() {
    if (!validation) return;
    const keys = validation.mappedFieldKeys;
    const headers = ['Row', ...keys.map((k) => entity.fields.find((f) => f.key === k)?.label ?? k), 'Why skipped'];
    const rows = validation.skipped.map((s) => [
      String(s.rowIndex + 2), // +1 for 0-index, +1 for the header row in the source file
      ...keys.map((k) => s.values[k] ?? ''),
      s.errors.join('; '),
    ]);
    downloadCsv(`${entity.key}-skipped.csv`, headers, rows);
    toast.success(`Downloaded ${rows.length.toLocaleString()} skipped rows.`);
  }

  /* ── per-step gating ─────────────────────────────────────────────────── */
  const canLeaveStep1 = parsed != null && !parsing;
  const canLeaveStep2 = (validation?.mappedFieldKeys.length ?? 0) > 0;

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <ModalShell
      title="Import data"
      icon={<Upload size={16} />}
      onClose={onClose}
      width={680}
    >
      <Stepper step={step} />

      {/* STEP 1 — entity + file */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-zinc-600 font-medium" style={{ fontSize: 12 }}>
              What are you importing?
            </label>
            <select
              value={entityKey}
              onChange={(e) => onEntityChange(e.target.value)}
              style={{ ...selectStyle, width: 220 }}
            >
              {ENTITY_CATALOGS.map((e) => (
                <option key={e.key} value={e.key}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-zinc-600 font-medium" style={{ fontSize: 12 }}>
              Upload a CSV or Excel file
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              style={{
                border: '1.5px dashed #d4d4d8', borderRadius: 8, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', background: '#fafafa',
              }}
            >
              <FileSpreadsheet size={26} style={{ color: '#9ca3af', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                {parsing ? 'Reading file…' : 'Click to choose, or drag a file here'}
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                .csv, .xlsx — first sheet, first row is the header
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onFileInput}
                style={{ display: 'none' }}
              />
            </div>
            {parsed && (
              <p style={{ fontSize: 12, color: '#15803d', marginTop: 8 }}>
                <CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                {fileName} — {parsed.headers.length} columns, {parsed.totalRows.toLocaleString()} rows
                {parsed.truncated && ' (capped to preview)'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP 2 — mapping */}
      {step === 2 && parsed && (
        <div className="space-y-3">
          <p className="text-zinc-500" style={{ fontSize: 12 }}>
            Match each column in your file to a {entity.label.toLowerCase().replace(/s$/, '')} field.
            Auto-matched where we could; choose <em>Don't import</em> to skip a column.
          </p>
          {unmapped.length > 0 && (
            <div style={{ fontSize: 12, color: '#b45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '7px 10px' }}>
              <AlertTriangle size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              {unmapped.length} unmapped column{unmapped.length > 1 ? 's' : ''} will be ignored: {unmapped.join(', ')}
            </div>
          )}
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Your column</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Maps to</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.sourceHeader}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#18181b', fontWeight: 500 }}>
                      {m.sourceHeader}
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                        e.g. {parsed.rows[0]?.[m.sourceHeader] || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
                      <select
                        value={m.targetField}
                        onChange={(e) => setMapping(m.sourceHeader, e.target.value)}
                        style={{ ...selectStyle, width: '100%' }}
                      >
                        <option value={IGNORE_FIELD}>— Don't import —</option>
                        {entity.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 3 — preview + validation summary */}
      {step === 3 && parsed && validation && (
        <div className="space-y-3">
          <div style={{ display: 'flex', gap: 10 }}>
            <SummaryPill color="#15803d" bg="#F0FDF4" border="#BBF7D0"
              label="ready to import" value={validation.validRows.length} />
            <SummaryPill color="#b45309" bg="#FFFBEB" border="#FDE68A"
              label="will be skipped" value={validation.skipped.length} />
          </div>

          <div>
            <p className="text-zinc-500" style={{ fontSize: 12, marginBottom: 4 }}>
              Preview — first {Math.min(PREVIEW_ROWS, validation.validRows.length)} mapped row(s)
            </p>
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {validation.mappedFieldKeys.map((k) => (
                      <th key={k} style={{ textAlign: 'left', padding: '6px 9px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>
                        {entity.fields.find((f) => f.key === k)?.label ?? k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validation.validRows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <tr key={i}>
                      {validation.mappedFieldKeys.map((k) => (
                        <td key={k} style={{ padding: '5px 9px', color: '#27272a', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>
                          {r[k] || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {validation.validRows.length === 0 && (
                    <tr><td style={{ padding: '10px', color: '#9ca3af' }}>No valid rows with the current mapping.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expandable skipped-row list (ALT-418) */}
          {validation.skipped.length > 0 && (
            <div style={{ border: '1px solid #FDE68A', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setSkippedOpen((o) => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '8px 10px', background: '#FFFBEB', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: '#b45309',
                }}
              >
                {skippedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {validation.skipped.length} skipped row{validation.skipped.length > 1 ? 's' : ''} — see why
              </button>
              {skippedOpen && (
                <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fff' }}>
                  {validation.skipped.slice(0, 200).map((s) => (
                    <div key={s.rowIndex} style={{ padding: '6px 10px', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#52525b' }}>Row {s.rowIndex + 2}:</span>{' '}
                      <span style={{ color: '#b91c1c' }}>{s.errors.join('; ')}</span>
                    </div>
                  ))}
                  {validation.skipped.length > 200 && (
                    <div style={{ padding: '6px 10px', fontSize: 11, color: '#9ca3af' }}>
                      …and {validation.skipped.length - 200} more. Download the full skipped list on the next step.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — finish (DISABLED import) */}
      {step === 4 && validation && (
        <div className="space-y-4">
          <div style={{ display: 'flex', gap: 10 }}>
            <SummaryPill color="#15803d" bg="#F0FDF4" border="#BBF7D0"
              label="ready to import" value={validation.validRows.length} />
            <SummaryPill color="#b45309" bg="#FFFBEB" border="#FDE68A"
              label="will be skipped" value={validation.skipped.length} />
          </div>

          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> Writing is not enabled yet
            </p>
            <p style={{ fontSize: 12, color: '#1e40af', marginTop: 4, lineHeight: 1.5 }}>
              This wizard validates and previews your file, but does not yet save records.
              The actual import is pending the admin import endpoint (server-side, decision-gated).
              For now you can download the cleaned, mapped data and the skipped rows below.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={ghostBtn} onClick={downloadCleaned} disabled={validation.validRows.length === 0}>
              <Download size={14} /> Download cleaned data ({validation.validRows.length})
            </button>
            <button style={ghostBtn} onClick={downloadSkipped} disabled={validation.skipped.length === 0}>
              <Download size={14} /> Download skipped rows ({validation.skipped.length})
            </button>
          </div>
        </div>
      )}

      {/* ── footer nav ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-100">
        <div>
          {step > 1 && (
            <button style={ghostBtn} onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button style={ghostBtn} onClick={onClose}>Cancel</button>
          {step < 4 ? (
            <button
              style={{ ...primaryBtn, opacity: (step === 1 ? !canLeaveStep1 : step === 2 ? !canLeaveStep2 : false) ? 0.5 : 1, cursor: (step === 1 ? !canLeaveStep1 : step === 2 ? !canLeaveStep2 : false) ? 'not-allowed' : 'pointer' }}
              disabled={step === 1 ? !canLeaveStep1 : step === 2 ? !canLeaveStep2 : false}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            // DELIBERATELY DISABLED — server import endpoint is a later piece.
            <button
              style={{ ...primaryBtn, opacity: 0.5, cursor: 'not-allowed' }}
              disabled
              title="Server import is coming soon — writing is pending the admin import endpoint."
            >
              <Lock size={13} /> Import (server import coming soon)
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ── sub-components ──────────────────────────────────────────────────────── */

function Stepper({ step }: { step: Step }) {
  const labels = ['Upload', 'Map columns', 'Preview', 'Finish'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 20, height: 20, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'var(--color-brand)' : done ? '#BBF7D0' : '#e5e7eb',
                  color: active ? '#fff' : done ? '#15803d' : '#9ca3af',
                }}
              >
                {done ? '✓' : n}
              </span>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#18181b' : '#9ca3af' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SummaryPill({ label, value, color, bg, border }: { label: string; value: number; color: string; bg: string; border: string }) {
  return (
    <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color }}>{label}</div>
    </div>
  );
}
