import { describe, expect, it } from 'vitest';
import {
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_DELAY_MS,
  hasAttemptsLeft,
  nextRetryAt,
  retryDelayMs,
} from '../../src/modules/reminders/retry.js';

describe('retryDelayMs', () => {
  it('doubles from the base delay', () => {
    expect(retryDelayMs(1)).toBe(RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(2)).toBe(RETRY_BASE_DELAY_MS * 2);
    expect(retryDelayMs(3)).toBe(RETRY_BASE_DELAY_MS * 4);
  });

  /**
   * The cap is what stops a long outage from pushing a birthday reminder days
   * out, which would be worse than not retrying at all.
   */
  it('never exceeds the ceiling however long the outage lasts', () => {
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      expect(retryDelayMs(attempt)).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS);
    }
  });

  /** A scheduler that computed attempt 0 or a negative must not throw. */
  it('treats a nonsensical attempt count as the first one', () => {
    expect(retryDelayMs(0)).toBe(RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(-3)).toBe(RETRY_BASE_DELAY_MS);
  });
});

describe('nextRetryAt', () => {
  it('offsets from the given moment, not from now', () => {
    const now = new Date('2026-10-10T06:00:00.000Z');
    expect(nextRetryAt(2, now).toISOString()).toBe('2026-10-10T06:10:00.000Z');
  });

  it('never returns a moment in the past', () => {
    const now = new Date();
    expect(nextRetryAt(1, now).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('hasAttemptsLeft', () => {
  it('allows a fresh delivery its first retry', () => {
    expect(hasAttemptsLeft(1)).toBe(true);
  });

  it('gives up once the budget is spent', () => {
    expect(hasAttemptsLeft(RETRY_MAX_ATTEMPTS)).toBe(false);
    expect(hasAttemptsLeft(RETRY_MAX_ATTEMPTS + 1)).toBe(false);
  });

  /**
   * Six attempts in total: the original send plus five retries. Guards against
   * an off-by-one that would either drop the last retry or retry forever.
   */
  it('counts one initial delivery plus five retries', () => {
    let attempts = 1;
    let retries = 0;
    while (hasAttemptsLeft(attempts)) {
      retries += 1;
      attempts += 1;
    }
    expect(attempts).toBe(RETRY_MAX_ATTEMPTS);
    expect(retries).toBe(RETRY_MAX_ATTEMPTS - 1);
  });
});
