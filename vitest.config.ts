import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests need a real PostgreSQL database and run via
    // `pnpm test:integration` (vitest.integration.config.ts) instead.
    exclude: ['tests/integration/**', 'node_modules/**', 'dist/**'],
    testTimeout: 10_000,
    clearMocks: true,
  },
});
