/**
 * useUnsavedChanges — protect in-progress edits from accidental loss (UX-AUDIT Top-30 #13).
 *
 * Three protections, all driven by a `dirty` flag the caller computes:
 *   1. CACHE   — while dirty, the draft is written to localStorage (keyed by
 *                `cacheKey`). If the user navigates away / refreshes / crashes and
 *                comes back to the same record, `cachedDraft` returns what they had
 *                so the page can offer to restore it.
 *   2. WARN    — while dirty, a `beforeunload` handler makes the browser warn before
 *                a tab close / refresh / hard navigation.
 *   3. CLEAN-UP — when no longer dirty (saved or discarded) the cache entry is removed,
 *                and callers should call clearCache() on a successful save.
 *
 * Note on in-app navigation: the app uses <BrowserRouter> (not a data router), so a
 * router-level useBlocker isn't available. Cache+restore is the safety net for in-app
 * navigation, and beforeunload covers leaving the site; pair with an explicit
 * "Discard changes?" confirm on Cancel/Back buttons.
 */
import { useEffect, useRef, useState } from 'react';

const PREFIX = 'altleads:draft:';

interface Options<T> {
  /** True when the draft differs from the last-saved/baseline value. */
  dirty: boolean;
  /** The current editable state to cache (must be JSON-serialisable). */
  draft: T;
  /** Stable per-record key, e.g. `lead:new` or `contact:123`. null disables caching. */
  cacheKey: string | null;
  /** Master switch (default true). */
  enabled?: boolean;
}

interface Result<T> {
  /** A draft recovered from a previous session for this key (null if none). */
  cachedDraft: T | null;
  /** Remove the cache entry and forget the recovered draft (call after a successful save). */
  clearCache: () => void;
  /** Forget the recovered draft without touching what's currently cached (e.g. user declined restore). */
  dismissCached: () => void;
}

export function useUnsavedChanges<T>({ dirty, draft, cacheKey, enabled = true }: Options<T>): Result<T> {
  const key = cacheKey ? PREFIX + cacheKey : null;
  const [cachedDraft, setCachedDraft] = useState<T | null>(null);
  const loadedRef = useRef(false);

  // Load any previously-cached draft once per key.
  useEffect(() => {
    if (!key || !enabled || loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setCachedDraft(JSON.parse(raw) as T);
    } catch {
      /* corrupt/unavailable storage — ignore */
    }
  }, [key, enabled]);

  // Persist while dirty; remove when clean.
  useEffect(() => {
    if (!key || !enabled) return;
    try {
      if (dirty) localStorage.setItem(key, JSON.stringify(draft));
      else localStorage.removeItem(key);
    } catch {
      /* quota/unavailable — ignore */
    }
  }, [key, enabled, dirty, draft]);

  // Browser-level warning on close/refresh/hard-nav while dirty.
  useEffect(() => {
    if (!enabled || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, dirty]);

  return {
    cachedDraft,
    clearCache: () => {
      if (key) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
      setCachedDraft(null);
    },
    dismissCached: () => setCachedDraft(null),
  };
}
