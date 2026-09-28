import {
  addDays,
  civilToDayNumber,
  civilToJalali,
  currentJalaliDate,
  isValidJalaliDate,
  jalaliMonthLength,
  jalaliToCivil,
  type CivilDate,
  type JalaliDate,
} from '../../shared/utils/date.js';

/**
 * The recurrence rule of a birthday, in the Jalali calendar.
 * `year` is only used for age calculation and is `null` when unknown.
 */
export interface BirthdayRule {
  month: number;
  day: number;
  year: number | null;
}

export interface BirthdayOccurrence {
  /** Jalali year of this occurrence. */
  jalaliYear: number;
  /** Resolved Jalali date (Esfand 30 falls back to Esfand 29 in common years). */
  jalali: JalaliDate;
  /** The same day in the Gregorian calendar. */
  civil: CivilDate;
  /** Days from the reference "today" to this occurrence (0 = today). */
  daysUntil: number;
}

export function isValidBirthdayRule(rule: BirthdayRule): boolean {
  if (rule.month < 1 || rule.month > 12) return false;
  if (rule.day < 1 || rule.day > 30) return false;
  // Every Jalali month has at least 29 days and none has more than 31, so any
  // day up to 30 is representable. Esfand 30 stays valid with an unknown birth
  // year: it is observed on Esfand 29 in common years (see occurrenceInJalaliYear).
  if (rule.year === null) return true;
  return isValidJalaliDate({ jy: rule.year, jm: rule.month, jd: rule.day });
}

/**
 * Resolves the birthday inside a given Jalali year.
 * Esfand 30 only exists in Jalali leap years, so it is observed on Esfand 29.
 */
export function occurrenceInJalaliYear(rule: BirthdayRule, jalaliYear: number): BirthdayOccurrence {
  const maxDay = jalaliMonthLength(jalaliYear, rule.month);
  const day = Math.min(rule.day, maxDay);
  const jalali: JalaliDate = { jy: jalaliYear, jm: rule.month, jd: day };
  return { jalaliYear, jalali, civil: jalaliToCivil(jalali), daysUntil: 0 };
}

/** The first occurrence of a birthday on or after `today`. */
export function nextOccurrence(
  rule: BirthdayRule,
  today: JalaliDate,
): BirthdayOccurrence {
  const todayCivil = jalaliToCivil(today);
  const todayDay = civilToDayNumber(todayCivil);

  for (const year of [today.jy, today.jy + 1]) {
    const candidate = occurrenceInJalaliYear(rule, year);
    const daysUntil = civilToDayNumber(candidate.civil) - todayDay;
    if (daysUntil >= 0) return { ...candidate, daysUntil };
  }

  // Unreachable: a year always contains the birthday.
  const fallback = occurrenceInJalaliYear(rule, today.jy + 1);
  return { ...fallback, daysUntil: civilToDayNumber(fallback.civil) - todayDay };
}

/** Subtracts whole days from a Jalali date. */
export function subtractJalaliDays(date: JalaliDate, days: number): JalaliDate {
  return civilToJalali(addDays(jalaliToCivil(date), -days));
}

/**
 * The occurrence whose reminder fires "today" for a given `daysBefore` offset.
 *
 * Returns `null` when the reminder moment for the next occurrence already
 * passed (e.g. today is the birthday, so the "7 days before" reminder is stale)
 * and the following year's occurrence is not due either.
 */
export function resolveDueOccurrence(
  rule: BirthdayRule,
  today: JalaliDate,
  daysBefore: number,
): BirthdayOccurrence | null {
  const todayDay = civilToDayNumber(jalaliToCivil(today));
  const upcoming = nextOccurrence(rule, today);

  const dueDay = civilToDayNumber(addDays(upcoming.civil, -daysBefore));
  if (dueDay === todayDay) return upcoming;

  // The reminder for the upcoming occurrence already passed: look one year ahead.
  const nextYear = occurrenceInJalaliYear(rule, upcoming.jalaliYear + 1);
  const nextYearDueDay = civilToDayNumber(addDays(nextYear.civil, -daysBefore));
  if (nextYearDueDay === todayDay) return nextYear;

  return null;
}

/** Age in years, based on Jalali years. */
export function ageOnBirthday(rule: BirthdayRule, occurrenceJalaliYear: number): number | null {
  if (rule.year === null) return null;
  return occurrenceJalaliYear - rule.year;
}

/** Convenience: today's Jalali date in the user's timezone. */
export function todayFor(timeZone: string, now?: Date): JalaliDate {
  return currentJalaliDate(timeZone, now);
}
