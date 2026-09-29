/**
 * §3.6 — retry with exponential backoff.
 *
 * A reminder is worth a few retries: Telegram rate-limits and short outages are
 * common, and losing a birthday notification because of one is the single worst
 * failure this bot can have. What must not happen is an unbounded retry storm,
 * so attempts are capped and the delay grows.
 *
 * Kept as pure functions: the backoff is the part most likely to be tuned, and
 * tuning it should not require a database to test.
 */

/** First retry delay. Long enough to ride out a rate limit, short enough to be useful. */
export const RETRY_BASE_DELAY_MS = 5 * 60_000;

/** Ceiling on a single delay, so a long outage does not push a retry days out. */
export const RETRY_MAX_DELAY_MS = 6 * 60 * 60_000;

/** Attempts before a delivery is given up on and marked `failed`. */
export const RETRY_MAX_ATTEMPTS = 6;

/**
 * How long a worker owns a due row while it is sending it.
 *
 * The fresh pass is protected by a unique constraint, but a retry re-sends a row
 * that already exists, so two workers reading the same due row would both send
 * it. Leasing pushes `nextAttemptAt` past the current instant, which takes the
 * row out of every other worker's `nextAttemptAt <= now` query.
 *
 * It only has to exceed a normal Telegram call; a crashed worker then costs one
 * extra delivery attempt at worst, rather than blocking the row forever.
 */
export const RETRY_LEASE_MS = 5 * 60_000;

/** The instant a leased row becomes visible to the next worker. */
export function leaseUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + RETRY_LEASE_MS);
}

/**
 * Delay before attempt number `attempts + 1`.
 *
 * Doubling, then capped. There is deliberately no jitter here: the retry pass
 * reads every due row in one query, and a per-row jitter would have to be
 * recomputed rather than stored, which makes the backoff untestable. The
 * thundering-herd risk is bounded by the cap and by the small number of due
 * rows a single user can have.
 */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(attempts - 1, 0);
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS);
}

/** The earliest moment the next attempt may run. */
export function nextRetryAt(attempts: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + retryDelayMs(attempts));
}

export function hasAttemptsLeft(attempts: number): boolean {
  return attempts < RETRY_MAX_ATTEMPTS;
}
