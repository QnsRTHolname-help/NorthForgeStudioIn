import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, RequestHandler } from 'express';
import { env } from './env';
import { db, newId, nowIso, queryOne } from './db';
import { forbidden, unauthorized } from './lib/http';
import type { Role } from '@shared/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: Session;
    }
  }
}

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
}

export const TOKEN_COOKIE = 'nf_session';
/** Custom header required on cookie-authenticated mutations (CSRF defence). */
export const CSRF_HEADER = 'x-nf-client';

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, env.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(session: Session, remember = true) {
  return jwt.sign(
    { sub: session.userId, email: session.email, role: session.role, clientId: session.clientId, name: session.name },
    env.jwtSecret,
    { expiresIn: (remember ? env.jwtExpiresIn : '12h') as jwt.SignOptions['expiresIn'], issuer: 'northforge' },
  );
}

export function verifyToken(token: string): Session | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { issuer: 'northforge' }) as jwt.JwtPayload;
    if (!payload.sub || !payload.role) return null;
    return {
      userId: String(payload.sub),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role as Role,
      clientId: payload.clientId ? String(payload.clientId) : null,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string, remember: boolean) {
  const maxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(TOKEN_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.isProd, path: '/' });
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  return typeof cookieToken === 'string' ? cookieToken : null;
}

/**
 * Populates `req.auth` when a valid session exists. Never throws —
 * routes opt into strictness with `requireAuth`.
 */
export const attachSession: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next();

  const session = verifyToken(token);
  if (!session) return next();

  // A token is only as good as the account behind it: deleted users,
  // role changes and client reassignment must take effect immediately.
  const user = queryOne<{ id: string; role: Role; client_id: string | null; name: string; email: string }>(
    'SELECT id, role, client_id, name, email FROM users WHERE id = ?',
    [session.userId],
  );
  if (!user) return next();

  req.auth = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.client_id,
  };
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  return next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    return next();
  };
}

/**
 * CSRF protection for cookie-authenticated state changes.
 *
 * Bearer tokens are immune (a cross-site request cannot read them).
 * Cookie requests must carry the custom `x-nf-client` header, which a
 * cross-origin form or fetch cannot set without a CORS preflight that
 * our allowlist rejects.
 */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (req.headers[CSRF_HEADER]) return next();
  return next(forbidden('This request could not be verified. Please reload and try again.'));
};

/* ── Authorization helpers (spec §83) ─────────────────────────────
 * Mirrors the Postgres RLS predicates in server/src/schema.sql:
 *   admin  → sees everything
 *   client → sees only rows whose client_id equals their own
 * These run on EVERY query. Frontend hiding is not security.
 * ─────────────────────────────────────────────────────────────── */

export function isAdmin(session: Session | undefined) {
  return session?.role === 'admin' || session?.role === 'super_admin';
}

export function assertCanAccessClient(session: Session | undefined, clientId: string | null) {
  if (!session) throw unauthorized();
  if (isAdmin(session)) return;
  if (!clientId || clientId !== session.clientId) {
    // Deliberately identical message to a genuine 404 — never confirm
    // that another client's record exists (spec §140).
    throw forbidden("You don't have access to this.");
  }
}

export function assertAdmin(session: Session | undefined) {
  if (!session) throw unauthorized();
  if (!isAdmin(session)) throw forbidden("You don't have access to this.");
}

/**
 * Returns a SQL fragment + params restricting rows to the caller's scope.
 * Admin → no restriction. Client → `client_id = ?`.
 */
export function clientScope(session: Session, column = 'client_id') {
  if (isAdmin(session)) return { clause: '', params: [] as string[] };
  return { clause: ` AND ${column} = ?`, params: [session.clientId ?? '__none__'] };
}

/** Loads a row only if the caller is allowed to see it; else throws 404. */
export function scopedRow<T extends { client_id?: string | null; id: string }>(
  session: Session,
  table: string,
  id: string,
): T {
  const { clause, params } = clientScope(session);
  const row = queryOne<T>(`SELECT * FROM ${table} WHERE id = ?${clause}`, [id, ...params]);
  if (!row) throw forbidden("You don't have access to this.");
  return row;
}

export function touchLogin(userId: string) {
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), userId);
}

export function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
  clientId?: string | null;
  phone?: string | null;
}) {
  const id = newId('us');
  return { id, passwordHash: bcrypt.hashSync(input.password, env.bcryptRounds), ...input };
}
