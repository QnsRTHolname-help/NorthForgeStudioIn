/**
 * Public-facing services: auth, MFA, the pricing catalog and the public
 * enquiry form.
 *
 * Split out of `services/index.ts` because that module is the barrel every
 * admin and portal screen imports from, and it is large. Anything that pulled
 * `authService` also pulled every admin service, so the whole agency data
 * layer — clients, invoices, leads, workflows — was in the bundle a marketing
 * visitor downloads before the homepage paints. Public pages import this
 * module instead, and the admin code stays in `services/index.ts`, which
 * re-exports everything here so existing imports keep working.
 */
import { supabase, assertSupabaseConfigured } from '@/lib/supabase';
import { AuthError, logAuthEvent, mapAuthError } from '@/lib/auth-errors';
import { AUTH_CALLBACK_PATH, canonicalUrl } from '@/lib/links';
import { ApiError } from '@/types';
import { authUserId, compact, run, mapDatabaseError } from '@/services/db';
import { mapClient } from '@/services/mappers';
import { CATALOG } from '@/services/catalog';
import { isHoneypotFilled, mapEnquiryPayload } from '@/lib/enquiry';
import type { Client, Plan, Service } from '@/types';
import type { Role } from '@/types';
/**
 * Service layer (spec §81).
 *
 * UI → hooks → services → Supabase. Components never touch the Supabase
 * client directly, so session handling, row mapping and error translation
 * live in exactly one place.
 *
 * Authorisation is NOT implemented here — every query is scoped by RLS on
 * the server. A client account querying another client's rows simply gets
 * an empty or denied result, no matter what this code asks for.
 */

/* ── Auth (spec §05, §10, §11) ── */

export interface AuthSession {
  user: { id: string; email: string; name: string; role: Role; clientId: string | null };
  client: Client | null;
}

const SESSION_LOST = 'Your session could not be restored. Please sign in again.';

export function sessionError() {
  return new AuthError({ code: 'AUTH_SESSION_ERROR', message: SESSION_LOST });
}

/** The app's identity record for the signed-in auth user. */
export async function loadProfile(): Promise<AuthSession> {
  const userId = await authUserId();
  if (!userId) throw sessionError();

  const rows = await run<{ id: string; email: string; name: string; role: Role; client_id: string | null; client: Record<string, unknown>[] | null }[]>(
    'auth.loadProfile',
    () => supabase.from('profiles').select('*, client:clients(*)').eq('id', userId).limit(1),
  );
  const profile = rows?.[0];
  if (!profile) {
    // Authenticated but no profile — the signup trigger should have made
    // one. Never crash; tell the user precisely what to do (spec §15).
    throw new AuthError({
      code: 'AUTH_PROFILE_MISSING',
      message: 'Your account was authenticated, but your NorthForge profile is incomplete. Please contact support.',
    });
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      role: profile.role,
      clientId: profile.client_id,
    },
    client: profile.client?.[0] ? mapClient(profile.client[0]) : null,
  };
}

