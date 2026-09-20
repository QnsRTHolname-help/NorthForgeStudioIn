import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
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
 * There is one backend: Supabase (Postgres + RLS + Auth + Storage + Edge
 * Functions). The browser talks to it directly with the publishable key, so
 * there is no `/api` proxy — the legacy Express/SQLite server and its proxy
 * were removed rather than left configured against a service that no longer
 * exists.
 */
export default defineConfig({
  plugins: [react(), emitRouteMeta()],
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
