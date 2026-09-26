import 'dotenv/config';
import { z } from 'zod';

/** Validates that a string is a real IANA timezone (e.g. `Asia/Tehran`). */
function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  BOT_TOKEN: z
    .string()
    .min(20, 'BOT_TOKEN looks invalid (expected the token from @BotFather)'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((value) => value.startsWith('postgres'), 'DATABASE_URL must be a postgres:// URL'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  DEFAULT_TIMEZONE: z
    .string()
    .default('Asia/Tehran')
    .refine(isIanaTimeZone, 'DEFAULT_TIMEZONE must be a valid IANA timezone'),
  DEFAULT_LANGUAGE: z.enum(['fa']).default('fa'),
  REMINDER_CHECK_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60 * 1000, 'REMINDER_CHECK_INTERVAL_MS is unreasonably large')
    .default(60_000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');

    // Fail fast: never start with an invalid configuration.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

export const env: Env = loadEnv();
