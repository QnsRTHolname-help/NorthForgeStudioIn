import crypto from 'node:crypto';

/**
 * RFC 6238 TOTP (30-second step, 6 digits, SHA-1) built on node:crypto —
 * no external dependencies.
 *
 * Used by the API's two-factor login challenge. Verification allows ±1 step
 * of clock drift, and a per-user replay cache rejects a code that has
 * already been consumed within its window.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generates a fresh Base32 secret with the given entropy (bytes). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** Builds the otpauth:// URI that authenticator apps scan as a QR code. */
export function totpUri(secret: string, account: string, issuer = 'NorthForge'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** The 6-digit code for a secret at a given time (ms). Exposed for tests. */
export function totpAt(secret: string, timeMs: number = Date.now()): string {
  const counter = Math.floor(timeMs / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

/**
 * Verify with ±1 step drift. Returns the matched step so callers can mark
 * it consumed (replay protection) — a captured code stays useless.
 */
export function verifyTotp(
  secret: string,
  code: string,
  consumedSteps: number[] = [],
  timeMs: number = Date.now(),
): { ok: boolean; step?: number } {
  const normalized = code.replace(/\D/g, '');
  if (normalized.length !== 6) return { ok: false };

  const current = Math.floor(timeMs / 30_000);
  for (const step of [current, current - 1, current + 1]) {
    if (consumedSteps.includes(step)) continue;
    if (totpAt(secret, step * 30_000) === normalized) {
      return { ok: true, step };
    }
  }
  return { ok: false };
}

/**
 * Per-user replay cache. Kept in memory: entries expire with their window
 * and a restart merely allows a replay within one 30s step — acceptable for
 * this deployment, and the alternative (a DB round-trip per keystroke of
 * lockout state) is not worth it at this scale.
 */
export class ReplayCache {
  private entries = new Map<string, number[]>();

  /** Marks a step consumed for a user. */
  consume(userId: string, step: number) {
    const steps = this.entries.get(userId) ?? [];
    steps.push(step);
    // Keep only recent steps — anything older than 2 windows is dead.
    const cutoff = Math.floor(Date.now() / 30_000) - 2;
    this.entries.set(userId, steps.filter((s) => s >= cutoff));
  }

  /** True when the step was already used for this user. */
  has(userId: string, step: number): boolean {
    return (this.entries.get(userId) ?? []).includes(step);
  }

  forget(userId: string) {
    this.entries.delete(userId);
  }
}

export const totpReplayCache = new ReplayCache();
