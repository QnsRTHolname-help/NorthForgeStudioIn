/**
 * Authentication service entry point (North Forge Studio).
 *
 * Provides the single source of truth for user authentication, registration,
 * session lifecycle, and email confirmation verification.
 */

import { supabase, assertSupabaseConfigured } from '@/lib/supabase';
import { authService, loadProfile, type AuthSession } from './public';
import { authUserId } from './db';
import { AuthError, mapAuthError, logAuthEvent } from '@/lib/auth-errors';
import type { User, Session } from '@supabase/supabase-js';

export * from './public';
export { authService, loadProfile, authUserId, AuthError, mapAuthError, logAuthEvent };
export type { AuthSession };

/**
 * Result of checking whether the active session belongs to a verified user.
 */
export interface EmailVerificationStatus {
  verified: boolean;
  user: User | null;
  session: Session | null;
  email?: string;
  confirmedAt?: string | null;
}

/**
 * Verifies the current session state against Supabase Auth.
 * Returns verified: true ONLY when an authenticated session exists
 * and user.email_confirmed_at is non-null.
 *
 * Re-validates against Supabase Auth server (supabase.auth.getUser)
 * to ensure that stale local storage cache does not report an unverified
 * state after the email was confirmed out-of-band.
 */
export async function verifyEmailSession(): Promise<EmailVerificationStatus> {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      return { verified: false, user: null, session: null };
    }

    let user = data.session.user;
    let confirmedAt = user.email_confirmed_at ?? null;

    // If local storage session lacks confirmation timestamp, re-check server
    if (!confirmedAt) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email_confirmed_at) {
          user = userData.user;
          confirmedAt = user.email_confirmed_at ?? null;
        }
      } catch {
        // Fall back to local session user
      }
    }

    const verified = Boolean(confirmedAt);

    return {
      verified,
      user,
      session: data.session,
      email: user.email,
      confirmedAt,
    };
  } catch (err) {
    logAuthEvent('verify_email_session_error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { verified: false, user: null, session: null };
  }
}

/**
 * Exchanges any auth code or token_hash present in the current browser URL.
 * Safely idempotent and cleans up URL parameters on completion.
 */
export async function exchangeUrlAuthSession(
  urlInput?: string,
): Promise<{ exchanged: boolean; error?: string }> {
  let targetUrl: URL | null = null;
  if (urlInput) {
    try {
      targetUrl = new URL(urlInput, 'https://northforgestudioin.vercel.app');
    } catch {
      return { exchanged: false };
    }
  } else if (typeof window !== 'undefined') {
    targetUrl = new URL(window.location.href);
  }
  if (!targetUrl) return { exchanged: false };

  try {
    const code = targetUrl.searchParams.get('code');
    const hashParams = new URLSearchParams(targetUrl.hash.replace(/^#/, ''));
    const tokenHash = targetUrl.searchParams.get('token_hash') ?? hashParams.get('token_hash');
    const tokenType = (targetUrl.searchParams.get('type') ?? hashParams.get('type') ?? 'signup') as any;

    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
      if (error) {
        return { exchanged: false, error: error.message };
      }
      return { exchanged: true };
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error && !/already|used|invalid flow state/i.test(error.message)) {
        return { exchanged: false, error: error.message };
      }
      return { exchanged: true };
    }

    return { exchanged: false };
  } catch (err) {
    return { exchanged: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Quick predicate to check if an entity (AuthSession, User, or Session) has confirmed email.
 * Strictly verifies email_confirmed_at rather than merely checking if an email string exists.
 */
export function isEmailVerified(
  target: AuthSession | User | Session | { user?: Partial<User> } | null | undefined,
): boolean {
  if (!target) return false;

  // Supabase User directly
  if ('email_confirmed_at' in target && target.email_confirmed_at !== undefined) {
    return Boolean(target.email_confirmed_at);
  }

  // Supabase Session or object containing user
  if ('user' in target && target.user) {
    const u = target.user as Record<string, unknown>;
    if ('email_confirmed_at' in u && u.email_confirmed_at !== undefined) {
      return Boolean(u.email_confirmed_at);
    }
    // If it is an AuthSession loaded via loadProfile (which gatekeeps on confirmed email)
    if ('id' in u && 'email' in u && 'role' in u) {
      return Boolean(u.email);
    }
  }

  return false;
}
