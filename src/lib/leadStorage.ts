/**
 * Lead & Credential Persistence across the NorthForge funnel.
 *
 * Persists visitor and client enquiry details (name, business name,
 * email, phone, business type, selected plan) across pages and sessions
 * so users never encounter blank form fields when advancing from
 * enquiry to registration or from account creation to subscription.
 */

export interface LeadCredentials {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  businessType?: string;
  plan?: string;
  message?: string;
  updatedAt?: number;
}

const STORAGE_KEY = 'nf_lead_credentials';

let memoryCache: Partial<LeadCredentials> = {};

/**
 * Save lead credentials to memory, sessionStorage and localStorage with safe fallbacks.
 */
export function saveLeadCredentials(data: Partial<LeadCredentials>): void {
  const existing = getLeadCredentials();
  const merged: LeadCredentials = {
    ...existing,
    ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== '')),
    updatedAt: Date.now(),
  };
  memoryCache = merged;

  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(merged);
      window.sessionStorage.setItem(STORAGE_KEY, serialized);
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // Storage might be restricted in private browsing mode
    }
  }
}

/**
 * Retrieve lead credentials from sessionStorage (preferred), localStorage, or memory cache.
 */
export function getLeadCredentials(): Partial<LeadCredentials> {
  if (typeof window !== 'undefined') {
    try {
      const rawSession = window.sessionStorage.getItem(STORAGE_KEY);
      if (rawSession) {
        const parsed = JSON.parse(rawSession) as Partial<LeadCredentials>;
        memoryCache = parsed;
        return parsed;
      }
      const rawLocal = window.localStorage.getItem(STORAGE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal) as Partial<LeadCredentials>;
        memoryCache = parsed;
        return parsed;
      }
    } catch {
      // Fall through to memory cache
    }
  }
  return memoryCache;
}

/**
 * Clear stored credentials once account registration or purchase completes.
 */
export function clearLeadCredentials(): void {
  memoryCache = {};
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
