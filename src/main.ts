import { env } from './config/env.js';
import { featureFlags } from './config/feature-flags.js';
import { createContainer } from './container.js';
import { createBot } from './bot/bot.js';
import { sendText } from './bot/helpers.js';
import { connectDatabase, disconnectDatabase } from './database/client.js';
import { Scheduler } from './modules/reminders/reminder.scheduler.js';
import { healthText } from './modules/health/health.service.js';
import { BirthdayReminderJob } from './jobs/birthday-reminder.job.js';
import { logger } from './shared/logger/index.js';
import { toError } from './shared/errors/index.js';
import { installShutdownHandlers } from './shared/lifecycle/shutdown.js';
import { t } from './shared/i18n/index.js';

async function main(): Promise<void> {
  logger.info(
    { event: 'app.starting', env: env.NODE_ENV, timezone: env.DEFAULT_TIMEZONE },
    'starting Yadette bot',
  );

  await connectDatabase();

  // The scheduler is the health probe's subject, so the container is built
  // against the loop rather than the loop being told about the container.
  const schedulerRef: { probe: Scheduler | null } = { probe: null };
  const { services, flowStore } = createContainer({
    isRunning: () => schedulerRef.probe?.isRunning() ?? false,
  });
  const bot = createBot({ token: env.BOT_TOKEN, services, flowStore });

  await bot.init();
  logger.info({ event: 'bot.initialized', username: bot.botInfo.username }, 'telegram bot ready');

  // Visible shortcut list in the Telegram UI: /start, /about, /help, /cancel.
  // A disabled feature leaves no trace, so its command is not advertised either.
  const commands = [
    { command: 'start', description: t('commands.start') },
    { command: 'about', description: t('commands.about') },
    { command: 'help', description: t('commands.help') },
    { command: 'cancel', description: t('commands.cancel') },
  ];
  if (featureFlags.isEnabled('healthCheck')) {
    commands.push({ command: 'health', description: t('commands.health') });
  }
  await bot.api.setMyCommands(commands);

  const job = new BirthdayReminderJob({
    reminders: services.reminders,
    users: services.users,
    bot,
    // §3.5 — off means the reminder carries no snooze button at all.
    canSnooze: featureFlags.isEnabled('snooze'),
  });
  const scheduler = new Scheduler([job], env.REMINDER_CHECK_INTERVAL_MS);
  schedulerRef.probe = scheduler;

  logger.info({ event: 'app.features', flags: featureFlags.snapshot() }, 'feature flags resolved');

  // Check once at boot, then on the interval.
  await scheduler.runOnce();
  scheduler.start();

  // §3.6 — an operator can check the bot from Telegram, not only from a shell.
  if (featureFlags.isEnabled('healthCheck')) {
    bot.command('health', async (ctx) => {
      const report = await services.health.check();
      logger.info(
        { event: 'health.checked', state: report.state, userId: ctx.from?.id },
        'health check requested',
      );
      await sendText(ctx, healthText(report, ctx.state.lang ?? 'fa'));
    });
  }

  // Installed before `bot.start()`, which long-polls and therefore never
  // resolves while the bot is healthy. Handlers registered after that `await`
  // would be unreachable for the whole life of the process, so a `docker compose
  // stop` would kill the bot outright instead of draining it.
  installShutdownHandlers({
    logger,
    onShutdown: async (reason) => {
      logger.info({ event: 'app.shutdown', reason }, 'shutting down');

      scheduler.stop();
      await bot.stop().catch((error: unknown) => {
        logger.warn({ event: 'bot.stop.failed', err: toError(error) }, 'bot stop failed');
      });
      await disconnectDatabase().catch((error: unknown) => {
        logger.warn({ event: 'db.disconnect.failed', err: toError(error) }, 'db disconnect failed');
      });

      process.exit(0);
    },
  });

  // Resolves only once polling stops, which is what the handlers above do — so
  // this await parks here for the healthy life of the process, then returns after
  // a shutdown. If it ever rejects, `main().catch` reports it and exits 1.
  await bot.start({
    onStart: (info) =>
      logger.info({ event: 'bot.started', username: info.username }, 'polling started'),
  });

  logger.info({ event: 'bot.stopped' }, 'long polling finished');
}

main().catch((error: unknown) => {
  logger.fatal({ event: 'app.crashed', err: toError(error) }, 'fatal startup error');
  process.exit(1);
});
