import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../shared/logger/index.js';

/**
 * Single Prisma client for the whole process.
 * Yadet is a modular monolith, so one connection pool is enough.
 */
export const prisma = new PrismaClient({
  log: env.LOG_LEVEL === 'debug' ? ['warn', 'error'] : ['error'],
});

prisma.$on('error', (event) => {
  logger.error({ event: 'prisma.error', target: event.target }, 'prisma error');
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info({ event: 'db.connected' }, 'database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info({ event: 'db.disconnected' }, 'database disconnected');
}

export type Database = PrismaClient;
