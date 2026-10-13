import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { INDEXABLE_ROUTES, ROUTES, SPA_REWRITES } from './shared/routes';

/**
 * Emits the route table into `dist/route-meta.json` at build time.
 *
 * The post-build steps (prerender, sitemap) run under plain Node and cannot
 * import TypeScript, so without this they would each keep a private copy of
 * the route list — which is how a sitemap ends up advertising a page whose
 * metadata nobody updated. They read this file instead.
 */
function emitRouteMeta(): Plugin {
  return {
    name: 'northforge:emit-route-meta',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'route-meta.json',
        source: JSON.stringify(
          {
            routes: ROUTES,
            indexable: INDEXABLE_ROUTES.map((route) => route.path),
            spaRewrites: SPA_REWRITES,
          },
          null,
          2,
        ),
      });
    },
  };
}

/**
 * Server-side relay for public contact enquiries (`/api/enquiries`).
 *
 * When a Supabase project has applied migration 0014 before migration 0017,
 * `app_submit_enquiry()` raises 42883 (`function gen_random_bytes(integer) does
 * not exist`) because `pgcrypto` lives in `extensions`, while direct `anon`
 * INSERT on `enquiries` was revoked by 0014. This server-side middleware
 * enforces the same validation and rate limits and writes the enquiry via
 * PostgREST using the server-only secret key (never exposed to the browser),
 * firing the `on_enquiry_created` trigger so leads and admin notifications are
 * created normally.
 */
function enquiryRelayPlugin(): Plugin {
  let supabaseUrl = '';
  let secretKey = '';

  const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  const handleRequest = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== 'POST') {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;

      const name = String(body.name ?? '').trim().slice(0, 120);
      const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);

      if (!name) {
        sendJson(res, 400, { error: { code: 'validation', message: 'Enter your name.' } });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        sendJson(res, 400, { error: { code: 'validation', message: 'Enter a valid email address.' } });
        return;
      }

      if (!supabaseUrl || !secretKey) {
        sendJson(res, 503, { error: { code: 'service_unavailable', message: 'Enquiry relay is not configured.' } });
        return;
      }

      const headers = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      };

      // Per-address throttle (1/minute, 3/hour) and global throttle (40/10m)
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      const oneMinAgo = new Date(now - 60 * 1000).toISOString();
      const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();

      const recentRes = await fetch(
        `${supabaseUrl}/rest/v1/enquiries?select=email,created_at&created_at=gt.${encodeURIComponent(oneHourAgo)}`,
        { headers },
      );
      if (recentRes.ok) {
        const recentRows = (await recentRes.json()) as Array<{ email?: string; created_at?: string }>;
        const forEmailHour = recentRows.filter((r) => (r.email ?? '').toLowerCase() === email);
        if (forEmailHour.length >= 3) {
          sendJson(res, 429, {
            error: { code: 'validation', message: 'We already have this enquiry — we will be in touch.' },
          });
          return;
        }
        const forEmailMin = forEmailHour.filter((r) => (r.created_at ?? '') > oneMinAgo);
        if (forEmailMin.length >= 1) {
          sendJson(res, 429, {
            error: { code: 'validation', message: 'Please wait a moment before sending another enquiry.' },
          });
          return;
        }
        const globalTenMin = recentRows.filter((r) => (r.created_at ?? '') > tenMinAgo);
        if (globalTenMin.length >= 40) {
          sendJson(res, 429, {
            error: {
              code: 'validation',
              message:
                'We are receiving a lot of enquiries right now — please try again shortly, or message us on WhatsApp.',
            },
          });
          return;
        }
      }

      const cleanOrNull = (val: unknown, maxLen: number): string | null => {
        if (typeof val !== 'string') return null;
        const trimmed = val.trim().slice(0, maxLen);
        return trimmed.length > 0 ? trimmed : null;
      };

      const rawId = typeof body.id === 'string' && /^eq_[0-9a-f]{12}$/.test(body.id) ? body.id : undefined;
      const insertRow: Record<string, unknown> = {
        ...(rawId ? { id: rawId } : {}),
        name,
        email,
        business_name: cleanOrNull(body.business_name, 200),
        whatsapp: cleanOrNull(body.whatsapp, 40),
        business_type: cleanOrNull(body.business_type, 80),
        current_tools: cleanOrNull(body.current_tools, 300),
        bottleneck: cleanOrNull(body.bottleneck, 300),
        monthly_enquiries: cleanOrNull(body.monthly_enquiries, 80),
        message: cleanOrNull(body.message, 4000),
        plan: cleanOrNull(body.plan, 80),
      };

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/enquiries`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(insertRow),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        sendJson(res, insertRes.status, {
          error: { code: 'error', message: errText || 'Could not save enquiry.' },
        });
        return;
      }

      const inserted = (await insertRes.json()) as Array<{ id?: string }>;
      const reference = inserted?.[0]?.id ?? rawId ?? null;
      sendJson(res, 200, { received: true, reference });
    } catch {
      sendJson(res, 500, { error: { code: 'server_error', message: 'Could not process enquiry.' } });
    }
  };

  return {
    name: 'northforge:enquiry-relay',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), '');
      supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
      secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    },
    configureServer(server) {
      server.middlewares.use('/api/enquiries', handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/enquiries', handleRequest);
    },
  };
}

/**
 * There is one backend: Supabase (Postgres + RLS + Auth + Storage + Edge
 * Functions). The browser talks to it directly with the publishable key, with
 * `/api/enquiries` providing a resilient server-side fallback when migration
 * 0017 has not yet been applied.
 */
export default defineConfig({
  plugins: [react(), emitRouteMeta(), enquiryRelayPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Accept the sandboxed preview hostnames used by hosted preview environments.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['gsap', 'lenis'],
          charts: [],
        },
      },
    },
  },
});
