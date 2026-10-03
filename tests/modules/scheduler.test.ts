import { describe, expect, it, vi } from 'vitest';
import {
  Scheduler,
  SCHEDULER_FAILURE_THRESHOLD,
  type ScheduledTask,
} from '../../src/modules/reminders/reminder.scheduler.js';

const INTERVAL = 60_000;

/**
 * `start()` fires its first tick without awaiting it, so anything asserted
 * straight after it would race. Draining the microtask queue makes the first
 * tick observable; every later tick is driven by `runOnce()`, which is awaited.
 */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function task(run: () => Promise<void>, name = 'reminder'): ScheduledTask {
  return { name, run };
}

const ok = task(async () => {});
const boom = task(async () => {
  throw new Error('telegram unreachable');
});

describe('Scheduler lifecycle', () => {
  it('is not running before start and not running after stop', () => {
    const scheduler = new Scheduler([ok], INTERVAL);

    expect(scheduler.isRunning()).toBe(false);

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('records a successful run', async () => {
    const scheduler = new Scheduler([ok], INTERVAL);
    scheduler.start();
    await settle();

    expect(scheduler.lastSuccess()).not.toBeNull();
    expect(scheduler.failureCount()).toBe(0);
  });

  it('never lets a failing task take the process down', async () => {
    const scheduler = new Scheduler([boom], INTERVAL);

    await expect(scheduler.runOnce()).resolves.toBeUndefined();
  });
});

/**
 * §3.6 asks for scheduler *monitoring*, and `isRunning()` used to mean only
 * "the interval is armed". A loop whose task throws on every tick therefore
 * reported healthy forever while delivering nothing — which is the exact failure
 * the health check exists to catch.
 */
describe('Scheduler reports a sick loop as not running', () => {
  it('tolerates a single failure, because one is usually a transient blip', async () => {
    const scheduler = new Scheduler([boom], INTERVAL);
    scheduler.start();
    await settle();

    expect(scheduler.failureCount()).toBe(1);
    expect(scheduler.isRunning()).toBe(true);
  });

  it('goes unhealthy once failures pass the threshold', async () => {
    const scheduler = new Scheduler([boom], INTERVAL);
    scheduler.start();
    await settle();

    // One failure already counted from the first tick; add the rest.
    for (let i = 1; i < SCHEDULER_FAILURE_THRESHOLD; i++) {
      await scheduler.runOnce();
    }

    expect(scheduler.failureCount()).toBe(SCHEDULER_FAILURE_THRESHOLD);
    expect(scheduler.isRunning()).toBe(false);
  });

  it('recovers as soon as one tick succeeds', async () => {
    let shouldFail = true;
    const flaky = task(async () => {
      if (shouldFail) throw new Error('still broken');
    });
    const scheduler = new Scheduler([flaky], INTERVAL);
    scheduler.start();
    await settle();

    for (let i = 1; i < SCHEDULER_FAILURE_THRESHOLD; i++) {
      await scheduler.runOnce();
    }
    expect(scheduler.isRunning()).toBe(false);

    shouldFail = false;
    await scheduler.runOnce();

    expect(scheduler.failureCount()).toBe(0);
    expect(scheduler.isRunning()).toBe(true);
  });

  /**
   * A single shared counter would be wrong here: the healthy sibling resets it,
   * so a permanently broken task would look fine as long as anything else ran.
   */
  it('does not let a healthy task mask one that keeps failing', async () => {
    const broken = task(async () => {
      throw new Error('reminders unreachable');
    }, 'birthday-reminder');
    const healthy = task(async () => {}, 'cleanup');
    const scheduler = new Scheduler([broken, healthy], INTERVAL);
    scheduler.start();
    await settle();

    for (let i = 1; i < SCHEDULER_FAILURE_THRESHOLD; i++) {
      await scheduler.runOnce();
    }

    // Only the broken task is tracked; the sibling succeeded and is absent.
    expect(scheduler.failureCounts()).toEqual({
      'birthday-reminder': SCHEDULER_FAILURE_THRESHOLD,
    });
    expect(scheduler.isRunning()).toBe(false);
  });

  it('refuses two tasks with the same name, which would share one counter', () => {
    const duplicate = task(async () => {}, 'reminder');

    expect(() => new Scheduler([ok, duplicate], INTERVAL)).toThrow(/unique/);
  });

  it('does not count a skipped overlap as a failure', async () => {
    // A tick that arrives while the previous run is still in flight is skipped
    // by design, and must not look like the task failing.
    const run = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const scheduler = new Scheduler([task(run)], INTERVAL);

    const first = scheduler.runOnce();
    const second = scheduler.runOnce();
    await Promise.all([first, second]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.failureCount()).toBe(0);
  });
});
