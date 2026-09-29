import { execFileSync } from 'node:child_process';
import { resolveTestDatabaseUrl } from './helpers/test-database-url.js';

/**
 * Applies the real migration history to the integration-test database.
 *
 * Using `migrate deploy` (not `db push` or `migrate dev`) means the tests run
 * against the exact SQL that production runs, so a broken migration fails here
 * rather than at deploy time. `migrate reset` also guarantees a clean slate
 * between runs even if a previous run crashed halfway through.
 */
export default function globalSetup(): void {
  const { url, databaseName } = resolveTestDatabaseUrl();

  execFileSync('prisma', ['migrate', 'reset', '--force', '--skip-generate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  process.stdout.write(`[integration] database ready: ${databaseName}\n`);
}
