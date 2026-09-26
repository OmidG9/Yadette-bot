import jalaali from 'jalaali-js';
import { UNKNOWN_BIRTH_YEAR_JALALI } from '../constants/index.js';

export const MS_PER_DAY = 86_400_000;

/** A calendar date without time and without timezone. */
export interface CivilDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export interface JalaliDate {
  jy: number;
  /** 1-12 */
  jm: number;
  jd: number;
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const MIN_YEAR = 1800;
const MAX_YEAR = 2200;
const MIN_JALALI_YEAR = 1000;
const MAX_JALALI_YEAR = 1500;

const PERSIAN_DIGIT_ZERO = 0x06f0;

/** Converts Persian/Arabic digits to ASCII digits. */
export function normalizeDigits(input: string): string {
  return input.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (char) => {
    const code = char.charCodeAt(0);
    const base = code >= PERSIAN_DIGIT_ZERO ? PERSIAN_DIGIT_ZERO : 0x0660;
    return String(code - base);
  });
}

/** Converts ASCII digits to Persian digits, for user-facing output. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 48 + PERSIAN_DIGIT_ZERO),
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** A small curated timezone list keeps the settings screen simple. */
export const COMMON_TIMEZONES = [
  'Asia/Tehran',
  'Asia/Dubai',
  'Europe/Istanbul',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const;

// ---------------------------------------------------------------------------
// Timezone helpers
// ---------------------------------------------------------------------------

/** Offset of `timeZone` from UTC (in ms) at the given instant. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    lookup['year'] ?? 0,
    (lookup['month'] ?? 1) - 1,
    lookup['day'] ?? 1,
    lookup['hour'] ?? 0,
    lookup['minute'] ?? 0,
    lookup['second'] ?? 0,
  );

  return asUtc - instant.getTime();
}

/** The calendar date an instant falls on, in the given timezone. */
export function getCivilDateInTimeZone(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = Number(part.value);
  }

  return { year: lookup['year'] ?? 0, month: lookup['month'] ?? 1, day: lookup['day'] ?? 1 };
}

/** "Today" for a user, according to their timezone (not the server timezone). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): CivilDate {
  return getCivilDateInTimeZone(now, timeZone);
}

/** The instant corresponding to a wall-clock time in a timezone. */
export function zonedTimeToUtc(
  date: CivilDate,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second);
  const firstOffset = timeZoneOffsetMs(new Date(naive), timeZone);
  let result = naive - firstOffset;

  // One refinement pass handles DST boundaries.
  const secondOffset = timeZoneOffsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = naive - secondOffset;

  return new Date(result);
}

// ---------------------------------------------------------------------------
// Civil date arithmetic
// ---------------------------------------------------------------------------

/** Days since 1970-01-01 for a calendar date. Timezone independent. */
export function civilToDayNumber(date: CivilDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY);
}

export function dayNumberToCivil(dayNumber: number): CivilDate {
  const value = new Date(dayNumber * MS_PER_DAY);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return dayNumberToCivil(civilToDayNumber(date) + days);
}

export function diffInDays(from: CivilDate, to: CivilDate): number {
  return civilToDayNumber(to) - civilToDayNumber(from);
}

