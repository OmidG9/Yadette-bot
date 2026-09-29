/**
 * §3.5 — snooze policy.
 *
 * Kept apart from the service so the choice of offsets is a single constant
 * that the keyboard, the callback validator and the tests all read. An offset
 * the buttons do not offer is not a value the handler has to defend against.
 */

/**
 * Offsets a user can pick, in days.
 *
 * All comfortably shorter than the shortest reminder lead time the product
 * offers, so a snooze can never push a delivery past its own birthday.
 */
export const SNOOZE_OPTIONS = [1, 3, 7] as const;

/** Longest snooze a user can request, in days. */
export const SNOOZE_MAX_DAYS = 7;

export function isSnoozeOption(days: number): boolean {
  return (SNOOZE_OPTIONS as readonly number[]).includes(days);
}
