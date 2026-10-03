import type { Logger } from 'pino';
import { toError } from '../errors/index.js';

/** The signals and pseudo-events that request the process to stop. */
export type ShutdownReason = 'SIGINT' | 'SIGTERM' | 'uncaughtException';

export interface ShutdownHandlersOptions {
  /**
   * Performs the actual teardown. Called at most once no matter how many
   * signals arrive: a `SIGTERM` that lands while an `uncaughtException` is being
   * handled must not start a second teardown.
   *
   * Whatever this throws is logged, and the process still exits — a teardown that
   * half-completes must never leave a half-stopped process serving traffic.
   */
  onShutdown: (reason: ShutdownReason) => Promise<void> | void;
  logger: Pick<Logger, 'error' | 'fatal'>;
  /** Overridable for tests; defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/**
 * A crash is not a clean stop.
 *
 * `docker stop` and a `Ctrl+C` both mean "we are done on purpose" and deserve a
 * 0. An `uncaughtException` means the process is broken: reporting success would
 * tell an orchestrator the container is healthy when it is not, and would let a
 * restart policy treat a crash loop as normal completion.
 */
export function exitCodeFor(reason: ShutdownReason): number {
  return reason === 'uncaughtException' ? 1 : 0;
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
  const { onShutdown, logger, exit = (code: number) => process.exit(code) } = options;

  let shuttingDown = false;

  const requestShutdown = (reason: ShutdownReason): void => {
    if (shuttingDown) {
      logger.error({ event: 'app.shutdown.ignored', reason }, 'shutdown already in progress');
      return;
    }
    shuttingDown = true;

    // Whatever happens below, the process ends. A teardown that throws partway
    // through must not leave the bot polling with a closed database pool.
    const finish = (): void => exit(exitCodeFor(reason));

    // `onShutdown` is invoked synchronously — the first step of a teardown
    // (stopping the scheduler) must not wait a microtask.
    let teardown: Promise<void> | void;
    try {
      teardown = onShutdown(reason);
    } catch (error: unknown) {
      logger.fatal({ event: 'app.shutdown.failed', reason, err: toError(error) }, 'shutdown failed');
      finish();
      return;
    }

    if (!teardown) {
      finish();
      return;
    }

    void Promise.resolve(teardown).then(
      () => finish(),
      (error: unknown) => {
        logger.fatal({ event: 'app.shutdown.failed', reason, err: toError(error) }, 'shutdown failed');
        finish();
      },
    );
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
