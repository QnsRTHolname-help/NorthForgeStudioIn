import { Router } from 'express';
import { db, newId, nowIso, queryOne } from '../db';
import { env } from '../env';
import {
  assertCanAccessClient,
  hashPassword,
  requireAuth,
  requireCsrf,
  setSessionCookie,
  clearSessionCookie,
  signPending2fa,
  signToken,
  verifyPassword,
  verifyPending2fa,
  type Session,
} from '../auth';
import { asyncHandler, badRequest, conflict, fail, notFound, ok, unauthorized } from '../lib/http';
import { parseBody, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../lib/validate';
import { rateLimit } from '../lib/rate-limit';
import { generateTotpSecret, totpReplayCache, totpUri, verifyTotp } from '../lib/totp';
import { mapClient, mapUser } from '../mappers';
import { recordActivity } from '../services/activity';
import { notifyAdmins } from '../services/notify';
import { resetEmail, verificationEmail } from '../services/mailer';
import { verify as verifyConfirm } from '../lib/confirm-token';
import { passwordProblem } from '@shared/password';
import type { Role } from '@shared/types';

const router = Router();

/* ── Rate limiting ─────────────────────────────────────────────────
 * Two axes per sensitive endpoint: per-IP (stuffing one login form) and
 * per-identity (spraying one account from many IPs). Fail closed with a
 * 429 + Retry-After; success resets the identity bucket.
 * ───────────────────────────────────────────────────────────────── */
const emailBucket = (req: { body?: { email?: unknown } }) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, bucket: emailBucket });
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 5, bucket: emailBucket });
const forgotLimiter = rateLimit({ windowMs: 60 * 60_000, max: 5, bucket: emailBucket });
const resetLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, bucket: (req) => String(req.body?.token ?? '').slice(0, 12) });
const totpLimiter = rateLimit({ windowMs: 15 * 60_000, max: 8, bucket: (req) => String(req.body?.pending ?? '').slice(-24) });

/** Shape returned to the client. Never includes password_hash. */
function sessionResponse(session: Session) {
  const user = queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [session.userId]);
  const client = session.clientId
    ? queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [session.clientId])
    : undefined;
  return {
    user: user ? mapUser(user) : null,
    client: client ? mapClient(client) : null,
  };
}

/* ── Login ─────────────────────────────────────────────────────── */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, remember } = parseBody(loginSchema, req.body);

    const row = queryOne<Record<string, unknown>>('SELECT * FROM users WHERE email = ?', [email]);

    // Constant-ish time: always run a compare so a missing account and a
    // wrong password take the same time (no user enumeration by timing).
    const hash = row ? String(row.password_hash) : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const valid = await verifyPassword(password, hash);

    if (!row || !valid) {
      return fail(res, 401, 'That email and password combination is not correct.', 'invalid_credentials');
    }

    // Email confirmation gate: self-registered accounts must verify their
    // address before they can sign in. Seeded/demo accounts are
    // pre-confirmed at creation (seed.ts sets email_confirmed_at).
    const confirmedAt = typeof row.email_confirmed_at === 'string' ? row.email_confirmed_at : null;
    if (!confirmedAt) {
      // Auto-send a fresh verification link so the user is never stuck.
      void (async () => {
        try {
          const { sign: signConfirm } = await import('../lib/confirm-token');
          const url = `${env.smtp.appUrl}/api/auth/confirm-email?token=${encodeURIComponent(signConfirm(String(row.id)))}`;
          await verificationEmail(String(row.email), url);
        } catch {
          /* best-effort */
        }
      })();
      return fail(
        res,
        403,
        'Please verify your email before signing in — we just sent a fresh verification link.',
        'email_unconfirmed',
      );
    }

    const userId = String(row.id);
    const totpSecret = typeof row.totp_secret === 'string' ? row.totp_secret : null;
    const totpEnabled = totpSecret !== null && Number(row.totp_enabled) === 1;

    // Second factor enabled: issue ONLY a 5-minute pending token. No
    // session exists until the TOTP challenge succeeds.
    if (totpEnabled && totpSecret) {
      return ok(res, { mfaRequired: true, pending: signPending2fa(userId) });
    }

    const session: Session = {
      userId,
      email: String(row.email),
      name: String(row.name),
      role: String(row.role) as Role,
      clientId: row.client_id ? String(row.client_id) : null,
    };

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), session.userId);
    const token = signToken(session, remember ?? true);
    setSessionCookie(res, token, remember ?? true);

    recordActivity({
      type: 'auth.login',
      label: 'Signed in',
      detail: session.email,
      actor: session.name,
      actorRole: session.role,
      clientId: session.clientId,
    });

    /**
     * The session travels in the httpOnly cookie ONLY. No token is returned
     * in the body: page JavaScript must never be able to read a session
     * credential — that is the XSS-theft path this removes.
     */
    return ok(res, sessionResponse(session));
  }),
);

