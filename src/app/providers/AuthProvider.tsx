import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { authService, type AuthSession } from '@/services';
import { logAuthEvent } from '@/lib/auth-errors';
import { ApiError } from '@/types';
import type { Client, Role } from '@/types';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  client: Client | null;
  /**
   * Bootstrap state (spec §11, §50): the app never renders a protected
   * route — or a login screen — until authentication is known.
   */
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
  role: Role | null;
  clientId: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthSession>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    phone?: string;
    businessType?: string;
  }) => Promise<AuthSession>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<AuthSession | null>;
  patchClient: (client: Client) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Authentication state — one source of truth (spec §10, §11).
 *
 * Supabase Auth is the authority. The browser holds the session issued by
 * Supabase (persisted + auto-refreshed by the client); `profiles` supplies
 * the application role and client linkage. Route guards read this context
 * for UX only — the database enforces the real boundary with RLS (§22).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  /**
   * Full session verification: Supabase session → application profile.
   * `silent` swallows the harmless "no session" case at bootstrap.
   */
  const refresh = useCallback(async (options: { silent?: boolean } = {}): Promise<AuthSession | null> => {
    try {
      const data = await authService.me();
      if (!data) {
        setSession(null);
        setStatus('unauthenticated');
        return null;
      }
      setSession(data);
      setStatus('authenticated');
      logAuthEvent('profile_loaded', { role: data.user.role });
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 0 && options.silent) {
        // Transport blip during bootstrap — do NOT sign the user out on
        // a network failure; keep waiting state resolved but neutral.
        setStatus((current) => (current === 'authenticated' ? current : 'unauthenticated'));
        return null;
      }
      if (!options.silent) {
        logAuthEvent('session_refresh_failed', {
          code: (error as { code?: string }).code ?? 'unknown',
        });
      }
      setSession(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  /* Bootstrap: resolve the initial session exactly once (spec §50). */
  useEffect(() => {
    void refresh({ silent: true });
  }, [refresh]);

  /**
   * One session listener for the whole app (spec §10): login, logout,
   * refresh, expired tokens, password changes and multi-tab sign-outs all
   * arrive here. SIGNED_OUT always clears application state, so no private
   * data survives a logout — including through browser-back (spec §48).
   */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // DEFER the callback body: supabase-js invokes listeners while still
      // holding its internal auth lock. Calling any async auth method
      // (getSession, getUser…) synchronously here deadlocks the client and
      // leaves the app stuck on the boot screen forever. A macrotask break
      // releases the lock before our refresh runs.
      setTimeout(() => {
        switch (event) {
          case 'SIGNED_OUT':
            setSession(null);
            setStatus('unauthenticated');
            break;
          case 'TOKEN_REFRESHED':
          case 'INITIAL_SESSION':
            // No action: the bootstrap refresh already resolved the profile.
            break;
          case 'SIGNED_IN':
          case 'PASSWORD_RECOVERY':
          case 'USER_UPDATED':
            void refresh({ silent: false });
            break;
          default:
            break;
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  /** A real 401-style auth rejection anywhere signs the user out safely. */
  useEffect(() => {
    if (status === 'unauthenticated') setSession(null);
  }, [status]);

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const data = await authService.login(email, password, remember);
    setSession(data);
    setStatus('authenticated');
    return data;
  }, []);

  const register = useCallback(async (input: Parameters<typeof authService.register>[0]) => {
    const data = await authService.register(input);
    setSession(data);
    setStatus('authenticated');
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      // Defensive: clear everything even if the network call failed, so
      // no private data ever remains visible (spec §48).
      setSession(null);
      setStatus('unauthenticated');
    }
  }, []);

  /**
   * Self-service account deletion (spec §47). The DATABASE deletes the
   * auth user; the SIGNED_OUT event + the local reset below clear every
   * piece of application state so nothing of the account remains visible.
   */
  const deleteAccount = useCallback(async () => {
    try {
      await authService.deleteAccount();
    } finally {
      setSession(null);
      setStatus('unauthenticated');
    }
  }, []);

  const patchClient = useCallback((client: Client) => {
    setSession((prev) => (prev ? { ...prev, client } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = session?.user.role ?? null;
    return {
      session,
      user: session?.user ?? null,
      client: session?.client ?? null,
      status,
      role,
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin',
      isClient: role === 'client',
      clientId: session?.user.clientId ?? null,
      login,
      register,
      logout,
      deleteAccount,
      refresh: () => refresh({ silent: false }), // returns the session for MFA routing
      patchClient,
    };
  }, [session, status, login, register, logout, deleteAccount, refresh, patchClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
