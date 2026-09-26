import { describe, expect, it } from 'vitest';
import {
  ageOnBirthday,
  isValidBirthdayRule,
  nextOccurrence,
  occurrenceInJalaliYear,
  reminderDateFor,
  resolveDueOccurrence,
  subtractJalaliDays,
  todayFor,
} from '../../src/modules/birthdays/birthday.calc.js';
import type { BirthdayRule } from '../../src/modules/birthdays/birthday.calc.js';
import type { JalaliDate } from '../../src/shared/utils/date.js';

const j = (jy: number, jm: number, jd: number): JalaliDate => ({ jy, jm, jd });

const rule = (month: number, day: number, year: number | null = null): BirthdayRule => ({
  month,
  day,
  year,
});

describe('isValidBirthdayRule', () => {
  it('accepts ordinary Jalali dates', () => {
    expect(isValidBirthdayRule(rule(7, 18, 1380))).toBe(true);
    expect(isValidBirthdayRule(rule(1, 1))).toBe(true);
    expect(isValidBirthdayRule(rule(7, 30, 1380))).toBe(true); // Mehr has 30 days
  });

  it('rejects impossible dates', () => {
    expect(isValidBirthdayRule(rule(13, 1))).toBe(false);
    expect(isValidBirthdayRule(rule(0, 1))).toBe(false);
    expect(isValidBirthdayRule(rule(7, 31))).toBe(false);
    expect(isValidBirthdayRule(rule(7, 0))).toBe(false);
    expect(isValidBirthdayRule(rule(6, 31))).toBe(false); // Shahrivar has 31? no: 31 days, ok
  });

  it('only allows Esfand 30 when the birth year is a leap year', () => {
    expect(isValidBirthdayRule(rule(12, 30, 1399))).toBe(true);
    expect(isValidBirthdayRule(rule(12, 30, 1398))).toBe(false);
    // Unknown year: Esfand 30 is accepted and clamped per occurrence.
    expect(isValidBirthdayRule(rule(12, 30))).toBe(true);
  });
});

describe('occurrenceInJalaliYear', () => {
  it('clamps Esfand 30 to Esfand 29 in common years', () => {
    expect(occurrenceInJalaliYear(rule(12, 30), 1398).jalali).toEqual(j(1398, 12, 29));
    expect(occurrenceInJalaliYear(rule(12, 30), 1399).jalali).toEqual(j(1399, 12, 30));
  });

  it('keeps Esfand 29 in every year', () => {
    expect(occurrenceInJalaliYear(rule(12, 29), 1398).jalali).toEqual(j(1398, 12, 29));
    expect(occurrenceInJalaliYear(rule(12, 29), 1399).jalali).toEqual(j(1399, 12, 29));
  });

  it('converts to the Gregorian calendar', () => {
    expect(occurrenceInJalaliYear(rule(7, 18), 1405).civil).toEqual({ year: 2026, month: 10, day: 10 });
  });
});

describe('nextOccurrence', () => {
  it('returns today when the birthday is today', () => {
    const result = nextOccurrence(rule(7, 18), j(1405, 7, 18));
    expect(result.jalali).toEqual(j(1405, 7, 18));
    expect(result.daysUntil).toBe(0);
  });

  it('returns the coming one within the same year', () => {
    const result = nextOccurrence(rule(12, 25), j(1405, 7, 18));
    expect(result.jalali).toEqual(j(1405, 12, 25));
    expect(result.daysUntil).toBeGreaterThan(0);
  });

  it('rolls over to next year when the date has passed', () => {
    const result = nextOccurrence(rule(1, 5), j(1405, 12, 1));
    expect(result.jalali).toEqual(j(1406, 1, 5));
    expect(result.daysUntil).toBeGreaterThan(0);
  });

  it('handles Nowruz rollover', () => {
    const result = nextOccurrence(rule(1, 1), j(1404, 12, 29));
    expect(result.jalali).toEqual(j(1405, 1, 1));
  });
});

