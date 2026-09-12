import { supabase, ConfigError } from '@/lib/supabase';
import { ApiError } from '@/types';

/**
 * Database error mapper (spec §32).
 *
 * Raw Postgres/PostgREST/RLS errors never reach a user. Every failure is
 * translated to a safe, specific message; technical detail stays in the
 * developer console (without secrets).
 */

type DbError = { code?: string; message?: string; status?: number; details?: string; hint?: string } | null;

export function mapDatabaseError(error: unknown, context: string): ApiError {
  if (error instanceof ApiError) return error;

  // Missing deployment configuration — not a database problem.
  if (error instanceof ConfigError) {
    return new ApiError(error.message, 503, 'config');
  }

  const err = error as DbError;
  const code = err?.code ?? '';
  const status = err?.status ?? 0;
  const message = err?.message ?? '';

  // Transport-level failure: the request never reached PostgREST (offline,
  // DNS, blocked request). postgrest-js reports a thrown fetch as an error
  // shaped "{ message: 'FetchError: …' | 'TypeError: …', code: '' }". Real
  // Postgres/PostgREST errors ALWAYS carry a non-empty code (PGRST… or a
  // SQLSTATE) and no status property at all — so `status === 0` must never
  // be treated as a transport signal here, or every database failure would
  // be misreported as "couldn't reach the database".
  if (err === null || /^(FetchError|TypeError):/.test(message)) {
    if (import.meta.env.DEV) console.warn(`[northforge:db] ${context} transport error`, { code, status });
    return new ApiError("We couldn't reach the database. Please try again.", 0, 'network');
  }

  // Missing schema — the migration has not been applied to this Supabase
  // project (PGRST205 = table missing from the schema cache, 42P01 =
  // undefined table). Say precisely what fixes it instead of pretending
  // the network is down.
  if (code === 'PGRST205' || code === '42P01') {
    if (import.meta.env.DEV) console.warn(`[northforge:db] ${context} schema missing`, { code, message });
    return new ApiError(
      'The NorthForge database is not set up yet. Apply the migration in supabase/migrations to the Supabase project, then sign in again.',
      503,
      'schema_missing',
    );
  }

  // RLS denial — the user is authenticated but not allowed. Say that plainly.
  if (code === '42501') {
    if (import.meta.env.DEV) console.warn(`[northforge:db] ${context} permission denied`, { code });
    return new ApiError("You don't have permission to perform this action.", 403, 'permission_denied');
  }

  // Constraint violations.
  if (code === '23505') {
    return new ApiError('This record already exists.', 409, 'duplicate');
  }
  if (code === '23503' || code === '23502') {
    return new ApiError('Some information is missing or invalid.', 400, 'constraint');
  }
  if (code === '22P02' || code === '23514') {
    return new ApiError('Some information is missing or invalid.', 400, 'invalid_value');
  }

  // PostgREST shape/config errors — a deployment configuration problem.
  if (code.startsWith('PGRST')) {
    if (import.meta.env.DEV) console.warn(`[northforge:db] ${context} API error`, { code, message });
    return new ApiError('NorthForge services are temporarily unavailable. Please try again.', 503, 'service_unavailable');
  }

  if (status >= 500) {
    return new ApiError('NorthForge services are temporarily unavailable. Please try again.', status, 'server_error');
  }

  if (import.meta.env.DEV) console.warn(`[northforge:db] ${context} unmapped error`, { code, status });
  return new ApiError('Something went wrong. Please try again.', status || 400, 'error');
}

/** Runs a Supabase query and normalises every failure into an ApiError. */
export async function run<T>(context: string, op: () => PromiseLike<{ data: T | null; error: DbError }>): Promise<T> {
  const { data, error } = await op();
  if (error) throw mapDatabaseError(error, context);
  return data as T;
}

/** The authenticated user's id, or null when signed out. */
export async function authUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Delete a key/undefined pair so partial updates stay partial. */
export function compact<T extends object>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}
