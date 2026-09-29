import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { notificationSlotKey } from '../../src/modules/reminders/reminder.types.js';
import { RETRY_LEASE_MS } from '../../src/modules/reminders/retry.js';
import {
  db,
  disconnectTestDatabase,
  repositories,
  resetDatabase,
  seedPerson,
  seedUser,
} from './helpers/database.js';

const { users, persons, reminders } = repositories();

afterAll(disconnectTestDatabase);
beforeEach(resetDatabase);

describe('PrismaReminderRepository (real database)', () => {
  describe('claimNotification — the duplicate-send guard', () => {
    it('claims an unclaimed slot', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      const claimed = await reminders.claimNotification({
        userId: user.id,
        personId: person.id,
        birthdayYear: 1405,
        daysBefore: 0,
      });

      expect(claimed).not.toBeNull();
      expect(claimed?.daysBefore).toBe(0);
      expect(claimed?.birthdayYear).toBe(1405);
      // A claim is an intent to send, not a delivery: §3.6 leaves it `pending`
      // and only `markSent` stamps `sentAt`.
      expect(claimed?.status).toBe('pending');
      expect(claimed?.attempts).toBe(1);
      expect(claimed?.sentAt).toBeNull();
    });

    it('returns null when the same slot is claimed again', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0 };

      expect(await reminders.claimNotification(slot)).not.toBeNull();
      expect(await reminders.claimNotification(slot)).toBeNull();
    });

    it('lets exactly one of ten concurrent claims win', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 3 };

      const results = await Promise.all(
        Array.from({ length: 10 }, () => reminders.claimNotification(slot)),
      );

      const winners = results.filter((result) => result !== null);
      expect(winners).toHaveLength(1);
      expect(await db.notificationLog.count({ where: slot })).toBe(1);
    });

    it('treats different offsets as different slots', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const base = { userId: user.id, personId: person.id, birthdayYear: 1405 };

      const offsets = await Promise.all(
        [7, 3, 1, 0].map((daysBefore) => reminders.claimNotification({ ...base, daysBefore })),
      );

      expect(offsets.every((result) => result !== null)).toBe(true);
      expect(await db.notificationLog.count({ where: base })).toBe(4);
    });

    it('treats a later Jalali year as a different slot', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const base = { userId: user.id, personId: person.id, daysBefore: 0 };

      expect(await reminders.claimNotification({ ...base, birthdayYear: 1404 })).not.toBeNull();
      expect(await reminders.claimNotification({ ...base, birthdayYear: 1405 })).not.toBeNull();
    });

    /**
     * §3.6 — a failed delivery keeps its claim and becomes a retry.
     *
     * The replaced behaviour deleted the row, which freed the slot but also
     * destroyed the record that the reminder still had to be sent.
     */
    it('keeps a failed slot and schedules it for retry', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 1 };

      const claimed = await reminders.claimNotification(slot);
      expect(claimed).not.toBeNull();
      expect(claimed!.status).toBe('pending');

      const nextAttemptAt = new Date(Date.now() + 300_000);
      await reminders.scheduleRetry(claimed!.id, 1, nextAttemptAt, 'telegram 502');

      const log = await reminders.findLog(slot.userId, slot.personId, slot.birthdayYear, slot.daysBefore);
      expect(log).not.toBeNull();
      expect(log!.status).toBe('pending');
      expect(log!.attempts).toBe(1);
      expect(log!.lastError).toBe('telegram 502');
      // Still claimed: a concurrent run must not be able to double-send.
      expect(await reminders.claimNotification(slot)).toBeNull();
    });

    /** The claim stops blocking once the send succeeded. */
    it('marks a delivered slot as sent', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 1 };

      const claimed = await reminders.claimNotification(slot);
      const sentAt = new Date('2026-10-09T06:00:00.000Z');
      await reminders.markSent(claimed!.id, sentAt);

      const log = await reminders.findLog(slot.userId, slot.personId, slot.birthdayYear, slot.daysBefore);
      expect(log!.status).toBe('sent');
      expect(log!.sentAt).toEqual(sentAt);
    });

    it('reports a claimed slot as handled even while it is still pending', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 1 };

      const claimed = await reminders.claimNotification(slot);
      // A pending row is a delivery in flight that the retry pass owns. The
      // fresh pass must skip it, or it would re-claim the slot every tick.
      expect((await reminders.findHandledSlotKeys(user.id)).size).toBe(1);

      await reminders.markSent(claimed!.id, new Date());
      expect((await reminders.findHandledSlotKeys(user.id)).size).toBe(1);
    });

    it('finds only the retries whose backoff has elapsed', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const now = new Date('2026-10-09T06:00:00.000Z');

      const due = await reminders.claimNotification({
        userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0,
      });
      const waiting = await reminders.claimNotification({
        userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 7,
      });

      await reminders.scheduleRetry(due!.id, 1, new Date(now.getTime() - 1000), 'boom');
      await reminders.scheduleRetry(waiting!.id, 1, new Date(now.getTime() + 60_000), 'boom');

      const retries = await reminders.findDueRetries(now, 10);
      expect(retries).toHaveLength(1);
      expect(retries[0]!.log.id).toBe(due!.id);
      // The join has to carry the name, or a retry cannot render itself.
      expect(retries[0]!.person.name).not.toBe('');
    });

    /**
     * The fresh pass leans on a unique constraint; a retry cannot, because the
     * row it re-sends already exists. These prove the lease closes that hole in
     * the database itself, not just in the fake.
     */
    describe('leaseRetry', () => {
      async function pendingSlot(daysBefore = 0): Promise<{
        logId: string;
        now: Date;
      }> {
        const user = await seedUser(users);
        const person = await seedPerson(persons, user.id);
        const log = await reminders.claimNotification({
          userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore,
        });
        const now = new Date('2026-10-09T06:00:00.000Z');
        await reminders.scheduleRetry(log!.id, 1, new Date(now.getTime() - 1000), 'boom');
        return { logId: log!.id, now };
      }

      it('lets exactly one of ten concurrent workers lease the same retry', async () => {
        const { logId, now } = await pendingSlot();

        const results = await Promise.all(
          Array.from({ length: 10 }, () => reminders.leaseRetry(logId, now)),
        );

        expect(results.filter(Boolean)).toHaveLength(1);
      });

      it('hides the leased row from the next worker’s due query', async () => {
        const { logId, now } = await pendingSlot();
        expect(await reminders.findDueRetries(now, 10)).toHaveLength(1);

        expect(await reminders.leaseRetry(logId, now)).toBe(true);

        // This is what makes the lease work: the row is gone from the query
        // that another worker uses to find work, not merely flagged in memory.
        expect(await reminders.findDueRetries(now, 10)).toHaveLength(0);
      });

      it('releases the row again once the lease has elapsed', async () => {
        const { logId, now } = await pendingSlot();
        await reminders.leaseRetry(logId, now);

        // A crashed worker must not strand the notification forever.
        const afterLease = new Date(now.getTime() + RETRY_LEASE_MS + 1000);
        expect(await reminders.findDueRetries(afterLease, 10)).toHaveLength(1);
        expect(await reminders.leaseRetry(logId, afterLease)).toBe(true);
      });

      it('refuses to lease a row that is no longer pending', async () => {
        const { logId, now } = await pendingSlot();
        await reminders.markSent(logId, now);

        expect(await reminders.leaseRetry(logId, now)).toBe(false);
      });
    });

    it('never returns another user’s log to a snooze button', async () => {
      const owner = await seedUser(users);
      const stranger = await seedUser(users);
      const person = await seedPerson(persons, owner.id);

      const claimed = await reminders.claimNotification({
        userId: owner.id, personId: person.id, birthdayYear: 1405, daysBefore: 0,
      });

      expect(await reminders.findLogByIdForUser(claimed!.id, owner.id)).not.toBeNull();
      expect(await reminders.findLogByIdForUser(claimed!.id, stranger.id)).toBeNull();
    });

    it('ignores an unknown log id', async () => {
      const user = await seedUser(users);
      expect(await reminders.findLogByIdForUser('does-not-exist', user.id)).toBeNull();
    });
  });

  describe('snooze', () => {
    it('replaces a pending snooze instead of stacking a second one', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0 };

      const first = await reminders.upsertSnooze({ ...slot, deliverAt: new Date('2026-10-10T00:00:00.000Z') });
      const second = await reminders.upsertSnooze({ ...slot, deliverAt: new Date('2026-10-12T00:00:00.000Z') });

      expect(second.id).toBe(first.id);
      expect(second.deliverAt).toEqual(new Date('2026-10-12T00:00:00.000Z'));
      expect(await db.snooze.count({ where: { userId: user.id } })).toBe(1);
    });

    it('resets the attempt budget when a snooze is changed', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0 };

      const snooze = await reminders.upsertSnooze({ ...slot, deliverAt: new Date('2026-10-10T00:00:00.000Z') });
      await reminders.scheduleSnoozeRetry(snooze.id, 3, new Date('2026-10-10T06:00:00.000Z'), 'telegram 502');

      // The previous failure was about the old delivery time; changing the
      // delay is a new decision and deserves a full budget again.
      const again = await reminders.upsertSnooze({ ...slot, deliverAt: new Date('2026-10-11T00:00:00.000Z') });
      expect(again.attempts).toBe(0);
      expect(again.status).toBe('pending');
      expect(again.lastError).toBeNull();
    });

    it('returns due snoozes with the person attached', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const now = new Date('2026-10-09T06:00:00.000Z');

      await reminders.upsertSnooze({
        userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0,
        deliverAt: new Date(now.getTime() - 1000),
      });

      const due = await reminders.findDueSnoozes(now, 10);
      expect(due).toHaveLength(1);
      expect(due[0]!.person.id).toBe(person.id);
    });

    it('lets exactly one worker lease the same snooze', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const now = new Date('2026-10-09T06:00:00.000Z');

      const snooze = await reminders.upsertSnooze({
        userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0,
        deliverAt: new Date(now.getTime() - 1000),
      });

      const results = await Promise.all(
        Array.from({ length: 10 }, () => reminders.leaseSnooze(snooze.id, now)),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      // And the row is out of the next worker's way, same as a retry.
      expect(await reminders.findDueSnoozes(now, 10)).toHaveLength(0);
    });
  });

  describe('findHandledSlotKeys', () => {
    it('returns an empty set when nothing was ever claimed', async () => {
      const user = await seedUser(users);
      expect(await reminders.findHandledSlotKeys(user.id)).toEqual(new Set());
    });

    it('uses the same key format as wasSent', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      await reminders.claimNotification({
        userId: user.id,
        personId: person.id,
        birthdayYear: 1405,
        daysBefore: 7,
      });

      const keys = await reminders.findHandledSlotKeys(user.id);
      expect(keys).toEqual(new Set([notificationSlotKey(person.id, 1405, 7)]));
    });

    it("never leaks another user's slots", async () => {
      const first = await seedUser(users);
      const second = await seedUser(users);
      const person = await seedPerson(persons, first.id);

      await reminders.claimNotification({
        userId: first.id,
        personId: person.id,
        birthdayYear: 1405,
        daysBefore: 0,
      });

      expect(await reminders.findHandledSlotKeys(second.id)).toEqual(new Set());
    });
  });

  describe('ensureForPerson', () => {
    it('creates the requested offsets enabled', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      const created = await reminders.ensureForPerson(user.id, person.id, [7, 3, 1, 0]);

      expect(created.map((reminder) => reminder.daysBefore).sort((a, b) => b - a)).toEqual([
        7, 3, 1, 0,
      ]);
      expect(created.every((reminder) => reminder.enabled)).toBe(true);
    });

    it('is idempotent for an already existing offset', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { reminderDays: [7] });

      await reminders.ensureForPerson(user.id, person.id, [7, 3]);

      expect(await db.reminder.count({ where: { personId: person.id } })).toBe(2);
    });

    it('does not re-enable an offset the user turned off', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { reminderDays: [7] });
      const existing = await reminders.findForPerson(person.id, user.id);
      const sevenDays = existing.find((reminder) => reminder.daysBefore === 7)!;

      await reminders.setEnabled(sevenDays.id, person.id, user.id, false);
      await reminders.ensureForPerson(user.id, person.id, [7]);

      const after = await reminders.findForPerson(person.id, user.id);
      expect(after.find((reminder) => reminder.daysBefore === 7)?.enabled).toBe(false);
    });

    it('returns nothing for an empty offset list', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      expect(await reminders.ensureForPerson(user.id, person.id, [])).toEqual([]);
    });
  });

  describe('setEnabled', () => {
    it('flips the flag and returns the row', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { reminderDays: [3] });
      const [reminder] = await reminders.findForPerson(person.id, user.id);

      const updated = await reminders.setEnabled(reminder!.id, person.id, user.id, false);

      expect(updated?.enabled).toBe(false);
    });

    it('refuses to touch a reminder owned by another user', async () => {
      const owner = await seedUser(users);
      const attacker = await seedUser(users);
      const person = await seedPerson(persons, owner.id, { reminderDays: [3] });
      const [reminder] = await reminders.findForPerson(person.id, owner.id);

      expect(await reminders.setEnabled(reminder!.id, person.id, attacker.id, false)).toBeNull();
      const unchanged = await reminders.findForPerson(person.id, owner.id);
      expect(unchanged[0]?.enabled).toBe(true);
    });
  });

  describe('findEnabledForUser', () => {
    it('skips disabled offsets', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { reminderDays: [7, 3] });
      const rows = await reminders.findForPerson(person.id, user.id);
      const threeDays = rows.find((reminder) => reminder.daysBefore === 3)!;
      await reminders.setEnabled(threeDays.id, person.id, user.id, false);

      const enabled = await reminders.findEnabledForUser(user.id);
      expect(enabled.map((row) => row.daysBefore)).toEqual([7]);
    });

    it('skips soft-deleted people', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { reminderDays: [0] });

      await persons.softDelete(person.id, user.id);

      expect(await reminders.findEnabledForUser(user.id)).toEqual([]);
    });

    it('hydrates the person with interests and notes', async () => {
      const user = await seedUser(users);
      await seedPerson(persons, user.id, {
        name: 'سارا',
        notes: 'قهوه دوست دارد',
        interests: ['کتاب', 'موسیقی'],
        reminderDays: [0],
      });

      const [row] = await reminders.findEnabledForUser(user.id);

      expect(row?.person.name).toBe('سارا');
      expect(row?.person.notes).toBe('قهوه دوست دارد');
      expect(row?.person.interests.map((interest) => interest.title)).toEqual(['کتاب', 'موسیقی']);
    });

    it("never returns another user's reminders", async () => {
      const owner = await seedUser(users);
      const other = await seedUser(users);
      await seedPerson(persons, owner.id, { reminderDays: [0] });

      expect(await reminders.findEnabledForUser(other.id)).toEqual([]);
    });
  });

  describe('deleteForPerson', () => {
    it('removes every offset and reports the count', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { reminderDays: [7, 3, 1, 0] });

      expect(await reminders.deleteForPerson(person.id)).toBe(4);
      expect(await reminders.findForPerson(person.id, user.id)).toEqual([]);
    });
  });
});