describe('resolveDueOccurrence', () => {
  it('is due on the birthday for daysBefore = 0', () => {
    const result = resolveDueOccurrence(rule(7, 18), j(1405, 7, 18), 0);
    expect(result?.jalali).toEqual(j(1405, 7, 18));
  });

  it('is due 7 days before', () => {
    const result = resolveDueOccurrence(rule(7, 18), j(1405, 7, 11), 7);
    expect(result?.jalali).toEqual(j(1405, 7, 18));
  });

  it('is due 3 and 1 days before', () => {
    expect(resolveDueOccurrence(rule(7, 18), j(1405, 7, 15), 3)?.jalali).toEqual(j(1405, 7, 18));
    expect(resolveDueOccurrence(rule(7, 18), j(1405, 7, 17), 1)?.jalali).toEqual(j(1405, 7, 18));
  });

  it('is not due on any other day', () => {
    expect(resolveDueOccurrence(rule(7, 18), j(1405, 7, 10), 7)).toBeNull();
    expect(resolveDueOccurrence(rule(7, 18), j(1405, 7, 12), 7)).toBeNull();
    // Already past: the "7 days before" reminder for this year is stale.
    expect(resolveDueOccurrence(rule(7, 18), j(1405, 7, 19), 7)).toBeNull();
  });

  it('fires exactly once per year per offset', () => {
    const ruleUnderTest = rule(1, 1);
    const dueDays: string[] = [];

    // Covers the whole 1405 reminder window (which starts in 1404/12) plus 1406.
    for (let offset = 0; offset < 400; offset += 1) {
      const today = subtractJalaliDays(j(1404, 12, 20), -offset);
      for (const daysBefore of [7, 3, 1, 0]) {
        if (resolveDueOccurrence(ruleUnderTest, today, daysBefore)) {
          dueDays.push(`${today.jy}/${today.jm}/${today.jd}:${daysBefore}`);
        }
      }
    }

    // 2 occurrences (1405 and 1406) × 4 offsets = 8 notifications, no more.
    expect(dueDays).toEqual([
      '1404/12/23:7',
      '1404/12/27:3',
      '1404/12/29:1',
      '1405/1/1:0',
      '1405/12/23:7',
      '1405/12/27:3',
      '1405/12/29:1',
      '1406/1/1:0',
    ]);
  });

  it('works for an unknown birth year', () => {
    expect(resolveDueOccurrence(rule(7, 18), j(1405, 7, 11), 7)?.jalali).toEqual(j(1405, 7, 18));
  });
});

describe('reminderDateFor', () => {
  it('goes back by the requested number of days', () => {
    // Esfand 1404 has 29 days, so 1405/1/1 minus 7 days is 1404/12/23.
    const occurrence = occurrenceInJalaliYear(rule(1, 1), 1405);
    expect(reminderDateFor(occurrence, 7)).toEqual(j(1404, 12, 23));
    expect(reminderDateFor(occurrence, 3)).toEqual(j(1404, 12, 27));
    expect(reminderDateFor(occurrence, 1)).toEqual(j(1404, 12, 29));
    expect(reminderDateFor(occurrence, 0)).toEqual(j(1405, 1, 1));
  });
});

describe('ageOnBirthday', () => {
  it('counts Jalali years', () => {
    expect(ageOnBirthday(rule(7, 18, 1380), 1405)).toBe(25);
  });

  it('returns null when the birth year is unknown', () => {
    expect(ageOnBirthday(rule(7, 18), 1405)).toBeNull();
  });
});

describe('todayFor', () => {
  it('uses the given timezone', () => {
    const instant = new Date('2026-03-20T20:30:00.000Z');
    // 2026-03-20 is Esfand 29 1404 in UTC...
    expect(todayFor('UTC', instant)).toEqual(j(1404, 12, 29));
    // ...but already Nowruz in Tehran (UTC+3:30).
    expect(todayFor('Asia/Tehran', instant)).toEqual(j(1405, 1, 1));
  });
});
