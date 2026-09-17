import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Thrown when the DEPLOYMENT configuration is missing — never when auth
 * itself fails. Distinguishing the two is what turns "login is broken"
 * into an actionable, one-line fix (spec §27, §67).
 */
export class ConfigError extends Error {
  constructor() {
    super(
      'NorthForge is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in the environment.',
    );
    this.name = 'ConfigError';
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the required public Supabase variables are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Fails fast with a precise ConfigError before any auth call is made. */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) throw new ConfigError();
}

if (!isSupabaseConfigured() && import.meta.env.DEV) {
  // Fail loudly in the console — but never at import time: a missing
  // configuration must not white-screen the whole app (spec §55).
  console.warn(
    '[northforge] Supabase environment variables are missing. Sign-in will report a configuration error until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
  );
}

/**
 * Session storage adapter (spec §25).
 *
 * The browser never persists a usable access token where page scripts or
 * shared-machine users can recover it:
 *
 *   - localStorage is NOT used at all. Anything there survives XSS, dies
 *     never, and is readable by every tab, extension and the next person
 *     on the machine — the classic stolen-session path.
 *   - The ACCESS token lives in memory only. It is stripped before the
 *     session is written to storage and re-injected on read.
 *   - The REFRESH token lives in sessionStorage: it is tab-scoped and
 *     dies with the tab, so a stolen refresh token has a tiny, local
 *     window — and nothing survives a browser restart on a shared PC.
 *   - The stored copy's `expires_at` is zeroed so a page restore ALWAYS
 *     mints a fresh access token via the refresh token — a stale blank
 *     token can never be silently used.
 *
 * Trade-offs, accepted deliberately: signing in is per-tab (a new tab
 * signs in again), and an offline page reload signs the user out (the
 * forced refresh fails). For a dashboard holding client business data,
 * both are the right side of the trade. Operators should also lower the
 * Supabase access-token TTL (Auth → Sessions) to 10 minutes so even a
 * momentarily-captured access token expires fast.
 *
 * In a pure SPA there is no server runtime to hold httpOnly cookies; this
 * adapter is the strongest credential posture available without one.
 */

/** Current access token — memory only, never written to any Storage. */
let memoryAccessToken: string | null = null;

interface StoredSessionShape {
  refresh_token?: unknown;
  access_token?: unknown;
  expires_at?: unknown;
  [key: string]: unknown;
}

/** Storage shard: sessionStorage when available, else nothing (memory-only mode). */
function tabStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The single Supabase client for the browser (spec §25).
 *
 * One client, one auth session store, one source of truth. Created with the
 * PUBLIC project URL and publishable (anon) key only — the secret key never
 * belongs in the browser bundle. Every table is protected by RLS, so the
 * publishable key is safe: it authenticates "who you are", never "what you
 * may see".
 */
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: {
          getItem(key: string): string | null {
            const raw = tabStorage()?.getItem(key) ?? null;
            if (!raw) return null;
            try {
              const session = JSON.parse(raw) as StoredSessionShape;
              // Re-inject the in-memory access token so a valid restored
              // session is immediately usable (the forced-refresh path
              // below normally replaces it within the same bootstrap).
              if (memoryAccessToken) session.access_token = memoryAccessToken;
              return JSON.stringify(session);
            } catch {
              return raw;
            }
          },
          setItem(key: string, value: string): void {
            try {
              const session = JSON.parse(value) as StoredSessionShape;
              // Split: keep the refresh token + user in tab storage; the
              // access token stays in memory and is zeroed on disk; zeroed
              // expires_at forces a fresh mint on the next page restore.
              memoryAccessToken = typeof session.access_token === 'string' ? session.access_token : null;
              session.access_token = '';
              session.expires_at = 0;
              tabStorage()?.setItem(key, JSON.stringify(session));
            } catch {
              // Not JSON (e.g. a plain OAuth verifier value): store as-is.
              tabStorage()?.setItem(key, value);
            }
          },
          removeItem(key: string): void {
            memoryAccessToken = null;
            tabStorage()?.removeItem(key);
          },
        },
      },
    })
  : createClient('https://not-configured.invalid', 'not-configured', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

/** Migration sweep: remove any pre-existing localStorage session token. */
if (typeof window !== 'undefined') {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-') || key.includes('auth-token') || key.startsWith('nf.auth')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage blocked — nothing to clean */
  }
}
