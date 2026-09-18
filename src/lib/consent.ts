/**
 * Consent state (spec §41, §53).
 *
 * NorthForge needs no consent for the cookies it cannot avoid: the
 * authentication session and the theme preference are strictly necessary
 * for the service the visitor asked for. Optional measurement (Google
 * Analytics 4) IS consent-gated — nothing is requested from Google until
 * the visitor has said yes.
 *
 * The decision lives in localStorage (never a cookie, so it is not sent on
 * every request) and is versioned: if the categories we ask about ever
 * change, CONSENT_VERSION is bumped and the visitor is asked again rather
 * than having an old answer silently reused.
 */

export type ConsentCategory = 'analytics' | 'marketing';

export interface ConsentState {
  version: number;
  analytics: boolean;
  marketing: boolean;
  /** When the visitor decided, or null while undecided. */
  decidedAt: string | null;
}

export const CONSENT_VERSION = 1;

const STORAGE_KEY = 'nf.consent';

/** Undecided is a real state — not the same thing as "denied". */
export const UNDECIDED: ConsentState = {
  version: CONSENT_VERSION,
  analytics: false,
  marketing: false,
  decidedAt: null,
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Storage blocked (private mode, policy). Treat as undecided; the
    // banner will ask again next visit and nothing optional ever loads.
    return null;
  }
}

export function readConsent(): ConsentState {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return UNDECIDED;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return UNDECIDED;
    return {
      version: CONSENT_VERSION,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : null,
    };
  } catch {
    return UNDECIDED;
  }
}

export function writeConsent(state: Omit<ConsentState, 'version'>): ConsentState {
  const next: ConsentState = { version: CONSENT_VERSION, ...state };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — the decision applies to this page only */
  }
  return next;
}

/** True once the visitor has made an explicit choice for this version. */
export function isDecided(state: ConsentState = readConsent()): boolean {
  return state.decidedAt !== null;
}

export function hasConsent(category: ConsentCategory, state: ConsentState = readConsent()): boolean {
  return state[category];
}

export function resetConsent(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
