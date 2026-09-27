import pino, { type Logger } from 'pino';
import { env } from '../../config/env.js';

const isPrettyEnabled = env.NODE_ENV === 'development' && process.stdout.isTTY === true;

const redactPaths = [
  'token',
  'botToken',
  '*.token',
  '*.botToken',
  'req.headers.authorization',
  'config.DATABASE_URL',
  'DATABASE_URL',
  'BOT_TOKEN',
];

/**
 * Application logger.
 *
 * Secrets are redacted and message bodies are never logged: only identifiers,
 * actions and durations. See `docs` in README ("Logging").
 */
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  ...(isPrettyEnabled
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export type AppLogger = Logger;
