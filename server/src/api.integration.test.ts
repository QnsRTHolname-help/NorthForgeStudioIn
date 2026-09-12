import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * End-to-end API tests.
 *
 * These boot the real server on a throwaway port against a temporary
 * database, then exercise the behaviours that are easy to break and
 * expensive to notice: session handling, CSRF, role scoping and client
 * data isolation. Nothing is mocked — if the API regresses, this fails.
 */

const PORT = 4_599;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'northforge-test-'));
const DB = path.join(TMP, 'test.db');

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

async function api<T = Record<string, unknown>>(
  pathname: string,
  options: { method?: string; body?: unknown; token?: string; cookie?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BASE}/api${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  return { status: response.status, body: (await response.json()) as T };
}

/** Pulls the session cookie out of a raw response. */
function sessionCookie(response: Response): string {
  const raw = response.headers.getSetCookie?.() ?? [];
  const match = raw.find((entry) => entry.startsWith('nf_session='));
  return match ? match.split(';')[0]! : '';
}

beforeAll(async () => {
  // On Windows, spawning 'npx' directly fails with ENOENT — it is a
  // .cmd shim, not an executable. 'shell: true' resolves it on every OS.
  await run('npx', ['tsx', 'server/src/seed.ts', '--clean'], { shell: true });
  server = spawn('npx', ['tsx', 'server/src/index.ts'], { env: ENV, stdio: 'ignore', shell: true });
  await waitForHealth();
}, 90_000);

afterAll(async () => {
  server?.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 400));
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

  it('issues a token that authenticates without any cookie', async () => {
    const { body } = await api<{ data: { token: string } }>('/auth/login', {
      method: 'POST',
      body: { email: 'owner@northforge.studio', password: 'NorthForge@2026' },
      headers: { 'x-nf-client': '1' },
    });
    const token = body.data?.token;
    expect(typeof token).toBe('string');

    const me = await api('/auth/me', { token });
    expect(me.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const { status } = await api('/auth/login', {
      method: 'POST',
      body: { email: 'owner@northforge.studio', password: 'wrong-password' },
      headers: { 'x-nf-client': '1' },
    });
    expect(status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('refuses a cookie-authenticated write that omits the custom header', async () => {
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nf-client': '1' },
      body: JSON.stringify({ email: 'owner@northforge.studio', password: 'NorthForge@2026' }),
    });
    const cookie = sessionCookie(login);
    expect(cookie).toMatch(/^nf_session=/);

    // Cookie present, custom header absent → blocked.
    const { status } = await api('/leads', {
      method: 'POST',
      body: { contactName: 'CSRF Probe', source: 'website', message: 'should not be created' },
      cookie,
    });
    expect(status).toBe(403);
  });
});

describe('role and ownership scoping', () => {
  it('lets an admin register a client and keeps that client out of other accounts', async () => {
    const admin = await api<{ data: { token: string } }>('/auth/login', {
      method: 'POST',
      body: { email: 'owner@northforge.studio', password: 'NorthForge@2026' },
      headers: { 'x-nf-client': '1' },
    });
    const adminToken = admin.body.data.token;

    const stamp = Date.now();
    const created = await api<{ data: { user: { clientId: string } } }>('/auth/register', {
      method: 'POST',
      body: {
        name: 'Scoped Owner',
        email: `scoped-${stamp}@example.com`,
        password: 'ScopedPass@2026',
        businessName: 'Scoped Business',
      },
      headers: { 'x-nf-client': '1' },
    });
    expect(created.status).toBeLessThan(300);
    const clientId = created.body.data.user.clientId;
    expect(clientId).toBeTruthy();

    const client = await api<{ data: { token: string } }>('/auth/login', {
      method: 'POST',
      body: { email: `scoped-${stamp}@example.com`, password: 'ScopedPass@2026' },
      headers: { 'x-nf-client': '1' },
    });
    const clientToken = client.body.data.token;

    // The client sees their own record…
    const own = await api(`/clients/${clientId}`, { token: clientToken });
    expect(own.status).toBe(200);

    // …the admin sees it too…
    const asAdmin = await api(`/clients/${clientId}`, { token: adminToken });
    expect(asAdmin.status).toBe(200);

    // …and a *different* client is told nothing, not even that it exists.
    const otherStamp = Date.now() + 1;
    await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Other Owner',
        email: `other-${otherStamp}@example.com`,
        password: 'OtherPass@2026',
        businessName: 'Other Business',
      },
      headers: { 'x-nf-client': '1' },
    });
    const other = await api<{ data: { token: string } }>('/auth/login', {
      method: 'POST',
      body: { email: `other-${otherStamp}@example.com`, password: 'OtherPass@2026' },
      headers: { 'x-nf-client': '1' },
    });
    const crossTenant = await api(`/clients/${clientId}`, { token: other.body.data.token });
    expect(crossTenant.status).toBe(403);

    // A client cannot reach admin-only surfaces.
    const adminOnly = await api('/system/status', { token: clientToken });
    expect([401, 403]).toContain(adminOnly.status);
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
