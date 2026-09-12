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
 * The single Supabase client for the browser (spec §25).
 *
 * One client, one auth session store, one source of truth. Created with the
 * PUBLIC project URL and publishable (anon) key only — the secret key never
 * belongs in the browser bundle. Every table is protected by RLS, so the
 * publishable key is safe: it authenticates "who you are", never "what you
 * may see".
 *
 * When the deployment config is missing the module still imports safely and
 * every auth entry point re-checks the configuration, surfacing a precise
 * ConfigError instead of a misleading login failure.
 */
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : createClient('https://not-configured.invalid', 'not-configured', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
