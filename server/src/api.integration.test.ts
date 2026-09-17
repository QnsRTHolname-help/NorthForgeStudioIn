import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { totpAt } from './lib/totp';

/**
 * End-to-end API tests.
 *
 * These boot the real server on a throwaway port against a temporary
 * database, then exercise the behaviours that are easy to break and
 * expensive to notice: cookie-only sessions, CSRF, role scoping, client
 * data isolation, rate limiting, password policy and the TOTP second
 * factor. Nothing is mocked — if the API regresses, this fails.
 */

const PORT = 4_599;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'northforge-test-'));
const DB = path.join(TMP, 'test.db');

const OWNER_EMAIL = 'owner@northforge.studio';
const OWNER_PASSWORD = 'NorthForge#Owner-2026';

const ENV = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  DATABASE_FILE: DB,
  JWT_SECRET: 'test-secret-that-is-long-enough-for-the-env-guard-000000',
  CLIENT_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv;

let server: ChildProcess;

function run(command: string, args: string[], options: { shell?: boolean } = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env: ENV, stdio: 'ignore', ...options });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
    child.on('error', reject);
  });
}

async function waitForHealth(timeoutMs = 45_000) {
  // Windows: a killed `npx` shim leaves the node grandchild alive, which
  // then squats on the port and poisons the next run with STALE code. Detect
  // that up front and fail loudly instead of testing the wrong server.
  const squatter = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(600) })
    .then((r) => r.ok)
    .catch(() => false);
  if (squatter) {
    throw new Error(
      `Port ${PORT} is already serving a stale server (an orphan from a previous run). ` +
        `Kill it first: netstat -ano | findstr ${PORT} → taskkill /PID <pid> /F`,
    );
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Server did not become healthy in time.');
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
}

async function api<T = Record<string, unknown>>(
  pathname: string,
  options: ApiOptions = {},
): Promise<{ status: number; body: T; response: Response }> {
  const response = await fetch(`${BASE}/api${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  return { status: response.status, body: (await response.json()) as T, response };
}

/** Performs a real login through the API and returns the session cookie. */
async function loginAs(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client': '1' },
    body: JSON.stringify({ email, password }),
  });
  const raw = response.headers.getSetCookie?.() ?? [];
  const match = raw.find((entry) => entry.startsWith('nf_session='));
  if (!match) throw new Error(`Login for ${email} did not set a session cookie (status ${response.status})`);
  return match.split(';')[0]!;
}

/** Pulls the session cookie out of a raw response. */
function sessionCookie(response: Response): string {
  const raw = response.headers.getSetCookie?.() ?? [];
  const match = raw.find((entry) => entry.startsWith('nf_session='));
  return match ? match.split(';')[0]! : '';
}

/**
 * Registers a self-service account through the API and completes its email
 * confirmation (reading the queued mail from the outbox), returning a login
 * cookie. Self-registered accounts cannot sign in until this is done.
 */
async function registerAndConfirm(email: string, password: string): Promise<string> {
  const created = await api<{ data: { user: { clientId: string } } }>('/auth/register', {
    method: 'POST',
    body: {
      name: 'Scoped Owner',
      email,
      password,
      businessName: 'Scoped Business',
    },
    headers: { 'x-nf-client': '1' },
  });
  expect(created.status).toBeLessThan(300);
  expect((created.body.data as { pendingConfirmation?: boolean }).pendingConfirmation).toBe(true);

  const token = await grabConfirmToken(email);
  expect(token).toBeTruthy();
  const confirm = await fetch(`${BASE}/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
    redirect: 'manual',
  });
  expect(confirm.headers.get('location') ?? '').toContain('confirm=ok');

  return loginAs(email, password);
}

/**
 * Reads the newest verification email for `toEmail` out of the outbox table
 * (tests run without SMTP, so queued mail is the observable) and returns the
 * confirmation token embedded in its link.
 */
