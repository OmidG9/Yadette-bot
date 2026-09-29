import { config as loadDotenv } from 'dotenv';

export const TEST_DB_ENV_KEY = 'TEST_DATABASE_URL';

const MISSING =
  `${TEST_DB_ENV_KEY} is not set.\n` +
  'Integration tests run against a real PostgreSQL database and refuse to guess.\n' +
  'Add a dedicated database (never your development one) to .env:\n' +
  '\n' +
  '  TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/yadette_test?schema=public"\n';

/** Database name from a postgres URL, or `null` when the URL cannot be parsed. */
export function databaseNameOf(connectionString: string): string | null {
  try {
    const name = decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''));
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export interface ResolvedTestDatabase {
  url: string;
  databaseName: string;
}

/**
 * Resolves the integration-test database URL and refuses to point the suite at
 * the development database.
 *
 * This is the last line of defence: every test truncates tables between cases,
 * so pointing `TEST_DATABASE_URL` at the same database as `DATABASE_URL` would
 * destroy real data. We compare database names rather than full URLs because
 * credentials and `?schema=` params legitimately differ.
 */
export function resolveTestDatabaseUrl(): ResolvedTestDatabase {
  loadDotenv({ override: false, quiet: true });

  const url = process.env[TEST_DB_ENV_KEY];
  if (!url || url.trim().length === 0) {
    throw new Error(MISSING);
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith('postgres')) {
    throw new Error(`${TEST_DB_ENV_KEY} must be a postgres:// URL.`);
  }

  const databaseName = databaseNameOf(trimmed);
  if (!databaseName) {
    throw new Error(`${TEST_DB_ENV_KEY} does not name a database: ${trimmed}`);
  }

  const devDatabaseName = process.env.DATABASE_URL
    ? databaseNameOf(process.env.DATABASE_URL)
    : null;
  if (devDatabaseName && devDatabaseName === databaseName) {
    throw new Error(
      `${TEST_DB_ENV_KEY} and DATABASE_URL both point at database "${databaseName}".\n` +
        'Integration tests truncate every table between cases, so this would erase ' +
        'your data. Create a separate database (e.g. "yadette_test") and use it here.',
    );
  }

  return { url: trimmed, databaseName };
}
