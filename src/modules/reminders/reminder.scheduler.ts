import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';
import { toError } from '../../shared/errors/index.js';

export interface ScheduledTask {
  /** Human-readable name, used in logs. */
  name: string;
  /** One execution of the task. */
  run(): Promise<void>;
}

/**
 * A minimal in-process scheduler.
 *
 * Deliberately simple: the MVP needs no Redis/BullMQ. `ReminderScheduler` runs
 * `ScheduledTask`s on a fixed interval, never overlapping executions, and can be
 * swapped for a BullMQ worker later without touching the task bodies (which
 * contain the business logic) or the delivery layer.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = true;

  constructor(
    private readonly tasks: ScheduledTask[],
    private readonly intervalMs: number = env.REMINDER_CHECK_INTERVAL_MS,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    logger.info({ event: 'scheduler.started', intervalMs: this.intervalMs }, 'scheduler started');

    for (const task of this.tasks) {
      void this.execute(task);
    }

    this.timer = setInterval(() => {
      for (const task of this.tasks) {
        void this.execute(task);
      }
    }, this.intervalMs);

    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopped = true;
    logger.info({ event: 'scheduler.stopped' }, 'scheduler stopped');
  }

  /**
   * §3.6 — whether the loop is live.
   *
   * Reported by the health check, because a scheduler that stopped ticking
   * looks exactly like a healthy bot to a user: messages still work, no
   * reminders ever arrive.
   */
  isRunning(): boolean {
    return !this.stopped;
  }

  /** Runs every task once, awaited — used on startup and in tests. */
  async runOnce(): Promise<void> {
    for (const task of this.tasks) {
      await this.execute(task);
    }
  }

  private async execute(task: ScheduledTask): Promise<void> {
    if (this.running) {
      logger.debug({ event: 'scheduler.skipped', task: task.name }, 'previous run still in progress');
      return;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      await task.run();
      logger.debug(
        { event: 'scheduler.task.done', task: task.name, durationMs: Date.now() - startedAt },
        'task finished',
      );
    } catch (error) {
      // A failing job must never take the process down.
      logger.error(
        { event: 'scheduler.task.failed', task: task.name, err: toError(error) },
        'task failed',
      );
    } finally {
      this.running = false;
    }
  }
}
