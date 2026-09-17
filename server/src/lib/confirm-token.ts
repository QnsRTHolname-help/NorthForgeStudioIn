/**
 * Signed, single-purpose email-confirmation tokens (self-hosted stack).
 *
 * Statelesss HMAC tokens: the server can verify a confirmation link without
 * a DB round-trip, and the confirmed state is then persisted on the user row.
 * Tokens are scoped by purpose so a reset link can never confirm an email
 * and vice-versa.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

const PURPOSE = 'email-confirm';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // links expire after 24h

function key(): string {
  return `${env.jwtSecret}:${PURPOSE}`;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Signs `{ userId, purpose, issuedAt }` into one opaque URL-safe token. */
export function sign(userId: string): string {
  const payload = b64url(JSON.stringify({ userId, p: PURPOSE, iat: Date.now() }));
  const mac = createHmac('sha256', key()).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export type ConfirmResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

/** Verifies a token from a confirmation link. Constant-time MAC compare. */
export function verify(token: string): ConfirmResult {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };

  const [payload, mac] = parts;
  const expected = createHmac('sha256', key()).update(payload).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let parsed: { userId?: unknown; p?: unknown; iat?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof parsed.userId !== 'string' || parsed.p !== PURPOSE) return { ok: false, reason: 'malformed' };
  if (typeof parsed.iat !== 'number' || Date.now() - parsed.iat > MAX_AGE_MS) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, userId: parsed.userId };
}
