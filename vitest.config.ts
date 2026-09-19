import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Test configuration.
 *
 * Everything runs in Node. The Supabase Edge Functions keep their pure,
 * dependency-free logic in `supabase/functions/_shared/`, which is included
 * below so the signature check and request validation are executed by the
 * test suite rather than trusted by inspection.
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
    include: [
      'src/**/*.test.{ts,tsx}',
      'shared/**/*.test.ts',
      'supabase/**/*.test.ts',
    ],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
