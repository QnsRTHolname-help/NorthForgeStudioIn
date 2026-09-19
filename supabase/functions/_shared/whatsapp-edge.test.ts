import { describe, expect, it } from 'vitest';
import {
  computeMetaSignature,
  isExpectedPhoneNumberId,
  isProbeRequest,
  MAX_MESSAGE_LENGTH,
  normalizeWhatsAppNumber,
  parseSendRequest,
  safeEqual,
  verifyMetaSignature,
} from './whatsapp-edge';

/**
 * Regression tests for the WhatsApp Edge Function contract.
 *
 * These run in Node against the same module the Edge Function imports, so the
 * signature check and the request validation are executed, not just read.
 */

const SECRET = 'test-app-secret';
const BODY = new TextEncoder().encode(
  JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '123' } } }] }] }),
);

describe('verifyMetaSignature', () => {
  it('accepts a body signed with the app secret', async () => {
    const header = await computeMetaSignature(BODY, SECRET);
    await expect(verifyMetaSignature(BODY, header, SECRET)).resolves.toBe(true);
  });

  it('rejects a tampered body', async () => {
    const header = await computeMetaSignature(BODY, SECRET);
    const tampered = new TextEncoder().encode(
      JSON.stringify({ entry: [{ changes: [{ value: { text: 'attacker payload' } }] }] }),
    );
    await expect(verifyMetaSignature(tampered, header, SECRET)).resolves.toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const header = await computeMetaSignature(BODY, 'not-the-app-secret');
    await expect(verifyMetaSignature(BODY, header, SECRET)).resolves.toBe(false);
  });

  it('rejects a missing header', async () => {
    await expect(verifyMetaSignature(BODY, null, SECRET)).resolves.toBe(false);
    await expect(verifyMetaSignature(BODY, undefined, SECRET)).resolves.toBe(false);
    await expect(verifyMetaSignature(BODY, '', SECRET)).resolves.toBe(false);
  });

  it('rejects a header without the sha256= prefix', async () => {
    const digest = (await computeMetaSignature(BODY, SECRET)).slice('sha256='.length);
    await expect(verifyMetaSignature(BODY, digest, SECRET)).resolves.toBe(false);
  });

  it('fails closed when no app secret is configured', async () => {
    const header = await computeMetaSignature(BODY, SECRET);
    await expect(verifyMetaSignature(BODY, header, '')).resolves.toBe(false);
  });

  it('is sensitive to any byte, including whitespace', async () => {
    const header = await computeMetaSignature(BODY, SECRET);
    // Same JSON value, different bytes — re-serialising the parsed body would
    // have produced a digest that does not match what Meta signed.
    const reformatted = new TextEncoder().encode(
      JSON.stringify(JSON.parse(new TextDecoder().decode(BODY)), null, 2),
    );
    await expect(verifyMetaSignature(reformatted, header, SECRET)).resolves.toBe(false);
  });
});

describe('safeEqual', () => {
  it('compares equal and unequal strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('isExpectedPhoneNumberId', () => {
  it('accepts only the configured number id', () => {
    expect(isExpectedPhoneNumberId('111222333', '111222333')).toBe(true);
    expect(isExpectedPhoneNumberId('999888777', '111222333')).toBe(false);
  });

  it('fails closed when nothing is configured or the value is not a string', () => {
    expect(isExpectedPhoneNumberId('111222333', '')).toBe(false);
    expect(isExpectedPhoneNumberId(undefined, '111222333')).toBe(false);
    expect(isExpectedPhoneNumberId(null, '111222333')).toBe(false);
    expect(isExpectedPhoneNumberId({}, '111222333')).toBe(false);
    expect(isExpectedPhoneNumberId('', '111222333')).toBe(false);
  });
});

describe('normalizeWhatsAppNumber', () => {
  it('accepts international, local and 0-prefixed forms', () => {
    expect(normalizeWhatsAppNumber('+91 91870 06703')).toBe('919187006703');
    expect(normalizeWhatsAppNumber('9187006703')).toBe('919187006703');
    expect(normalizeWhatsAppNumber('09187006703')).toBe('919187006703');
    expect(normalizeWhatsAppNumber('0091 91870 06703')).toBe('919187006703');
  });

  it('rejects anything unusable', () => {
    expect(normalizeWhatsAppNumber('')).toBeNull();
    expect(normalizeWhatsAppNumber('hello')).toBeNull();
    expect(normalizeWhatsAppNumber('123')).toBeNull();
    expect(normalizeWhatsAppNumber('00')).toBeNull();
    expect(normalizeWhatsAppNumber('1234567890123456789')).toBeNull();
  });

  it('agrees with the browser helper on every documented form', () => {
    // Same cases as src/lib/whatsapp.test.ts. If these ever diverge, the
    // Edge Function and the browser disagree about who a message is for.
    const browserCases: [string, string | null][] = [
      ['+91 98450 12345', '919845012345'],
      ['98450 12345', '919845012345'],
      ['09845012345', '919845012345'],
      ['919845012345', '919845012345'],
      ['+1 (415) 555-0100', '14155550100'],
      ['9845012345', '919845012345'],
      ['80 4123 4567', '918041234567'],
      ['not-a-number', null],
    ];
    for (const [input, expected] of browserCases) {
      expect(normalizeWhatsAppNumber(input), input).toBe(expected);
    }
  });
});

describe('parseSendRequest', () => {
  it('accepts a well-formed send', () => {
    const result = parseSendRequest({ to: '9187006703', body: 'Hello', clientId: 'cl_abc123' });
    expect(result).toEqual({ ok: true, value: { to: '919187006703', body: 'Hello', clientId: 'cl_abc123' } });
  });

  it('treats an absent or empty client id as no client', () => {
    for (const clientId of [undefined, null, '']) {
      const result = parseSendRequest({ to: '9187006703', body: 'Hi', clientId });
      expect(result.ok && result.value.clientId).toBe(null);
    }
  });

  it('rejects a non-object body', () => {
    for (const payload of [null, 'string', 42, []]) {
      const result = parseSendRequest(payload);
      // An array is an object with no `to`, so it fails validation instead.
      expect(result.ok).toBe(false);
    }
  });

  it('rejects a missing or invalid number', () => {
    for (const to of [undefined, '', 'nope', '123']) {
      const result = parseSendRequest({ to, body: 'Hi' });
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBe('validation');
    }
  });

  it('rejects an empty body', () => {
    const result = parseSendRequest({ to: '9187006703', body: '   ' });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('validation');
  });

  it('rejects a body beyond the provider limit', () => {
    const body = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
    const result = parseSendRequest({ to: '9187006703', body });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain(String(MAX_MESSAGE_LENGTH));
    // Exactly at the limit is still fine.
    expect(parseSendRequest({ to: '9187006703', body: 'x'.repeat(MAX_MESSAGE_LENGTH) }).ok).toBe(true);
  });

  it('rejects a client id that is not an application key', () => {
    for (const clientId of ["cl_1' or 1=1", '../etc', 'a'.repeat(65), 12345, {}]) {
      const result = parseSendRequest({ to: '9187006703', body: 'Hi', clientId });
      expect(result.ok).toBe(false);
    }
  });
});

describe('isProbeRequest', () => {
  it('is true only for an explicit boolean true', () => {
    expect(isProbeRequest({ probe: true })).toBe(true);
    expect(isProbeRequest({ probe: 'true' })).toBe(false);
    expect(isProbeRequest({ probe: 1 })).toBe(false);
    expect(isProbeRequest({})).toBe(false);
    expect(isProbeRequest(null)).toBe(false);
  });
});
