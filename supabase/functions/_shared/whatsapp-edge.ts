/**
 * Pure helpers shared by the WhatsApp Edge Functions.
 *
 * This module is deliberately dependency-free and Deno-agnostic: it uses only
 * WebCrypto and TextEncoder, so the SAME code that runs inside the Edge
 * Function can be unit-tested in Node (`npm test`) instead of being trusted
 * by inspection. Signature verification and request parsing are exactly the
 * kind of code that must not be "reviewed by eye".
 *
 * Nothing here touches `Deno.*`, the network, or a database.
 */

/* ── Meta webhook signature ─────────────────────────────────────── */

/** The header Meta signs the payload with. */
export const SIGNATURE_HEADER = 'x-hub-signature-256';

/** WhatsApp rejects free-form text beyond this length. */
export const MAX_MESSAGE_LENGTH = 4096;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * Constant-time string comparison.
 *
 * `===` on a signature leaks how many leading characters matched through
 * timing, which is enough to forge a value one byte at a time. The length
 * check is not constant-time, but a wrong length is not a useful oracle.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 of the exact bytes received, formatted as Meta sends it. */
export async function computeMetaSignature(rawBody: Uint8Array, appSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, rawBody as unknown as ArrayBuffer);
  return `sha256=${toHex(new Uint8Array(signature))}`;
}

/**
 * Verify `X-Hub-Signature-256` over the RAW request bytes.
 *
 * Must be given the original bytes, never `JSON.stringify(parsedBody)`: any
 * difference in key order, whitespace or unicode escaping changes the digest,
 * so re-serialised JSON would either fail legitimate events or (if the check
 * were loosened) let a forger craft a body that parses the same but signs
 * differently.
 *
 * Fails closed in every ambiguous case: no secret, no header, wrong prefix.
 */
export async function verifyMetaSignature(
  rawBody: Uint8Array,
  header: string | null | undefined,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret) return false;
  if (!header) return false;
  if (!header.startsWith('sha256=')) return false;
  const expected = await computeMetaSignature(rawBody, appSecret);
  return safeEqual(header.trim().toLowerCase(), expected);
}

/**
 * Meta must be talking about the NorthForge business number.
 *
 * Fails closed when the id is not configured: writing an event we cannot
 * attribute to a known number would put another business's messages into
 * this inbox.
 */
export function isExpectedPhoneNumberId(
  incoming: unknown,
  expected: string,
): incoming is string {
  if (!expected || typeof incoming !== 'string' || incoming === '') return false;
  return incoming === expected;
}

/* ── Outbound send request ──────────────────────────────────────── */

/**
 * The same digit rules the browser applies (src/lib/whatsapp.ts) and the
 * inbound webhook applies: country code first, default India when a bare
 * 10-digit local number is given.
 */
export function normalizeWhatsAppNumber(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

export interface SendRequest {
  to: string;
  body: string;
  clientId: string | null;
}

export type ParseResult =
  | { ok: true; value: SendRequest }
  | { ok: false; status: number; error: string; message: string };

/** A client id is an opaque application key, never user-supplied free text. */
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Validate an outbound send body.
 *
 * Length caps matter here for a second reason beyond tidiness: the row and
 * the Graph API request both carry the text, so an unbounded body is a way
 * to send a very large payload to Meta on NorthForge's account.
 */
export function parseSendRequest(payload: unknown): ParseResult {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, status: 400, error: 'bad_request', message: 'Malformed request body.' };
  }
  const input = payload as Record<string, unknown>;

  const to = normalizeWhatsAppNumber(String(input.to ?? ''));
  if (!to) {
    return {
      ok: false,
      status: 400,
      error: 'validation',
      message: 'Enter a valid WhatsApp number (country code first).',
    };
  }

  const body = String(input.body ?? '').trim();
  if (!body) {
    return { ok: false, status: 400, error: 'validation', message: 'Write the message to send.' };
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: 'validation',
      message: `That message is ${body.length} characters. WhatsApp allows ${MAX_MESSAGE_LENGTH}.`,
    };
  }

  const rawClientId = input.clientId;
  let clientId: string | null = null;
  if (rawClientId !== null && rawClientId !== undefined && rawClientId !== '') {
    if (typeof rawClientId !== 'string' || !CLIENT_ID.test(rawClientId)) {
      return { ok: false, status: 400, error: 'validation', message: 'Unknown client reference.' };
    }
    clientId = rawClientId;
  }

  return { ok: true, value: { to, body, clientId } };
}

/** True only for an explicit `probe: true` — never for a truthy value. */
export function isProbeRequest(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as Record<string, unknown>).probe === true
  );
}
