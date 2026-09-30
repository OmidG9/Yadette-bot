import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installShutdownHandlers,
  type ShutdownReason,
} from '../../src/shared/lifecycle/shutdown.js';

/** A logger stub shaped like the two methods the module is allowed to use. */
function stubLogger(): { error: ReturnType<typeof vi.fn>; fatal: ReturnType<typeof vi.fn> } {
  return { error: vi.fn(), fatal: vi.fn() };
}

const disposers: (() => void)[] = [];

function install(
  onShutdown: (reason: ShutdownReason) => Promise<void> | void,
  logger: { error: ReturnType<typeof vi.fn>; fatal: ReturnType<typeof vi.fn> } = stubLogger(),
): { error: ReturnType<typeof vi.fn>; fatal: ReturnType<typeof vi.fn> } {
  const dispose = installShutdownHandlers({ logger, onShutdown });
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
    const dispose = installShutdownHandlers({ logger: stubLogger(), onShutdown });
    dispose();

    signal('SIGTERM');

    expect(onShutdown).not.toHaveBeenCalled();
  });
});
