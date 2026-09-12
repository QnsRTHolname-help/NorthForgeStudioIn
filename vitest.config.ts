import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Test configuration.
 *
 * Two projects, because the two halves of the product have different needs:
 * API tests run in Node against the real SQLite database helpers, and
 * component tests (when added) need a DOM.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    // The API tests open a real SQLite database; run them in isolation.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