/* ── Register (clients only — roles are assigned server-side) ──── */
router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const weak = passwordProblem(input.password);
    if (weak) throw badRequest(weak, { password: weak });

    const existing = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [input.email]);
    if (existing) throw conflict('An account with that email already exists. Try signing in instead.');

    const clientId = newId('cl');
    const userId = newId('us');
    const passwordHash = await hashPassword(input.password);
    const now = nowIso();

    db.transaction(() => {
      db.prepare(
        `INSERT INTO clients (id, business_name, contact_name, email, phone, business_type, status, onboarding_step, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'onboarding', 0, ?, ?)`,
      ).run(clientId, input.businessName, input.name, input.email, input.phone || null, input.businessType || null, now, now);

      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, role, client_id, phone, created_at)
         VALUES (?, ?, ?, ?, 'client', ?, ?, ?)`,
      ).run(userId, input.email, input.name, passwordHash, clientId, input.phone || null, now);
    })();

    // Self-service accounts start UNCONFIRMED. No session is issued here —
    // the account activates only after the confirmation link is followed.
    // Email confirmation is sent out of band so a slow SMTP provider can
    // never block the signup. Without SMTP configured the message lands in
    // the email_outbox table instead (status 'queued').
    void (async () => {
      try {
        const { sign: signConfirm } = await import('../lib/confirm-token');
        const url = `${env.smtp.appUrl}/api/auth/confirm-email?token=${encodeURIComponent(signConfirm(userId))}`;
        await verificationEmail(input.email, url);
      } catch {
        /* confirmation mail is best-effort */
      }
    })();

    recordActivity({
      type: 'client.created',
      label: 'Client account created',
      detail: input.businessName,
      actor: input.name,
      actorRole: 'client',
      entityType: 'client',
      entityId: clientId,
      clientId,
    });
    notifyAdmins({
      kind: 'lead',
      title: 'New client registered',
      body: `${input.businessName} — ${input.email}`,
      href: `/app/clients/${clientId}`,
      entityType: 'client',
      entityId: clientId,
    });

    return ok(res, {
      user: { id: userId, email: input.email, name: input.name, role: 'client', clientId },
      pendingConfirmation: true,
    }, 201);
  }),
);

/* ── Two-factor challenge (password already verified) ─────────── */
router.post(
  '/2fa/verify',
  totpLimiter,
  asyncHandler(async (req, res) => {
    const pending = String(req.body?.pending ?? '');
    const code = String(req.body?.code ?? '');
    const userId = verifyPending2fa(pending);
    if (!userId) throw unauthorized('Your sign-in attempt expired. Please sign in again.');

    const row = queryOne<{ id: string; email: string; name: string; role: string; client_id: string | null; totp_secret: string }>(
      'SELECT * FROM users WHERE id = ?',
      [userId],
    );
    if (!row?.totp_secret) throw unauthorized('Two-factor setup not found. Please sign in again.');

    const attempt = verifyTotp(row.totp_secret, code);
    if (!attempt.ok || attempt.step === undefined) {
      return fail(res, 401, 'That code is not correct. Codes rotate every 30 seconds — try the next one.', 'invalid_totp');
    }

    // Replay protection: this code is burned for its window.
    if (totpReplayCache.has(userId, attempt.step)) {
      return fail(res, 401, 'That code has already been used. Wait for the next one.', 'totp_replay');
    }
    totpReplayCache.consume(userId, attempt.step);

    const session: Session = {
      userId: row.id,
      email: row.email,
      name: row.name,
      role: row.role as Role,
      clientId: row.client_id,
    };

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), session.userId);
    setSessionCookie(res, signToken(session, true), true);

    recordActivity({
      type: 'auth.login',
      label: 'Signed in with 2FA',
      detail: session.email,
      actor: session.name,
      actorRole: session.role,
      clientId: session.clientId,
    });

    return ok(res, sessionResponse(session));
  }),
);

/* ── 2FA management: enrol / status / disable ─────────────────── */
router.get(
  '/2fa/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = queryOne<{ totp_enabled: number }>('SELECT totp_enabled FROM users WHERE id = ?', [req.auth!.userId]);
    return ok(res, { enabled: row ? Number(row.totp_enabled) === 1 : false });
  }),
);

router.post(
  '/2fa/enroll',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const current = String(req.body?.currentPassword ?? '');
    const row = queryOne<{ password_hash: string; email: string }>('SELECT password_hash, email FROM users WHERE id = ?', [session.userId]);
    if (!row) throw notFound('Account not found.');

    const valid = await verifyPassword(current, row.password_hash);
    if (!valid) throw badRequest('Your current password is not correct.', { currentPassword: 'Incorrect password.' });

    const secret = generateTotpSecret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, session.userId);

    return ok(res, {
      secret,
      uri: totpUri(secret, row.email),
      // Displayed below the QR as a manual fallback (words are hard to mistype).
      otpauth: totpUri(secret, row.email),
    });
  }),
);

router.post(
  '/2fa/confirm',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const code = String(req.body?.code ?? '');
    const row = queryOne<{ totp_secret: string | null }>('SELECT totp_secret FROM users WHERE id = ?', [session.userId]);
    if (!row?.totp_secret) throw badRequest('Start the setup first.');

    const attempt = verifyTotp(row.totp_secret, code);
    if (!attempt.ok) throw badRequest('That code is not correct — check your app and try again.', { code: 'Incorrect code.' });

    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(session.userId);
    recordActivity({
      type: 'auth.2fa_enabled',
      label: 'Two-factor authentication enabled',
      actor: session.name,
      actorRole: session.role,
      clientId: session.clientId,
    });
    return ok(res, { enabled: true });
  }),
);

router.post(
  '/2fa/disable',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const current = String(req.body?.currentPassword ?? '');
    const row = queryOne<{ password_hash: string; totp_secret: string | null }>(
      'SELECT password_hash, totp_secret FROM users WHERE id = ?',
      [session.userId],
    );
    if (!row?.totp_secret) throw badRequest('Two-factor authentication is not enabled.');

    const valid = await verifyPassword(current, row.password_hash);
    if (!valid) throw badRequest('Your current password is not correct.', { currentPassword: 'Incorrect password.' });

    db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(session.userId);
    totpReplayCache.forget(session.userId);
    recordActivity({
      type: 'auth.2fa_disabled',
      label: 'Two-factor authentication disabled',
      actor: session.name,
      actorRole: session.role,
      clientId: session.clientId,
    });
    return ok(res, { enabled: false });
  }),
);

/* ── Current session ───────────────────────────────────────────── */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.auth) return fail(res, 401, 'Not signed in.', 'unauthenticated');
    return ok(res, sessionResponse(req.auth));
  }),
);

/* ── Logout ────────────────────────────────────────────────────── */
router.post(
  '/logout',
  requireCsrf,
  asyncHandler(async (_req, res) => {
    clearSessionCookie(res);
    return ok(res, { signedOut: true });
  }),
);

/* ── Profile updates ───────────────────────────────────────────── */
router.patch(
  '/profile',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : null;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : null;

    if (name !== null && (name.length < 2 || name.length > 80)) throw badRequest('Enter your full name.');

    db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?').run(
      name,
      phone,
      session.userId,
    );

    recordActivity({
      type: 'auth.profile_updated',
      label: 'Profile updated',
      actor: session.name,
      actorRole: session.role,
      clientId: session.clientId,
    });

    return ok(res, sessionResponse({ ...session, name: name ?? session.name }));
  }),
);

/* ── Change password ───────────────────────────────────────────── */
router.post(
  '/password',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const current = String(req.body?.currentPassword ?? '');
    const next = String(req.body?.newPassword ?? '');

    if (next.length < 8) throw badRequest('Use at least 8 characters for your new password.');
    const weak = passwordProblem(next);
    if (weak) throw badRequest(weak, { newPassword: weak });

    const row = queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [session.userId]);
    if (!row) throw notFound('Account not found.');

    const valid = await verifyPassword(current, row.password_hash);
    if (!valid) throw badRequest('Your current password is not correct.', { currentPassword: 'Incorrect password.' });

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), session.userId);

    recordActivity({
      type: 'auth.password_changed',
      label: 'Password changed',
      actor: session.name,
      actorRole: session.role,
      clientId: session.clientId,
    });

    return ok(res, { changed: true });
  }),
);

/* ── Password reset ─────────────────────────────────────────────────
 * No mail transport is configured, so the reset link is issued as a
 * short-lived single-use token. In production, wire `deliverReset` to
 * your email provider and never return the token in the response.
 * The endpoint always answers identically whether or not the address
 * exists, so it cannot be used to enumerate accounts.
 * ───────────────────────────────────────────────────────────────── */
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();

router.post(
  '/forgot-password',
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parseBody(forgotPasswordSchema, req.body);
    const user = queryOne<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = ?', [email]);

    let devToken: string | null = null;
    if (user) {
      const token = newId('rst') + newId('x');
      resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 30 * 60 * 1000 });
      if (!env.isProd) devToken = token;

      // Real delivery when SMTP is configured; otherwise the message is
      // recorded in email_outbox and (in dev) the token is returned so the
      // flow stays testable without a mailbox.
      const url = `${env.smtp.appUrl}/reset-password?token=${token}`;
      void resetEmail(user.email, url);
    }

    return ok(res, {
      sent: true,
      message: 'If that email is registered, a reset link is on its way.',
      ...(devToken ? { devToken } : {}),
    });
  }),
);

router.post(
  '/reset-password',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = parseBody(resetPasswordSchema, req.body);
    const weak = passwordProblem(password);
    if (weak) throw badRequest(weak, { password: weak });
    const entry = resetTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      resetTokens.delete(token);
      throw badRequest('That reset link has expired. Request a new one.');
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), entry.userId);
    resetTokens.delete(token);

    recordActivity({ type: 'auth.password_reset', label: 'Password reset', actor: 'Account owner', actorRole: 'client' });

    return ok(res, { reset: true });
  }),
);

/* ── Client business profile (portal → Profile) ───────────────── */
router.patch(
  '/business',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    if (!session.clientId) throw badRequest('No business profile is linked to this account.');
    assertCanAccessClient(session, session.clientId);

    const allowed = ['businessName', 'contactName', 'phone', 'businessType', 'city', 'state', 'websiteUrl'] as const;
    const columnMap: Record<(typeof allowed)[number], string> = {
      businessName: 'business_name',
      contactName: 'contact_name',
      phone: 'phone',
      businessType: 'business_type',
      city: 'city',
      state: 'state',
      websiteUrl: 'website_url',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    for (const key of allowed) {
      if (typeof req.body?.[key] === 'string') {
        updates.push(`${columnMap[key]} = ?`);
        params.push(req.body[key].trim());
      }
    }
    if (updates.length) {
      params.push(nowIso(), session.clientId);
      db.prepare(`UPDATE clients SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...(params as never[]));
    }

    const client = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [session.clientId]);
    return ok(res, { client: client ? mapClient(client) : null });
  }),
);

