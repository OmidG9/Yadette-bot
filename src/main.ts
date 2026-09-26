import { env } from './config/env.js';
import { createContainer } from './container.js';
import { createBot } from './bot/bot.js';
import { connectDatabase, disconnectDatabase } from './database/client.js';
import { Scheduler } from './modules/reminders/reminder.scheduler.js';
import { BirthdayReminderJob } from './jobs/birthday-reminder.job.js';
import { logger } from './shared/logger/index.js';
import { toError } from './shared/errors/index.js';

async function main(): Promise<void> {
  logger.info(
    { event: 'app.starting', env: env.NODE_ENV, timezone: env.DEFAULT_TIMEZONE },
    'starting Yadet bot',
  );

  await connectDatabase();

  const { services, flowStore } = createContainer();
  const bot = createBot({ token: env.BOT_TOKEN, services, flowStore });

  await bot.init();
  logger.info({ event: 'bot.initialized', username: bot.botInfo.username }, 'telegram bot ready');

  const job = new BirthdayReminderJob({ reminders: services.reminders, users: services.users, bot });
  const scheduler = new Scheduler([job], env.REMINDER_CHECK_INTERVAL_MS);

  // Check once at boot, then on the interval.
  await scheduler.runOnce();
  scheduler.start();

  await bot.start({ onStart: (info) => logger.info({ event: 'bot.started', username: info.username }, 'polling started') });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ event: 'app.shutdown', signal }, 'shutting down');

    scheduler.stop();
    await bot.stop().catch((error: unknown) => {
      logger.warn({ event: 'bot.stop.failed', err: toError(error) }, 'bot stop failed');
    });
    await disconnectDatabase().catch((error: unknown) => {
      logger.warn({ event: 'db.disconnect.failed', err: toError(error) }, 'db disconnect failed');
    });

    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ event: 'process.unhandledRejection', err: toError(reason) }, 'unhandled rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ event: 'process.uncaughtException', err: error }, 'uncaught exception');
    void shutdown('uncaughtException');
  });
}

main().catch((error: unknown) => {
  logger.fatal({ event: 'app.crashed', err: toError(error) }, 'fatal startup error');
  process.exit(1);
});
