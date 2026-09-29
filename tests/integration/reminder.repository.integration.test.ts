import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { notificationSlotKey } from '../../src/modules/reminders/reminder.types.js';
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
      expect(claimed?.sentAt).toBeInstanceOf(Date);
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

    it('releaseNotification frees the slot for the next tick', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      const slot = { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 1 };

      const first = await reminders.claimNotification(slot);
      expect(first).not.toBeNull();

      await reminders.releaseNotification(first!.id);

      expect(
        await reminders.findLog(slot.userId, slot.personId, slot.birthdayYear, slot.daysBefore),
      ).toBeNull();
      expect(await reminders.claimNotification(slot)).not.toBeNull();
    });

    it('releaseNotification is idempotent for an unknown id', async () => {
      await expect(reminders.releaseNotification('does-not-exist')).resolves.toBeUndefined();
    });
  });

  describe('findLogKeys', () => {
    it('returns an empty set when nothing was sent', async () => {
      const user = await seedUser(users);
      expect(await reminders.findLogKeys(user.id)).toEqual(new Set());
    });

    it('groups every sent slot into the same key format as wasSent', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      await reminders.claimNotification({
        userId: user.id,
        personId: person.id,
        birthdayYear: 1405,
        daysBefore: 7,
      });

      const keys = await reminders.findLogKeys(user.id);
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

      expect(await reminders.findLogKeys(second.id)).toEqual(new Set());
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
