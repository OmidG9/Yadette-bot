import { beforeEach, describe, expect, it } from 'vitest';
import { ReminderService } from '../../src/modules/reminders/reminder.service.js';
import { SNOOZE_OPTIONS, isSnoozeOption } from '../../src/modules/reminders/snooze.js';
import { FakeReminderRepository, FakeUserRepository, fakeUser } from '../helpers/fakes.js';

/** Mehr 18 1405, the "on the day" slot. */
const NOW = new Date('2026-10-10T06:00:00.000Z');
const user = fakeUser();

const person = {
  id: 'person1',
  userId: user.id,
  name: 'Sara',
  birthMonth: 7,
  birthDay: 18,
  birthYear: 1380,
  notes: null,
};

/** Only the "on the day" slot, so a test never has to care which offset won. */
function freshService(): { reminders: FakeReminderRepository; service: ReminderService } {
  const reminders = new FakeReminderRepository();
  reminders.seed(person, [0]);
  return { reminders, service: new ReminderService(reminders, new FakeUserRepository([user])) };
}

/** A delivered notification the user could tap "snooze" on. */
async function deliveredSlot(
  service: ReminderService,
): Promise<{ logId: string; target: { personId: string; birthdayYear: number; daysBefore: number } }> {
  const due = (await service.findDueNotifications(NOW))[0]!;
  const claim = await service.claim(due);
  await service.markSent(claim!.log.id, NOW);
  return { logId: claim!.log.id, target: (await service.resolveSnoozeTarget(claim!.log.id, user.id))! };
}

describe('isSnoozeOption', () => {
  it('accepts exactly the offsets that are offered', () => {
    for (const days of SNOOZE_OPTIONS) {
      expect(isSnoozeOption(days), String(days)).toBe(true);
    }
  });

  /**
   * The offset arrives in callback data, which anyone can forge. An arbitrary
   * value would produce a plausible-looking postponement the user never asked
   * for, so anything not on the offered list is refused.
   */
  it('refuses an offset that was never offered', () => {
    for (const days of [0, -1, 2, 14, 400, 1.5, NaN, Infinity]) {
      expect(isSnoozeOption(days), String(days)).toBe(false);
    }
  });
});

describe('ReminderService.resolveSnoozeTarget', () => {
  let service: ReminderService;

  beforeEach(() => {
    ({ service } = freshService());
  });

  it('resolves a delivered notification back to its slot', async () => {
    const { target } = await deliveredSlot(service);

    expect(target).toEqual({ personId: 'person1', birthdayYear: 1405, daysBefore: 0 });
  });

  /**
   * The log id is the only thing a snooze button carries, and it is not a
   * secret. Without the ownership check, anyone who learned a log id could
   * postpone somebody else's reminder.
   */
  it('refuses a log id belonging to another user', async () => {
    const { logId } = await deliveredSlot(service);

    expect(await service.resolveSnoozeTarget(logId, 'someone-else')).toBeNull();
  });

  it('refuses an unknown log id', async () => {
    expect(await service.resolveSnoozeTarget('does-not-exist', user.id)).toBeNull();
  });

  /** A reminder that never went out has nothing worth postponing. */
  it('refuses a slot that was claimed but not delivered', async () => {
    const due = (await service.findDueNotifications(NOW))[0]!;
    const claim = await service.claim(due);

    expect(await service.resolveSnoozeTarget(claim!.log.id, user.id)).toBeNull();
  });
});

describe('ReminderService.snooze', () => {
  let reminders: FakeReminderRepository;
  let service: ReminderService;

  beforeEach(() => {
    ({ reminders, service } = freshService());
  });

  it('schedules the delivery for the chosen number of days later', async () => {
    const { target } = await deliveredSlot(service);

    const snooze = await service.snooze({ userId: user.id, ...target, days: 3, now: NOW });

    expect(snooze.deliverAt).toEqual(new Date(NOW.getTime() + 3 * 86_400_000));
    expect(snooze.status).toBe('pending');
    // Nothing is spent up front, so a changed mind is not a spent budget.
    expect(snooze.attempts).toBe(0);
  });

  /** Tapping a different offset has to move the delivery, not add a second one. */
  it('replaces a previous snooze for the same slot', async () => {
    const { target } = await deliveredSlot(service);

    await service.snooze({ userId: user.id, ...target, days: 1, now: NOW });
    const second = await service.snooze({ userId: user.id, ...target, days: 7, now: NOW });

    expect(reminders.snoozeCount()).toBe(1);
    expect(second.deliverAt).toEqual(new Date(NOW.getTime() + 7 * 86_400_000));
  });

  /** The original was delivered; postponing it must not un-deliver it. */
  it('leaves the notification log marked as sent', async () => {
    const due = (await service.findDueNotifications(NOW))[0]!;
    const { target } = await deliveredSlot(service);

    await service.snooze({ userId: user.id, ...target, days: 1, now: NOW });

    // The duplicate-send guard relies on this staying true, so the fresh pass
    // does not re-notify while the snoozed copy is still waiting.
    expect(await service.wasSent(due)).toBe(true);
  });

  it('is not due before the chosen moment', async () => {
    const { target } = await deliveredSlot(service);
    await service.snooze({ userId: user.id, ...target, days: 7, now: NOW });

    expect(await service.findDueSnoozes(new Date(NOW.getTime() + 86_400_000))).toHaveLength(0);
  });

  it('is due once the chosen moment arrives, carrying the person', async () => {
    const { target } = await deliveredSlot(service);
    await service.snooze({ userId: user.id, ...target, days: 1, now: NOW });

    const due = await service.findDueSnoozes(new Date(NOW.getTime() + 2 * 86_400_000));

    expect(due).toHaveLength(1);
    expect(due[0]!.person.id).toBe('person1');
    expect(due[0]!.snooze.daysBefore).toBe(0);
  });

  it('stops being due once it has been delivered', async () => {
    const { target } = await deliveredSlot(service);
    const snooze = await service.snooze({ userId: user.id, ...target, days: 1, now: NOW });
    const later = new Date(NOW.getTime() + 2 * 86_400_000);

    await service.markSnoozeSent(snooze.id, later);

    expect(await service.findDueSnoozes(new Date(later.getTime() + 86_400_000))).toHaveLength(0);
  });
});