export function isSameDay(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** `Date` (UTC midnight) ⇄ `CivilDate` conversions for date-only columns. */
export function civilToDateOnly(date: CivilDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

export function dateOnlyToCivil(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Jalali ⇄ Gregorian
// ---------------------------------------------------------------------------

export function toJalali(date: Date): JalaliDate {
  const { jy, jm, jd } = jalaali.toJalaali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  return { jy, jm, jd };
}

export function isValidJalaliDate(date: JalaliDate): boolean {
  if (date.jy < MIN_JALALI_YEAR || date.jy > MAX_JALALI_YEAR) return false;
  return jalaali.isValidJalaaliDate(date.jy, date.jm, date.jd);
}

/** Number of days in a Jalali month (Esfand has 30 days in leap years). */
export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function jalaliToCivil(date: JalaliDate): CivilDate {
  const { gy, gm, gd } = jalaali.toGregorian(date.jy, date.jm, date.jd);
  return { year: gy, month: gm, day: gd };
}

export function civilToJalali(date: CivilDate): JalaliDate {
  return toJalali(civilToDateOnly(date));
}

export function isValidCivilDate(date: CivilDate): boolean {
  if (date.month < 1 || date.month > 12) return false;
  if (date.year < MIN_YEAR || date.year > MAX_YEAR) return false;
  if (date.day < 1 || date.day > daysInMonth(date.year, date.month)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

/**
 * Yadet stores birthdays in the Jalali (Persian) calendar: what the user types
 * is exactly what the user sees. ISO input is converted to Jalali on the way in.
 */
export interface ParsedBirthday {
  ok: true;
  /** Jalali month (1-12) of the yearly recurrence. */
  month: number;
  /** Jalali day of the yearly recurrence. */
  day: number;
  /** Original Jalali birth year, or `null` when the user did not provide one. */
  year: number | null;
  /** Gregorian date of the original birth (uses a leap reference year if `year` is null). */
  civil: CivilDate;
}

export type ParseBirthdayResult = ParsedBirthday | { ok: false; reason: 'empty' | 'invalid' };

function parseGregorianInput(normalized: string): ParseBirthdayResult {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(normalized);
  if (!match) return { ok: false, reason: 'invalid' };

  const civil: CivilDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (!isValidCivilDate(civil)) return { ok: false, reason: 'invalid' };

  const jalali = civilToJalali(civil);
  if (jalali.jy < MIN_JALALI_YEAR || jalali.jy > MAX_JALALI_YEAR) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, month: jalali.jm, day: jalali.jd, year: jalali.jy, civil };
}

function findJalaliMonth(name: string): number | null {
  const index = JALALI_MONTH_NAMES.findIndex((month) => month === name);
  return index === -1 ? null : index + 1;
}

function parseJalaliInput(normalized: string): ParseBirthdayResult {
  // `<day> <month-name>` or `<day> <month-name> <year>`
  const match = /^(\d{1,3})\s+([^\d\s]+)(?:\s+(\d{1,4}))?$/.exec(normalized.trim());
  if (!match) return { ok: false, reason: 'invalid' };

  const day = Number(match[1]);
  const month = findJalaliMonth(match[2] as string);
  if (month === null) return { ok: false, reason: 'invalid' };

  const hasYear = match[3] !== undefined;
  const jy = hasYear ? Number(match[3]) : UNKNOWN_BIRTH_YEAR_JALALI;
  if (!isValidJalaliDate({ jy, jm: month, jd: day })) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    month,
    day,
    year: hasYear ? jy : null,
    civil: jalaliToCivil({ jy, jm: month, jd: day }),
  };
}

/**
 * Accepts Persian-friendly and ISO input:
 * - `۱۸ مهر ۱۳۸۰` / `18 مهر 1380` / `18 مهر` (Jalali, year optional)
 * - `2001-10-10` (Gregorian, year required)
 *
 * The result is always normalized to the Jalali calendar.
 */
export function parseBirthDate(rawInput: string): ParseBirthdayResult {
  const input = normalizeDigits(rawInput)
    .replace(/[ً-ْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (input.length === 0) return { ok: false, reason: 'empty' };
  if (input.length > 40) return { ok: false, reason: 'invalid' };

  const gregorian = parseGregorianInput(input);
  return gregorian.ok ? gregorian : parseJalaliInput(input);
}

/** The Jalali calendar date of an instant, in a given timezone. */
export function currentJalaliDate(timeZone: string, now: Date = new Date()): JalaliDate {
  return toJalali(civilToDateOnly(todayInTimeZone(timeZone, now)));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** `۱۸ مهر` / `۱۸ مهر ۱۳۸۰` — straight from Jalali components, no conversion. */
export function formatJalali(month: number, day: number, year?: number | null): string {
  const monthName = JALALI_MONTH_NAMES[month - 1] ?? String(month);
  const base = `${toPersianDigits(day)} ${monthName}`;
  return year === undefined || year === null ? base : `${base} ${toPersianDigits(year)}`;
}

export function formatJalaliCivil(civil: CivilDate, options: { withYear?: boolean } = {}): string {
  const { jy, jm, jd } = civilToJalali(civil);
  return formatJalali(jm, jd, options.withYear ? jy : null);
}

export function formatJalaliDateOnly(date: Date, options: { withYear?: boolean } = {}): string {
  const { jy, jm, jd } = toJalali(date);
  return formatJalali(jm, jd, options.withYear ? jy : null);
}

/** `۱۲ روز دیگه` / `فردا` / `امروز` */
export function formatDaysUntil(days: number): string {
  if (days <= 0) return 'امروز';
  if (days === 1) return 'فردا';
  return `${toPersianDigits(days)} روز دیگه`;
}
