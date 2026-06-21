/**
 * ProjectContext — the global "project scope" foundation (owner ask #8).
 *
 * One project selector lives next to the global search; the chosen project
 * pre-filters records across the app. `selectedProjectId === null` means
 * "All projects" (no project filter).
 *
 * Persistence model (localStorage, per-user is implicit — these are device-local
 * preferences keyed only by their localStorage key, matching the app's other
 * device-local prefs):
 *   - 'altleads:selected-project'  → the live selection (sticky across reloads).
 *   - 'altleads:default-project'   → the user's preferred default, set in Settings.
 *
 * Seeding rule on first mount: use the last live selection if present, otherwise
 * the user's default, otherwise "All projects" (null). Once a project list is
 * loaded, a stored id that the user can no longer access is dropped back to "All".
 *
 * This module is additive and read-only against the DB (it only reads the user's
 * accessible projects); it performs no writes.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchMyProjects } from '../data/admin';

export const SELECTED_PROJECT_KEY = 'altleads:selected-project';
export const DEFAULT_PROJECT_KEY = 'altleads:default-project';

export interface ScopedProject {
  project_id: number;
  project_name: string;
}

interface ProjectContextType {
  /** Projects the current user may scope to (excludes the "All projects" pseudo-option). */
  projects: ScopedProject[];
  /** Currently scoped project id; null = "All projects". */
  selectedProjectId: number | null;
  /** Set (and persist) the current scope. Pass null for "All projects". */
  setSelectedProjectId: (id: number | null) => void;
  /** True while the accessible-project list is still loading. */
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

/** Read a numeric project id from a localStorage key; null if absent/invalid/"all". */
function readStoredProjectId(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '' || raw === 'all' || raw === 'null') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Persist (or clear) a project id under a localStorage key. null → "all". */
function writeStoredProjectId(key: string, id: number | null): void {
  try {
    if (id == null) localStorage.setItem(key, 'all');
    else localStorage.setItem(key, String(id));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** The initial scope before the project list resolves: last selection, else default, else null. */
function seedInitialSelection(): number | null {
  const last = readStoredProjectId(SELECTED_PROJECT_KEY);
  if (last != null) return last;
  return readStoredProjectId(DEFAULT_PROJECT_KEY);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const userId = profile?.user_id ?? null;

  const [projects, setProjects] = useState<ScopedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(() =>
    seedInitialSelection(),
  );

  // Load the user's accessible projects once auth has resolved.
  useEffect(() => {
    let cancelled = false;

    // Wait for auth to settle so isAdmin / user_id are accurate.
    if (authLoading) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    // Signed out (no profile): no scope, clear list, fall back to "All".
    if (userId == null && !isAdmin) {
      setProjects([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    fetchMyProjects(userId, isAdmin)
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        // Drop a stored selection the user can no longer access → "All projects".
        setSelectedProjectIdState((prev) => {
          if (prev != null && !list.some((p) => p.project_id === prev)) {
            writeStoredProjectId(SELECTED_PROJECT_KEY, null);
            return null;
          }
          return prev;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin, authLoading]);

  // Selecting a project persists immediately.
  const setSelectedProjectId = (id: number | null) => {
    setSelectedProjectIdState(id);
    writeStoredProjectId(SELECTED_PROJECT_KEY, id);
  };

  const value = useMemo<ProjectContextType>(
    () => ({ projects, selectedProjectId, setSelectedProjectId, loading }),
    [projects, selectedProjectId, loading],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * Access the global project scope. Safe to call outside a ProjectProvider — it
 * returns an inert "All projects" scope so non-CRM trees (e.g. the client portal,
 * login pages) don't crash if they read it indirectly.
 */
export function useProjectScope(): ProjectContextType {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    return {
      projects: [],
      selectedProjectId: null,
      setSelectedProjectId: () => {},
      loading: false,
    };
  }
  return ctx;
}
