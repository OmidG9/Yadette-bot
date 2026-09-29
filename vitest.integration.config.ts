import { defineConfig } from 'vitest/config';

/**
 * Integration tests run the real Prisma repositories against a real PostgreSQL
 * database. They are kept out of `vitest.config.ts` on purpose: unit tests must
 * stay runnable anywhere with no database, while these need `TEST_DATABASE_URL`
 * and the migration history applied.
 *
 *   pnpm test:integration
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    // Migration application in globalSetup is slower than a unit test.
    globalSetup: ['tests/integration/global-setup.ts'],
    // Repoint `DATABASE_URL` before any test module imports Prisma.
    setupFiles: ['tests/integration/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    clearMocks: true,
    // Every test truncates shared tables, so files must not run concurrently.
    fileParallelism: false,
  },
});
