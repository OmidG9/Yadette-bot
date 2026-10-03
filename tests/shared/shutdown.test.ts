import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  exitCodeFor,
  installShutdownHandlers,
  type ShutdownReason,
} from '../../src/shared/lifecycle/shutdown.js';

/** A logger stub shaped like the two methods the module is allowed to use. */
function stubLogger(): { error: ReturnType<typeof vi.fn>; fatal: ReturnType<typeof vi.fn> } {
  return { error: vi.fn(), fatal: vi.fn() };
}

const disposers: (() => void)[] = [];

/**
 * Installs handlers with a stubbed exit. Without the stub the module would end
 * the vitest worker on the first signal.
 */
function install(
  onShutdown: (reason: ShutdownReason) => Promise<void> | void,
  logger: { error: ReturnType<typeof vi.fn>; fatal: ReturnType<typeof vi.fn> } = stubLogger(),
  exit: (code: number) => void = vi.fn(),
): { error: ReturnType<typeof vi.fn>; fatal: ReturnType<typeof vi.fn> } {
  const dispose = installShutdownHandlers({ logger, onShutdown, exit });
  disposers.push(dispose);
  return logger;
}

/**
 * Emitting the event is how a signal reaches a listener; it is the same code
 * path the OS takes, without actually signalling the test runner.
 */
function signal(name: 'SIGINT' | 'SIGTERM'): void {
  process.emit(name);
}

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  vi.restoreAllMocks();
});

describe('installShutdownHandlers', () => {
  it('shuts down on SIGINT', () => {
    const onShutdown = vi.fn();
    install(onShutdown);

    signal('SIGINT');

    expect(onShutdown).toHaveBeenCalledTimes(1); expect(onShutdown).toHaveBeenCalledWith('SIGINT');
  });

  /**
   * `docker compose down`, `docker stop` and every orchestrator's default
   * grace period end in SIGTERM. If this one is lost the container is killed
   * after the timeout with the scheduler still running.
   */
  it('shuts down on SIGTERM', () => {
    const onShutdown = vi.fn();
    install(onShutdown);

    signal('SIGTERM');

    expect(onShutdown).toHaveBeenCalledTimes(1); expect(onShutdown).toHaveBeenCalledWith('SIGTERM');
  });

  it('stops the bot at most once when several signals arrive', () => {
    const onShutdown = vi.fn();
    const logger = install(onShutdown);

    signal('SIGINT');
    signal('SIGTERM');
    signal('SIGINT');

    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'app.shutdown.ignored' }),
      expect.any(String),
    );
  });

  it('keeps serving after an unhandled rejection', () => {
    const onShutdown = vi.fn();
    const logger = install(onShutdown);

    // Typed as a generic emitter event: `process.on` only accepts `Signals` here,
    // but `'unhandledRejection'` is a real Node event with a listener.
    (process as NodeJS.EventEmitter).emit('unhandledRejection', new Error('nobody awaited me'));

    expect(onShutdown).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'process.unhandledRejection' }),
      expect.any(String),
    );
  });

  it('shuts down after an uncaught exception', () => {
    const onShutdown = vi.fn();
    const logger = install(onShutdown);

    (process as NodeJS.EventEmitter).emit('uncaughtException', new Error('boom'));

    expect(onShutdown).toHaveBeenCalledTimes(1); expect(onShutdown).toHaveBeenCalledWith('uncaughtException');
    expect(logger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'process.uncaughtException' }),
      expect.any(String),
    );
  });

  /**
   * A teardown that throws would otherwise become an unhandled rejection during
   * shutdown, which is exactly the state we are trying to leave.
   */
  it('reports a failing teardown instead of leaking a rejection', async () => {
    const logger = stubLogger();
    const unhandled: unknown[] = [];
    const spy = vi.fn((reason: unknown) => unhandled.push(reason));
    process.on('unhandledRejection', spy);

    install(() => {
      throw new Error('teardown failed');
    }, logger);
    disposers.push(() => process.off('unhandledRejection', spy));

    signal('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'app.shutdown.failed' }),
      expect.any(String),
    );
    expect(unhandled).toEqual([]);
  });

  it('stops listening once disposed', () => {
    const onShutdown = vi.fn();
    const dispose = installShutdownHandlers({ logger: stubLogger(), exit: vi.fn(), onShutdown });
    dispose();

    signal('SIGTERM');

    expect(onShutdown).not.toHaveBeenCalled();
  });
});

describe('exit code matches the reason', () => {
  /**
   * `exit: 0` after a crash tells a restart policy the container completed
   * normally, so a crash loop looks like a healthy service.
   */
  it('exits 1 on an uncaught exception and 0 on a signal', async () => {
    const crashes: number[] = [];
    const stops: number[] = [];

    installShutdownHandlers({
      logger: stubLogger(),
      exit: (code) => crashes.push(code),
      onShutdown: () => {},
    });
    (process as NodeJS.EventEmitter).emit('uncaughtException', new Error('boom'));
    await new Promise((resolve) => setImmediate(resolve));

    installShutdownHandlers({
      logger: stubLogger(),
      exit: (code) => stops.push(code),
      onShutdown: () => {},
    });
    signal('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));

    expect(crashes).toEqual([1]);
    expect(stops).toEqual([0]);
  });

  it('exposes the mapping directly', () => {
    expect(exitCodeFor('SIGINT')).toBe(0);
    expect(exitCodeFor('SIGTERM')).toBe(0);
    expect(exitCodeFor('uncaughtException')).toBe(1);
  });
});

describe('the process always ends', () => {
  /**
   * A teardown that throws halfway through leaves the bot polling against a
   * closed database pool. Staying alive is worse than exiting, so the exit is
   * not conditional on the teardown succeeding.
   */
  it('exits even when the teardown throws synchronously', async () => {
    const exit = vi.fn();
    const logger = stubLogger();
    installShutdownHandlers({
      logger,
      exit,
      onShutdown: () => {
        throw new Error('stopped halfway');
      },
    });

    signal('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));

    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'app.shutdown.failed' }),
      expect.any(String),
    );
  });

  it('exits even when the teardown rejects', async () => {
    const exit = vi.fn();
    installShutdownHandlers({
      logger: stubLogger(),
      exit,
      onShutdown: () => Promise.reject(new Error('disconnect hung')),
    });

    signal('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));

    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits after a synchronous teardown, without waiting a tick', () => {
    const exit = vi.fn();
    installShutdownHandlers({ logger: stubLogger(), exit, onShutdown: () => {} });

    signal('SIGTERM');

    // Synchronous: the scheduler must already be stopped by the time the
    // handler returns, before any `await` gets a chance to run.
    expect(exit).toHaveBeenCalledWith(0);
  });
});
