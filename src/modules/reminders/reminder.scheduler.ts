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
/**
 * How many consecutive failing ticks count as a sick scheduler.
 *
 * Three, not one: a single failure is usually a transient network blip, and a
 * health check that cries wolf gets ignored. The reminder job already retries
 * delivery internally, so a throw has escaped all of that.
 */
export const SCHEDULER_FAILURE_THRESHOLD = 3;

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = true;
  /** Per task, so one healthy task cannot mask another that is failing. */
  private readonly failures = new Map<string, number>();
  private lastSuccessAt: Date | null = null;

  constructor(
    private readonly tasks: ScheduledTask[],
    private readonly intervalMs: number = env.REMINDER_CHECK_INTERVAL_MS,
  ) {
    // Failure state is tracked per task *name*, so two tasks sharing a name
    // would silently share one counter — a healthy one would then mask a broken
    // one. That is the exact blind spot the health check must not have.
    const names = new Set(tasks.map((task) => task.name));
    if (names.size !== tasks.length) {
      throw new Error(
        `Scheduler task names must be unique; got ${tasks.length} tasks and ${names.size} names`,
      );
    }
  }

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
   * §3.6 — whether reminders are actually being delivered.
   *
   * Reported by the health check, because a scheduler that stopped ticking
   * looks exactly like a healthy bot to a user: messages still work, no
   * reminders ever arrive.
   *
   * Armed is not the same as working. A loop whose task throws on every tick is
   * armed and running forever while delivering nothing, so a run of consecutive
   * failures reports as not running: from the user's point of view the reminders
   * are indeed not running.
   */
  isRunning(): boolean {
    if (this.stopped) return false;
    // Every task must be under the threshold: a scheduler where one task is
    // sick is not a scheduler that is delivering.
    for (const count of this.failures.values()) {
      if (count >= SCHEDULER_FAILURE_THRESHOLD) return false;
    }
    return true;
  }

  /** Consecutive failed ticks for the worst task; 0 when all are healthy. */
  failureCount(): number {
    let worst = 0;
    for (const count of this.failures.values()) {
      if (count > worst) worst = count;
    }
    return worst;
  }

  /** Which task is failing and how often, for logs and diagnostics. */
  failureCounts(): Record<string, number> {
    return Object.fromEntries(this.failures);
  }

  /** When a task last completed without throwing, or `null` if never. */
  lastSuccess(): Date | null {
    return this.lastSuccessAt;
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
      this.failures.delete(task.name);
      this.lastSuccessAt = new Date();
      logger.debug(
        { event: 'scheduler.task.done', task: task.name, durationMs: Date.now() - startedAt },
        'task finished',
      );
    } catch (error) {
      // A failing job must never take the process down.
      const consecutiveFailures = (this.failures.get(task.name) ?? 0) + 1;
      this.failures.set(task.name, consecutiveFailures);
      logger.error(
        {
          event: 'scheduler.task.failed',
          task: task.name,
          consecutiveFailures,
          sick: consecutiveFailures >= SCHEDULER_FAILURE_THRESHOLD,
          err: toError(error),
        },
        'task failed',
      );
    } finally {
      this.running = false;
    }
  }
}