export const authService = {
  /**
   * Verify + load the current session. Returns null when signed out.
   * Used at app bootstrap (spec §50) — never redirects, never throws for
   * the harmless "no session" case.
   */
  me: async (): Promise<AuthSession | null> => {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logAuthEvent('session_restore_failed', { error: error.name });
      return null;
    }
    if (!data.session) return null;
    // Hard gate: a session for an unconfirmed self-service address must
    // never resolve — covers sessions minted while the project's confirm
    // toggle was off. Admin-provisioned users carry an invite marker.
    if (!data.session.user.email_confirmed_at && !data.session.user.user_metadata?.invited_by_admin) {
      await supabase.auth.signOut();
      logAuthEvent('session_blocked_unconfirmed');
      throw new AuthError({
        code: 'AUTH_EMAIL_NOT_CONFIRMED',
        message: 'Please verify your email before signing in. Check your inbox for the verification link.',
      });
    }
    return loadProfile();
  },

  login: async (email: string, password: string, _remember = true): Promise<AuthSession> => {
    // Fail with a precise configuration error instead of a misleading
    // "invalid credentials" when the deployment env is incomplete (spec §27).
    assertSupabaseConfigured();
    logAuthEvent('auth_request_started', { flow: 'password' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const mapped = mapAuthError(error);
      logAuthEvent('auth_request_failed', { code: mapped.code });
      throw new AuthError(mapped);
    }

    // Email confirmation is REQUIRED for self-service accounts — even when
    // the project's "Confirm email" toggle is off. Supabase then happily
    // issues a session for an unverified address, so we enforce it here.
    // Admin-provisioned logins (invited/seeded users) skip this gate.
    if (data.user && !data.user.email_confirmed_at && !data.user.user_metadata?.invited_by_admin) {
      await supabase.auth.signOut();
      logAuthEvent('auth_request_failed', { code: 'email_not_confirmed' });
      throw new AuthError({
        code: 'AUTH_EMAIL_NOT_CONFIRMED',
        message: 'Please verify your email before signing in. Check your inbox for the verification link.',
      });
    }

    // Second factor enrolled: the password alone only buys an AAL1 session.
    // Signal the login screen to route into the verification challenge
    // BEFORE any protected data loads — never browse at first-factor only.
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.data && assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') {
      logAuthEvent('mfa_challenge_required');
      throw new AuthError({ code: 'AUTH_MFA_REQUIRED', message: 'Enter your two-factor code to continue.' });
    }

    logAuthEvent('session_established');
    const session = await loadProfile();
    logAuthEvent('redirect_ready', { role: session.user.role });
    return session;
  },

  /**
   * Client self-registration (spec §16). The role is NEVER sent by the
   * browser as a claim — the server-side trigger provisions role 'client'
   * no matter what metadata contains (spec §17).
   */
  register: async (input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    phone?: string;
    businessType?: string;
    /**
     * Age eligibility attestation (spec §10–§11). The RESULT is all that is
     * stored: profiles.age_verified / age_verified_at, written by the signup
     * trigger from this flag. No date of birth and no identity document are
     * collected for a basic eligibility check.
     */
    ageConfirmed: boolean;
  }): Promise<AuthSession> => {
    assertSupabaseConfigured();
    // Enforced again here so the rule does not live only in the form markup.
    if (!input.ageConfirmed) {
      throw new AuthError({
        code: 'AUTH_AGE_REQUIRED',
        message: 'Please confirm that you meet the minimum age requirement to create an account.',
      });
    }
    logAuthEvent('signup_request_started');
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          business_name: input.businessName,
          phone: input.phone ?? null,
          business_type: input.businessType ?? null,
          // Read by handle_new_user() (migration 0012) to set
          // age_verified + age_verified_at on the new profile.
          age_confirmed: input.ageConfirmed,
        },
        // Canonical, never `window.location.origin`: a signup triggered
        // from a local dev machine must not email a localhost link to a
        // real customer (src/lib/links.ts).
        emailRedirectTo: canonicalUrl(AUTH_CALLBACK_PATH),
      },
    });
    if (error) {
      const mapped = mapAuthError(error);
      logAuthEvent('signup_request_failed', { code: mapped.code });
      throw new AuthError(mapped);
    }
    // Email confirmation is REQUIRED — regardless of the project's
    // "Confirm email" toggle. When the toggle is off Supabase returns a
    // live session for an unverified address; we throw it away and treat
    // signup as "check your inbox" either way.
    const confirmed = Boolean(data.user?.email_confirmed_at);
    if (!data.session || !confirmed) {
      if (data.session) await supabase.auth.signOut();
      logAuthEvent('signup_awaiting_confirmation', { confirmed });
      throw new AuthError({
        code: 'AUTH_EMAIL_NOT_CONFIRMED',
        message: 'Account created. Check your inbox to confirm your email, then sign in.',
      });
    }
    return loadProfile();
  },

  logout: async (): Promise<{ signedOut: boolean }> => {
    await supabase.auth.signOut();
    logAuthEvent('signed_out');
    return { signedOut: true };
  },

  /**
   * Re-send the signup confirmation email (spec: expired/used links must
   * never dead-end a new account). Always resolves successfully — Supabase
   * deliberately does not reveal whether the address exists.
   */
  resendConfirmation: async (email: string): Promise<{ sent: boolean }> => {
    assertSupabaseConfigured();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: canonicalUrl(AUTH_CALLBACK_PATH) },
    });
    if (error) {
      const mapped = mapAuthError(error);
      throw new AuthError(mapped);
    }
    return { sent: true };
  },

  updateProfile: async (input: { name?: string; phone?: string }): Promise<AuthSession> => {
    const userId = await authUserId();
    if (!userId) throw sessionError();
    await run('auth.updateProfile', () => supabase.from('profiles').update(compact(input)).eq('id', userId));
    if (input.name) await supabase.auth.updateUser({ data: { name: input.name } });
    return loadProfile();
  },

  updateBusiness: async (input: Partial<Client>): Promise<{ client: Client | null }> => {
    const session = await loadProfile();
    if (!session.user.clientId) throw new ApiError('No business profile is linked to this account.', 400, 'no_client');
    const rows = await run<Record<string, unknown>[]>('auth.updateBusiness', () =>
      supabase
        .from('clients')
        .update(
          compact({
            business_name: input.businessName,
            contact_name: input.contactName,
            phone: input.phone,
            business_type: input.businessType,
            city: input.city,
            state: input.state,
            website_url: input.websiteUrl,
          }),
        )
        .eq('id', session.user.clientId!)
        .select(),
    );
    const row = rows?.[0];
    return { client: row ? mapClient(row) : null };
  },

  /**
   * Delete the signed-in client's account and all of their business data
   * (spec §47 erasure right).
   *
   * Runs the 0009 security-definer RPC: the DATABASE resolves the caller
   * from auth.uid(), refuses privileged roles, cascades the client's
   * business rows and removes the auth user — all in one transaction.
   * After a successful call the local session is signed out and cleared;
   * the local sign-out is fire-and-forget since the auth user no longer
   * exists.
   */
  deleteAccount: async (): Promise<{ deleted: boolean }> => {
    assertSupabaseConfigured();
    logAuthEvent('account_deletion_started');
    const { error } = await supabase.rpc('app_delete_own_account');
    if (error) {
      // Surface the RPC's specific refusals; everything else maps safely.
      const hint = (error as { hint?: string }).hint ?? '';
      if (error.code === 'P0001' && hint.includes('Sign in')) {
        throw new ApiError('Your session expired. Sign in again to continue.', 401, 'session_expired');
      }
      if (error.code === 'P0001' && hint.includes('super admin')) {
        throw new ApiError(
          'Admin accounts cannot be deleted from the portal. Ask a super admin to remove this account.',
          403,
          'forbidden',
        );
      }
      throw new ApiError('We could not delete the account right now. Please try again or contact support.', 400, 'delete_failed');
    }
    logAuthEvent('account_deleted');
    // The auth user is gone — clear whatever the client still holds.
    await supabase.auth.signOut().catch(() => undefined);
    return { deleted: true };
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ changed: boolean }> => {
    assertSupabaseConfigured();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) throw sessionError();
    // Verify the current password first — never allow a silent takeover.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      throw new AuthError({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Your current password is not correct.' });
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError(mapAuthError(error));
    return { changed: true };
  },

  /** Supabase sends the reset email; the link lands on /reset-password. */
  forgotPassword: async (email: string): Promise<{ sent: boolean; message: string }> => {
    assertSupabaseConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: canonicalUrl('/reset-password'),
    });
    if (error) throw new AuthError(mapAuthError(error));
    return { sent: true, message: 'If that email is registered, a reset link is on its way.' };
  },

  /**
   * Verify that a password-recovery session is active (spec §09).
   *
   * The recovery link signs the user in via the URL fragment; the client
   * exchanges it automatically (detectSessionInUrl + PKCE). The exchange can
   * finish a beat after the page mounts, so we wait for it (bounded) instead
   * of wrongly reporting "link expired".
   */
  verifyRecovery: async (): Promise<{ hasSession: boolean }> => {
    assertSupabaseConfigured();
    const { data } = await supabase.auth.getSession();
    if (data.session) return { hasSession: true };

    // The PKCE exchange fires SIGNED_IN/PASSWORD_RECOVERY when it completes.
    // Wait briefly (bounded) so a slow exchange is not reported as expired.
    const recovered = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void subscription.unsubscribe();
        resolve(value);
      };
      const timer = setTimeout(() => done(false), 5000);
      const { data: subData } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') done(true);
      });
      const subscription = subData.subscription;
    });
    return { hasSession: recovered };
  },

  /**
   * Updates the password for the CURRENT recovery/sign-in session.
   * The legacy `token` query parameter is no longer used (Supabase PKCE
   * recovery links carry the code in the URL fragment, exchanged by the
   * client automatically).
   */
  resetPassword: async (_token: string, password: string): Promise<{ reset: boolean }> => {
    assertSupabaseConfigured();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new AuthError(mapAuthError(error));
    return { reset: true };
  },
};

