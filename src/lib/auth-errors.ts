import { ApiError } from '@/types';
import { ConfigError } from '@/lib/supabase';

/**
 * Authentication error translation layer (spec §06, §67).
 *
 * Supabase Auth errors, network failures and RLS denials arrive as raw
 * provider errors. Nothing raw ever reaches a user: every failure is mapped
 * to a safe, specific, human message plus a stable developer code
 * (AUTH_INVALID_CREDENTIALS, …) that is logged without secrets.
 */

/** Developer-facing categorisation. Never contains tokens or secrets. */
export type AuthErrorCode =
  | 'AUTH_NOT_CONFIGURED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_NOT_CONFIRMED'
  | 'AUTH_EMAIL_EXISTS'
  | 'AUTH_RATE_LIMIT'
  | 'AUTH_NETWORK_ERROR'
  | 'AUTH_SERVER_ERROR'
  | 'AUTH_SESSION_ERROR'
  | 'AUTH_PROFILE_MISSING'
  | 'AUTH_ROLE_ERROR'
  | 'AUTH_WEAK_PASSWORD'
  | 'AUTH_VALIDATION'
  | 'AUTH_UNKNOWN';

interface MappedAuthError {
  code: AuthErrorCode;
  message: string;
}

/** Supabase auth error codes we understand explicitly. */
const KNOWN_CODES = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'weak_password',
  'user_banned',
  'refresh_token_not_found',
  'session_expired',
]);

export function mapAuthError(error: unknown): MappedAuthError {
  if (error instanceof ApiError) {
    return { code: toCode(error.code), message: error.message };
  }

  // A missing deployment configuration is not a login problem — say so.
  if (error instanceof ConfigError) {
    return { code: 'AUTH_NOT_CONFIGURED', message: error.message };
  }

  const err = error as { code?: string; message?: string; status?: number; name?: string } | null;

  // Transport-level failure: fetch threw, or the request never reached the
  // auth server (offline, DNS, blocked request).
  if (err?.name === 'AuthRetryableFetchError' || err?.name === 'TypeError' || err?.status === 0) {
    return {
      code: 'AUTH_NETWORK_ERROR',
      message: "We couldn't connect to NorthForge. Check your internet connection and try again.",
    };
  }

  const code = err?.code ?? '';
  const status = err?.status ?? 0;

  if (KNOWN_CODES.has(code) || (typeof code === 'string' && code.endsWith('_not_confirmed'))) {
    switch (code) {
      case 'invalid_credentials':
        return { code: 'AUTH_INVALID_CREDENTIALS', message: 'Email or password is incorrect.' };
      case 'email_not_confirmed':
        return { code: 'AUTH_EMAIL_NOT_CONFIRMED', message: 'Please verify your email before signing in.' };
      case 'user_already_exists':
        return { code: 'AUTH_EMAIL_EXISTS', message: 'An account with this email already exists. Try signing in instead.' };
      case 'over_email_send_rate_limit':
        return {
          code: 'AUTH_RATE_LIMIT',
          message:
            'Too many verification emails have been sent from this project just now. Wait about an hour and try again, or sign in if the account was already created.',
        };
      case 'over_request_rate_limit':
        return {
          code: 'AUTH_RATE_LIMIT',
          message: 'Too many attempts. Please wait a minute and try again.',
        };
      case 'weak_password':
        return { code: 'AUTH_WEAK_PASSWORD', message: 'Choose a stronger password — at least 8 characters.' };
      case 'refresh_token_not_found':
      case 'session_expired':
      case 'user_banned':
        return { code: 'AUTH_SESSION_ERROR', message: 'Your session could not be restored. Please sign in again.' };
      default:
        break;
    }
  }

  // Some providers return only a message without a code.
  const message = (err?.message ?? '').toLowerCase();
  if (message.includes('invalid login credentials')) {
    return { code: 'AUTH_INVALID_CREDENTIALS', message: 'Email or password is incorrect.' };
  }
  if (message.includes('email not confirmed')) {
    return { code: 'AUTH_EMAIL_NOT_CONFIRMED', message: 'Please verify your email before signing in.' };
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return { code: 'AUTH_EMAIL_EXISTS', message: 'An account with this email already exists. Try signing in instead.' };
  }
  if (message.includes('rate limit')) {
    return { code: 'AUTH_RATE_LIMIT', message: 'Too many attempts. Please wait a minute and try again.' };
  }
  if (message.includes('different from the old') || message.includes('should be different')) {
    return { code: 'AUTH_WEAK_PASSWORD', message: 'Choose a password you have not used before.' };
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return {
      code: 'AUTH_NETWORK_ERROR',
      message: "We couldn't connect to NorthForge. Check your internet connection and try again.",
    };
  }

  if (status >= 500) {
    // Almost always project-side (paused free-tier project, or an outage) —
    // never blame the person filling in the form.
    if (import.meta.env.DEV) {
      console.warn('[northforge:auth] auth server error', { code, status, name: err?.name });
    }
    return {
      code: 'AUTH_SERVER_ERROR',
      message:
        'NorthForge authentication is temporarily unavailable. If this keeps happening, the Supabase project may be paused or unreachable — an operator can restore it and you can try again in a minute.',
    };
  }

  // Any other provider error WITH details: surface a safe, specific message
  // instead of a misleading "service is down". The raw text is never shown.
  if (code || message) {
    if (import.meta.env.DEV) {
      console.warn('[northforge:auth] unmapped auth error', { code, status });
    }
    return {
      code: 'AUTH_UNKNOWN',
      message: 'We could not complete that request. Check your details and try again.',
    };
  }

  return {
    code: 'AUTH_UNKNOWN',
    message: 'Something went wrong while signing you in. Please try again.',
  };
}

function toCode(raw: string): AuthErrorCode {
  switch (raw) {
    case 'network':
      return 'AUTH_NETWORK_ERROR';
    case 'unauthorized':
      return 'AUTH_SESSION_ERROR';
    case 'invalid_credentials':
      return 'AUTH_INVALID_CREDENTIALS';
    case 'config':
      return 'AUTH_NOT_CONFIGURED';
    default:
      return 'AUTH_UNKNOWN';
  }
}

/** Thrown by the auth service; safe to display directly in the UI. */
export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(mapped: MappedAuthError) {
    super(mapped.message);
    this.name = 'AuthError';
    this.code = mapped.code;
  }
}

/**
 * Central diagnostics (spec §67, §68). Logs the category and a safe context
 * — never passwords, tokens or raw provider payloads.
 */
export function logAuthEvent(event: string, detail: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) {
    console.info(`[northforge:auth] ${event}`, detail);
  }
}