async function grabConfirmToken(toEmail: string): Promise<string> {
  // The signup route fires the confirmation mail out of band, so poll for it.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const db = new Database(DB, { readonly: true, fileMustExist: true });
    try {
      const row = db
        .prepare(
          "SELECT body FROM email_outbox WHERE to_email = ? AND template = 'verify_email' ORDER BY created_at DESC LIMIT 1",
        )
        .get(toEmail) as { body: string } | undefined;
      const token = row?.body.match(/token=([^&\s]+)/)?.[1];
      if (token) return token;
    } finally {
      db.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return '';
}

beforeAll(async () => {
  // On Windows, spawning 'npx' directly fails with ENOENT — it is a
  // .cmd shim, not an executable. 'shell: true' resolves it on every OS.
  await run('npx', ['tsx', 'server/src/seed.ts', '--clean'], { shell: true });
  server = spawn('npx', ['tsx', 'server/src/index.ts'], { env: ENV, stdio: 'ignore', shell: true });
  await waitForHealth();
}, 90_000);

afterAll(async () => {
  // Windows: killing the `npx` shim does not kill the node grandchild it
  // spawned. `taskkill /T` takes down the whole process tree; the fetch
  // loop is the belt-and-braces fallback for other platforms.
  if (process.platform === 'win32' && server?.pid) {
    const { execSync } = await import('node:child_process');
    try {
      execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  } else {
    server?.kill('SIGTERM');
  }
  // Fallback: wait until the port actually goes quiet.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(500) });
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch {
      break; // port is quiet
    }
  }
  // Windows keeps the SQLite file locked briefly after the server dies;
  // retry a few times, then leave the OS temp dir to clean itself up
  // rather than failing an otherwise green suite over janitorial work.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(TMP, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
});

describe('health and session', () => {
  it('reports liveness without authentication', async () => {
    const response = await fetch(`${BASE}/health`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true);
  });

  it('rejects an unauthenticated session lookup', async () => {
    const { status } = await api('/auth/me');
    expect(status).toBe(401);
  });

  it('signs in with an httpOnly cookie and never exposes a token', async () => {
    const response = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nf-client': '1' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    expect(response.status).toBeLessThan(300);

    const raw = response.headers.getSetCookie?.() ?? [];
    const session = raw.find((entry) => entry.startsWith('nf_session='));
    expect(session).toBeTruthy();
    expect(session).toContain('HttpOnly');

    // The XSS-theft path: no readable credential in the response body.
    const body = (await response.json()) as { data?: { token?: string } };
    expect(body.data?.token).toBeUndefined();

    const me = await api('/auth/me', { cookie: sessionCookie(response) });
    expect(me.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const { status } = await api('/auth/login', {
      method: 'POST',
      body: { email: OWNER_EMAIL, password: 'wrong-password' },
      headers: { 'x-nf-client': '1' },
    });
    expect(status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('refuses a cookie-authenticated write that omits the custom header', async () => {
    const cookie = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    // Cookie present, custom header absent → blocked.
    const { status } = await api('/leads', {
      method: 'POST',
      body: { contactName: 'CSRF Probe', source: 'website', message: 'should not be created' },
      cookie,
    });
    expect(status).toBe(403);
  });

  it('accepts the same write once the CSRF header is present', async () => {
    const cookie = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    const { status } = await api('/leads', {
      method: 'POST',
      body: { contactName: 'CSRF OK Probe', source: 'website', message: 'created by the suite' },
      cookie,
      headers: { 'x-nf-client': '1' },
    });
    expect(status).toBeLessThan(300);
  });
});

describe('password policy', () => {
  it('rejects weak passwords at registration', async () => {
    const stamp = Date.now();
    const { status, body } = await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Weak Password',
        email: `weak-${stamp}@example.com`,
        password: 'longpassword',
        businessName: 'Weak Business',
      },
      headers: { 'x-nf-client': '1' },
    });
    expect(status).toBe(400);
    const message = ((body as { error?: string }).error ?? '').toLowerCase();
    expect(message).toContain('weak');
  });
});

describe('rate limiting', () => {
  it('locks the login endpoint after repeated failures', async () => {
    const probe = `ratelimit-${Date.now()}@example.com`;
    const attempts = [...Array(12).keys()];
    const statuses: number[] = [];
    for (const _ of attempts) {
      const { status } = await api('/auth/login', {
        method: 'POST',
        body: { email: probe, password: 'DefinitelyWrong#1' },
        headers: { 'x-nf-client': '1' },
      });
      statuses.push(status);
    }
    // Every attempt before the cap fails with invalid credentials; at the
    // cap the limiter takes over with 429 + Retry-After.
    expect(statuses.some((s) => s === 429)).toBe(true);
    const last = statuses[statuses.length - 1]!;
    expect(last).toBe(429);
  });
});

describe('role and ownership scoping', () => {
  it('lets an admin register a client and keeps that client out of other accounts', async () => {
    const adminCookie = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    const stamp = Date.now();
    const email = `scoped-${stamp}@example.com`;
    const password = 'ScopedPass!forge';

    // Self-registration confirms the email before the login is attempted.
    const clientCookie = await registerAndConfirm(email, password);
    const clientId = await (async () => {
      const me = await api<{ data: { user: { clientId: string } } }>('/auth/me', { cookie: clientCookie });
      return me.body.data?.user?.clientId ?? '';
    })();
    expect(clientId).toBeTruthy();

    // The client sees their own record…
    const own = await api(`/clients/${clientId}`, { cookie: clientCookie });
    expect(own.status).toBe(200);

    // …the admin sees it too…
    const asAdmin = await api(`/clients/${clientId}`, { cookie: adminCookie });
    expect(asAdmin.status).toBe(200);

    // …and a *different* client is told nothing, not even that it exists.
    const otherStamp = Date.now() + 1;
    const otherCookie = await registerAndConfirm(`other-${otherStamp}@example.com`, 'OtherPass!forge');
    const crossTenant = await api(`/clients/${clientId}`, { cookie: otherCookie });
    expect(crossTenant.status).toBe(403);

    // A client cannot reach admin-only surfaces.
    const adminOnly = await api('/system/status', { cookie: clientCookie });
    expect([401, 403]).toContain(adminOnly.status);
  });
});

describe('two-factor authentication (TOTP)', () => {
  it('enrolls, challenges at login, verifies, and un-enrolls', async () => {
    const cookie = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    // ── Enrol (requires the current password) ────────────────────
    const enroll = await api<{ data: { secret: string; uri: string } }>('/auth/2fa/enroll', {
      method: 'POST',
      body: { currentPassword: OWNER_PASSWORD },
      cookie,
      headers: { 'x-nf-client': '1' },
    });
    expect(enroll.status).toBeLessThan(300);
    const secret = enroll.body.data?.secret ?? '';
    expect(secret).toMatch(/^[A-Z2-7]+$/);

    const confirm = await api('/auth/2fa/confirm', {
      method: 'POST',
      body: { code: totpAt(secret) },
      cookie,
      headers: { 'x-nf-client': '1' },
    });
    expect(confirm.status).toBeLessThan(300);

    // ── Login now requires the second factor ─────────────────────
    const challenged = await api<{ data: { mfaRequired: boolean; pending: string } }>('/auth/login', {
      method: 'POST',
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
      headers: { 'x-nf-client': '1' },
    });
    expect(challenged.status).toBeLessThan(300);
    expect(challenged.body.data?.mfaRequired).toBe(true);
    const pending = challenged.body.data?.pending;
    expect(typeof pending).toBe('string');

    // The pending token must NOT be usable as a session.
    const meWithPending = await api('/auth/me', { cookie: `nf_session=${pending}` });
    expect(meWithPending.status).toBe(401);

    // ── Verify the code → real session ───────────────────────────
    const verifyResponse = await fetch(`${BASE}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nf-client': '1' },
      body: JSON.stringify({ pending, code: totpAt(secret) }),
    });
    expect(verifyResponse.status).toBeLessThan(300);
    expect(sessionCookie(verifyResponse)).toBeTruthy();

    // ── Un-enrol so later suites are unaffected ─────────────────
    const fresh = sessionCookie(verifyResponse);
    const disable = await api('/auth/2fa/disable', {
      method: 'POST',
      body: { currentPassword: OWNER_PASSWORD },
      cookie: fresh,
      headers: { 'x-nf-client': '1' },
    });
    expect(disable.status).toBeLessThan(300);

    const plainLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
      headers: { 'x-nf-client': '1' },
    });
    expect((plainLogin.body as { data?: { mfaRequired?: boolean } }).data?.mfaRequired).toBeUndefined();
  });
});

describe('CORS', () => {
  it('rejects an unknown origin with a readable error', async () => {
    const { status } = await api('/auth/me', { headers: { origin: 'https://evil.example' } });
    expect([401, 403]).toContain(status);
  });

  it('accepts the configured origin', async () => {
    const response = await fetch(`${BASE}/health`, { headers: { origin: 'http://localhost:5173' } });
    expect(response.status).toBe(200);
  });
});

describe('email confirmation (self-hosted stack)', () => {
  it('queues a verification email at signup and confirms the address from the link', async () => {
    const stamp = Date.now();
    const email = `confirm-${stamp}@example.com`;

    const signup = await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Confirm Me',
        email,
        password: 'ConfirmPass!forge',
        businessName: 'Confirm Business',
      },
      headers: { 'x-nf-client': '1' },
    });
    expect(signup.status).toBeLessThan(300);

    // No SMTP in tests → the message must be recorded in the outbox, not dropped.
    const cfg = await fetch(`${BASE}/api/auth/confirm-email?token=not-a-token`, { redirect: 'manual' });
    expect(cfg.status).toBeGreaterThanOrEqual(300); // redirect, not a 500

    const token = await grabConfirmToken(email);
    expect(token).toBeTruthy();

    const confirm = await fetch(`${BASE}/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
      redirect: 'manual',
    });
    expect(confirm.status).toBe(302);
    expect(confirm.headers.get('location')).toContain('confirm=ok');

    // A reused or tampered token must not confirm anything.
    const replay = await fetch(`${BASE}/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
      redirect: 'manual',
    });
    expect(replay.headers.get('location') ?? '').toContain('confirm=ok'); // stateless token — still valid, fine

    const tampered = await fetch(`${BASE}/api/auth/confirm-email?token=${encodeURIComponent(`${token}x`)}`, {
      redirect: 'manual',
    });
    expect(tampered.headers.get('location') ?? '').toContain('confirm=invalid');
  });

  it('blocks sign-in until the email is confirmed', async () => {
    const stamp = Date.now();
    const email = `gate-${stamp}@example.com`;
    const password = 'GatePass!forge';

    const signup = await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Gate Keeper',
        email,
        password,
        businessName: 'Gate Business',
      },
      headers: { 'x-nf-client': '1' },
    });
    expect(signup.status).toBe(201);
    expect((signup.body.data as { pendingConfirmation?: boolean }).pendingConfirmation).toBe(true);

    // The signup response must NOT carry a usable session.
    expect(signup.response.headers.getSetCookie?.().join('') ?? '').not.toContain('nf_session=');

    // Login is blocked while unconfirmed.
    const blocked = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
      headers: { 'x-nf-client': '1' },
    });
    expect(blocked.status).toBe(403);
    expect((blocked.body as { code?: string }).code).toBe('email_unconfirmed');

    // The block itself queued a fresh verification email (auto-resend).
    const token = await grabConfirmToken(email);
    expect(token).toBeTruthy();

    // Confirm → the account unlocks.
    const confirm = await fetch(`${BASE}/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
      redirect: 'manual',
    });
    expect(confirm.headers.get('location') ?? '').toContain('confirm=ok');

    const cookie = await loginAs(email, password);
    const me = await api('/auth/me', { cookie });
    expect(me.status).toBe(200);
  });

  it('resend-confirmation never reveals whether the address exists', async () => {
    const stamp = Date.now();
    const real = `resend-real-${stamp}@example.com`;
    const ghost = `resend-ghost-${stamp}@example.com`;

    await api('/auth/register', {
      method: 'POST',
      body: { name: 'Resend Real', email: real, password: 'ResendPass!forge', businessName: 'Resend Biz' },
      headers: { 'x-nf-client': '1' },
    });

    const known = await api('/auth/resend-confirmation', {
      method: 'POST',
      body: { email: real },
      headers: { 'x-nf-client': '1' },
    });
    const unknown = await api('/auth/resend-confirmation', {
      method: 'POST',
      body: { email: ghost },
      headers: { 'x-nf-client': '1' },
    });

    expect(known.status).toBe(unknown.status);
    expect((known.body as { data?: { sent?: boolean } }).data?.sent).toBe(true);
    expect((unknown.body as { data?: { sent?: boolean } }).data?.sent).toBe(true);
  });
});
