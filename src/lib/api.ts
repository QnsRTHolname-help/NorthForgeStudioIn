import { ApiError } from '@/types';

/**
 * API base URL.
 *
 * Same-origin (`/api`) by default — that is how it runs locally and how it
 * runs when the API sits behind the same domain. Set `VITE_API_URL` when the
 * frontend and API are deployed separately (for example the site on Vercel
 * and the API on a server you host); the API's CLIENT_ORIGIN must then
 * include this site's origin.
 */
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api').replace(/\/$/, '');

/** Custom header required by the API on cookie-authenticated mutations. */
const CSRF_HEADER = 'x-nf-client';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the JSON envelope (never needed today, kept for downloads). */
  raw?: boolean;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * Session token store.
 *
 * A session needs to survive three different browser environments, and each
 * one can take a different storage mechanism away:
 *
 *   1. memory        — always available; lost on reload
 *   2. localStorage  — survives reload; THROWS in a sandboxed iframe
 *   3. URL fragment  — survives reload even when storage is blocked
 *   4. httpOnly cookie — set by the server; dropped when third-party
 *      cookies are blocked (embedded previews, partner portals)
 *
 * The order matters: whatever is still readable in the current context wins.
 * The fragment is only used when storage is genuinely unavailable — it is
 * never persisted by the server, and fragments are not sent in Referer
 * headers or to the origin, so it stays client-side.
 *
 * Every request carries the token as a bearer credential, and the server
 * verifies it on every call: nothing about the session is trusted here.
 */
const TOKEN_KEY = 'nf.session.token';
const FRAGMENT_KEY = 'nf_s';

let memoryToken: string | null = null;
let storageWorks = true;

function readFragment(): string | null {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    return params.get(FRAGMENT_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken;

  if (storageWorks) {
    try {
      const stored = window.localStorage.getItem(TOKEN_KEY);
      if (stored) {
        memoryToken = stored;
        return stored;
      }
    } catch {
      storageWorks = false;
    }
  }

  const fromFragment = readFragment();
  if (fromFragment) memoryToken = fromFragment;
  return fromFragment;
}

export function setToken(token: string | null) {
  memoryToken = token;

  if (token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
      storageWorks = true;
      clearFragment();
      return;
    } catch {
      storageWorks = false;
    }
    // Storage is blocked: keep the token in the URL fragment so a reload
    // (or an in-app navigation that remounts the app) does not sign out.
    writeFragment(token);
    return;
  }

  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to remove */
  }
  clearFragment();
}

function writeFragment(token: string) {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    params.set(FRAGMENT_KEY, token);
    const url = `${window.location.pathname}${window.location.search}#${params.toString()}`;
    window.history.replaceState(null, '', url);
  } catch {
    /* If even history is unavailable, memory alone carries this page. */
  }
}

function clearFragment() {
  try {
    if (!window.location.hash.includes(FRAGMENT_KEY)) return;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    params.delete(FRAGMENT_KEY);
    const remaining = params.toString();
    const url = `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ''}`;
    window.history.replaceState(null, '', url);
  } catch {
    /* non-fatal */
  }
}

/**
 * Visible diagnostics. When a session ends we say why in the console, so a
 * report of "it logged me out" can be traced to a transport failure, a
 * rejected token, or storage being unavailable.
 */
export function describeSessionEnvironment() {
  let storage = 'available';
  try {
    window.localStorage.getItem(TOKEN_KEY);
  } catch {
    storage = 'BLOCKED';
  }
  return {
    storage,
    cookies: navigator.cookieEnabled ? 'enabled' : 'BLOCKED',
    tokenSource: memoryToken ? (storageWorks ? 'localStorage' : 'fragment') : 'none',
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
        [CSRF_HEADER]: '1',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError('Network unavailable. Check your connection and try again.', 0, 'network');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');

  if (!isJson) {
    // A non-JSON response almost always means the API is not deployed at this
    // address and a static host answered with an HTML page instead. Say that
    // plainly — it turns a mysterious failure into a fixable one.
    throw new ApiError(
      'The NorthForge API did not respond. If the site is hosted separately from the API, set VITE_API_URL to the API address.',
      502,
      'bad_gateway',
    );
  }

  const payload = (await response.json()) as { ok?: boolean; data?: unknown; error?: string; code?: string; fields?: Record<string, string> };

  if (response.status === 401) {
    onUnauthorized?.();
    throw new ApiError(payload?.error ?? 'Your session expired. Please sign in again.', 401, 'unauthorized');
  }

  if (!response.ok || payload?.ok === false) {
    throw new ApiError(
      payload?.error ?? 'Something went wrong. Please try again.',
      response.status,
      payload?.code ?? 'error',
      payload?.fields,
    );
  }

  return (payload?.data ?? null) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: 'POST', body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: 'PATCH', body, signal }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};

/** Query-string builder that drops empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}
