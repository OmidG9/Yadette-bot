import { beforeEach, describe, expect, it } from 'vitest';
import { ReminderService, reminderLabel } from '../../src/modules/reminders/reminder.service.js';
import { ValidationError } from '../../src/shared/errors/index.js';
import { FakeReminderRepository, FakeUserRepository, fakeUser } from '../helpers/fakes.js';

function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0]!;
}

const person = {
  id: 'person1',
  userId: 'user1',
  name: 'مادر',
  birthMonth: 7,
  birthDay: 18,
  birthYear: 1380,
  notes: null,
};

describe('ReminderService.findDueNotifications', () => {
  let reminders: FakeReminderRepository;
  let users: FakeUserRepository;
  let service: ReminderService;

  beforeEach(() => {
    reminders = new FakeReminderRepository();
    users = new FakeUserRepository([fakeUser()]);
    reminders.seed(person);
    service = new ReminderService(reminders, users);
  });

  it('returns nothing on an ordinary day', async () => {
    // 2026-06-01 is 1405/03/11; the birthday (Mehr 18) is far away.
    const due = await service.findDueNotifications(new Date('2026-06-01T06:00:00.000Z'));
    expect(due).toHaveLength(0);
  });

  it('returns only the birthday reminder on the birthday itself', async () => {
    // 2026-10-10 is Mehr 18 1405 in Tehran: the "0 days before" slot.
    const due = await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z'));
    expect(due.map((item) => item.daysBefore)).toEqual([0]);
    expect(due[0]!.occurrence.jalaliYear).toBe(1405);
  });

  it('fires exactly one offset per day, never two', async () => {
    // Walk the whole reminder window around Mehr 18 1405, day by day.
    const fired: number[] = [];

    for (let day = 1; day <= 20; day += 1) {
      const at = new Date(Date.UTC(2026, 9, day, 6, 0, 0));
      const due = await service.findDueNotifications(at);
      // At most one notification per day, by design.
      expect(due.length).toBeLessThanOrEqual(1);
      fired.push(...due.map((item) => item.daysBefore));
    }

    // 7, 3, 1 and 0 days before Mehr 18 — each exactly once.
    expect(fired.sort((a, b) => b - a)).toEqual([7, 3, 1, 0]);
  });

  it('evaluates the same instant differently per user timezone', async () => {
    // 2026-10-02T21:00Z is 1405/07/11 (00:30) in Tehran but 1405/07/10 in UTC.
    const instant = new Date('2026-10-02T21:00:00.000Z');
    users = new FakeUserRepository([
      fakeUser({ id: 'tehran', timezone: 'Asia/Tehran' }),
      fakeUser({ id: 'utc', timezone: 'UTC' }),
    ]);
    reminders = new FakeReminderRepository();
    reminders.seed({ ...person, userId: 'tehran' });
    reminders.seed({ ...person, id: 'person2', userId: 'utc' });
    service = new ReminderService(reminders, users);

    const due = await service.findDueNotifications(instant);
    expect(due).toHaveLength(1);
    expect(due[0]!.userId).toBe('tehran');
    expect(due[0]!.daysBefore).toBe(7);
  });

  it('skips users with reminders globally disabled', async () => {
    users = new FakeUserRepository([fakeUser({ reminderEnabled: false })]);
    service = new ReminderService(reminders, users);
    const due = await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z'));
    expect(due).toHaveLength(0);
  });

  /**
   * Regression: "already sent" used to be checked in the job, after the due list
   * was built. A birthday stays due for the whole day, so every scheduler tick
   * re-reported the same reminder forever even though nothing was resent.
   */
  it('stops reporting a slot that has already been delivered', async () => {
    const birthday = new Date('2026-10-10T06:00:00.000Z');

    const first = await service.findDueNotifications(birthday);
    expect(first).toHaveLength(1);
    expect(await service.claim(only(first))).not.toBeNull();

    expect(await service.findDueNotifications(birthday)).toHaveLength(0);
  });

  it('keeps reporting a slot released after a failed delivery', async () => {
    const birthday = new Date('2026-10-10T06:00:00.000Z');
    const claimed = await service.claim(only(await service.findDueNotifications(birthday)));
    expect(claimed).not.toBeNull();

    await service.release(claimed!.log.id);

    expect(await service.findDueNotifications(birthday)).toHaveLength(1);
  });

  it('reports the same slot again for the next Jalali year', async () => {
    const thisYear = new Date('2026-10-10T06:00:00.000Z');
    await service.claim(only(await service.findDueNotifications(thisYear)));

    const nextYear = new Date('2027-10-10T06:00:00.000Z');
    const due = await service.findDueNotifications(nextYear);

    expect(due).toHaveLength(1);
    expect(due[0]!.occurrence.jalaliYear).toBe(1406);
  });

  it('skips disabled offsets', async () => {
    const all = await reminders.findForPerson(person.id, person.userId);
    const birthdayReminder = all.find((item) => item.daysBefore === 0)!;
    await reminders.setEnabled(birthdayReminder.id, person.id, person.userId, false);

    expect(await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z'))).toHaveLength(0);
    // Other offsets keep working on their own days.
    expect(await service.findDueNotifications(new Date('2026-10-03T06:00:00.000Z'))).toHaveLength(1);
  });

  it('sorts the closest birthday first', async () => {
    const due = await service.findDueNotifications(new Date('2026-10-03T06:00:00.000Z'));
    const days = due.map((item) => item.occurrence.daysUntil);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
});

describe('ReminderService.setEnabled', () => {
  let reminders: FakeReminderRepository;
  let service: ReminderService;

  beforeEach(() => {
    reminders = new FakeReminderRepository();
    const users = new FakeUserRepository([fakeUser()]);
    reminders.seed(person);
    service = new ReminderService(reminders, users);
  });

  it('turns on an offset the person does not have yet', async () => {
    const before = await service.listForPerson('user1', person.id);
    expect(before.find((r) => r.daysBefore === 14)?.enabled).toBe(false);

    await service.setEnabled('user1', person.id, 14, true);

    const after = await service.listForPerson('user1', person.id);
    expect(after.find((r) => r.daysBefore === 14)?.enabled).toBe(true);
  });

  /**
   * Regression: `ensureForPerson` returns *all* of the person's rows ordered by
   * offset descending, and the code took the first one. Turning on "14 days
   * before" for someone who already had 30/7/1/0 therefore rewrote the 30-day
   * reminder instead — a silent data change the user never asked for.
   */
  it('never touches a different offset when creating a missing one', async () => {
    const before = await reminders.findForPerson(person.id, 'user1');
    const others = before
      .filter((r) => r.daysBefore !== 14)
      .map((r) => ({ daysBefore: r.daysBefore, enabled: r.enabled }));

    expect(others.length).toBeGreaterThan(0);

    await service.setEnabled('user1', person.id, 14, true);

    const after = await reminders.findForPerson(person.id, 'user1');
    for (const other of others) {
      expect(
        after.find((r) => r.daysBefore === other.daysBefore)?.enabled,
        `offset ${other.daysBefore} must not change`,
      ).toBe(other.enabled);
    }
    expect(after.find((r) => r.daysBefore === 14)?.enabled).toBe(true);
  });

  it('creates a missing offset already in the requested state', async () => {
    // `ensureForPerson` always inserts enabled rows, so an "off" request has to
    // be applied to the freshly created row.
    await service.setEnabled('user1', person.id, 30, false);

    const after = await reminders.findForPerson(person.id, 'user1');
    expect(after.find((r) => r.daysBefore === 30)?.enabled).toBe(false);
  });

  it('rejects an offset the product does not offer', async () => {
    await expect(service.setEnabled('user1', person.id, 99, true)).rejects.toThrow(ValidationError);
  });

  it('re-enables only the requested offset when all of them are off', async () => {
    for (const days of [0, 1, 3, 7]) {
      await service.setEnabled('user1', person.id, days, false);
    }
    expect((await reminders.findForPerson(person.id, 'user1')).every((r) => !r.enabled)).toBe(true);

    await service.setEnabled('user1', person.id, 3, true);

    const rows = await reminders.findForPerson(person.id, 'user1');
    expect(rows.find((r) => r.daysBefore === 3)?.enabled).toBe(true);
    for (const days of [0, 1, 7]) {
      expect(rows.find((r) => r.daysBefore === days)?.enabled, `offset ${days}`).toBe(false);
    }
  });

  it('works for a person whose reminder rows were deleted outright', async () => {
    const empty = new FakeReminderRepository();
    const users = new FakeUserRepository([fakeUser()]);
    empty.seed({ ...person, id: 'person2' });
    const svc = new ReminderService(empty, users);

    await empty.deleteForPerson('person2');
    expect(await empty.findForPerson('person2', 'user1')).toHaveLength(0);

    await svc.setEnabled('user1', 'person2', 3, true);

    const rows = await empty.findForPerson('person2', 'user1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.daysBefore).toBe(3);
    expect(rows[0]?.enabled).toBe(true);
  });
});

describe('ReminderService notification claims', () => {
  let reminders: FakeReminderRepository;
  let service: ReminderService;

  beforeEach(() => {
    reminders = new FakeReminderRepository();
    const users = new FakeUserRepository([fakeUser()]);
    reminders.seed(person);
    service = new ReminderService(reminders, users);
  });

  it('allows one claim per occurrence and offset', async () => {
    const due = only(await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z')));

    const first = await service.claim(due);
    expect(first).not.toBeNull();
    expect(await service.claim(due)).toBeNull();
    expect(reminders.logCount()).toBe(1);
  });

  it('treats a second claim as already sent', async () => {
    const due = only(await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z')));
    expect(await service.wasSent(due)).toBe(false);

    const claim = await service.claim(due);
    expect(await service.wasSent(due)).toBe(true);
    expect(claim?.log.daysBefore).toBe(due.daysBefore);
  });

  it('keeps claims of different days independent', async () => {
    const sevenDay = only(await service.findDueNotifications(new Date('2026-10-03T06:00:00.000Z')));
    const birthday = only(await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z')));

    expect(await service.claim(sevenDay)).not.toBeNull();
    expect(await service.claim(birthday)).not.toBeNull();
    expect(reminders.logCount()).toBe(2);

    // ...and neither can be claimed twice.
    expect(await service.claim(sevenDay)).toBeNull();
    expect(await service.claim(birthday)).toBeNull();
  });

  it('allows a retry after a failed delivery releases the claim', async () => {
    const due = only(await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z')));
    const claim = await service.claim(due);
    expect(claim).not.toBeNull();

    await service.release(claim!.log.id);

    expect(await service.wasSent(due)).toBe(false);
    expect(await service.claim(due)).not.toBeNull();
  });

  it('does not repeat a notification the next year', async () => {
    const due = only(await service.findDueNotifications(new Date('2026-10-10T06:00:00.000Z')));
    await service.claim(due);
    expect(await service.claim(due)).toBeNull();

    // Mehr 18 1406 is a new occurrence, so the same offset may fire again.
    const nextYear = await service.findDueNotifications(new Date('2027-10-10T06:00:00.000Z'));
    const nextDue = only(nextYear.filter((item) => item.daysBefore === 0));
    expect(nextDue.occurrence.jalaliYear).toBe(1406);
    expect(await service.claim(nextDue)).not.toBeNull();
  });
});

describe('ReminderService.setEnabled', () => {
  it('rejects offsets outside the allowed set', async () => {
    const reminders = new FakeReminderRepository();
    const service = new ReminderService(reminders, new FakeUserRepository([fakeUser()]));
    reminders.seed(person);

    await expect(service.setEnabled('user1', 'person1', 5, true)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('toggles an existing offset', async () => {
    const reminders = new FakeReminderRepository();
    const service = new ReminderService(reminders, new FakeUserRepository([fakeUser()]));
    reminders.seed(person);

    const result = await service.setEnabled('user1', 'person1', 0, false);
    expect(result.find((item) => item.daysBefore === 0)?.enabled).toBe(false);
  });
});

describe('reminderLabel', () => {
  it('uses a dedicated label for the birthday itself', () => {
    expect(reminderLabel(0, 'fa')).not.toBe(reminderLabel(1, 'fa'));
    expect(reminderLabel(7, 'fa')).toContain('۷');
  });
});
