import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * There is one backend: Supabase (Postgres + RLS + Auth + Storage + Edge
 * Functions). The browser talks to it directly with the publishable key, so
 * there is no `/api` proxy — the legacy Express/SQLite server and its proxy
 * were removed rather than left configured against a service that no longer
 * exists.
 */
export default defineConfig({
  plugins: [react()],
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
