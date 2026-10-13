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

import { handleEnquiryRelayRequest } from './shared/enquiryRelay';

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

  return {
    name: 'northforge:enquiry-relay',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), '');
      supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
      secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    },
    configureServer(server) {
      server.middlewares.use('/api/enquiries', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        void handleEnquiryRelayRequest(req, res, { supabaseUrl, secretKey }, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/enquiries', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        void handleEnquiryRelayRequest(req, res, { supabaseUrl, secretKey }, next);
      });
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