/* ── Email confirmation link (self-hosted stack) ──────────────── */
// GET because the user lands here from an email client.
router.get(
  '/confirm-email',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? '');
    const result = verifyConfirm(token);
    const redirect = (status: string) => res.redirect(`${env.clientOrigin}/login?confirm=${status}`);

    if (!result.ok) return redirect(result.reason === 'expired' ? 'expired' : 'invalid');

    db.prepare('UPDATE users SET email_confirmed_at = ? WHERE id = ?').run(nowIso(), result.userId);
    return redirect('ok');
  }),
);

/* ── Resend confirmation (public, rate-limited) ───────────────── */
router.post(
  '/resend-confirmation',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parseBody(forgotPasswordSchema, req.body);
    const row = queryOne<{ id: string; email_confirmed_at: string | null }>(
      'SELECT id, email_confirmed_at FROM users WHERE email = ?',
      [email],
    );

    // Same response either way — never reveal whether the address exists.
    // Only unconfirmed accounts get an actual email.
    if (row && !row.email_confirmed_at) {
      void (async () => {
        try {
          const { sign: signConfirm } = await import('../lib/confirm-token');
          const url = `${env.smtp.appUrl}/api/auth/confirm-email?token=${encodeURIComponent(signConfirm(row.id))}`;
          await verificationEmail(email, url);
        } catch {
          /* best-effort */
        }
      })();
    }

    return ok(res, { sent: true, message: 'If that address needs confirming, a new link is on its way.' });
  }),
);

export default router;
