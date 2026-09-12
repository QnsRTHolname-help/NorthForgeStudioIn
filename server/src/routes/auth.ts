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
  signToken,
  verifyPassword,
  verifyToken,
  type Session,
} from '../auth';
import { asyncHandler, badRequest, conflict, fail, notFound, ok, unauthorized } from '../lib/http';
import { parseBody, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../lib/validate';
import { mapClient, mapUser } from '../mappers';
import { recordActivity } from '../services/activity';
import { notifyAdmins } from '../services/notify';
import type { Role } from '@shared/types';

const router = Router();

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

    const session: Session = {
      userId: String(row.id),
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
     * The token is returned as well as set as a cookie.
     *
     * Embedded contexts (an iframe on another domain, some mobile webviews)
     * block third-party cookies, so the cookie alone silently fails and the
     * user is signed straight back out. Sending the same signed JWT as a
     * bearer token keeps the session working there; the server accepts
     * either, and both are verified identically.
     */
    return ok(res, { ...sessionResponse(session), token });
  }),
);

/* ── Register (clients only — roles are assigned server-side) ──── */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);

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

    const session: Session = {
      userId,
      email: input.email,
      name: input.name,
      role: 'client',
      clientId,
    };

    const token = signToken(session, true);
    setSessionCookie(res, token, true);

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

    return ok(res, { ...sessionResponse(session), token }, 201);
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
  asyncHandler(async (req, res) => {
    const { email } = parseBody(forgotPasswordSchema, req.body);
    const user = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);

    let devToken: string | null = null;
    if (user) {
      const token = newId('rst') + newId('x');
      resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 30 * 60 * 1000 });
      if (!env.isProd) devToken = token;
      console.info(`[northforge] password reset token for ${email}: ${token}`);
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
  asyncHandler(async (req, res) => {
    const { token, password } = parseBody(resetPasswordSchema, req.body);
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

/** DEV-ONLY helper used by the seeded demo accounts switcher. */
router.post(
  '/dev-token',
  asyncHandler(async (req, res) => {
    if (env.isProd) throw notFound();
    const token = String(req.body?.token ?? '');
    const session = verifyToken(token);
    if (!session) throw unauthorized('That session token is not valid.');
    setSessionCookie(res, token, true);
    return ok(res, sessionResponse(session));
  }),
);

export default router;