/* ── Two-factor auth (Supabase MFA — TOTP, spec §05) ──
 *
 * Supabase MFA is enforced SERVER-side: the admin session cannot call
 * admin-surface data unless it carries a verified second factor (AAL2).
 * These helpers drive the browser side of that flow — enrolment in
 * Settings, and the verification challenge the login screen shows after a
 * correct password when a factor is active.
 */

export const mfaService = {
  /** Whether the signed-in user has a verified TOTP factor. */
  status: async (): Promise<{ enabled: boolean }> => {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new AuthError(mapAuthError(error));
    const enabled = (data?.totp ?? []).some((factor) => factor.status === 'verified');
    return { enabled };
  },

  /** Begins enrolment: returns the shared secret + otpauth URI for the QR. */
  enroll: async (): Promise<{ factorId: string; secret: string; uri: string }> => {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'NorthForge authenticator',
    });
    if (error || !data) throw new AuthError(mapAuthError(error));
    return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
  },

  /** Confirms enrolment with the first code from the authenticator app. */
  confirmEnroll: async (factorId: string, code: string): Promise<void> => {
    assertSupabaseConfigured();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) throw new AuthError(mapAuthError(challenge.error));
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data!.id,
      code,
    });
    if (verify.error) throw new AuthError(mapAuthError(verify.error));
  },

  /**
   * Completes an AAL1 login by verifying the TOTP code, escalating the
   * session to AAL2. Throws a precise AuthError on a wrong/expired code.
   */
  verifyChallenge: async (factorId: string, code: string): Promise<void> => {
    assertSupabaseConfigured();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) throw new AuthError(mapAuthError(challenge.error));
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data!.id,
      code,
    });
    if (verify.error) throw new AuthError(mapAuthError(verify.error));
  },

  /** Lists verified factor IDs (the login screen needs one to challenge). */
  verifiedFactorIds: async (): Promise<string[]> => {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new AuthError(mapAuthError(error));
    return (data?.totp ?? []).filter((f) => f.status === 'verified').map((f) => f.id);
  },

  /** Un-enrolls a factor (Settings → security). Requires a fresh AAL2 auth. */
  unenroll: async (factorId: string): Promise<void> => {
    assertSupabaseConfigured();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new AuthError(mapAuthError(error));
  },
};

