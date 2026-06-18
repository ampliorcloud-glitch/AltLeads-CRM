import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  user_id: number | null;
  email: string;
  full_name: string;
  role: string;
}

/** Role names that grant access to the Sales Portal (/sales/*). */
const SALES_ROLE_NAMES = ['SALES_HEAD', 'SALES_PERSON'];
/** Role names that grant access to the internal CRM app. */
const INTERNAL_ROLE_NAMES = ['ADMIN', 'TEAM_LEAD', 'AGENT', 'QC'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Full set of role names assigned to the user (from user_role × role_master). */
  roles: string[];
  /** True when the user has any sales role (SALES_HEAD / SALES_PERSON). */
  isSalesUser: boolean;
  /** True when the user has any internal role (ADMIN / TEAM_LEAD / AGENT / QC). */
  isInternalUser: boolean;
  loading: boolean;
  /** Real email from auth session */
  userEmail: string;
  /** Sign out of Supabase */
  signOut: () => Promise<void>;
  /** @deprecated legacy alias used by LoginPage; prefer signOut */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

/**
 * Load the user's full set of role names from user_role × role_master,
 * keyed by the profile's numeric user_id. Falls back to the single
 * profile.role (if present) so callers always get a usable list and we
 * never regress existing role-based UI when the join is empty/unavailable.
 *
 * Additive only — no schema/RLS change. The same tables already power the
 * Admin panel (see src/data/admin.ts).
 */
async function fetchRoleNames(profile: Profile | null): Promise<string[]> {
  const fallback = profile?.role ? [profile.role] : [];
  if (profile?.user_id == null) return fallback;

  const { data, error } = await supabase
    .from('user_role')
    .select('role_master(name)')
    .eq('user_id', profile.user_id)
    .is('deleted_date', null);

  if (error || !data) return fallback;

  const names = (data as unknown as { role_master: { name: string | null } | { name: string | null }[] | null }[])
    .flatMap((row) => {
      const rm = row.role_master;
      if (!rm) return [];
      // Supabase may return the joined row as an object or a single-element array.
      return Array.isArray(rm) ? rm.map((r) => r.name) : [rm.name];
    })
    .filter((n): n is string => Boolean(n));

  // Merge with the legacy single-role so neither source is lost; de-dupe.
  return Array.from(new Set([...names, ...fallback]));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate from current session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        setProfile(p);
        setRoles(await fetchRoleNames(p));
      }
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);
          setRoles(await fetchRoleNames(p));
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const userEmail = user?.email ?? '';
  const isSalesUser = roles.some((r) => SALES_ROLE_NAMES.includes(r));
  const isInternalUser = roles.some((r) => INTERNAL_ROLE_NAMES.includes(r));

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      roles,
      isSalesUser,
      isInternalUser,
      loading,
      userEmail,
      signOut,
      logout: signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
