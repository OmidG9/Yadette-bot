import { beforeEach, describe, expect, it } from 'vitest';
import { BirthdayService } from '../../src/modules/birthdays/birthday.service.js';
import { buildMonth, monthName, shiftMonth } from '../../src/modules/birthdays/calendar.js';
import { ageOnBirthday, nextOccurrence } from '../../src/modules/birthdays/birthday.calc.js';
import type { BirthdayRule } from '../../src/modules/birthdays/birthday.calc.js';
import type { UpcomingBirthday } from '../../src/modules/birthdays/birthday.types.js';
import type { PersonWithReminders } from '../../src/modules/people/person.types.js';
import { FakePersonRepository } from '../helpers/fake-person.repository.js';
import { FakeUserRepository, fakeUser } from '../helpers/fakes.js';
import { isLeapYear, jalaliMonthLength } from '../../src/shared/utils/date.js';

/** Azar 5 1405. */
const NOW = new Date('2026-11-26T09:00:00.000Z');

const user = fakeUser();

describe('shiftMonth', () => {
  it('moves within a year', () => {
    expect(shiftMonth(1405, 8, 1)).toEqual({ jy: 1405, jm: 9 });
    expect(shiftMonth(1405, 12, -1)).toEqual({ jy: 1405, jm: 11 });
  });

  it('crosses the year boundary in both directions', () => {
    expect(shiftMonth(1405, 12, 1)).toEqual({ jy: 1406, jm: 1 });
    expect(shiftMonth(1406, 1, -1)).toEqual({ jy: 1405, jm: 12 });
  });

  /**
   * Tapping "next" repeatedly must keep producing valid months. A naive
   * `month + delta` produces month 13, which then renders as an empty calendar
   * and quietly breaks paging.
   */
  it('never produces a month outside 1..12', () => {
    for (let delta = -30; delta <= 30; delta += 1) {
      const { jm } = shiftMonth(1405, 6, delta);
      expect(jm).toBeGreaterThanOrEqual(1);
      expect(jm).toBeLessThanOrEqual(12);
    }
  });

  it('is its own inverse, so paging back returns where it started', () => {
    for (let delta = 1; delta <= 20; delta += 1) {
      const forward = shiftMonth(1405, 11, delta);
      expect(shiftMonth(forward.jy, forward.jm, -delta)).toEqual({ jy: 1405, jm: 11 });
    }
  });

  it('handles a large jump across several years', () => {
    expect(shiftMonth(1405, 1, 25)).toEqual({ jy: 1407, jm: 2 });
  });
});

describe('buildMonth', () => {
  /**
   * `buildMonth` re-resolves every rule inside the requested year, so the
   * occurrence attached here is only the "next one" and is never what it reads.
   * Building it with the real function keeps the fixture honest.
   */
  function rule(month: number, day: number): UpcomingBirthday {
    const birthdayRule: BirthdayRule = { month, day, year: 1380 };
    const person: PersonWithReminders = {
      id: `p${month}-${day}`,
      userId: 'user1',
      name: `n${month}-${day}`,
      birthMonth: month,
      birthDay: day,
      birthYear: 1380,
      notes: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      interests: [],
      reminders: [],
    };
    const occurrence = nextOccurrence(birthdayRule, { jy: 1405, jm: 1, jd: 1 });
    return {
      person,
      rule: birthdayRule,
      occurrence,
      daysUntil: occurrence.daysUntil,
      age: ageOnBirthday(birthdayRule, occurrence.jalaliYear),
    };
  }

  it('groups several birthdays on the same day', () => {
    const month = buildMonth([rule(8, 6), rule(8, 6), rule(8, 20)], 1405, 8);

    expect(month.days).toEqual([
      { day: 6, names: ['n8-6', 'n8-6'] },
      { day: 20, names: ['n8-20'] },
    ]);
    expect(month.total).toBe(3);
  });

  it('only includes days that have a birthday on them', () => {
    const month = buildMonth([rule(8, 6)], 1405, 8);

    // An empty day is not rendered, so the view stays short.
    expect(month.days).toHaveLength(1);
  });

  it('returns an empty month when nothing falls in it', () => {
    const month = buildMonth([rule(8, 6)], 1405, 9);

    expect(month.days).toEqual([]);
    expect(month.total).toBe(0);
  });

  it('sorts days in calendar order regardless of input order', () => {
    const month = buildMonth([rule(8, 25), rule(8, 3), rule(8, 14)], 1405, 8);

    expect(month.days.map((day) => day.day)).toEqual([3, 14, 25]);
  });

  /**
   * Esfand 30 exists only in a leap year. Asking for a common year has to show
   * the person on Esfand 29, because that is the day the birthday is actually
   * observed - and it is the requested year, not "next year", that decides.
   */
  it('puts an Esfand 30 birthday on the 29th in a common year', () => {
    expect(isLeapYear(1405)).toBe(false);
    expect(jalaliMonthLength(1405, 12)).toBe(29);

    const month = buildMonth([rule(12, 30)], 1405, 12);

    expect(month.days).toEqual([{ day: 29, names: ['n12-30'] }]);
  });

  it('keeps an Esfand 30 birthday on the 30th in a leap year', () => {
    expect(isLeapYear(1408)).toBe(true);
    expect(jalaliMonthLength(1408, 12)).toBe(30);

    const month = buildMonth([rule(12, 30)], 1408, 12);

    expect(month.days).toEqual([{ day: 30, names: ['n12-30'] }]);
  });

  it('reports the requested year and month back to the caller', () => {
    const month = buildMonth([rule(5, 1)], 1410, 5);

    expect(month.jalaliYear).toBe(1410);
    expect(month.jalaliMonth).toBe(5);
  });
});

describe('monthName', () => {
  it('names every month of the Jalali year', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(monthName(month)).not.toBe(String(month));
    }
  });

  it('degrades to the number rather than returning undefined', () => {
    expect(monthName(13)).toBe('13');
  });
});

describe('BirthdayService.getCalendarForUser', () => {
  let people: FakePersonRepository;
  let service: BirthdayService;

  beforeEach(() => {
    people = new FakePersonRepository();
    service = new BirthdayService(people, new FakeUserRepository([user]));
  });

  function add(name: string, month: number, day: number): Promise<PersonWithReminders> {
    return people.create({ userId: user.id, name, birthMonth: month, birthDay: day, birthYear: null });
  }

  it('defaults to the owner current Jalali month', async () => {
    await add('Ali', 9, 6);
    const result = await service.getCalendarForUser(user.id, undefined, { now: NOW });

    expect(result!.month.jalaliMonth).toBe(9);
    expect(result!.month.days).toEqual([{ day: 6, names: ['Ali'] }]);
  });

  /** Paging carries an absolute year/month so three "next" then one "prev" is a no-op. */
  it('shows the requested month rather than drifting', async () => {
    await add('Ali', 1, 5);
    await add('Sara', 9, 6);

    const january = await service.getCalendarForUser(user.id, { year: 1406, month: 1 }, { now: NOW });

    expect(january!.month.days).toEqual([{ day: 5, names: ['Ali'] }]);
  });

  it('shows a birthday in a future year, not only the next one', async () => {
    await add('Ali', 1, 5);

    // Far enough ahead that the person's next occurrence is not in this year.
    const far = await service.getCalendarForUser(user.id, { year: 1410, month: 1 }, { now: NOW });

    expect(far!.month.days).toEqual([{ day: 5, names: ['Ali'] }]);
  });

  it('returns null for a user that no longer exists', async () => {
    expect(await service.getCalendarForUser('ghost', undefined, { now: NOW })).toBeNull();
  });
});
