import { JALALI_MONTH_NAMES } from '../../shared/utils/date.js';
import { occurrenceInJalaliYear } from './birthday.calc.js';
import type { UpcomingBirthday } from './birthday.types.js';

/** One Jalali day that has at least one birthday on it. */
export interface CalendarDay {
  day: number;
  names: string[];
}

export interface BirthdayMonth {
  jalaliYear: number;
  jalaliMonth: number;
  /** Only days that actually have a birthday; an empty day is not rendered. */
  days: CalendarDay[];
  total: number;
}

/**
 * §3.2 — one Jalali month, day by day.
 *
 * A yearly birthday recurs every year, so a month is answered by re-resolving
 * each rule inside the *requested* year rather than filtering the next
 * occurrence. That distinction matters for Esfand 30: it only exists in a leap
 * year, so in a common year it is observed on Esfand 29 — and whether the
 * requested year is a leap year is exactly what the requested year decides.
 */
export function buildMonth(
  items: UpcomingBirthday[],
  jalaliYear: number,
  jalaliMonth: number,
): BirthdayMonth {
  const byDay = new Map<number, string[]>();

  for (const item of items) {
    const { jm, jd } = occurrenceInJalaliYear(item.rule, jalaliYear).jalali;
    if (jm !== jalaliMonth) continue;

    const names = byDay.get(jd);
    if (names) names.push(item.person.name);
    else byDay.set(jd, [item.person.name]);
  }

  const days = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, names]) => ({ day, names }));

  return { jalaliYear, jalaliMonth, days, total: days.reduce((sum, day) => sum + day.names.length, 0) };
}

/** A year-month pair. A month has no day, so this is deliberately not `JalaliDate`. */
export interface YearMonth {
  jy: number;
  jm: number;
}

/** Clamps a month to the calendar, so paging never lands on month 0 or 13. */
export function shiftMonth(jalaliYear: number, jalaliMonth: number, delta: number): YearMonth {
  // Work in a 0-based month index, then convert back.
  const index = jalaliYear * 12 + (jalaliMonth - 1) + delta;
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
}

export function monthName(jalaliMonth: number): string {
  return JALALI_MONTH_NAMES[jalaliMonth - 1] ?? String(jalaliMonth);
}
