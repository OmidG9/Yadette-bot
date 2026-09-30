import type { Logger } from 'pino';
import { toError } from '../errors/index.js';

/** The signals and pseudo-events that request the process to stop. */
export type ShutdownReason = 'SIGINT' | 'SIGTERM' | 'uncaughtException';

export interface ShutdownHandlersOptions {
  /**
   * Performs the actual teardown. Called at most once no matter how many
   * signals arrive: a `SIGTERM` that lands while an `uncaughtException` is being
   * handled must not start a second teardown.
   */
  onShutdown: (reason: ShutdownReason) => Promise<void> | void;
  logger: Pick<Logger, 'error' | 'fatal'>;
}

/**
 * Installs the process-level handlers that make the bot stoppable.
 *
 * This lives in its own module because of *when* it has to run. `bot.start()`
 * long-polls, so it never resolves while the bot is healthy: anything written
 * after `await bot.start(...)` is unreachable for the entire life of the
 * process. Handlers registered down there would mean `docker compose stop`, a
 * `Ctrl+C`, and an orchestrator's `SIGTERM` all fell through to Node's default
 * behaviour and killed the process mid-flight, with the scheduler still running
 * and the database pool still open.
 *
 * `main.ts` therefore calls this *before* starting the bot.
 */
export function installShutdownHandlers(options: ShutdownHandlersOptions): () => void {
  const { onShutdown, logger } = options;

  let shuttingDown = false;

  const requestShutdown = (reason: ShutdownReason): void => {
    if (shuttingDown) {
      logger.error({ event: 'app.shutdown.ignored', reason }, 'shutdown already in progress');
      return;
    }
    shuttingDown = true;

    // `onShutdown` decides how the process ends, so a failure inside it must not
    // escape as an unhandled rejection. It is invoked synchronously — the first
    // step of a teardown (stopping the scheduler) must not wait a microtask.
    let teardown: Promise<void> | void;
    try {
      teardown = onShutdown(reason);
    } catch (error: unknown) {
      logger.fatal({ event: 'app.shutdown.failed', reason, err: toError(error) }, 'shutdown failed');
      return;
    }

    if (teardown) {
      void Promise.resolve(teardown).catch((error: unknown) => {
        logger.fatal({ event: 'app.shutdown.failed', reason, err: toError(error) }, 'shutdown failed');
      });
    }
  };

  const onSigint = (): void => requestShutdown('SIGINT');
  const onSigterm = (): void => requestShutdown('SIGTERM');

  const onUnhandledRejection = (reason: unknown): void => {
    // A rejected promise nobody awaited is a bug, not a reason to stop: log it
    // loudly and keep serving.
    logger.error({ event: 'process.unhandledRejection', err: toError(reason) }, 'unhandled rejection');
  };

  const onUncaughtException = (error: unknown): void => {
    logger.fatal({ event: 'process.uncaughtException', err: toError(error) }, 'uncaught exception');
    requestShutdown('uncaughtException');
  };

  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
  process.on('unhandledRejection', onUnhandledRejection);
  process.on('uncaughtException', onUncaughtException);

  return () => {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    process.off('unhandledRejection', onUnhandledRejection);
    process.off('uncaughtException', onUncaughtException);
  };
}
