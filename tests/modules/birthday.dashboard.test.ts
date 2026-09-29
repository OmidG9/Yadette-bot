import { beforeEach, describe, expect, it } from 'vitest';
import { BirthdayService } from '../../src/modules/birthdays/birthday.service.js';
import { DASHBOARD_LATER_LIMIT } from '../../src/modules/birthdays/dashboard.types.js';
import { FakePersonRepository } from '../helpers/fake-person.repository.js';
import { FakeUserRepository, fakeUser } from '../helpers/fakes.js';
import { toJalali } from '../../src/shared/utils/date.js';

/** 5 Aban 1405, a Thursday. Far from month end so the buckets are unambiguous. */
const NOW = new Date('2026-11-26T09:00:00.000Z');

const user = fakeUser();

/**
 * A person whose next birthday falls in `days` days from NOW.
 *
 * Birthdays are stored as Jalali month/day, so the offset has to be converted
 * rather than reused from the Gregorian date.
 */
function personIn(days: number): { month: number; day: number } {
  const target = new Date(NOW.getTime() + days * 86_400_000);
  const jalali = toJalali(target);
  return { month: jalali.jm, day: jalali.jd };
}

describe('BirthdayService.getDashboardForUser', () => {
  let people: FakePersonRepository;
  let service: BirthdayService;

  beforeEach(() => {
    people = new FakePersonRepository();
    service = new BirthdayService(people, new FakeUserRepository([user]));
  });

  async function add(days: number, name?: string): Promise<void> {
    const { month, day } = personIn(days);
    await people.create({
      userId: user.id,
      name: name ?? `p${days}`,
      birthMonth: month,
      birthDay: day,
      birthYear: null,
    });
  }

  it('separates today, this week and later', async () => {
    await add(0, 'today');
    await add(3, 'thisWeek');
    await add(7, 'weekEdge');
    await add(8, 'later');

    const buckets = await service.getDashboardForUser(user.id, { now: NOW });

    expect(buckets!.today.map((item) => item.person.name)).toEqual(['today']);
    // 7 is inside the week; 8 is the first day of "later".
    expect(buckets!.thisWeek.map((item) => item.person.name).sort()).toEqual(['thisWeek', 'weekEdge']);
    expect(buckets!.later.map((item) => item.person.name)).toEqual(['later']);
  });

  it('reports the closest birthday as the next one', async () => {
    await add(20);
    await add(2);
    await add(9);

    const buckets = await service.getDashboardForUser(user.id, { now: NOW });

    expect(buckets!.nextBirthday?.person.name).toBe('p2');
    expect(buckets!.nextBirthday?.daysUntil).toBe(2);
  });

  it('caps the later bucket so the home screen stays scannable', async () => {
    for (let days = 30; days < 30 + DASHBOARD_LATER_LIMIT + 5; days += 1) {
      // Distinct names would collide on the same day; offset by month instead.
      await add(days, `later${days}`);
    }

    const buckets = await service.getDashboardForUser(user.id, { now: NOW });

    expect(buckets!.later).toHaveLength(DASHBOARD_LATER_LIMIT);
    // The cap is a display limit, not a data loss: the month count still sees all.
    expect(buckets!.totalPeople).toBe(DASHBOARD_LATER_LIMIT + 5);
  });

  it('counts how many birthdays fall in the current Jalali month', async () => {
    await add(0);
    await add(5);
    await add(40);

    const buckets = await service.getDashboardForUser(user.id, { now: NOW });

    // 40 days out crosses into the next Jalali month, so it must not be counted.
    expect(buckets!.thisMonthCount).toBe(2);
  });

  it('returns an empty dashboard rather than throwing for a user with nobody', async () => {
    const buckets = await service.getDashboardForUser(user.id, { now: NOW });

    expect(buckets).not.toBeNull();
    expect(buckets!.today).toEqual([]);
    expect(buckets!.thisWeek).toEqual([]);
    expect(buckets!.later).toEqual([]);
    expect(buckets!.nextBirthday).toBeNull();
    expect(buckets!.thisMonthCount).toBe(0);
  });

  /** A keyboard can outlive the user it points at. */
  it('returns null when the user no longer exists', async () => {
    expect(await service.getDashboardForUser('ghost', { now: NOW })).toBeNull();
  });

  it('never includes a soft-deleted person', async () => {
    const person = await people.create({
      userId: user.id, name: 'gone', birthMonth: 9, birthDay: 5, birthYear: null,
    });
    await people.softDelete(person.id, user.id);

    const buckets = await service.getDashboardForUser(user.id, { now: NOW });

    expect(buckets!.today).toEqual([]);
    expect(buckets!.totalPeople).toBe(0);
  });

  it('orders every bucket by how soon it is', async () => {
    await add(6, 'six');
    await add(1, 'one');
    await add(4, 'four');

    const buckets = await service.getDashboardForUser(user.id, { now: NOW });
    const days = buckets!.thisWeek.map((item) => item.daysUntil);

    expect(days).toEqual([1, 4, 6]);
  });
});
