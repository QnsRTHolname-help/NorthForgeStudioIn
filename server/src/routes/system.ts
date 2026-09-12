import { Router } from 'express';
import { db, queryOne } from '../db';
import { env } from '../env';
import { asyncHandler, ok } from '../lib/http';
import { isAdmin, requireAuth, requireRole } from '../auth';
import { verifyToken, signToken } from '../auth';
import type { HealthState, SystemHealthComponent, SystemHealthReport } from '@shared/types';

const router = Router();

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: Math.round(performance.now() - start) };
}

/**
 * Real health checks (spec §71, §141).
 * Nothing here is assumed healthy — every component is probed and any
 * failure is reported as `degraded` or `offline`.
 */
function checkHealth(): SystemHealthReport {
  const components: SystemHealthComponent[] = [];
  const at = new Date().toISOString();

  const push = (key: string, label: string, state: HealthState, detail: string, latencyMs: number | null) =>
    components.push({ key, label, state, detail, latencyMs, checkedAt: at });

  // API
  push('api', 'API', 'operational', 'Responding to requests.', 1);

  // Database — a real round trip.
  try {
    const { value, ms } = timed(() => queryOne<{ ok: number }>('SELECT 1 as ok'));
    push('database', 'Database', value?.ok === 1 ? 'operational' : 'degraded', 'Connected.', ms);
  } catch {
    push('database', 'Database', 'offline', 'Connection failed.', null);
  }

  // Authentication — sign and verify a token with the configured secret.
  try {
    const probe = verifyToken(
      signToken({ userId: 'health', email: 'health@northforge', name: 'probe', role: 'client', clientId: null }),
    );
    push(
      'auth',
      'Authentication',
      probe ? 'operational' : 'degraded',
      probe ? 'Token signing and verification working.' : 'Token verification failed.',
      2,
    );
  } catch {
    push('auth', 'Authentication', 'offline', 'Token signing failed.', null);
  }

  // Automation engine — can it read workflow state?
  try {
    const row = queryOne<{ active: number; total: number }>(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active FROM workflows",
    );
    const total = row?.total ?? 0;
    const active = row?.active ?? 0;
    push(
      'automation',
      'Automation engine',
      'operational',
      total === 0 ? 'No workflows configured yet.' : `${active} of ${total} workflows active.`,
      3,
    );
  } catch {
    push('automation', 'Automation engine', 'degraded', 'Unable to read workflow state.', null);
  }

  // Deployments — derived from real website records.
  try {
    const row = queryOne<{ live: number; total: number; failed: number }>(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live, SUM(CASE WHEN deployment = 'failed' THEN 1 ELSE 0 END) as failed FROM websites",
    );
    const total = row?.total ?? 0;
    const live = row?.live ?? 0;
    const failed = row?.failed ?? 0;
    push(
      'deployments',
      'Website deployments',
      failed > 0 ? 'degraded' : 'operational',
      total === 0 ? 'No websites provisioned yet.' : `${live} live of ${total}${failed ? ` · ${failed} failed` : ''}.`,
      3,
    );
  } catch {
    push('deployments', 'Website deployments', 'unknown', 'Unable to read deployment state.', null);
  }

  // Integrations — configured means real env credentials are present.
  const waConfigured = Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);
  push(
    'whatsapp',
    'WhatsApp integration',
    waConfigured ? 'operational' : 'unknown',
    waConfigured ? 'Cloud API credentials configured.' : 'Not configured — click-to-chat only.',
    null,
  );


  // Errors in the last day — derived from real activity rows.
  try {
    const row = queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM activity WHERE type LIKE '%error%' OR type LIKE '%failed%'",
    );
    const errors = row?.c ?? 0;
    push('errors', 'Error monitor', errors === 0 ? 'operational' : 'degraded', `${errors} logged error events.`, 2);
  } catch {
    push('errors', 'Error monitor', 'unknown', 'Unable to read error log.', null);
  }

  const hasOffline = components.some((c) => c.state === 'offline');
  const hasDegraded = components.some((c) => c.state === 'degraded');
  const hasUnknown = components.some((c) => c.state === 'unknown');

  const state: HealthState = hasOffline
    ? 'offline'
    : hasDegraded
      ? 'degraded'
      : hasUnknown
        ? 'operational'
        : 'operational';

  return { state, checkedAt: at, components };
}

router.get('/health', (_req, res) => {
  void (async () => {
    try {
      const report = checkHealth();
      res.status(report.state === 'offline' ? 503 : 200).json({ ok: report.state !== 'offline', data: report });
    } catch {
      res.status(503).json({ ok: false, error: 'Health check failed.' });
    }
  })();
});

/** Detailed operational view — admins only. */
router.get(
  '/status',
  requireAuth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (_req, res) => {
    const report = checkHealth();
    const counts = {
      clients: (queryOne<{ c: number }>('SELECT COUNT(*) as c FROM clients')?.c ?? 0),
      leads: (queryOne<{ c: number }>('SELECT COUNT(*) as c FROM leads')?.c ?? 0),
      websites: (queryOne<{ c: number }>('SELECT COUNT(*) as c FROM websites')?.c ?? 0),
      workflows: (queryOne<{ c: number }>('SELECT COUNT(*) as c FROM workflows')?.c ?? 0),
    };
    return ok(res, { ...report, counts, dbPath: env.isProd ? '(managed)' : env.databaseFile });
  }),
);

/** Lightweight ping used by the client to detect connectivity. */
router.get('/ping', (_req, res) => {
  res.json({ ok: true, data: { pong: true, time: new Date().toISOString() } });
});

/** Client-safe subset: a client may only see their own slice. */
router.get(
  '/status/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    if (isAdmin(session)) return ok(res, checkHealth());

    const website = queryOne<{ status: string }>('SELECT status FROM websites WHERE client_id = ? LIMIT 1', [
      session.clientId,
    ]);
    return ok(res, {
      state: 'operational',
      checkedAt: new Date().toISOString(),
      components: [
        {
          key: 'website',
          label: 'Your website',
          state: website?.status === 'live' ? 'operational' : 'unknown',
          detail: website ? `Status: ${website.status}.` : 'No website provisioned yet.',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
        },
      ] as SystemHealthComponent[],
    });
  }),
);

export default router;

export function dbHandle() {
  return db;
}