/* ── Catalog (single source of truth for pricing, spec §71) ── */

export interface CatalogResponse {
  currency: string;
  intervalDays: number;
  plans: Plan[];
  services: Service[];
  serviceGroups: { key: string; label: string; blurb: string }[];
  thirdPartyCosts: { label: string; note: string }[];
  billingFacts: string[];
}

export const catalogService = {
  // The catalog is a static, versioned constant — the browser never
  // invents a price and there is exactly one definition in the codebase.
  get: async (): Promise<CatalogResponse> => CATALOG,
};

/* ── Public enquiry (contact form, spec §38) ── */

export const contactService = {
  /**
   * Submit the public contact form.
   *
   * The write goes through `app_submit_enquiry()` (migration 0014), not a
   * table insert. Anonymous INSERT on `enquiries` was
   * `with check (true)` and every row fires a trigger that creates a lead and
   * notifies every admin, so one script could flood the inbox without limit.
   * A browser honeypot is a speed bump, not a boundary. The RPC validates and
   * length-caps every field and throttles per address and globally, and the
   * table no longer accepts anonymous INSERTs at all.
   */
  submit: async (input: Record<string, unknown>): Promise<{ received: boolean; reference: string | null }> => {
    // The reference is generated here so the visitor gets a real one even
    // though the enquiries SELECT policy is admin-only (the row must not be
    // read back). The RPC validates its shape and adopts it.
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const reference = 'eq_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

    // Anti-spam: the form's hidden field was submitted and then ignored, so
    // it caught nothing. Answered with the normal success shape on purpose —
    // telling a bot it was detected just invites a retry.
    if (isHoneypotFilled(input)) {
      logAuthEvent('enquiry_honeypot_blocked');
      return { received: true, reference: null };
    }

    // Field-name mapping lives in one tested place (src/lib/enquiry.ts): the
    // form sends `phone` and `slowestProcess`, the table has `whatsapp` and
    // `bottleneck`, and reading the wrong key dropped both silently.
    const base = mapEnquiryPayload(input, reference);
    const plan = (input.plan as string) ?? null;

    const { data, error } = await supabase.rpc('app_submit_enquiry', {
      p_name: base.name,
      p_email: base.email,
      p_id: reference,
      p_business_name: base.business_name,
      p_whatsapp: base.whatsapp,
      p_business_type: base.business_type,
      p_current_tools: base.current_tools,
      p_bottleneck: base.bottleneck,
      p_monthly_enquiries: base.monthly_enquiries,
      p_message: base.message,
      p_plan: plan,
    });

    if (error) {
      // A failed validation or throttle is raised by the function; its hint is
      // written for the visitor, so surface it rather than a generic failure.
      const hint = (error as { hint?: string }).hint ?? '';
      if (error.code === 'P0001' && hint) {
        throw new ApiError(hint, error.message?.includes('RATE_LIMITED') ? 429 : 400, 'validation');
      }
      throw mapDatabaseError(error, 'contact.submit');
    }

    return { received: true, reference: typeof data === 'string' ? data : reference };
  },
};

