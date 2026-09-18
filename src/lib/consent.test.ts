import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Consent store tests.
 *
 * The behaviour that matters legally is: an undecided visitor is NOT
 * consented, a decision survives a reload, and a policy-version change asks
 * again instead of silently reusing an old answer.
 */

function makeStorage() {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
  return { map, storage: storage as unknown as Storage };
}

describe('consent store', () => {
  let map: Map<string, string>;

  beforeEach(() => {
    vi.resetModules();
    const made = makeStorage();
    map = made.map;
    (globalThis as unknown as { window: unknown }).window = { localStorage: made.storage };
  });

  it('treats an undecided visitor as not consented', async () => {
    const { readConsent, isDecided, hasConsent } = await import('@/lib/consent');
    const state = readConsent();
    expect(isDecided(state)).toBe(false);
    expect(hasConsent('analytics', state)).toBe(false);
  });

  it('round-trips a recorded decision', async () => {
    const { readConsent, writeConsent, hasConsent } = await import('@/lib/consent');
    writeConsent({ analytics: true, marketing: false, decidedAt: '2026-09-18T00:00:00.000Z' });

    const state = readConsent();
    expect(state.analytics).toBe(true);
    expect(state.marketing).toBe(false);
    expect(hasConsent('analytics', state)).toBe(true);
    expect(state.decidedAt).toBe('2026-09-18T00:00:00.000Z');
  });

  it('records an explicit refusal as a decision, not as undecided', async () => {
    const { isDecided, writeConsent } = await import('@/lib/consent');
    const state = writeConsent({ analytics: false, marketing: false, decidedAt: new Date().toISOString() });
    expect(isDecided(state)).toBe(true);
    expect(state.analytics).toBe(false);
  });

  it('asks again when the policy version moves on', async () => {
    const { CONSENT_VERSION, readConsent, UNDECIDED } = await import('@/lib/consent');
    map.set(
      'nf.consent',
      JSON.stringify({ version: CONSENT_VERSION - 1, analytics: true, marketing: true, decidedAt: '2025-01-01' }),
    );
    const state = readConsent();
    expect(state.analytics).toBe(false);
    expect(state.decidedAt).toBe(UNDECIDED.decidedAt);
  });

  it('survives unreadable stored data', async () => {
    const { readConsent } = await import('@/lib/consent');
    map.set('nf.consent', 'not json');
    expect(readConsent().analytics).toBe(false);
  });
});
