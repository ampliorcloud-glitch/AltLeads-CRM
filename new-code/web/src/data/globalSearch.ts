/**
 * globalSearch.ts — data layer for the Cmd-K command palette (ALT-188 / ALT-213).
 *
 * Rather than issue new (untested) cross-table queries, this reuses the existing,
 * known-good list fetchers and builds a single in-memory search index the first
 * time the palette opens. The index is cached at module scope so re-opening the
 * palette on any page is instant; call loadSearchIndex(true) to force a refresh.
 */
import { fetchLeadsFallback } from './realLeads';
import { fetchCompanies } from './companies';
import { fetchAllContacts } from './contacts';

export type SearchType = 'lead' | 'company' | 'contact';

export interface SearchItem {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
  /** Lowercased blob of all searchable text for this record. */
  haystack: string;
}

let cache: SearchItem[] | null = null;
let inflight: Promise<SearchItem[]> | null = null;

function join(parts: (string | null | undefined)[], sep = ' · '): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

/** Build (or return cached) the searchable index across leads, companies, contacts. */
export async function loadSearchIndex(force = false): Promise<SearchItem[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const [leadsRes, compRes, contactsRes] = await Promise.all([
      fetchLeadsFallback(),
      fetchCompanies(),
      fetchAllContacts(),
    ]);

    const items: SearchItem[] = [];

    for (const l of leadsRes.leads ?? []) {
      const title = l.company || l.contactName || l.leadNumber || 'Lead';
      items.push({
        type: 'lead',
        id: l.id,
        title,
        subtitle: join([l.leadNumber, l.contactName, l.city]),
        route: `/leads/${l.id}`,
        haystack: join(
          [l.company, l.contactName, l.leadNumber, l.contactPhone, l.contactEmail, l.city],
          ' ',
        ).toLowerCase(),
      });
    }

    for (const c of compRes.companies ?? []) {
      items.push({
        type: 'company',
        id: c.id,
        title: c.name || 'Company',
        subtitle: join([c.city, c.industry]),
        route: `/companies/${c.id}`,
        haystack: join([c.name, c.domainClean, c.city, c.industry], ' ').toLowerCase(),
      });
    }

    for (const ct of contactsRes.contacts ?? []) {
      items.push({
        type: 'contact',
        id: String(ct.contact_id),
        title: ct.full_name || 'Contact',
        subtitle: join([ct.company_name, ct.city_name, ct.mobile_no]),
        route: `/contacts/${ct.contact_id}`,
        haystack: join(
          [ct.full_name, ct.email, ct.mobile_no, ct.company_name, ct.city_name],
          ' ',
        ).toLowerCase(),
      });
    }

    cache = items;
    inflight = null;
    return items;
  })();

  return inflight;
}

/** Rank index items against a query. Every whitespace-separated term must match. */
export function searchIndex(items: SearchItem[], termRaw: string, limit = 24): SearchItem[] {
  const term = termRaw.trim().toLowerCase();
  if (!term) return [];
  const terms = term.split(/\s+/);

  const scored: { item: SearchItem; score: number }[] = [];
  for (const it of items) {
    if (!terms.every((t) => it.haystack.includes(t))) continue;
    const title = it.title.toLowerCase();
    let score = 0;
    if (title.startsWith(term)) score += 100;
    else if (title.includes(term)) score += 50;
    if (it.haystack.startsWith(term)) score += 10;
    scored.push({ item: it, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, limit).map((s) => s.item);
}

/** Clear the cached index (e.g. after a bulk import). */
export function clearSearchIndex(): void {
  cache = null;
  inflight = null;
}
