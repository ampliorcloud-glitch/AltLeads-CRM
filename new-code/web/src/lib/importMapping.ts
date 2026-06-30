/**
 * importMapping — auto-match a parsed file's source columns to a target
 * entity's fields for the in-app Import Wizard (ALT-399). Pure data, no writes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER FIELD CATALOG
 * The per-entity field lists below are an OBVIOUS, hand-written placeholder so
 * the wizard is usable end-to-end today. The REAL, authoritative field metadata
 * (full column set, types, which fields are writable, the match key, lookups for
 * project/owner, etc.) will come later from the server-side import endpoint /
 * schema introspection — once that exists, swap ENTITY_CATALOGS for the real
 * catalog and the rest of the wizard keeps working unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** The sentinel target meaning "leave this source column out of the import". */
export const IGNORE_FIELD = '__ignore__';

export type ValidationKind = 'email' | 'phone' | 'url' | 'text';

export interface TargetField {
  /** Stable key written to the import payload (placeholder names for now). */
  key: string;
  /** Human label shown in the mapping dropdown. */
  label: string;
  /** Whether at least one of the entity's `required` fields must be present. */
  required?: boolean;
  /** Drives per-cell validation in importValidate. */
  validate?: ValidationKind;
  /** Extra header spellings that should auto-match to this field. */
  aliases?: string[];
}

export interface EntityDef {
  key: string;
  label: string;
  fields: TargetField[];
}

/** PLACEHOLDER catalogs — see file header. Keep fields obvious + easy to extend. */
export const ENTITY_CATALOGS: EntityDef[] = [
  {
    key: 'companies',
    label: 'Companies',
    fields: [
      { key: 'name', label: 'Company name', required: true, aliases: ['company', 'company name', 'organisation', 'organization', 'account'] },
      { key: 'website', label: 'Website', validate: 'url', aliases: ['url', 'site', 'web'] },
      { key: 'industry', label: 'Industry', aliases: ['sector', 'vertical'] },
      { key: 'phone', label: 'Phone', validate: 'phone', aliases: ['telephone', 'contact number', 'mobile'] },
      { key: 'email', label: 'Email', validate: 'email', aliases: ['email address'] },
      { key: 'city', label: 'City', aliases: ['town'] },
      { key: 'state', label: 'State', aliases: ['region', 'province'] },
      { key: 'country', label: 'Country' },
      { key: 'employee_count', label: 'Employees', aliases: ['headcount', 'size', 'employee count'] },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    fields: [
      { key: 'full_name', label: 'Full name', required: true, aliases: ['name', 'contact', 'contact name', 'person'] },
      { key: 'first_name', label: 'First name', aliases: ['firstname', 'given name'] },
      { key: 'last_name', label: 'Last name', aliases: ['lastname', 'surname', 'family name'] },
      { key: 'email', label: 'Email', validate: 'email', aliases: ['email address', 'e-mail'] },
      { key: 'phone', label: 'Phone', validate: 'phone', aliases: ['mobile', 'telephone', 'contact number'] },
      { key: 'company', label: 'Company', aliases: ['company name', 'organisation', 'organization', 'account'] },
      { key: 'designation', label: 'Designation', aliases: ['title', 'job title', 'role', 'position'] },
      { key: 'linkedin_url', label: 'LinkedIn URL', validate: 'url', aliases: ['linkedin', 'linkedin profile'] },
      { key: 'city', label: 'City', aliases: ['town', 'location'] },
    ],
  },
  {
    key: 'leads',
    label: 'Leads',
    fields: [
      { key: 'company', label: 'Company', required: true, aliases: ['company name', 'organisation', 'organization', 'account'] },
      { key: 'contact_name', label: 'Contact name', aliases: ['name', 'contact', 'person', 'prospect'] },
      { key: 'email', label: 'Email', validate: 'email', aliases: ['email address', 'e-mail'] },
      { key: 'phone', label: 'Phone', validate: 'phone', aliases: ['mobile', 'telephone', 'contact number'] },
      { key: 'designation', label: 'Designation', aliases: ['title', 'job title', 'role'] },
      { key: 'status', label: 'Status', aliases: ['stage', 'lead status'] },
      { key: 'source', label: 'Source', aliases: ['lead source', 'channel'] },
      { key: 'city', label: 'City', aliases: ['town', 'location'] },
      { key: 'notes', label: 'Notes', aliases: ['remark', 'remarks', 'comment', 'comments'] },
      // ALT-470 — UTM / lead attribution. Maps onto lead_master.utm_* (staged migration).
      { key: 'utm_source', label: 'UTM Source', aliases: ['utm source', 'utm_source', 'campaign source'] },
      { key: 'utm_medium', label: 'UTM Medium', aliases: ['utm medium', 'utm_medium', 'campaign medium'] },
      { key: 'utm_campaign', label: 'UTM Campaign', aliases: ['utm campaign', 'utm_campaign', 'campaign', 'campaign name'] },
    ],
  },
];

export function getEntityDef(entityKey: string): EntityDef | undefined {
  return ENTITY_CATALOGS.find((e) => e.key === entityKey);
}

export interface ColumnMapping {
  sourceHeader: string;
  /** A target field key, or IGNORE_FIELD to skip the column. */
  targetField: string;
}

/** Normalise a header/field name for fuzzy comparison (case/space/punct-insensitive). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Auto-match source headers to target fields. A header matches a field when its
 * normalised form equals the field's normalised key, label, or any alias. Each
 * target field is claimed at most once (first matching header wins); unmatched
 * headers default to IGNORE_FIELD.
 */
export function autoMap(headers: string[], entity: EntityDef): ColumnMapping[] {
  // Build a normalised lookup: candidate string → field key.
  const lookup = new Map<string, string>();
  for (const f of entity.fields) {
    const candidates = [f.key, f.label, ...(f.aliases ?? [])];
    for (const c of candidates) {
      const n = norm(c);
      if (n && !lookup.has(n)) lookup.set(n, f.key);
    }
  }

  const claimed = new Set<string>();
  return headers.map((h) => {
    const fieldKey = lookup.get(norm(h));
    if (fieldKey && !claimed.has(fieldKey)) {
      claimed.add(fieldKey);
      return { sourceHeader: h, targetField: fieldKey };
    }
    return { sourceHeader: h, targetField: IGNORE_FIELD };
  });
}

/** Headers that ended up unmapped (target = IGNORE_FIELD) — surfaced in the UI. */
export function unmappedHeaders(mappings: ColumnMapping[]): string[] {
  return mappings.filter((m) => m.targetField === IGNORE_FIELD).map((m) => m.sourceHeader);
}
