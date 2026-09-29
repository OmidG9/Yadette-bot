import { t, type Language } from '../../shared/i18n/index.js';

export type HealthState = 'ok' | 'degraded' | 'down';

/** The result of a single probe. */
export interface ProbeResult {
  name: string;
  ok: boolean;
  /** Shown to the user. Never a stack trace. */
  detail: string;
  /** Wall-clock cost, useful when a timeout is the failure mode. */
  tookMs: number;
}

export interface HealthReport {
  state: HealthState;
  checks: ProbeResult[];
  checkedAt: Date;
}

/** The minimum a health probe has to answer: "is the database reachable?" */
export interface DatabaseProbe {
  /** Resolves when the database answers; rejects or throws when it does not. */
  ping(): Promise<unknown>;
}

/** Optional: whether the reminder scheduler is still ticking. */
export interface SchedulerProbe {
  isRunning(): boolean;
}

/**
 * §3.6 — a health probe.
 *
 * Deliberately dependency-free and side-effect-free so it can be unit tested
 * with two fakes, and so a health check can never be the thing that takes the
 * bot down: every probe is individually guarded.
 */
export class HealthService {
  constructor(
    private readonly db: DatabaseProbe,
    private readonly scheduler?: SchedulerProbe,
  ) {}

  async check(now: Date = new Date()): Promise<HealthReport> {
    const checks: ProbeResult[] = [await this.timeProbe('database', () => this.db.ping())];

    if (this.scheduler) {
      const running = this.scheduler.isRunning();
      checks.push({
        name: 'scheduler',
        ok: running,
        detail: running ? t('health.schedulerUp') : t('health.schedulerDown'),
        tookMs: 0,
      });
    }

    // `down` would mean the bot cannot do its job at all; `degraded` means one
    // subsystem is unhappy but messages still flow.
    const state: HealthState = checks.every((check) => check.ok)
      ? 'ok'
      : checks.some((check) => check.name === 'database' && !check.ok)
        ? 'down'
        : 'degraded';

    return { state, checks, checkedAt: now };
  }

  /**
   * Runs one probe, converting any failure into a reported result.
   *
   * A thrown error becomes `ok: false` with a short reason rather than
   * propagating: the caller is usually a user tapping a button, and an
   * unhandled rejection there would kill the update loop, not the probe.
   */
  private async timeProbe(name: string, run: () => Promise<unknown>): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
      await run();
      return {
        name,
        ok: true,
        detail: t('health.reachable'),
        tookMs: Date.now() - startedAt,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        name,
        ok: false,
        // Trimmed: a driver error can carry a whole connection string.
        detail: reason.slice(0, 120) || 'unknown error',
        tookMs: Date.now() - startedAt,
      };
    }
  }
}

/** `🩺 وضعیت بات` */
export function healthText(report: HealthReport, lang: Language): string {
  const lines: string[] = [
    t('health.title', lang),
    '',
    // Three distinct states need three distinct messages: telling a user whose
    // database is gone that it will be fixed "shortly" would be a false promise
    // on the one day a missed birthday actually matters.
    t(
      report.state === 'ok' ? 'health.ok' : report.state === 'down' ? 'health.down' : 'health.degraded',
      lang,
    ),
    '',
  ];

  for (const check of report.checks) {
    const value = check.ok ? check.detail : t('health.unreachable', lang, { value: check.detail });
    lines.push(t(check.name === 'database' ? 'health.database' : 'health.reminders', lang, { value }));
  }

  return lines.join('\n');
}
