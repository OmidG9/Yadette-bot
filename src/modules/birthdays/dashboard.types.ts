import type { UpcomingBirthday } from './birthday.types.js';

/**
 * §3.1 — the home screen, split by urgency.
 *
 * The buckets are derived, not stored: every field is a projection of the same
 * sorted occurrence list, so the home screen can never disagree with the
 * birthday list it links to.
 */
export interface BirthdayBuckets {
  /** daysUntil === 0. */
  today: UpcomingBirthday[];
  /** 1 to {@link DASHBOARD_WEEK_DAYS} days away, inclusive. */
  thisWeek: UpcomingBirthday[];
  /** Everything further out, capped so the message stays inside Telegram's limit. */
  later: UpcomingBirthday[];
  /** The single closest birthday, or `null` when nobody is stored. */
  nextBirthday: UpcomingBirthday | null;
  /** How many upcoming birthdays land in the current Jalali month. */
  thisMonthCount: number;
  /** Total people the user has stored (excluding soft-deleted). */
  totalPeople: number;
  /** Jalali month and year the buckets were computed against. */
  jalaliYear: number;
  jalaliMonth: number;
}

/** Upper bound, in days, of the "this week" bucket. */
export const DASHBOARD_WEEK_DAYS = 7;

/** How many birthdays the "later" bucket lists before it is cut off. */
export const DASHBOARD_LATER_LIMIT = 10;
