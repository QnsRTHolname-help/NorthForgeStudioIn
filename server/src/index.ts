import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './env';
import { isOriginAllowed } from './lib/origin';
import { TOKEN_COOKIE } from './auth';
import { db } from './db';
import { attachSession, requireCsrf } from './auth';
import { HttpError, fail, asyncHandler } from './lib/http';

import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import publicRoutes from './routes/public';
import systemRoutes from './routes/system';
import leadsRoutes from './routes/leads';
import clientsRoutes from './routes/clients';
import deliveryRoutes from './routes/delivery';
import billingRoutes from './routes/billing';
import automationRoutes from './routes/automation';
import engagementRoutes from './routes/engagement';
import insightsRoutes from './routes/insights';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ── Security headers (spec §95) ─────────────────────────────── */

/**
 * Two policies, because this process serves two very different things.
 *
 * API responses are machine-readable only, so they get the tightest possible
 * policy. The single-page app is served from the same origin and needs to
 * load its own scripts, styles, fonts and images — a `default-src 'none'`
 * header here would silently break the entire frontend in production.
 */
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const SPA_CSP = [
  "default-src 'self'",
  // No 'unsafe-inline': the theme bootstrap lives in /theme-init.js.
  "script-src 'self'",
  // React writes inline styles for measured layout (charts, transforms).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  const isApi = req.path.startsWith('/api') || req.path === '/health';
  res.setHeader('Content-Security-Policy', isApi ? API_CSP : SPA_CSP);

  if (env.isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin (no Origin header) and allowlisted clients only.
      if (isOriginAllowed(origin)) return callback(null, true);
      console.warn(`[northforge] rejected cross-origin request from ${origin ?? '(none)'}`);
      return callback(new Error('Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-nf-client'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

/* ── Session + CSRF ──────────────────────────────────────────── */
app.use(attachSession);

// Force the CSRF header on every state-changing request, whether or not
// the route itself requires authentication.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireCsrf(req, res, next);
});

/* ── Unauthenticated liveness probe (spec §141) ──────────────── */
// Deliberately thin: no secrets, no record counts, no version strings from
// the environment. Load balancers and uptime monitors hit this.
app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    let database: 'up' | 'down' = 'up';
    try {
      db.prepare('SELECT 1').get();
    } catch {
      database = 'down';
    }
    return res.status(database === 'up' ? 200 : 503).json({
      ok: database === 'up',
      data: { state: database === 'up' ? 'operational' : 'offline', database, uptime: Math.round(process.uptime()) },
    });
  }),
);

/* ── Routes ──────────────────────────────────────────────────── */
// Order matters: routers mounted at `/api` apply their own middleware to
// every request that reaches them, so the most specific mounts must come
// first and the broad `/api` mounts last.
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api', publicRoutes); // POST /api/contact
app.use('/api', deliveryRoutes);
app.use('/api', automationRoutes);
app.use('/api', engagementRoutes);
app.use('/api', insightsRoutes);

app.get(
  '/api',
  asyncHandler(async (_req, res) => {
    return res.json({ ok: true, data: { name: 'NorthForge API', version: '1.0.0' } });
  }),
);

app.use('/api', (_req, res) => fail(res, 404, 'That endpoint does not exist.', 'not_found'));

/* ── Static SPA in production ────────────────────────────────── */
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints asset filenames, so those are safe to cache forever.
        // index.html is the entry point and must always be revalidated.
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }),
  );
  // SPA fallback. express.static is mounted with index: false, so this path
  // bypasses setHeaders — the entry document must never be cached.
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

/* ── Error handling — never leak internals (spec §96) ────────── */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error && err.message === 'Origin not allowed') {
    return fail(res, 403, 'This origin is not allowed to use the NorthForge API.', 'origin_not_allowed');
  }

  if (err instanceof HttpError) {
    // Diagnostics for session problems: a 401 is only actionable if we know
    // whether the request carried a cookie, a bearer token, or neither.
    if (err.status === 401) {
      const hadCookie = Boolean(req.cookies?.[TOKEN_COOKIE]);
      const hadBearer = req.headers.authorization?.startsWith('Bearer ');
      console.warn(
        `[northforge] 401 ${req.method} ${req.path} — cookie: ${hadCookie ? 'yes' : 'no'}, bearer: ${hadBearer ? 'yes' : 'no'}, origin: ${req.headers.origin ?? 'none'} — ${err.code}`,
      );
    }
    return res.status(err.status).json({ ok: false, error: err.message, code: err.code, ...(err.fields ? { fields: err.fields } : {}) });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({ ok: false, error: 'Malformed request body.', code: 'bad_request' });
  }
  if (err instanceof Error && err.message === 'Origin not allowed') {
    return res.status(403).json({ ok: false, error: 'Origin not allowed.', code: 'forbidden' });
  }

  console.error('[northforge] unhandled error:', err);
  return res.status(500).json({
    ok: false,
    error: env.isProd ? 'Something went wrong on our side. Please try again.' : String((err as Error)?.message ?? 'Server error'),
    code: 'server_error',
  });
});

app.listen(env.port, '0.0.0.0', () => {
  console.log(`[northforge] API listening on http://0.0.0.0:${env.port}`);
});

export default app;
