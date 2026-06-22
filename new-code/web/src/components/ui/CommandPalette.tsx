/**
 * CommandPalette — global Cmd-K / Ctrl-K search (ALT-188 / ALT-213).
 *
 * Press Cmd/Ctrl-K (or fire the `altleads:open-search` window event from a search
 * button) to open a search-anything box across leads, companies and contacts,
 * with full keyboard navigation (↑/↓ to move, Enter to open, Esc to close) and
 * deep-link navigation. Mounted once at the app root; only active for a
 * logged-in internal user. The search index is built on first open and cached.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Target, Building2, User, CheckSquare, CalendarDays, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  loadSearchIndex,
  searchIndex,
  type SearchItem,
  type SearchType,
} from '../../data/globalSearch';

const TYPE_META: Record<SearchType, { label: string; group: string; Icon: typeof Target; color: string }> = {
  lead: { label: 'Lead', group: 'Leads', Icon: Target, color: '#1A7EE8' },
  company: { label: 'Company', group: 'Companies', Icon: Building2, color: '#7C3AED' },
  contact: { label: 'Contact', group: 'Contacts', Icon: User, color: '#0E9F6E' },
  task: { label: 'Task', group: 'Tasks', Icon: CheckSquare, color: '#D97706' },
  meeting: { label: 'Meeting', group: 'Meetings', Icon: CalendarDays, color: '#0891B2' },
};

/** Fixed display order of result groups (Zoho/HubSpot-style sections). */
const GROUP_ORDER: SearchType[] = ['lead', 'company', 'contact', 'task', 'meeting'];

export function CommandPalette() {
  const { session, isInternalUser } = useAuth();
  const navigate = useNavigate();
  const enabled = Boolean(session && isInternalUser);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Open via Cmd/Ctrl-K or the global search-button event; close on Escape.
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('altleads:open-search', onOpenEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('altleads:open-search', onOpenEvent);
    };
  }, [enabled]);

  // Load (and cache) the index the first time the palette opens.
  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    setLoading(true);
    loadSearchIndex().then((idx) => {
      if (!cancelled) {
        setItems(idx);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, items]);

  // Focus the input whenever it opens.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    // Reset transient state on close.
    setQuery('');
    setSelected(0);
  }, [open]);

  const results = useMemo(
    () => (items ? searchIndex(items, query) : []),
    [items, query],
  );

  // Group the ranked results by type into Zoho/HubSpot-style sections, in a fixed
  // order. `flat` is the display-order list the keyboard navigates (so ↑/↓ walks
  // groups top-to-bottom and Enter opens the highlighted row).
  const grouped = useMemo(() => {
    const m = new Map<SearchType, SearchItem[]>();
    for (const it of results) {
      const arr = m.get(it.type) ?? [];
      arr.push(it);
      m.set(it.type, arr);
    }
    return GROUP_ORDER.filter((t) => m.has(t)).map((t) => ({ type: t, items: m.get(t)! }));
  }, [results]);
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Keep the selection in range as results change.
  useEffect(() => { setSelected(0); }, [query]);

  const close = useCallback(() => setOpen(false), []);

  const go = useCallback(
    (item: SearchItem | undefined) => {
      if (!item) return;
      setOpen(false);
      navigate(item.route);
    },
    [navigate],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Scroll the active row into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  if (!enabled || !open) return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 11000,
        background: 'rgba(17,24,39,0.40)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '12vh 16px 16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        style={{
          width: '100%', maxWidth: 560, background: '#fff',
          borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <Search size={17} className="text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search leads, companies, contacts, tasks, meetings…"
            aria-label="Search leads, companies, contacts, tasks and meetings"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14,
              color: 'var(--color-gray-900)', background: 'transparent',
            }}
          />
          <kbd style={{
            fontSize: 10, color: 'var(--color-gray-400)', border: '1px solid var(--border-color)',
            borderRadius: 4, padding: '1px 5px', background: 'var(--color-gray-50)',
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-400" style={{ fontSize: 13, padding: '32px 16px' }}>
              <Loader2 size={15} className="animate-spin" /> Loading search…
            </div>
          ) : query.trim() === '' ? (
            <div className="text-zinc-400" style={{ fontSize: 13, padding: '28px 18px', textAlign: 'center' }}>
              Type to search across leads, companies, contacts, tasks and meetings.
            </div>
          ) : flat.length === 0 ? (
            <div className="text-zinc-400" style={{ fontSize: 13, padding: '28px 18px', textAlign: 'center' }}>
              No matches for “{query.trim()}”.
            </div>
          ) : (
            (() => {
              // Running index across groups so keyboard selection maps to display order.
              let idx = -1;
              return grouped.map((g) => (
                <div key={g.type}>
                  {/* Group header (Zoho/HubSpot-style section) */}
                  <div style={{
                    padding: '10px 16px 4px', fontSize: 11, fontWeight: 600,
                    color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {TYPE_META[g.type].group}
                    <span style={{ marginLeft: 6, color: 'var(--color-gray-300)', fontWeight: 500 }}>
                      {g.items.length}
                    </span>
                  </div>
                  {g.items.map((item) => {
                    idx += 1;
                    const i = idx;
                    const meta = TYPE_META[item.type];
                    const active = i === selected;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        data-idx={i}
                        role="button"
                        tabIndex={-1}
                        aria-label={`${meta.label}: ${item.title}`}
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => go(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 16px', cursor: 'pointer',
                          background: active ? 'var(--color-brand-light)' : 'transparent',
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 28, height: 28, borderRadius: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: '#F4F4F5',
                        }}>
                          <meta.Icon size={15} style={{ color: meta.color }} />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-gray-900)' }}>
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div className="truncate" style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--color-gray-400)', flexShrink: 0 }}>{meta.label}</span>
                        {active && <CornerDownLeft size={13} className="text-zinc-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px',
          borderTop: '1px solid #F3F4F6', background: 'var(--color-gray-50)',
          fontSize: 11, color: 'var(--color-gray-400)',
        }}>
          <span>↑ ↓ to navigate</span>
          <span>↵ to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommandPalette;
