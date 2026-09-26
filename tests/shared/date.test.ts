import { describe, expect, it } from 'vitest';
import {
  addDays,
  civilToDateOnly,
  civilToDayNumber,
  dateOnlyToCivil,
  diffInDays,
  formatDaysUntil,
  formatJalaliDateOnly,
  getCivilDateInTimeZone,
  isValidCivilDate,
  isValidTimeZone,
  normalizeDigits,
  parseBirthDate,
  toJalali,
  toPersianDigits,
  todayInTimeZone,
  zonedTimeToUtc,
  type CivilDate,
} from '../../src/shared/utils/date.js';

describe('digits', () => {
  it('normalizes Persian and Arabic digits', () => {
    expect(normalizeDigits('۱۳۸۰')).toBe('1380');
    expect(normalizeDigits('٢٠١٢')).toBe('2012');
  });

  it('converts digits for display', () => {
    expect(toPersianDigits(1380)).toBe('۱۳۸۰');
    expect(toPersianDigits('12')).toBe('۱۲');
  });
});

describe('parseBirthDate', () => {
  it('parses a Jalali date with year', () => {
    const result = parseBirthDate('18 مهر 1380');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.month).toBe(7);
    expect(result.day).toBe(18);
    expect(result.year).toBe(1380);
    expect(result.civil).toEqual({ year: 2001, month: 10, day: 10 });
  });

  it('parses a Jalali date without year against the reference year', () => {
    const result = parseBirthDate('2 آبان');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.year).toBeNull();
    expect(result.month).toBe(8);
    expect(result.day).toBe(2);
    // 2 Aban of the reference year (1399) falls in October 2020.
    expect(result.civil).toEqual({ year: 2020, month: 10, day: 23 });
  });

  it('parses Persian digits and extra whitespace', () => {
    const result = parseBirthDate('  ۱۸   مهر   ۱۳۸۰ ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.civil).toEqual({ year: 2001, month: 10, day: 10 });
  });

  it('parses an ISO Gregorian date and converts it to Jalali', () => {
    const result = parseBirthDate('2001-10-10');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.civil).toEqual({ year: 2001, month: 10, day: 10 });
    expect(result.month).toBe(7);
    expect(result.day).toBe(18);
    expect(result.year).toBe(1380);
  });

  it('parses an ISO Gregorian date with slashes', () => {
    const result = parseBirthDate('2001/10/10');
    expect(result.ok).toBe(true);
  });

  it('rejects invalid input', () => {
    expect(parseBirthDate('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseBirthDate('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseBirthDate('31 مهر').ok).toBe(false); // Mehr has 30 days
    expect(parseBirthDate('13 دیبه').ok).toBe(false); // unknown month
    expect(parseBirthDate('2001-13-01').ok).toBe(false);
    expect(parseBirthDate('2001-02-30').ok).toBe(false);
    expect(parseBirthDate('hello').ok).toBe(false);
  });

  it('accepts Esfand 30 only in a Jalali leap year', () => {
    // Esfand 29 exists in every year.
    expect(parseBirthDate('29 اسفند 1398').ok).toBe(true);
    expect(parseBirthDate('29 اسفند 1399').ok).toBe(true);
    // Esfand 30 only exists in a leap year (1399 is one, 1398 is not).
    expect(parseBirthDate('30 اسفند 1399').ok).toBe(true);
    expect(parseBirthDate('30 اسفند 1398').ok).toBe(false);
  });
});

describe('jalali conversion', () => {
  it('converts a known Gregorian date to Jalali', () => {
    expect(toJalali(new Date(Date.UTC(2001, 9, 10)))).toEqual({ jy: 1380, jm: 7, jd: 18 });
    expect(toJalali(new Date(Date.UTC(2026, 2, 21)))).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it('formats dates in Persian', () => {
    expect(formatJalaliDateOnly(new Date(Date.UTC(2001, 9, 10)), { withYear: true })).toBe(
      '۱۸ مهر ۱۳۸۰',
    );
    expect(formatJalaliDateOnly(new Date(Date.UTC(2001, 9, 10)))).toBe('۱۸ مهر');
  });
});

describe('timezone handling', () => {
  const instant = new Date('2026-03-20T20:30:00.000Z');

  it('validates IANA timezones', () => {
    expect(isValidTimeZone('Asia/Tehran')).toBe(true);
    expect(isValidTimeZone('Mars/Phobos')).toBe(false);
  });

  it('uses the user timezone instead of the server timezone', () => {
    // 2026-03-20T20:30Z is 2026-03-21 00:00 in Tehran (UTC+3:30)
    expect(getCivilDateInTimeZone(instant, 'Asia/Tehran')).toEqual({
      year: 2026,
      month: 3,
      day: 21,
    });
    expect(todayInTimeZone('UTC', instant)).toEqual({ year: 2026, month: 3, day: 20 });
    // New York is UTC-4 in March (DST)
    expect(todayInTimeZone('America/New_York', instant)).toEqual({
      year: 2026,
      month: 3,
      day: 20,
    });
  });

  it('converts a wall-clock time to an instant', () => {
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 21 }, 'Asia/Tehran', 9, 0).toISOString()).toBe(
      '2026-03-21T05:30:00.000Z',
    );
    // Same wall clock in a DST-observing zone
    expect(
      zonedTimeToUtc({ year: 2026, month: 7, day: 1 }, 'America/New_York', 9, 0).toISOString(),
    ).toBe('2026-07-01T13:00:00.000Z');
    // ...and in winter (standard time)
    expect(
      zonedTimeToUtc({ year: 2026, month: 1, day: 1 }, 'America/New_York', 9, 0).toISOString(),
    ).toBe('2026-01-01T14:00:00.000Z');
  });
});

describe('civil date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays({ year: 2026, month: 12, day: 30 }, 1)).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addDays({ year: 2024, month: 2, day: 28 }, 1)).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(addDays({ year: 2026, month: 2, day: 28 }, 1)).toEqual({
      year: 2026,
      month: 3,
      day: 1,
    });
  });

  it('computes day differences', () => {
    const from: CivilDate = { year: 2026, month: 3, day: 20 };
    expect(diffInDays(from, { year: 2026, month: 3, day: 21 })).toBe(1);
    expect(diffInDays(from, { year: 2026, month: 12, day: 31 })).toBe(286);
    expect(civilToDayNumber({ year: 1970, month: 1, day: 2 })).toBe(1);
  });

  it('round-trips date-only values', () => {
    const civil: CivilDate = { year: 1998, month: 10, day: 15 };
    const date = civilToDateOnly(civil);
    expect(date.toISOString()).toBe('1998-10-15T00:00:00.000Z');
    expect(dateOnlyToCivil(date)).toEqual(civil);
  });

  it('validates Gregorian dates', () => {
    expect(isValidCivilDate({ year: 2024, month: 2, day: 29 })).toBe(true);
    expect(isValidCivilDate({ year: 2023, month: 2, day: 29 })).toBe(false);
    expect(isValidCivilDate({ year: 2023, month: 0, day: 1 })).toBe(false);
  });
});

describe('formatDaysUntil', () => {
  it('uses friendly Persian wording', () => {
    expect(formatDaysUntil(0)).toBe('امروز');
    expect(formatDaysUntil(1)).toBe('فردا');
    expect(formatDaysUntil(12)).toBe('۱۲ روز دیگه');
  });
});
