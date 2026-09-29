import { resolveTestDatabaseUrl } from './helpers/test-database-url.js';

/**
 * Runs in every test worker before the test file's module graph is loaded.
 *
 * `config/env.ts` imports `dotenv/config`, which would otherwise leave
 * `DATABASE_URL` pointing at the development database for the whole worker.
 * Repointing it here — before any test module imports Prisma — is what makes
 * the repositories under test talk to the test database instead.
 */
const { url } = resolveTestDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
