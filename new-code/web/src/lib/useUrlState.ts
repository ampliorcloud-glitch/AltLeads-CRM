/**
 * useUrlState.ts — persist list/detail UI state in the URL query string.
 *
 * (ALT-186 foundation.) Keeping filters / sort / page / active-tab in the URL
 * means refresh, browser back/forward, and copy-paste sharing all restore the
 * exact worklist the user was looking at. Built on react-router-dom v7
 * `useSearchParams`, which works under BrowserRouter.
 *
 * React-rules safety:
 *   - We never call setState or mutate during render. Parsing is done in
 *     useMemo (pure) keyed on the raw param string; writes happen only inside
 *     event-handler setters via setSearchParams.
 *   - Every setter MERGES into the existing params (preserving unrelated keys)
 *     by using the functional updater form of setSearchParams, and writes with
 *     { replace: true } so we don't spam the history stack while the user fiddles
 *     with filters.
 *   - Writing a value equal to the default (or an empty value) REMOVES the param,
 *     keeping shared URLs short and clean.
 *
 * All exports are named. Only imports from 'react' and 'react-router-dom'.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  Generic escape hatch                                               */
/* ------------------------------------------------------------------ */

/**
 * Generic URL-backed state. Provide your own serialize/deserialize so you can
 * round-trip arbitrary shapes (objects, dates, JSON, etc.) through one param.
 *
 * A param is removed when its serialized form equals the serialized default or
 * is an empty string — keeping the URL clean for default views.
 */
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  serialize: (v: T) => string,
  deserialize: (s: string) => T,
): [T, (v: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Raw string (or null) for this key. Reading params during render is fine —
  // it's just reading current props/state, not writing.
  const raw = searchParams.get(key);

  // Memoize parsing against the raw value so identical renders return a stable
  // reference (important when the value is an object consumed by deps arrays).
  const value = useMemo<T>(() => {
    if (raw === null) return defaultValue;
    try {
      return deserialize(raw);
    } catch {
      return defaultValue;
    }
    // We intentionally key only on `raw`. `defaultValue` / `deserialize` are
    // expected to be stable for a given call site; re-parsing on their identity
    // churn would defeat the memo without changing the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (next: T) => {
      const nextStr = serialize(next);
      const defaultStr = serialize(defaultValue);
      setSearchParams(
        (prev) => {
          // Clone so we never mutate the live params object.
          const merged = new URLSearchParams(prev);
          if (nextStr === '' || nextStr === defaultStr) {
            merged.delete(key);
          } else {
            merged.set(key, nextStr);
          }
          return merged;
        },
        { replace: true },
      );
    },
    // serialize/defaultValue are stable per call site (see note above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, setSearchParams],
  );

  return [value, setValue];
}

/* ------------------------------------------------------------------ */
/*  String                                                            */
/* ------------------------------------------------------------------ */

const identity = (v: string): string => v;

/**
 * Single string query param (search box, active tab, sort key, …).
 * Writing the default value or '' removes the param.
 */
export function useUrlString(
  key: string,
  defaultValue = '',
): [string, (v: string) => void] {
  return useUrlState<string>(key, defaultValue, identity, identity);
}

/* ------------------------------------------------------------------ */
/*  Number                                                            */
/* ------------------------------------------------------------------ */

/**
 * Single numeric query param (page index, page size, …).
 * Writing the default value removes the param. Non-numeric/NaN values in the
 * URL fall back to the default.
 */
export function useUrlNumber(
  key: string,
  defaultValue: number,
): [number, (v: number) => void] {
  return useUrlState<number>(
    key,
    defaultValue,
    (v) => String(v),
    (s) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : defaultValue;
    },
  );
}

/* ------------------------------------------------------------------ */
/*  String array (multi-select filter facets)                         */
/* ------------------------------------------------------------------ */

/**
 * String-array query param, serialized as a comma-separated, URL-encoded list.
 * Empty array removes the param. Empty segments are dropped on read so a stray
 * trailing comma never produces a phantom '' facet.
 */
export function useUrlStringArray(
  key: string,
  defaultValue: string[] = [],
): [string[], (v: string[]) => void] {
  return useUrlState<string[]>(
    key,
    defaultValue,
    (v) => v.map(encodeURIComponent).join(','),
    (s) =>
      s
        .split(',')
        .filter((part) => part.length > 0)
        .map(decodeURIComponent),
  );
}
