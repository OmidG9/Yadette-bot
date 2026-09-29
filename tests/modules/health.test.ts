import { describe, expect, it } from 'vitest';
import { HealthService, healthText } from '../../src/modules/health/health.service.js';
import type { DatabaseProbe, SchedulerProbe } from '../../src/modules/health/health.service.js';

const okDb: DatabaseProbe = { ping: async () => undefined };
const brokenDb: DatabaseProbe = {
  ping: async () => {
    throw new Error('connection refused');
  },
};

const running: SchedulerProbe = { isRunning: () => true };
const stopped: SchedulerProbe = { isRunning: () => false };

describe('HealthService.check', () => {
  it('is ok when the database answers and the scheduler is running', async () => {
    const report = await new HealthService(okDb, running).check();

    expect(report.state).toBe('ok');
    expect(report.checks.map((check) => check.ok)).toEqual([true, true]);
  });

  /**
   * The database is the one dependency that makes the bot useless: without it
   * no birthday can be stored, read, or delivered. It is reported as `down`
   * rather than lumped in with the scheduler.
   */
  it('is down when the database is unreachable', async () => {
    const report = await new HealthService(brokenDb, running).check();

    expect(report.state).toBe('down');
    expect(report.checks[0]!.name).toBe('database');
    expect(report.checks[0]!.ok).toBe(false);
  });

  /**
   * A stopped scheduler means reminders silently stop, while the bot still
   * answers messages. That is degraded, not down.
   */
  it('is degraded when only the scheduler has stopped', async () => {
    const report = await new HealthService(okDb, stopped).check();

    expect(report.state).toBe('degraded');
    expect(report.checks.find((check) => check.name === 'scheduler')!.ok).toBe(false);
  });

  /**
   * The usual caller is a user tapping a command. A rejection escaping here
   * would take down the update loop, so every failure is converted to a result.
   */
  it('never propagates a probe failure', async () => {
    const report = await new HealthService(brokenDb, running).check();

    expect(report.checks[0]!.detail).toContain('connection refused');
  });

  /** A driver error can carry a whole connection string. */
  it('truncates a very long failure reason', async () => {
    const report = await new HealthService(
      { ping: async () => { throw new Error('x'.repeat(500)); } },
      running,
    ).check();

    expect(report.checks[0]!.detail.length).toBeLessThanOrEqual(120);
  });

  /** A driver that rejects with a bare value must not produce a confusing report. */
  it('copes with a probe that rejects with a non-error', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the point of the test
    const report = await new HealthService({ ping: async () => Promise.reject('just a string') }, running).check();

    expect(report.checks[0]!.ok).toBe(false);
    expect(report.checks[0]!.detail).toBe('just a string');
  });

  it('omits the scheduler check when no scheduler was supplied', async () => {
    const report = await new HealthService(okDb).check();

    expect(report.checks.map((check) => check.name)).toEqual(['database']);
    expect(report.state).toBe('ok');
  });

  it('stamps the moment it was asked, for the caller to log', async () => {
    const now = new Date('2026-11-26T09:00:00.000Z');
    const report = await new HealthService(okDb, running).check(now);

    expect(report.checkedAt).toBe(now);
  });
});

describe('healthText', () => {
  it('says nothing alarming when everything is fine', () => {
    const text = healthText(
      { state: 'ok', checks: [{ name: 'database', ok: true, detail: 'متصل', tookMs: 1 }], checkedAt: new Date() },
      'fa',
    );

    expect(text).toContain('🩺');
    expect(text).not.toContain('❌');
  });

  /** Each state needs its own message, or a dead database reads as "almost fine". */
  it('distinguishes degraded from down', async () => {
    const degraded = healthText(
      { state: 'degraded', checks: [{ name: 'scheduler', ok: false, detail: 'متوقف', tookMs: 0 }], checkedAt: new Date() },
      'fa',
    );
    const down = healthText(
      { state: 'down', checks: [{ name: 'database', ok: false, detail: 'connection refused', tookMs: 3 }], checkedAt: new Date() },
      'fa',
    );

    expect(degraded).toContain('⚠️');
    expect(down).toContain('❌');
    expect(degraded).not.toBe(down);
  });

  it('names each subsystem so the report is actionable', () => {
    const text = healthText(
      {
        state: 'degraded',
        checks: [
          { name: 'database', ok: true, detail: 'متصل', tookMs: 2 },
          { name: 'scheduler', ok: false, detail: 'متوقف', tookMs: 0 },
        ],
        checkedAt: new Date(),
      },
      'fa',
    );

    expect(text).toContain('🗄');
    expect(text).toContain('⏰');
  });

  it('shows the reason a probe failed', () => {
    const text = healthText(
      { state: 'down', checks: [{ name: 'database', ok: false, detail: 'connection refused', tookMs: 3 }], checkedAt: new Date() },
      'fa',
    );

    expect(text).toContain('connection refused');
  });
});
